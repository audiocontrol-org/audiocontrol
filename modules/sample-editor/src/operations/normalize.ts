/**
 * Normalize to target peak level (default: 0dB = full scale).
 *
 * Finds the peak amplitude, calculates the scale factor to reach the target,
 * multiplies all samples, and clamps to Int16 range.
 */
export function normalize(
  samples: Int16Array,
  targetPeakDb: number = 0,
): Int16Array {
  if (samples.length === 0) {
    return new Int16Array(0);
  }

  // Find peak amplitude
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) {
      peak = abs;
    }
  }

  // Avoid division by zero for silent samples
  if (peak === 0) {
    return new Int16Array(samples);
  }

  const targetLinear = Math.pow(10, targetPeakDb / 20) * 32767;
  const scaleFactor = targetLinear / peak;

  return applyScaleFactor(samples, scaleFactor);
}

/**
 * Apply gain in dB. Positive = louder, negative = quieter.
 * Clamps to [-32768, 32767].
 */
export function applyGain(samples: Int16Array, gainDb: number): Int16Array {
  if (samples.length === 0) {
    return new Int16Array(0);
  }

  const scaleFactor = Math.pow(10, gainDb / 20);
  return applyScaleFactor(samples, scaleFactor);
}

function applyScaleFactor(samples: Int16Array, scaleFactor: number): Int16Array {
  const result = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const scaled = Math.round(samples[i] * scaleFactor);
    result[i] = Math.max(-32768, Math.min(32767, scaled));
  }
  return result;
}
