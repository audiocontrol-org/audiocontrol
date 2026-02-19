import type { Config } from 'tailwindcss';
import editorCorePreset from '@audiocontrol/editor-core/tailwind-preset';

export default {
  presets: [editorCorePreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../editor-core/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // D-110 inspired color scheme (device-specific)
        'd110': {
          bg: 'var(--ac-bg-primary)',
          panel: 'var(--ac-bg-panel)',
          surface: 'color-mix(in srgb, var(--ac-bg-panel) 88%, black)',
          text: 'var(--ac-text-primary)',
          muted: 'var(--ac-text-muted)',
          accent: 'var(--ac-highlight)',
          highlight: 'var(--ac-status-selected)',
          border: 'var(--ac-border)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
