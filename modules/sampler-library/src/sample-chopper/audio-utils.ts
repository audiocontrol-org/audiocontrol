/**
 * Audio analysis utilities for sample chopping.
 *
 * Provides RMS calculation, peak detection, and time conversion
 * functions used by the various slicing algorithms.
 *
 * @packageDocumentation
 */

/**
 * Convert milliseconds to samples at a given sample rate.
 *
 * @param ms - Time in milliseconds
 * @param sampleRate - Sample rate in Hz
 * @returns Number of samples
 */
export function msToSamples(ms: number, sampleRate: number): number {
  return Math.round((ms * sampleRate) / 1000);
}

/**
 * Convert samples to milliseconds at a given sample rate.
 *
 * @param samples - Number of samples
 * @param sampleRate - Sample rate in Hz
 * @returns Time in milliseconds
 */
export function samplesToMs(samples: number, sampleRate: number): number {
  return (samples * 1000) / sampleRate;
}

/**
 * Calculate RMS (root mean square) amplitude for a region of samples.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param start - Start index
 * @param length - Number of samples to analyze
 * @returns RMS amplitude (0-1 normalized from 16-bit range)
 */
export function calculateRms(
  samples: Int16Array,
  start: number,
  length: number
): number {
  if (length <= 0) {
    return 0;
  }

  const end = Math.min(start + length, samples.length);
  const actualLength = end - start;

  if (actualLength <= 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = start; i < end; i++) {
    const normalized = samples[i] / 32768;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / actualLength);
}

/**
 * Calculate peak amplitude for a region of samples.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param start - Start index
 * @param length - Number of samples to analyze
 * @returns Peak amplitude (0-1 normalized from 16-bit range)
 */
export function calculatePeak(
  samples: Int16Array,
  start: number,
  length: number
): number {
  if (length <= 0) {
    return 0;
  }

  const end = Math.min(start + length, samples.length);
  let maxAbs = 0;

  for (let i = start; i < end; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) {
      maxAbs = abs;
    }
  }

  return maxAbs / 32768;
}

/**
 * Convert linear amplitude (0-1) to decibels.
 *
 * @param amplitude - Linear amplitude (0-1)
 * @returns Amplitude in dB (returns -Infinity for amplitude 0)
 */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) {
    return -Infinity;
  }
  return 20 * Math.log10(amplitude);
}

/**
 * Convert decibels to linear amplitude (0-1).
 *
 * @param db - Amplitude in dB
 * @returns Linear amplitude (0-1)
 */
export function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) {
    return 0;
  }
  return Math.pow(10, db / 20);
}

/**
 * Calculate RMS values in sliding windows across the entire sample.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param windowSizeSamples - Window size in samples
 * @param hopSizeSamples - Hop size between windows in samples
 * @returns Array of RMS values for each window position
 */
export function calculateRmsWindowed(
  samples: Int16Array,
  windowSizeSamples: number,
  hopSizeSamples: number
): number[] {
  const rmsValues: number[] = [];

  for (let start = 0; start + windowSizeSamples <= samples.length; start += hopSizeSamples) {
    rmsValues.push(calculateRms(samples, start, windowSizeSamples));
  }

  return rmsValues;
}

/**
 * Find the first sample index where the amplitude exceeds a threshold.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param threshold - Amplitude threshold (0-1)
 * @param startIndex - Index to start searching from
 * @returns Index of first sample above threshold, or -1 if not found
 */
export function findOnsetAboveThreshold(
  samples: Int16Array,
  threshold: number,
  startIndex: number = 0
): number {
  const thresholdValue = threshold * 32768;

  for (let i = startIndex; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= thresholdValue) {
      return i;
    }
  }

  return -1;
}

/**
 * Find the sample index where the amplitude falls below a threshold.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param threshold - Amplitude threshold (0-1)
 * @param startIndex - Index to start searching from
 * @param minDuration - Minimum number of samples below threshold to trigger
 * @returns Index of first sustained drop below threshold, or samples.length if not found
 */
export function findSilenceStart(
  samples: Int16Array,
  threshold: number,
  startIndex: number = 0,
  minDuration: number = 1
): number {
  const thresholdValue = threshold * 32768;
  let belowCount = 0;
  let silenceStart = startIndex;

  for (let i = startIndex; i < samples.length; i++) {
    if (Math.abs(samples[i]) < thresholdValue) {
      if (belowCount === 0) {
        silenceStart = i;
      }
      belowCount++;
      if (belowCount >= minDuration) {
        return silenceStart;
      }
    } else {
      belowCount = 0;
    }
  }

  return samples.length;
}
