import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const editorCoreDevDir = path.dirname(
  fileURLToPath(import.meta.resolve('@audiocontrol/editor-core/dev/postcss.config')),
);

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
    allowedHosts: ['orion-m1', 'orion-m1.local'],
  },
});
