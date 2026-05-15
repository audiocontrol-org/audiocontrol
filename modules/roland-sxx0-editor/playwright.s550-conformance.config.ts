import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.http-midi.config';

export default defineConfig({
  ...baseConfig,
  testMatch: 's550-*.spec.ts',
});
