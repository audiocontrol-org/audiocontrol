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
          'bg': '#1a1a2e',
          'panel': '#16213e',
          'accent': '#0f3460',
          'highlight': '#e94560',
          'text': '#eaeaea',
          'muted': '#7a7a7a',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
