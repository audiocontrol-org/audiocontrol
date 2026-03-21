import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const editorCoreDevDir = path.dirname(
  fileURLToPath(import.meta.resolve('@audiocontrol/editor-core/dev/postcss.config')),
);

const certPath = path.resolve(__dirname, 'certs/dev.crt');
const keyPath = path.resolve(__dirname, 'certs/dev.key');
const hasCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  css: {
    postcss: editorCoreDevDir,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3332,
    host: true,
    allowedHosts: ['orion-m1', 'orion-m1.local', 'orion-m1.tail8254f4.ts.net'],
    ...(hasCerts && {
      https: {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
      },
    }),
  },
});
