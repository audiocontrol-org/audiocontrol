import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    exclude: ['node_modules/**'],
    globals: true,
    testTimeout: 120000, // scenarios take 10-60s each
    hookTimeout: 120000, // beforeAll runs full scenarios
    sequence: {
      concurrent: false, // run describe blocks sequentially
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
