import { defineConfig } from "vite";
import reactSwc from "@vitejs/plugin-react-swc";
import deno from "@deno/vite-plugin";
import { env } from "./parse-env.ts";

export default defineConfig({
  server: {
    port: env().PORT,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${env().API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [reactSwc(), deno()],
});
