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
      include: [
        'src/lib/utils/akai-encoding.ts',
        'src/lib/utils/mtools-binary.ts',
        'src/lib/converters/s5k-to-sfz.ts',
        'src/lib/converters/s5k-to-decentsampler.ts'
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
    alias: [
      { find: /^@\/lib\//, replacement: `${resolve(__dirname, 'src/lib')}/` },
      { find: /^@\//, replacement: `${resolve(__dirname, 'src/lib')}/` },
    ]
  }
});
