import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli/index.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'midi',
        '@midival/core',
        'commander',
        'inquirer',
        'ora',
        'chalk',
        'js-yaml',
        'zod',
        // Node.js built-ins
        'module',
        'fs',
        'path',
        'util',
        'os',
        'stream',
        'buffer',
        'process'
      ],
      output: {
        preserveModules: false,
        entryFileNames: '[name].js'
      }
    },
    target: 'node18',
    minify: false,
    sourcemap: true
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/cli/**' // CLI is tested with integration tests
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});