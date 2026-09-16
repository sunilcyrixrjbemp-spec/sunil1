import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        host: true,
        port: 5173,
        // Proxy all /api and /uploads calls to Cloudflare Worker
        proxy: {
            '/api': {
                target: 'https://fieldops-api.sunilbishnoi.workers.dev',
                changeOrigin: true,
                secure: true,
            },
            '/uploads': {
                target: 'https://fieldops-api.sunilbishnoi.workers.dev',
                changeOrigin: true,
                secure: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
    },
});
