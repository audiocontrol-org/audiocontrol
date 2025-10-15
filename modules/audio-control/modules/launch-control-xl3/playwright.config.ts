import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/integration',
  testMatch: '**/*.playwright.test.ts',

  timeout: 30000,

  use: {
    // Base browser configuration
    browserName: 'chromium',

    // Grant permissions for MIDI access
    permissions: ['midi', 'midi-sysex'],

    // Context options
    contextOptions: {
      permissions: ['midi', 'midi-sysex'],
    },

    // Enable WebMIDI with proper feature flags
    launchOptions: {
      args: [
        '--enable-features=WebMIDI',
        '--enable-blink-features=WebMIDI',
        '--enable-experimental-web-platform-features',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chrome', // Use Chrome if available (has better MIDI support)
        permissions: ['midi', 'midi-sysex'],
        launchOptions: {
          args: [
            '--enable-features=WebMIDI',
            '--enable-blink-features=WebMIDI',
            '--enable-experimental-web-platform-features',
          ],
        },
      },
    },
  ],
});
