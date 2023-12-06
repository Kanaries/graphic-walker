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
      },
    },
  },
});
