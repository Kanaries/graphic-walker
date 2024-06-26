import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "middleware",
      apply: "serve",
      configureServer(viteDevServer) {
        return () => {
          viteDevServer.middlewares.use(async (req, res, next) => {
            if (req.originalUrl.startsWith("/examples")) {
              req.url = "/examples.html";
            } else if (req.originalUrl.startsWith("/gallery")) {
              req.url = "/gallery.html"
            }

            next();
          });
        };
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        examples: "examples.html",
        gallery: "gallery.html",
      },
    },
  },
  server: {
    port: 3000
  }
});
