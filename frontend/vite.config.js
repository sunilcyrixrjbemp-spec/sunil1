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
        // Proxy all /api and /uploads calls to Cloudflare Worker dev server
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
    },
});
