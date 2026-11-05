/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:3000';
// VITE_DEMO=1 → גרסת דמו ללא שרת: base יחסי (ניתנת לפרסום מכל נתיב) ותיקיית פלט נפרדת
const IS_DEMO = Boolean(process.env.VITE_DEMO);

export default defineConfig({
  base: IS_DEMO ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: IS_DEMO ? 'dist-demo' : 'dist',
    sourcemap: false,
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
