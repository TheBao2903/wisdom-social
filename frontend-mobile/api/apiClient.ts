import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import {
    clearStorage,
    getIdToken,
    getRefreshToken,
    saveIdToken,
} from "@/utils/storage";

function resolveExpoLanHost(): string | null {
    const hostUri =
        (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
        (
            Constants as unknown as {
                manifest?: { debuggerHost?: string };
                manifest2?: {
                    extra?: {
                        expoClient?: { hostUri?: string };
                    };
                };
            }
        ).manifest2?.extra?.expoClient?.hostUri ??
        (
            Constants as unknown as {
                manifest?: { debuggerHost?: string };
            }
        ).manifest?.debuggerHost;

    if (!hostUri || typeof hostUri !== "string") return null;

    const lanHost = hostUri.split(":")[0]?.trim();
    return lanHost || null;
}

const EXPO_LAN_HOST = resolveExpoLanHost();

const API_URL = Platform.select({
    android: EXPO_LAN_HOST
        ? `http://${EXPO_LAN_HOST}:8080/api`
        : "http://10.0.2.2:8080/api",
    ios: EXPO_LAN_HOST
        ? `http://${EXPO_LAN_HOST}:8080/api`
        : "http://192.168.1.153:8080/api",
    default: EXPO_LAN_HOST
        ? `http://${EXPO_LAN_HOST}:8080/api`
        : "http://192.168.1.153:8080/api",
});

const PUBLIC_ENDPOINTS = [
    "/auth/login",
    "/auth/register",
    "/auth/confirm",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/session/qr-login/confirm",
    "/session/qr-login/reject",
];

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 15000,
    headers: {
        "Content-Type": "application/json",
    },
});

const isPublicEndpoint = (url?: string): boolean => {
    if (!url) return false;
    return PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

const decodeJwtPayload = (token: string): { exp?: number } | null => {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (payload.length % 4 !== 0) payload += "=";

        if (!globalThis.atob) {
            return null;
        }

        const decoded = globalThis.atob(payload);
        return JSON.parse(decoded);
    } catch {
        return null;
    }
};

const isTokenExpiringSoon = (token: string, marginSeconds = 60): boolean => {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
    const expiresAt = payload.exp * 1000;
    return Date.now() >= expiresAt - marginSeconds * 1000;
};

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const doRefreshToken = async (): Promise<string | null> => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
        const refreshResponse = await axios.get(`${API_URL}/auth/refresh`, {
            headers: {
                Cookie: `refreshToken=${refreshToken}`,
            },
            timeout: 15000,
        });

        let newIdToken: string = refreshResponse.data;

        if (typeof newIdToken === "object" && newIdToken !== null) {
            newIdToken =
                (newIdToken as { data?: string; idToken?: string }).data ??
                (newIdToken as { idToken?: string }).idToken ??
                "";
        }

        if (typeof newIdToken === "string") {
            newIdToken = newIdToken.replace(/^"|"$/g, "").trim();
        }

        if (!newIdToken || newIdToken.length < 20) {
            return null;
        }

        await saveIdToken(newIdToken);
        return newIdToken;
    } catch {
        return null;
    }
};

const ensureFreshToken = async (): Promise<string | null> => {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = doRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
    });

    return refreshPromise;
};

apiClient.interceptors.request.use(
    async (config) => {
        if (isPublicEndpoint(config.url)) {
            return config;
        }

        try {
            let idToken = await getIdToken();
            const refreshToken = await getRefreshToken();

            if (idToken && isTokenExpiringSoon(idToken, 60)) {
                const newToken = await ensureFreshToken();
                if (newToken) {
                    idToken = newToken;
                }
            }

            const cookieParts: string[] = [];
            if (idToken) cookieParts.push(`accessToken=${idToken}`);
            if (refreshToken) cookieParts.push(`refreshToken=${refreshToken}`);

            if (cookieParts.length > 0) {
                config.headers.Cookie = cookieParts.join("; ");
            }
        } catch {
            // Best effort for auth header injection.
        }

        return config;
    },
    (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        if (
            (status === 401 || status === 403) &&
            !originalRequest?._retry &&
            !isPublicEndpoint(originalRequest?.url)
        ) {
            originalRequest._retry = true;

            try {
                const newIdToken = await ensureFreshToken();
                if (newIdToken) {
                    const refreshToken = await getRefreshToken();
                    originalRequest.headers.Cookie = `accessToken=${newIdToken}; refreshToken=${refreshToken || ""}`;
                    return apiClient(originalRequest);
                }
                await clearStorage();
            } catch {
                await clearStorage();
            }
        }

        return Promise.reject(error);
    },
);

export default apiClient;
