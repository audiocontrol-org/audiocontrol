import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    css: false,
    include: ['test/unit/**/*.test.ts'], // Only unit tests by default
    exclude: ['test/integration/**'],    // Exclude integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'postcss.config.cjs',
        'src/cli/**' // CLI tested via integration
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
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
