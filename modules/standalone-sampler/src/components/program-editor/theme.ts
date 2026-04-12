import type { ParameterSliderTheme, CollapsibleSectionTheme } from '@audiocontrol/editor-core';

export const sliderTheme: ParameterSliderTheme = {
  container: 'flex flex-col gap-1',
  disabledContainer: 'opacity-50',
  label: 'text-xs text-sampler-muted',
  value: 'text-xs text-sampler-text font-mono',
  root: 'relative flex items-center h-5 w-full cursor-pointer',
  disabledRoot: 'cursor-not-allowed',
  track: 'relative h-1 w-full rounded-full bg-sampler-border',
  range: 'absolute h-full rounded-full bg-sampler-highlight',
  thumb: 'block h-3.5 w-3.5 rounded-full bg-sampler-text shadow-sm border border-sampler-border focus:outline-none focus:ring-1 focus:ring-sampler-highlight',
};

export const sectionTheme: CollapsibleSectionTheme = {
  container: 'border border-sampler-border rounded-md overflow-hidden',
  headerButton: 'w-full flex items-center justify-between px-3 py-2 bg-sampler-surface hover:bg-sampler-border transition-colors',
  title: 'text-sm font-medium text-sampler-text',
  icon: 'text-sampler-muted',
  body: 'p-3',
};
