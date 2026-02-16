import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    css: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'src/s3k.ts',
        'src/s5k.ts',
        'src/specs.ts',
        'src/jv1080.ts',
        'src/devices/jv1080/*.ts',
        'src/devices/s330/s330-addresses.ts',
        'src/devices/s330/s330-front-panel.ts',
        'src/devices/s330/s330-parameter-listener.ts',
        'src/devices/s330/s330-params.ts',
        'src/devices/s56k*.ts',
      ],
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
      '@': resolve(__dirname, 'src'),
      'tests': resolve(__dirname, 'test')
    }
  }
});
