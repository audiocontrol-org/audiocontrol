import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    // Handle tsconfig paths from workspace dependencies when resolving source files
    tsconfigPaths({
      projects: [
        resolve(__dirname, 'tsconfig.json'),
        resolve(__dirname, '../sampler-devices/tsconfig.json'),
      ],
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
      ],
    },
  },
  resolve: {
    // Use "development" condition to resolve workspace dependencies to source files
    // This allows tests to run without requiring dist/ to exist
    conditions: ['development', 'import', 'module', 'default'],
  },
});
