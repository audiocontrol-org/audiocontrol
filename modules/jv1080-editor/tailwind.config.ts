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
        // JV-1080 inspired color scheme (device-specific)
        jv1080: {
          bg: 'var(--ac-bg-primary)',
          panel: 'var(--ac-bg-panel)',
          border: 'var(--ac-border)',
          text: 'var(--ac-text-primary)',
          muted: 'var(--ac-text-muted)',
          accent: 'var(--ac-highlight)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
