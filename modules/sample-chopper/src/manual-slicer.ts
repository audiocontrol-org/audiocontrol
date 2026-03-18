/**
 * Manual region slicer for sample chopping.
 *
 * Extracts user-specified regions from audio, useful for
 * precise control over slice boundaries.
 *
 * @packageDocumentation
 */

import type { ManualConfig, SliceResult, Slice, ManualRegion } from '@/types.js';
import { msToSamples, samplesToMs } from '@/audio-utils.js';

/**
 * Slice audio at user-specified regions.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Manual region configuration
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * // Extract specific regions
 * const result = sliceByManualRegions(samples, 44100, {
 *   method: 'manual',
 *   regions: [
 *     { start: 0, end: 500, name: 'kick' },
 *     { start: 500, end: 1000, name: 'snare' },
 *   ]
 * });
 * ```
 */
export function sliceByManualRegions(
  samples: Int16Array,
  sampleRate: number,
  config: ManualConfig
): SliceResult {
  const totalDurationMs = samplesToMs(samples.length, sampleRate);
  const totalDurationSamples = samples.length;

  if (config.regions.length === 0) {
    throw new Error('Manual slicing requires at least one region');
  }

  // Validate and sort regions
  const validatedRegions = validateRegions(config.regions, totalDurationMs);

  const slices: Slice[] = validatedRegions.map((region, index) => {
    const startSample = msToSamples(region.start, sampleRate);
    const endSample = Math.min(msToSamples(region.end, sampleRate), totalDurationSamples);
    const sliceSamples = samples.slice(startSample, endSample);

    return {
      index,
      startSample,
      endSample,
      samples: sliceSamples,
      durationMs: samplesToMs(sliceSamples.length, sampleRate),
      name: region.name,
    };
  });

  return {
    slices,
    sampleRate,
    totalDurationMs,
  };
}

/**
 * Validate manual region definitions.
 *
 * @param regions - User-defined regions
 * @param totalDurationMs - Total audio duration in ms
 * @returns Validated and sorted regions
 */
function validateRegions(
  regions: ManualRegion[],
  totalDurationMs: number
): ManualRegion[] {
  const errors: string[] = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const label = region.name ?? `Region ${i + 1}`;

    if (region.start < 0) {
      errors.push(`${label}: start time (${region.start}ms) cannot be negative`);
    }

    if (region.end <= region.start) {
      errors.push(`${label}: end time (${region.end}ms) must be greater than start time (${region.start}ms)`);
    }

    if (region.start > totalDurationMs) {
      errors.push(`${label}: start time (${region.start}ms) exceeds audio duration (${totalDurationMs.toFixed(1)}ms)`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid manual regions:\n  - ${errors.join('\n  - ')}`);
  }

  // Sort by start time
  const sorted = [...regions].sort((a, b) => a.start - b.start);

  // Check for overlaps (warning, not error)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.start < prev.end) {
      const prevLabel = prev.name ?? `Region ${i}`;
      const currLabel = curr.name ?? `Region ${i + 1}`;
      console.warn(
        `Warning: ${currLabel} (${curr.start}ms) overlaps with ${prevLabel} (ends at ${prev.end}ms)`
      );
    }
  }

  return sorted;
}

/**
 * Create regions from a simple array of boundary times.
 *
 * Useful for converting beat/measure markers into regions.
 *
 * @param boundaries - Array of time points in ms (will be sorted)
 * @param names - Optional names for each resulting region
 * @returns ManualConfig ready for slicing
 *
 * @example
 * ```typescript
 * // 4 beats at 120 BPM (500ms each)
 * const config = createRegionsFromBoundaries([0, 500, 1000, 1500, 2000]);
 * // Creates regions: 0-500, 500-1000, 1000-1500, 1500-2000
 * ```
 */
export function createRegionsFromBoundaries(
  boundaries: number[],
  names?: string[]
): ManualConfig {
  if (boundaries.length < 2) {
    throw new Error('Need at least 2 boundaries to create regions');
  }

  const sorted = [...boundaries].sort((a, b) => a - b);
  const regions: ManualRegion[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    regions.push({
      start: sorted[i],
      end: sorted[i + 1],
      name: names?.[i],
    });
  }

  return {
    method: 'manual',
    regions,
  };
}

/**
 * Create regions from beat count and tempo.
 *
 * @param numBeats - Number of beats (regions) to create
 * @param bpm - Tempo in beats per minute
 * @param startOffsetMs - Offset from start in ms (default: 0)
 * @param names - Optional names for each resulting region
 * @returns ManualConfig ready for slicing
 *
 * @example
 * ```typescript
 * // 4 regions at 120 BPM
 * const config = createRegionsFromTempo(4, 120, 0, ['kick', 'snare', 'hhc', 'hho']);
 * ```
 */
export function createRegionsFromTempo(
  numBeats: number,
  bpm: number,
  startOffsetMs: number = 0,
  names?: string[]
): ManualConfig {
  const msPerBeat = 60000 / bpm;
  const boundaries: number[] = [];

  for (let i = 0; i <= numBeats; i++) {
    boundaries.push(startOffsetMs + i * msPerBeat);
  }

  return createRegionsFromBoundaries(boundaries, names);
}
