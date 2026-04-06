import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

// Prevent Vite dev server from crashing on TLS connection resets
// (common with mobile Safari dropping connections)
process.on('uncaughtException', (err) => {
  if ('code' in err && err.code === 'ECONNRESET') return;
  console.error('Uncaught exception:', err);
  process.exit(1);
});

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
    proxy: {
      '/scsi-bridge': {
        target: 'http://s3k.local:7033',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/scsi-bridge/, ''),
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
