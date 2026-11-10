import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const packageRoot = path.resolve(__dirname, '../..');
const workspaceRoot = path.resolve(packageRoot, '../..');

export default defineConfig({
    root: packageRoot,
    publicDir: false,
    logLevel: 'error',
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(packageRoot, 'src'),
            // Read only by native-preview/, which the native renderer fixture loads the way the dev server does.
            '@kanaries/worksheet-renderer': path.resolve(packageRoot, '../worksheet-renderer/src/index.ts'),
        },
    },
    build: {
        outDir: path.resolve(workspaceRoot, 'node_modules/.cache/graphic-walker-e2e'),
        emptyOutDir: true,
        rollupOptions: {
            input: [path.resolve(__dirname, 'issue-501.html'), path.resolve(__dirname, 'native-renderer.html')],
        },
    },
    preview: {
        host: '127.0.0.1',
        port: 4175,
        strictPort: true,
    },
});
