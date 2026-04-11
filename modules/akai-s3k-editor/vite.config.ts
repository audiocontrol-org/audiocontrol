import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';

// Prevent Vite dev server from crashing on connection drops
// (common with mobile browsers dropping WebSocket/TLS connections)
const IGNORABLE_ERRORS = new Set(['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ERR_STREAM_WRITE_AFTER_END']);
process.on('uncaughtException', (err) => {
  if ('code' in err && IGNORABLE_ERRORS.has(err.code as string)) return;
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
        // Use IPv4 explicitly — s3k.local resolves to IPv6 which times out
        target: 'http://10.0.0.57:7033',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/scsi-bridge/, ''),
        ws: true,
      },
    },
  },
  preview: {
    proxy: {
      '/scsi-bridge': {
        // Use IPv4 explicitly — s3k.local resolves to IPv6 which times out
        target: 'http://10.0.0.57:7033',
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
