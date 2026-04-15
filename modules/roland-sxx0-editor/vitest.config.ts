import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.{ts,tsx}', 'test/integration/**/*.test.{ts,tsx}'],
    exclude: ['test/e2e/**', 'test/ui/**', 'node_modules/**'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
