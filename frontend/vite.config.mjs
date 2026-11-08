import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [react()],
  server: {
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.FRONTEND_PORT || 5176),
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT || 4001}`, changeOrigin: false } }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
