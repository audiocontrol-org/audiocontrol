import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

const useMkcert = process.env.VISUAL_HTTP !== '1';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    ...(useMkcert
      ? [mkcert({
          hosts: ['localhost', 'orion-m1', 'orion-m4'],
        })]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3300,
    host: true,
    allowedHosts: ['orion-m1', 'orion-m4'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
