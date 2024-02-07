import { defineConfig } from 'vite'
import path from 'path';
import react from '@vitejs/plugin-react'
import typescript from '@rollup/plugin-typescript'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 2002,
  },
  plugins: [
    react(),
    // @ts-ignore
    {
      ...typescript({
        tsconfig: path.resolve(__dirname, './tsconfig.app-dist.json'),
      }),
      apply: 'build'
    }
  ],
  build: {
    outDir: 'app-dist',
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  }
})
