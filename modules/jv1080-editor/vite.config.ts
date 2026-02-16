import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/roland/jv1080/editor/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3108,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
