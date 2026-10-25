import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { backendPlugin } from "./server/vite-plugin.js";
export default defineConfig({
  plugins: [backendPlugin(), react(), tailwindcss()],
  optimizeDeps: { entries: ["index.html"] },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 400,
      ignored: ["**/test-results/**", "**/legacy/**"],
    },
  },
});
