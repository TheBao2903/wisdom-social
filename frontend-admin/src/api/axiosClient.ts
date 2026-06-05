import axios, { type AxiosInstance } from 'axios';
import { clearAuthStorage, getCookie, setCookie } from '../utils/cookies';
import { recordRequestOutcome } from '../services/auditLogService';

const API_BASE_URL = '/api';
const TOKEN_TTL_DAYS = 1 / 24;
const REFRESH_MARGIN = 5 * 60 * 1000;
const ACCESS_COOKIE = 'accessToken';
const EXPIRES_COOKIE = 'tokenExpiresAt';

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/confirm',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
];

const isPublicEndpoint = (url?: string) =>
  !!url && PUBLIC_ENDPOINTS.some((e) => url.includes(e));

const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'admin-console',
  },
});

const axiosRefresh: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client': 'admin-console',
  },
});

export function saveAccessToken(token: string): void {
  const expiresAt = Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
  setCookie(ACCESS_COOKIE, token, TOKEN_TTL_DAYS);
  setCookie(EXPIRES_COOKIE, String(expiresAt), TOKEN_TTL_DAYS);
}

function isTokenExpiringSoon(): boolean {
  const raw = getCookie(EXPIRES_COOKIE);
  if (!raw) return true;
  return Date.now() >= Number(raw) - REFRESH_MARGIN;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function doRefreshToken(): Promise<boolean> {
  try {
    const response = await axiosRefresh.get<string>('/auth/refresh', { timeout: 15000 });
    const newToken =
      typeof response.data === 'string'
        ? response.data.replace(/^"|"$/g, '').trim()
        : null;
    if (!newToken || newToken.length < 20) return false;
    saveAccessToken(newToken);
    return true;
  } catch {
    return false;
  }
}

async function ensureFreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = doRefreshToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

axiosClient.interceptors.request.use(
  async (config) => {
    if (isPublicEndpoint(config.url)) return config;
    if (isTokenExpiringSoon()) {
      await ensureFreshToken();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => {
    recordRequestOutcome({
      method: response.config?.method,
      url: response.config?.url,
      body: response.config?.data,
      status: 'SUCCESS',
      statusCode: response.status,
    });
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const config = error.config;
    if (isPublicEndpoint(config?.url)) {
      // Ghi nhận đăng nhập thất bại (sự kiện bảo mật quan trọng)
      if (config?.url?.includes('/auth/login')) {
        recordRequestOutcome({
          method: config.method,
          url: config.url,
          body: config.data,
          status: 'FAILED',
          statusCode: status,
          errorMessage: error.response?.data?.message || error.message,
        });
      }
      return Promise.reject(error);
    }

    // Ghi log thất bại (trừ 401 sẽ được thử lại bên dưới)
    if (config && !(status === 401 && !config._retry)) {
      recordRequestOutcome({
        method: config.method,
        url: config.url,
        body: config.data,
        status: 'FAILED',
        statusCode: status,
        errorMessage: error.response?.data?.message || error.message,
      });
    }

    if (status === 401 && config && !config._retry) {
      config._retry = true;
      const ok = await ensureFreshToken();
      if (ok) return axiosClient(config);
      clearAuthStorage();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
