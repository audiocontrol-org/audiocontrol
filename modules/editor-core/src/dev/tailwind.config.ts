import type { Config } from 'tailwindcss';
import path from 'path';
import { fileURLToPath } from 'url';
import editorCorePreset from '../tailwind.preset';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = path.resolve(__dirname, '../../..');

/**
 * Shared Tailwind config for dev harnesses.
 *
 * Extends the editor-core preset with s330-* color mappings so shared
 * components render correctly outside of sampler-editor. Each dev harness
 * points its PostCSS config here instead of maintaining its own copy.
 *
 * Content paths use absolute paths computed from this file's location
 * because Tailwind resolves globs relative to the config file, not the
 * consuming module's working directory.
 */
export default {
  presets: [editorCorePreset],
  content: [
    path.join(modulesDir, '*/dev/**/*.{js,ts,jsx,tsx,html}'),
    path.join(modulesDir, '*/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
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
