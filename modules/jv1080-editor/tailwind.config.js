/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
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
};
