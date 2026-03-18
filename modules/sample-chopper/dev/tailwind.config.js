/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './dev/**/*.{tsx,ts,html}',
    './src/ui/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {
      colors: {
        'ac-bg': 'var(--ac-bg)',
        'ac-panel': 'var(--ac-panel)',
        'ac-text': 'var(--ac-text)',
        'ac-muted': 'var(--ac-muted)',
        'ac-accent': 'var(--ac-accent)',
        'ac-highlight': 'var(--ac-highlight)',
      },
      accentColor: {
        'ac-highlight': 'var(--ac-highlight)',
      },
    },
  },
  plugins: [],
};
