/**
 * Test helpers for audio integration tests.
 *
 * Provides signal generation and frequency analysis utilities
 * for verifying audio output from OfflineAudioContext renders.
 */

/**
 * Generate a single-cycle sine wave as Int16Array.
 * Repeating this buffer with looping produces a pure tone at `frequency` Hz.
 */
export function generateSineInt16(frequency: number, sampleRate: number): Int16Array {
  const samplesPerCycle = Math.round(sampleRate / frequency);
  const buffer = new Int16Array(samplesPerCycle);
  for (let i = 0; i < samplesPerCycle; i++) {
    buffer[i] = Math.round(Math.sin((2 * Math.PI * i) / samplesPerCycle) * 32767);
  }
  return buffer;
}

/**
 * Generate a multi-cycle sine wave as Int16Array.
 */
export function generateSineWaveInt16(
  frequency: number,
  sampleRate: number,
  durationSec: number,
): Int16Array {
  const length = Math.round(sampleRate * durationSec);
  const buffer = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 32767);
  }
  return buffer;
}

/**
 * Estimate the dominant frequency in an audio buffer using zero-crossing analysis.
 *
 * Counts zero crossings in the signal and derives frequency from the crossing rate.
 * Works well for simple periodic signals (sine, saw). Not suitable for complex
 * multi-frequency content — use `estimateFrequencyFFT` for that.
 *
 * @param samples - Audio samples (Float32Array from rendered AudioBuffer)
 * @param sampleRate - Sample rate in Hz
 * @param skipSamples - Samples to skip at the start (avoids attack transient)
 * @returns Estimated frequency in Hz
 */
export function estimateFrequencyZeroCrossing(
  samples: Float32Array,
  sampleRate: number,
  skipSamples = 0,
): number {
  let crossings = 0;
  for (let i = skipSamples + 1; i < samples.length; i++) {
    if ((samples[i - 1]! < 0 && samples[i]! >= 0) || (samples[i - 1]! >= 0 && samples[i]! < 0)) {
      crossings++;
    }
  }
  const duration = (samples.length - skipSamples) / sampleRate;
  // Each full cycle has 2 zero crossings
  return crossings / (2 * duration);
}

/**
 * Measure RMS amplitude of audio samples.
 *
 * @param samples - Audio samples
 * @param startSample - First sample to include
 * @param endSample - Last sample (exclusive). Defaults to full buffer.
 * @returns RMS amplitude (0.0 to ~1.0 for normalized audio)
 */
export function measureRMS(
  samples: Float32Array,
  startSample = 0,
  endSample?: number,
): number {
  const end = endSample ?? samples.length;
  let sum = 0;
  for (let i = startSample; i < end; i++) {
    sum += samples[i]! * samples[i]!;
  }
  return Math.sqrt(sum / (end - startSample));
}

/**
 * Render an OfflineAudioContext and return the output channel data.
 *
 * Convenience wrapper that handles the async render and extracts channel 0.
 */
export async function renderAndGetSamples(ctx: OfflineAudioContext): Promise<Float32Array> {
  const buffer = await ctx.startRendering();
  return buffer.getChannelData(0);
}

/**
 * Check if a region of audio contains a repeating signal (i.e., is looping).
 *
 * Compares two adjacent segments of equal length. If they correlate well,
 * the signal is repeating (looping). Returns correlation coefficient (0-1).
 */
export function measureLoopCorrelation(
  samples: Float32Array,
  regionStartSample: number,
  regionLengthSamples: number,
): number {
  const a = regionStartSample;
  const b = regionStartSample + regionLengthSamples;

  if (b + regionLengthSamples > samples.length) {
    throw new Error('Not enough samples for two-segment correlation');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < regionLengthSamples; i++) {
    const sA = samples[a + i]!;
    const sB = samples[b + i]!;
    dot += sA * sB;
    normA += sA * sA;
    normB += sB * sB;
  }

  const denom = Math.sqrt(normA * normB);
  return denom > 0 ? dot / denom : 0;
}
