import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // Pastikan base path benar
  build: {
    outDir: '../dist', // Pastikan output ke folder yang benar
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  define: {
    'process.env': process.env, // Untuk env variables
  },
});