import { defineConfig } from "vite";
import reactSwc from "@vitejs/plugin-react-swc";
import deno from "@deno/vite-plugin";

export default defineConfig({
  server: {
    port: 13000,
    proxy: {
      "/api": {
        target: "http://localhost:15000",
        changeOrigin: true,
      },
    },
  },
  plugins: [reactSwc(), deno()],
});
