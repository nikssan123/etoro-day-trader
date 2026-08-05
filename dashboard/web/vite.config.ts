import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    port: 5173,
    // In dev the API runs separately; in production the same Express process serves both.
    proxy: { '/api': 'http://localhost:8080' },
  },
});
