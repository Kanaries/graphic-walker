import { defineConfig } from 'vite';
import path from 'path';
import typescript from '@rollup/plugin-typescript';

export default defineConfig({
  plugins: [
    {
      ...typescript({
        tsconfig: path.resolve(__dirname, './tsconfig.json'),
      }),
      apply: 'build',
    },
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, './src/index.tsx'),
      name: 'GraphicWalkerEChartsRenderer',
      fileName: 'graphic-walker-renderer-echarts',
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
    minify: 'esbuild',
    sourcemap: true,
  },
});
