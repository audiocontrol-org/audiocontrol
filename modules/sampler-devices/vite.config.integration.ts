import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'test/unit/**'],
    testTimeout: 60000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'tests': resolve(__dirname, 'test'),
    },
  },
});
