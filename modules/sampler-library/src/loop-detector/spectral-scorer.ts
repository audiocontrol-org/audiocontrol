/**
 * Spectral envelope similarity scoring for loop point detection.
 *
 * Even when time-domain NCC is high, spectral differences between the regions
 * around loopStart and loopEnd can cause a perceptible timbral shift at the
 * loop point. This module provides FFT-based spectral similarity scoring.
 *
 * @packageDocumentation
 */

import FFT from 'fft.js';

/**
 * Cache for FFT instances by size.
 * FFT.js requires pre-instantiation for each size, so caching improves performance.
 */
const fftCache = new Map<number, FFT>();

/**
 * Get or create an FFT instance for a given size.
 *
 * @param size - FFT size (must be power of 2)
 * @returns FFT instance
 */
function getFFT(size: number): FFT {
  let fft = fftCache.get(size);
  if (!fft) {
    fft = new FFT(size);
    fftCache.set(size, fft);
  }
  return fft;
}

/**
 * Create a Hann window function.
 *
 * The Hann window reduces spectral leakage when computing the FFT.
 *
 * @param size - Window size
 * @returns Float64Array containing window coefficients
 */
export function createHannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/**
 * Cache for Hann windows by size.
 */
const hannWindowCache = new Map<number, Float64Array>();

/**
 * Get or create a Hann window of a given size.
 *
 * @param size - Window size
 * @returns Float64Array containing window coefficients
 */
function getHannWindow(size: number): Float64Array {
  let window = hannWindowCache.get(size);
  if (!window) {
    window = createHannWindow(size);
    hannWindowCache.set(size, window);
  }
  return window;
}

/**
 * Compute the log-magnitude spectrum of a window of samples.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param centerIndex - Center sample index of the analysis window
 * @param windowSize - FFT window size (must be power of 2)
 * @returns Float32Array of log-magnitude values (length = windowSize/2 + 1)
 */
export function computeLogMagnitudeSpectrum(
  samples: Int16Array,
  centerIndex: number,
  windowSize: number
): Float32Array {
  // Calculate window boundaries
  const halfWindow = Math.floor(windowSize / 2);
  const startIndex = centerIndex - halfWindow;
  const endIndex = startIndex + windowSize;

  // Get FFT instance and Hann window
  const fft = getFFT(windowSize);
  const hannWindow = getHannWindow(windowSize);

  // Prepare input buffer (windowed and normalized)
  const input = new Float64Array(windowSize);

  for (let i = 0; i < windowSize; i++) {
    const sampleIndex = startIndex + i;

    // Handle out-of-bounds by zero-padding
    if (sampleIndex < 0 || sampleIndex >= samples.length) {
      input[i] = 0;
    } else {
      // Normalize to [-1, 1] and apply Hann window
      const normalized = samples[sampleIndex] / 32768;
      input[i] = normalized * hannWindow[i];
    }
  }

  // Compute FFT
  // fft.js uses a flat array for complex output: [re0, im0, re1, im1, ...]
  const complexOutput = fft.createComplexArray();
  fft.realTransform(complexOutput, input);

  // Calculate log-magnitude spectrum (only positive frequencies)
  const numBins = windowSize / 2 + 1;
  const logMagnitude = new Float32Array(numBins);

  // Small value to prevent log(0)
  const epsilon = 1e-10;

  for (let i = 0; i < numBins; i++) {
    const re = complexOutput[2 * i];
    const im = complexOutput[2 * i + 1];
    const magnitude = Math.sqrt(re * re + im * im);

    // Log scale (dB-like)
    logMagnitude[i] = Math.log10(magnitude + epsilon);
  }

  return logMagnitude;
}

/**
 * Calculate the spectral distance between two log-magnitude spectra.
 *
 * Uses L2 norm (Euclidean distance) of the difference between spectra.
 *
 * @param spectrum1 - First log-magnitude spectrum
 * @param spectrum2 - Second log-magnitude spectrum
 * @returns L2 distance (lower = more similar)
 */
