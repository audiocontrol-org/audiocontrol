import type { Config } from 'tailwindcss';
import editorCorePreset from '@audiocontrol/editor-core/tailwind-preset';

export default {
  presets: [editorCorePreset],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../editor-core/src/**/*.{js,ts,jsx,tsx}',
    '../loop-editor/src/**/*.{js,ts,jsx,tsx}',
    '../sample-chopper/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Roland S-330 inspired color palette (device-specific)
        's330': {
          'bg': 'var(--ac-bg-primary)',
          'panel': 'var(--ac-bg-panel)',
          'accent': 'var(--ac-border)',
          'highlight': 'var(--ac-highlight)',
          'secondary': 'var(--ac-highlight-secondary)',
          'text': 'var(--ac-text-primary)',
          'muted': 'var(--ac-text-muted)',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
