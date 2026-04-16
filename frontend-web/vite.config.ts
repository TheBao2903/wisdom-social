import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        // Tailwind sẽ tự đọc cấu hình mặc định của project, không cần truyền config ở đây.
        tailwindcss(),
    ],
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
            // Proxy riêng cho SockJS/WebSocket handshake để tránh lỗi CORS khi dev.
            "/ws": {
                target: "http://localhost:8080",
                changeOrigin: true,
                ws: true,
            },
        },
    },
    define: {
        global: "globalThis",
    },
});