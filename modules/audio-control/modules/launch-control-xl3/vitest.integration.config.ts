import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable globals for better test experience
    globals: true,
    environment: 'node',

    // No parallel execution for hardware tests (only one device)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid device conflicts
      },
    },

    // Longer timeouts for hardware operations
    testTimeout: 30000,  // 30s for hardware operations
    hookTimeout: 15000,  // 15s for setup/teardown

    // Only include integration tests
    include: [
      'test/integration/**/*.test.ts',
      '**/*.integration.test.ts',
    ],

    // Exclude everything else
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**',
      '**/test-pages/**',
      // Exclude unit tests
      'test/unit/**',
      'test/core/**',
      'test/device/**',
      'test/utils/**',
    ],

    // Mock and setup configuration
    clearMocks: true,
    restoreMocks: true,

    // Reporter configuration for hardware tests
    reporter: 'verbose',

    // No retries for hardware tests (let failures show real issues)
    retry: 0,

    // No bail - run all hardware tests even if one fails
    bail: 0,

    // Allow tests to be skipped based on environment
    passWithNoTests: false,
  },

  // Path resolution for @/ imports
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Optimize build performance
  esbuild: {
    target: 'node18',
    format: 'esm',
  },

  // Define environment variables for tests
  define: {
    __TEST__: true,
    __DEV__: false,
  },
});
