import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

export default defineConfig({
  base: '/roland/s330/editor/',
  plugins: [
    react(),
    mkcert({
      hosts: ['localhost', 'orion-m1', 'orion-m4'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3330,
    host: true,
    allowedHosts: ['orion-m1', 'orion-m4'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
