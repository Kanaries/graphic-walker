import { defineConfig } from 'vite'
import path from 'path';
import react from '@vitejs/plugin-react'
import typescript from '@rollup/plugin-typescript'
import { peerDependencies } from './package.json'


// @see https://styled-components.com/docs/faqs#marking-styledcomponents-as-external-in-your-package-dependencies
const modulesNotToBundle = Object.keys(peerDependencies);

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
        },
      },
    },
    minify: 'esbuild',
    sourcemap: true,
  }
})
