import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    proxy: {
      // Proxy OCR Space requests to avoid CORS in development.
      // In production, call the API from a backend or a trusted server-side origin.
      "/ocr-proxy": {
        target: "https://api.ocr.space",
        changeOrigin: true,
        rewrite: () => "/parse/image",
      },
    },
  },
});
