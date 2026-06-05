const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const backendOrigin = trimTrailingSlash(
    import.meta.env.VITE_BACKEND_ORIGIN || "http://localhost:8080",
);

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "/api";

export const BACKEND_ORIGIN = backendOrigin;

export const SOCKJS_URL =
    import.meta.env.VITE_SOCKJS_URL || `${BACKEND_ORIGIN}/ws`;
