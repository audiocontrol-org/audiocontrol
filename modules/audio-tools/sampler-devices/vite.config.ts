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
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'mochawesome-report/**',
        'postcss.config.cjs',
        'src/gen-s3000xl.ts' // Code generator
      ],
      all: true,
      lines: 98,
      functions: 98,
      branches: 98,
      statements: 98
    },
    testTimeout: 10000,
    hookTimeout: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'tests': resolve(__dirname, 'test')
    }
  }
});
