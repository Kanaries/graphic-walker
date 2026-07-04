import { defineConfig } from 'vite'
import fs from 'node:fs/promises';
import path from 'path';
import react from '@vitejs/plugin-react'
import typescript from '@rollup/plugin-typescript'
import { peerDependencies } from './package.json'
import { DEMO_DATASETS, downloadDemoDataset } from '../../scripts/demo-datasets.mjs';


// @see https://styled-components.com/docs/faqs#marking-styledcomponents-as-external-in-your-package-dependencies
const modulesNotToBundle = Object.keys(peerDependencies).concat(["react-dom/client", "react-dom/server"]);
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
  server: {
    port: 2002,
  },
  plugins: [
    demoDatasetFallbackPlugin(),
    react(),
    // @ts-ignore
    {
      ...typescript({
        tsconfig: path.resolve(__dirname, './tsconfig.json'),
      }),
      apply: 'build'
    }
  ],
  resolve: {
    dedupe: modulesNotToBundle,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.tsx'),
      name: 'GraphicWalker',
      fileName: (format) => `graphic-walker.${format}.js`
    },
    rollupOptions: {
      external: modulesNotToBundle,
      output: {
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
          'styled-components': 'styled',
          'react-dom/client': 'ReactDOMClient',
          'react-dom/server': 'ReactDOMServer',
        },
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  }
})
