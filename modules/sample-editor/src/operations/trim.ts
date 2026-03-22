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
  if (samples.length === 0) {
    return new Int16Array(0);
  }

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms windows
  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  // RMS threshold squared for comparison without sqrt
  const thresholdRmsSquared = thresholdLinear * thresholdLinear;
  // Scale for Int16 range: peak is 32768
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
    return new Int16Array(0);
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
    return new Int16Array(0);
  }

  return samples.slice(firstAbove, lastAbove);
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
