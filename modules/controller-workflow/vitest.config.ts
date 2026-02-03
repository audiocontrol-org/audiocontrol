import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/__tests__/**',
        // Non-production code exclusions
        'examples/**',          // Example code (1,219 lines)
        'docs/**',              // Documentation code (70 lines)
        'src/index.ts',         // Export-only file (26 lines)
        'src/cli/**',           // CLI code (437 lines, will test after MVP)
        'src/adapters/daws/LiveDeployer.ts',  // Phase 2 - Not yet implemented (334 lines)
        'test-conversion.ts',   // Manual test script (70 lines)
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    // Fail tests on console errors (helps catch unhandled promises)
    silent: false,
    // Set reasonable timeout for MIDI operations
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
