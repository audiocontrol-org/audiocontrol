import type { FadeCurve } from '@/types';

/**
 * Apply fade-in to the first N milliseconds.
 */
export function fadeIn(
  samples: Int16Array,
  sampleRate: number,
  durationMs: number,
  curve: FadeCurve = 'linear',
): Int16Array {
  const fadeSamples = Math.min(
    Math.floor((durationMs / 1000) * sampleRate),
    samples.length,
  );
  const result = new Int16Array(samples);
  const curveFunction = getCurveFunction(curve);

  for (let i = 0; i < fadeSamples; i++) {
    const t = i / fadeSamples;
    result[i] = Math.round(samples[i] * curveFunction(t));
  }

  return result;
}

/**
 * Apply fade-out to the last N milliseconds.
 */
export function fadeOut(
  samples: Int16Array,
  sampleRate: number,
  durationMs: number,
  curve: FadeCurve = 'linear',
): Int16Array {
  const fadeSamples = Math.min(
    Math.floor((durationMs / 1000) * sampleRate),
    samples.length,
  );
  const result = new Int16Array(samples);
  const curveFunction = getCurveFunction(curve);
  const fadeStart = samples.length - fadeSamples;

  for (let i = 0; i < fadeSamples; i++) {
    // t goes from 1 (full amplitude) down to 0 (silence)
    // Use (fadeSamples - 1 - i) / (fadeSamples - 1) so last sample is exactly 0
    const t = fadeSamples > 1 ? (fadeSamples - 1 - i) / (fadeSamples - 1) : 0;
    result[fadeStart + i] = Math.round(samples[fadeStart + i] * curveFunction(t));
  }

  return result;
}

function getCurveFunction(curve: FadeCurve): (t: number) => number {
  switch (curve) {
    case 'linear':
      return (t) => t;
    case 'equal-power':
      return (t) => Math.sin((t * Math.PI) / 2);
    case 'logarithmic':
      return (t) => Math.log10(1 + 9 * t);
  }
}
