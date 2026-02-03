import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LaunchControlXL3',
      fileName: 'launch-control-xl3.browser',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      external: [],  // Bundle everything for browser
      output: {
        globals: {}
      }
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
    outDir: 'dist/browser'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
