import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/roland/d110/editor/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3110,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
