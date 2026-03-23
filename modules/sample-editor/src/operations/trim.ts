/**
 * Trim samples to a region [startSample, endSample).
 */
export function trimSamples(
  samples: Int16Array,
  startSample: number,
  endSample: number,
): Int16Array {
  const start = Math.max(0, Math.floor(startSample));
  const end = Math.min(samples.length, Math.floor(endSample));
  if (start >= end) {
    return new Int16Array(0);
  }
  return samples.slice(start, end);
}

/**
 * Find the first and last sample above the RMS threshold.
 *
 * Returns `{ start, end }` where start..end is the region to keep.
 * Uses 10ms analysis windows. When the entire sample is below threshold,
 * returns `{ start: 0, end: 0 }`.
 */
export function findTrimPoints(
  samples: Int16Array,
  sampleRate: number,
  thresholdDb: number,
): { start: number; end: number } {
  if (samples.length === 0) {
    return { start: 0, end: 0 };
  }

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms windows
  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const thresholdRmsSquared = thresholdLinear * thresholdLinear;
  const scale = 1 / 32768;

  // Scan from start to find first window above threshold
  let firstAbove = samples.length;
  for (let i = 0; i <= samples.length - windowSize; i += windowSize) {
    const rmsSquared = computeRmsSquared(samples, i, windowSize, scale);
    if (rmsSquared > thresholdRmsSquared) {
      firstAbove = i;
      break;
    }
  }

  if (firstAbove >= samples.length) {
    return { start: 0, end: 0 };
  }

  // Scan from end to find last window above threshold
  let lastAbove = 0;
  for (let i = samples.length - windowSize; i >= 0; i -= windowSize) {
    const rmsSquared = computeRmsSquared(samples, i, windowSize, scale);
    if (rmsSquared > thresholdRmsSquared) {
      lastAbove = Math.min(i + windowSize, samples.length);
      break;
    }
  }

  if (firstAbove >= lastAbove) {
    return { start: 0, end: 0 };
  }

  return { start: firstAbove, end: lastAbove };
}

/**
 * Auto-trim silence from start and end of sample. Returns trimmed copy.
 *
 * Uses RMS-based detection with 10ms analysis windows.
 * Default threshold: -40dB.
 */
export function trimSilence(
  samples: Int16Array,
  sampleRate: number,
  thresholdDb: number = -40,
): Int16Array {
  const { start, end } = findTrimPoints(samples, sampleRate, thresholdDb);
  if (start >= end) {
    return new Int16Array(0);
  }
  return samples.slice(start, end);
}

function computeRmsSquared(
  samples: Int16Array,
  offset: number,
  windowSize: number,
  scale: number,
): number {
  let sumSquared = 0;
  for (let j = 0; j < windowSize; j++) {
    const normalized = samples[offset + j] * scale;
    sumSquared += normalized * normalized;
  }
  return sumSquared / windowSize;
}
