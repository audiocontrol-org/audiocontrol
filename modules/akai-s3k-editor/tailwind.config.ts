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
    '../sample-editor/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        's3k': {
          'bg': 'var(--ac-bg-primary)',
          'panel': 'var(--ac-bg-panel)',
          'accent': 'var(--ac-border)',
          'highlight': 'var(--ac-highlight)',
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