export function calculateSpectralDistance(
  spectrum1: Float32Array,
  spectrum2: Float32Array
): number {
  if (spectrum1.length !== spectrum2.length) {
    throw new Error('Spectra must have the same length');
  }

  let sumSquaredDiff = 0;

  for (let i = 0; i < spectrum1.length; i++) {
    const diff = spectrum1[i] - spectrum2[i];
    sumSquaredDiff += diff * diff;
  }

  return Math.sqrt(sumSquaredDiff);
}

/**
 * Calculate spectral similarity score between two regions of a sample.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param windowSize - FFT window size (must be power of 2)
 * @returns Similarity score [0, 1] where 1 = identical spectra
 */
export function scoreSpectralSimilarity(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  windowSize: number
): number {
  // Compute spectra centered on each point
  const spectrum1 = computeLogMagnitudeSpectrum(samples, loopStart, windowSize);
  const spectrum2 = computeLogMagnitudeSpectrum(samples, loopEnd, windowSize);

  // Calculate distance
  const distance = calculateSpectralDistance(spectrum1, spectrum2);

  // Convert distance to similarity score
  // Empirically, distances typically range from 0 to ~20 for audio signals
  // Using a sigmoid-like transformation to map to [0, 1]
  return normalizeSpectralDistance(distance);
}

/**
 * Normalize spectral distance to a similarity score.
 *
 * Maps distance values to [0, 1] range where:
 * - 0 distance -> 1.0 (identical)
 * - Large distance -> 0.0 (completely different)
 *
 * Uses an exponential decay function tuned for typical audio spectral distances.
 *
 * @param distance - L2 spectral distance
 * @returns Similarity score [0, 1]
 */
export function normalizeSpectralDistance(distance: number): number {
  // Decay constant tuned for typical spectral distances
  // A distance of 5 gives ~0.67 similarity
  // A distance of 10 gives ~0.37 similarity
  // A distance of 20 gives ~0.14 similarity
  const decayConstant = 0.1;

  return Math.exp(-decayConstant * distance);
}

/**
 * Batch calculate spectral similarity scores for multiple candidate pairs.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param candidates - Array of {loopStart, loopEnd} pairs
 * @param windowSize - FFT window size (must be power of 2)
 * @returns Map from "loopStart,loopEnd" key to spectral similarity score
 */
export function batchCalculateSpectralSimilarity(
  samples: Int16Array,
  candidates: Array<{ loopStart: number; loopEnd: number }>,
  windowSize: number
): Map<string, number> {
  const results = new Map<string, number>();

  // Cache computed spectra to avoid redundant FFT calculations
  const spectrumCache = new Map<number, Float32Array>();

  const getSpectrum = (index: number): Float32Array => {
    let spectrum = spectrumCache.get(index);
    if (!spectrum) {
      spectrum = computeLogMagnitudeSpectrum(samples, index, windowSize);
      spectrumCache.set(index, spectrum);
    }
    return spectrum;
  };

  for (const { loopStart, loopEnd } of candidates) {
    const spectrum1 = getSpectrum(loopStart);
    const spectrum2 = getSpectrum(loopEnd);

    const distance = calculateSpectralDistance(spectrum1, spectrum2);
    const similarity = normalizeSpectralDistance(distance);

    const key = `${loopStart},${loopEnd}`;
    results.set(key, similarity);
  }

  return results;
}

/**
 * Calculate the optimal FFT window size for spectral analysis.
 *
 * The window should be large enough to capture frequency content
 * but not so large that it smears time-domain information.
 *
 * @param sampleRate - Sample rate in Hz
 * @param minFreqResolution - Minimum frequency resolution in Hz
 * @returns FFT window size (power of 2)
 */
export function calculateOptimalFFTSize(
  sampleRate: number,
  minFreqResolution: number = 50
): number {
  // Frequency resolution = sampleRate / fftSize
  // So fftSize >= sampleRate / minFreqResolution
  const minSize = sampleRate / minFreqResolution;

  // Round up to next power of 2
  const power = Math.ceil(Math.log2(minSize));

  // Clamp to reasonable range (512 to 4096)
  const clampedPower = Math.max(9, Math.min(12, power)); // 512 to 4096

  return Math.pow(2, clampedPower);
}
