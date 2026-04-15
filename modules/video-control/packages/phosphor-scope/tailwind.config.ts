import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        phosphor: {
          green: '#39ff14',
          amber: '#ffbf00',
          blue: '#00d4ff',
          white: '#ffffff',
        },
        crt: {
          bg: '#0a0a0a',
          panel: '#141414',
          border: '#2a2a2a',
        },
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'monospace'],
        display: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
