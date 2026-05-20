import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset for audiocontrol editors
 *
 * Provides consistent color mappings to CSS custom properties defined in tokens.css
 * Each editor can extend this preset with device-specific customizations.
 */
export default {
  theme: {
    extend: {
      colors: {
        ac: {
          bg: 'var(--ac-bg-primary)',
          panel: 'var(--ac-bg-panel)',
          border: 'var(--ac-border)',
          text: 'var(--ac-text-primary)',
          muted: 'var(--ac-text-muted)',
          accent: 'var(--ac-highlight)',
          'accent-secondary': 'var(--ac-highlight-secondary)',
        },
        'ac-surface': {
          canvas: 'var(--ac-color-surface-canvas)',
          panel: 'var(--ac-color-surface-panel)',
        },
        'ac-status': {
          connected: 'var(--ac-status-connected)',
          warning: 'var(--ac-status-warning)',
          danger: 'var(--ac-status-danger)',
          selected: 'var(--ac-status-selected)',
        },
      },
      fontFamily: {
        sans: ['var(--ac-font-body)'],
        mono: ['var(--ac-font-mono)'],
      },
      spacing: {
        'ac-1': 'var(--ac-space-1)',
        'ac-2': 'var(--ac-space-2)',
        'ac-3': 'var(--ac-space-3)',
        'ac-4': 'var(--ac-space-4)',
        'ac-6': 'var(--ac-space-6)',
        'ac-8': 'var(--ac-space-8)',
      },
      borderRadius: {
        'ac-sm': 'var(--ac-radius-sm)',
        'ac-md': 'var(--ac-radius-md)',
        'ac-lg': 'var(--ac-radius-lg)',
      },
      transitionDuration: {
        'ac-fast': 'var(--ac-duration-fast)',
        'ac-normal': 'var(--ac-duration-normal)',
        'ac-slow': 'var(--ac-duration-slow)',
      },
      transitionTimingFunction: {
        'ac-default': 'var(--ac-easing-default)',
        'ac-emphasized': 'var(--ac-easing-emphasized)',
      },
    },
  },
} satisfies Partial<Config>;
