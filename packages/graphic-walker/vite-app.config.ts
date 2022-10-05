import { defineConfig } from 'vite'
import path from 'path';
import reactRefresh from '@vitejs/plugin-react-refresh'
import typescript from '@rollup/plugin-typescript'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 2002,
  },
  plugins: [
    // @ts-ignore
    reactRefresh(),
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
  }
})
