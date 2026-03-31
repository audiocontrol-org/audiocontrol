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
    extend: {},
  },
  plugins: [],
} satisfies Config;
