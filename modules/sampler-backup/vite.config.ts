import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      entryRoot: 'src',
      outDir: 'dist',
      rollupTypes: true,
      pathsToAliases: true,
    })
  ],
  css: false, // Disable CSS processing for Node.js library
  build: {
    lib: {
      entry: {
        'lib/index': resolve(__dirname, 'src/lib/index.ts'),
        'cli/backup': resolve(__dirname, 'src/cli/backup.ts'),
        'cli/migrate': resolve(__dirname, 'src/cli/migrate.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'commander',
        'pathe',
        'inquirer',
        '@audiocontrol/sampler-devices',
        '@audiocontrol/sampler-lib',
        '@audiocontrol/audiotools-config',
        '@audiocontrol/lib-device-uuid',
        // Node.js built-ins (both with and without node: prefix)
        'module',
        'fs',
        'fs/promises',
        'path',
        'util',
        'os',
        'stream',
        'buffer',
        'process',
        'child_process',
        'node:module',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:util',
        'node:os',
        'node:stream',
        'node:buffer',
        'node:process',
        'node:child_process'
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
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'test/device/**',
      'src/lib/device/auto-detect-backup.test.ts',
      'test/unit/borg-backup-adapter.test.ts',
      'test/unit/sources/remote-source.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/lib/backup/repo-path-resolver.ts',
        'src/lib/media/media-detector.ts',
        'src/lib/backup/local-backup-adapter.ts',
        'src/lib/backup/rsync-adapter.ts',
        'src/lib/sources/backup-source-factory.ts',
        'src/lib/sources/local-source.ts',
        'src/lib/prompt/interactive-prompt.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/cli/**' // CLI tested with integration tests
      ]
    },
    testTimeout: 5000,
    hookTimeout: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/backup': resolve(__dirname, 'src/lib/backup')
    }
  }
});
