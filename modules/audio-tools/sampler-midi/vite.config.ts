import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    })
  ],
  css: false, // Disable CSS processing for Node.js library
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts')
      },
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: [
        '@oletizi/sampler-devices',
        '@oletizi/sampler-lib',
        'easymidi',
        'pathe',
        // Node.js built-ins
        'module',
        'fs',
        'fs/promises',
        'path',
        'util',
        'os',
        'stream',
        'buffer',
        'process',
        'child_process'
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
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 5000,
    hookTimeout: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'tests': resolve(__dirname, 'test')
    }
  }
});
