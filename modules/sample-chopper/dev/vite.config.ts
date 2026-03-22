import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';
import { fileURLToPath } from 'url';

const editorCoreDevDir = path.dirname(
  fileURLToPath(import.meta.resolve('@audiocontrol/editor-core/dev/postcss.config')),
);

const useMkcert = process.env.VISUAL_HTTP !== '1';

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    ...(useMkcert ? [mkcert({ hosts: ['localhost', 'orion-m1', 'orion-m4'] })] : []),
  ],
  css: {
    postcss: editorCoreDevDir,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3331,
    strictPort: false,
    host: true,
    allowedHosts: true,
  },
});
