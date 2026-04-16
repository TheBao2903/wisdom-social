import axios, { type AxiosInstance } from "axios";
import { getCookie, setCookie, clearAuthStorage } from "../utils/cookies";

const API_BASE_URL = "/api";

const TOKEN_TTL_DAYS = 1/24;
const REFRESH_MARGIN = 5 * 60 * 1000; 
const EXPIRES_COOKIE = 'tokenExpiresAt';
const ACCESS_COOKIE  = 'accessToken';

// Instance chính — có interceptor
const axiosClient: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

// Instance riêng để gọi refresh — KHÔNG có interceptor, tránh vòng lặp
const axiosRefresh: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // cần để gửi refreshToken cookie lên backend
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

// ─── Public endpoints ──────────────────────────────────────────────────────────

const PUBLIC_ENDPOINTS = [
    '/auth/login',
    '/auth/register',
    '/auth/confirm',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh',
    '/session/qr-login/create',
    '/session/qr-login/status/:sessionId',
    '/session/qr-login/access-token/:sessionId',
    '/session/qr-login/access-token',
];

const isPublicEndpoint = (url?: string): boolean => {
    if (!url) return false;
    return PUBLIC_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// ─── Cookie helpers ────────────────────────────────────────────────────────────

export function saveAccessToken(token: string): void {
    const expiresAt = Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    setCookie(ACCESS_COOKIE,  token,             TOKEN_TTL_DAYS);
    setCookie(EXPIRES_COOKIE, String(expiresAt), TOKEN_TTL_DAYS);
}

function isTokenExpiringSoon(): boolean {
    const raw = getCookie(EXPIRES_COOKIE);
    if (!raw) return true;
    return Date.now() >= Number(raw) - REFRESH_MARGIN;
}

// ─── Token refresh (deduplication) ────────────────────────────────────────────

let isRefreshing    = false;
let refreshPromise: Promise<boolean> | null = null;

async function doRefreshToken(): Promise<boolean> {
    try {
        const isQrAuth = localStorage.getItem('type') === 'qr';

        // Dùng axiosRefresh (không có interceptor) để tránh vòng lặp
        const response = await axiosRefresh.get<string>(
            isQrAuth ? '/session/qr-login/access-token' : '/auth/refresh',
            { timeout: 15000 }
        );

        const newToken = typeof response.data === 'string'
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

    isRefreshing   = true;
    refreshPromise = doRefreshToken().finally(() => {
        isRefreshing   = false;
        refreshPromise = null;
    });

    return refreshPromise;
}

// ─── Request interceptor ──────────────────────────────────────────────────────

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

// ─── Response interceptor ─────────────────────────────────────────────────────

axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const config = error.config;

        if (isPublicEndpoint(config?.url)) {
            return Promise.reject(error);
        }

        if (status === 401 && config && !config._retry) {
            config._retry = true;

            const ok = await ensureFreshToken();
            if (ok) {
                return axiosClient(config);
            }

            clearAuthStorage();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default axiosClient;