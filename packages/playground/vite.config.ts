import { defineConfig } from "vite";
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from "@vitejs/plugin-react";
import { DEMO_DATASETS, downloadDemoDataset } from '../../scripts/demo-datasets.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const demoDatasetDownloads = new Map<string, Promise<Buffer>>();

function demoDatasetFallbackPlugin() {
  const datasetDir = path.resolve(__dirname, 'public/datasets');

  return {
    name: 'demo-dataset-fallback',
    apply: 'serve' as const,
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        const filename = path.basename(pathname);

        if (!pathname.startsWith('/datasets/') || !DEMO_DATASETS.includes(filename)) {
          next();
          return;
        }

        try {
          let buffer = await fs.readFile(path.join(datasetDir, filename)).catch(() => undefined);

          if (!buffer) {
            let download = demoDatasetDownloads.get(filename);

            if (!download) {
              download = downloadDemoDataset(filename, datasetDir);
              demoDatasetDownloads.set(filename, download);
            }

            buffer = await download;
            demoDatasetDownloads.delete(filename);
            server.config.logger.info(`Cached demo dataset: /datasets/${filename}`);
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(buffer);
        } catch (error) {
          demoDatasetDownloads.delete(filename);
          next(error);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    demoDatasetFallbackPlugin(),
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
