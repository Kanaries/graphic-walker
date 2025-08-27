import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './src/demo',
  publicDir: '../../public',
  build: {
    outDir: '../../dist-demo',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@lib': resolve(__dirname, './src/lib'),
      '@demo': resolve(__dirname, './src/demo')
    }
  },
  server: {
    port: 3000
  }
})
