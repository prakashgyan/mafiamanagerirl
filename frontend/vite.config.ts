import { defineConfig, loadEnv } from "vite";
// @ts-expect-error -- plugin resolution is handled by Vite during runtime
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyTarget = env.VITE_API_BASE && env.VITE_API_BASE.trim() !== ""
    ? env.VITE_API_BASE
    : "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "")
        }
      }
    },
    preview: {
      port: 4173
    }
  };
});
