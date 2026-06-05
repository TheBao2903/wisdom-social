import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const proxyTarget = env.VITE_DEV_PROXY_TARGET || "http://localhost:8080";

    return {
        plugins: [
            react(),
            // Tailwind sẽ tự đọc cấu hình mặc định của project, không cần truyền config ở đây.
            tailwindcss(),
        ],
        server: {
            proxy: {
                "/api": {
                    target: proxyTarget,
                    changeOrigin: true,
                },
                // Proxy riêng cho SockJS/WebSocket handshake để tránh lỗi CORS khi dev.
                "/ws": {
                    target: proxyTarget,
                    changeOrigin: true,
                    ws: true,
                },
            },
        },
        define: {
            global: "globalThis",
        },
    };
});
