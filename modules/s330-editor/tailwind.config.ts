import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Roland S-330 inspired color palette
        's330': {
          'bg': 'var(--ac-bg-primary)',
          'panel': 'var(--ac-bg-panel)',
          'accent': 'var(--ac-border)',
          'highlight': 'var(--ac-status-danger)',
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
