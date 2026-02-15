import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    css: false,
    // Use include pattern that can be overridden by CLI filters
    include: ['test/**/*.test.ts'],
    // Exclude integration by default
    exclude: ['node_modules/**', 'dist/**', 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'src/lib-akai-mpc.ts',
        'src/lib-midi.ts',
        'src/lib-decent.ts',
        'src/lib-translate.ts'
      ],
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
      branches: 80,
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
