import { defineConfig } from "vite";
export default defineConfig({
  root: "web",
  build: { outDir: "../public", emptyOutDir: true },
  server: {
    port: 5179,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8019" },
  },
});
