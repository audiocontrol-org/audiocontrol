import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'postcss.config.cjs'
      ],
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90
    },
    testTimeout: 10000,
    hookTimeout: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
