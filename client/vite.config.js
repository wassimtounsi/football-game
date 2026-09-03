import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// L'URL du backend en dev et en prod (variable d'env par défaut)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});