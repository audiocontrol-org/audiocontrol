/**
 * Transient (attack) exclusion for loop point detection.
 *
 * Looping into the attack transient of a sample produces obvious artifacts.
 * This module identifies the sustain region of a sample, ensuring that
 * loop start candidates are drawn only from the stable portion of the sound.
 *
 * @packageDocumentation
 */

import { calculateRmsWindowed, msToSamples } from '@/sample-chopper/audio-utils.js';
import { DEFAULT_TRANSIENT_CONFIG, type TransientConfig } from '@/loop-detector/types.js';

/**
 * Find the sample index where the sustain region begins.
 *
 * Uses the RMS envelope derivative method:
 * 1. Compute short-time RMS envelope over the sample
 * 2. Calculate the derivative (rate of change) of the envelope
 * 3. Find where the derivative drops below a threshold (amplitude stabilized)
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param sampleRate - Sample rate in Hz
 * @param config - Transient detection configuration
 * @returns Sample index where sustain region begins
 */
export function findSustainStart(
  samples: Int16Array,
  sampleRate: number,
  config: Partial<TransientConfig> = {}
): number {
  const cfg: TransientConfig = {
    ...DEFAULT_TRANSIENT_CONFIG,
    ...config,
  };

  // Convert ms to samples
  const windowSizeSamples = msToSamples(cfg.windowMs, sampleRate);
  const hopSizeSamples = msToSamples(cfg.hopMs, sampleRate);
  const minSustainOffsetSamples = msToSamples(cfg.minSustainOffsetMs, sampleRate);

  // Ensure minimum window/hop sizes
  const effectiveWindowSize = Math.max(windowSizeSamples, 1);
  const effectiveHopSize = Math.max(hopSizeSamples, 1);

  // Calculate RMS envelope
  const rmsEnvelope = calculateRmsWindowed(samples, effectiveWindowSize, effectiveHopSize);

  if (rmsEnvelope.length < 2) {
    // Sample too short for analysis, use minimum offset
    return Math.min(minSustainOffsetSamples, samples.length);
  }

  // Find peak RMS value for normalization
  const peakRms = Math.max(...rmsEnvelope);

  if (peakRms === 0) {
    // Silent sample, use minimum offset
    return Math.min(minSustainOffsetSamples, samples.length);
  }

  // Calculate derivative of RMS envelope (normalized)
  const derivatives = calculateEnvelopeDerivative(rmsEnvelope, peakRms);

  // Find where derivative stabilizes (drops below threshold)
  const sustainFrameIndex = findStabilizationPoint(derivatives, cfg.derivativeThreshold);

  // Convert frame index back to sample index
  const sustainSampleIndex = sustainFrameIndex * effectiveHopSize;

  // Ensure we're at least at the minimum offset
  return Math.max(sustainSampleIndex, minSustainOffsetSamples);
}

/**
 * Calculate the derivative (rate of change) of an RMS envelope.
 *
 * The derivative is normalized by the peak RMS value to produce
 * values in a consistent range regardless of signal amplitude.
 *
 * @param envelope - Array of RMS values
 * @param peakRms - Peak RMS value for normalization
 * @returns Array of derivative values (one less than input length)
 */
function calculateEnvelopeDerivative(envelope: number[], peakRms: number): number[] {
  const derivatives: number[] = [];

  for (let i = 1; i < envelope.length; i++) {
    // Normalized derivative
    const derivative = (envelope[i] - envelope[i - 1]) / peakRms;
    derivatives.push(derivative);
  }

  return derivatives;
}

/**
 * Find the frame index where the envelope derivative stabilizes.
 *
 * Stabilization is defined as the point where:
 * 1. The derivative magnitude drops below the threshold
 * 2. The derivative remains below threshold for subsequent frames
 *
 * @param derivatives - Array of envelope derivative values
 * @param threshold - Maximum derivative magnitude for stabilization
 * @returns Frame index where stabilization begins
 */
