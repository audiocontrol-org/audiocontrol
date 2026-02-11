/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // D-110 inspired color scheme (silver/gray hardware)
        'd110': {
          bg: '#1a1a1e',
          panel: '#252529',
          surface: '#2d2d33',
          text: '#e8e8ec',
          muted: '#8b8b94',
          accent: '#6b9bd1',
          highlight: '#89c4f4',
          border: '#3d3d44',
        },
      },
    },
  },
  plugins: [],
};