function findStabilizationPoint(derivatives: number[], threshold: number): number {
  // Find the first point where derivative drops below threshold
  // and stays there for at least a few frames (to avoid false positives)
  const minStableFrames = 3;

  for (let i = 0; i < derivatives.length - minStableFrames; i++) {
    let stable = true;

    for (let j = 0; j < minStableFrames; j++) {
      if (Math.abs(derivatives[i + j]) > threshold) {
        stable = false;
        break;
      }
    }

    if (stable) {
      return i + 1; // +1 because derivatives array is offset by 1 from envelope
    }
  }

  // If no stabilization found, return the point of minimum derivative after peak
  return findMinDerivativeAfterPeak(derivatives) + 1;
}

/**
 * Find the frame index with minimum derivative magnitude after the peak.
 *
 * This is a fallback for samples that don't clearly stabilize.
 *
 * @param derivatives - Array of envelope derivative values
 * @returns Frame index of minimum derivative after peak
 */
function findMinDerivativeAfterPeak(derivatives: number[]): number {
  // Find the peak (maximum positive derivative - the attack)
  let peakIndex = 0;
  let peakValue = derivatives[0] ?? 0;

  for (let i = 1; i < derivatives.length; i++) {
    if (derivatives[i] > peakValue) {
      peakValue = derivatives[i];
      peakIndex = i;
    }
  }

  // Find minimum derivative magnitude after peak
  let minIndex = peakIndex;
  let minValue = Math.abs(derivatives[peakIndex] ?? 0);

  for (let i = peakIndex + 1; i < derivatives.length; i++) {
    const absValue = Math.abs(derivatives[i]);
    if (absValue < minValue) {
      minValue = absValue;
      minIndex = i;
    }
  }

  return minIndex;
}

/**
 * Analyze the attack characteristics of a sample.
 *
 * Returns information about the attack transient for UI display
 * or advanced processing.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param sampleRate - Sample rate in Hz
 * @param config - Transient detection configuration
 * @returns Attack analysis results
 */
export function analyzeAttack(
  samples: Int16Array,
  sampleRate: number,
  config: Partial<TransientConfig> = {}
): AttackAnalysis {
  const cfg: TransientConfig = {
    ...DEFAULT_TRANSIENT_CONFIG,
    ...config,
  };

  const windowSizeSamples = msToSamples(cfg.windowMs, sampleRate);
  const hopSizeSamples = msToSamples(cfg.hopMs, sampleRate);

  const effectiveWindowSize = Math.max(windowSizeSamples, 1);
  const effectiveHopSize = Math.max(hopSizeSamples, 1);

  const rmsEnvelope = calculateRmsWindowed(samples, effectiveWindowSize, effectiveHopSize);

  if (rmsEnvelope.length === 0) {
    return {
      peakIndex: 0,
      peakRms: 0,
      sustainStartIndex: 0,
      attackDurationMs: 0,
      hasDetectedAttack: false,
    };
  }

  // Find peak RMS
  let peakFrameIndex = 0;
  let peakRms = rmsEnvelope[0];

  for (let i = 1; i < rmsEnvelope.length; i++) {
    if (rmsEnvelope[i] > peakRms) {
      peakRms = rmsEnvelope[i];
      peakFrameIndex = i;
    }
  }

  const sustainStartIndex = findSustainStart(samples, sampleRate, config);

  // Convert to milliseconds
  const peakSampleIndex = peakFrameIndex * effectiveHopSize;
  const attackDurationMs = (peakSampleIndex / sampleRate) * 1000;

  return {
    peakIndex: peakSampleIndex,
    peakRms,
    sustainStartIndex,
    attackDurationMs,
    hasDetectedAttack: peakSampleIndex > 0,
  };
}

/**
 * Results of attack analysis.
 */
export interface AttackAnalysis {
  /**
   * Sample index of the peak amplitude.
   */
  peakIndex: number;

  /**
   * RMS value at the peak.
   */
  peakRms: number;

  /**
   * Sample index where sustain region begins.
   */
  sustainStartIndex: number;

  /**
   * Duration of the attack in milliseconds.
   */
  attackDurationMs: number;

  /**
   * Whether a distinct attack transient was detected.
   */
  hasDetectedAttack: boolean;
}
