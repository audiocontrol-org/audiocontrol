/**
 * Converters between DrumKitBundle and ChoppedSample formats.
 *
 * Enables round-tripping between the device-specific drum kit bundle format
 * and the device-agnostic chopped sample format.
 *
 * @packageDocumentation
 */

import type { DrumKitBundle, SliceDefinition } from '@/schemas/drum-kit-bundle-schema.js';
import type { DrumKitChoppedSample, GenericChoppedSample, ChoppedSample } from '@/schemas/chopped-sample-schema.js';

/**
 * Convert a DrumKitBundle (v2, with slices) to a DrumKitChoppedSample.
 *
 * @param bundle - Source drum kit bundle (must be version 2 with source + slices)
 * @param resolvedBaseNote - The resolved base note value (string or number)
 * @returns A drum-kit variant ChoppedSample
 * @throws Error if the bundle is not version 2 or lacks slices/source
 */
export function drumKitBundleToChoppedSample(
  bundle: DrumKitBundle,
  resolvedBaseNote?: string | number
): DrumKitChoppedSample {
  if (bundle.version !== 2) {
    throw new Error('Only DrumKitBundle version 2 (source + slices) can be converted');
  }

  if (!bundle.source || !bundle.slices || bundle.slices.length === 0) {
    throw new Error('DrumKitBundle must have source and slices for conversion');
  }

  return {
    format: 'chopped-sample',
    version: 1,
    variant: 'drum-kit',
    name: bundle.name,
    description: bundle.description,
    source: bundle.source,
    sampleRate: bundle.sampleRate,
    slices: bundle.slices.map((s) => ({
      label: s.label,
      startSample: s.startSample,
      endSample: s.endSample,
    })),
    drumKit: {
      baseNote: resolvedBaseNote ?? bundle.baseNote,
      transpose: bundle.transpose,
      velocitySensitivity: bundle.velocitySensitivity,
    },
  };
}

/**
 * Convert a ChoppedSample (drum-kit variant) back to a DrumKitBundle v2.
 *
 * @param chopped - Source chopped sample (must be drum-kit variant)
 * @param targetSampleRate - Target sample rate (15000 or 30000 Hz)
 * @returns A DrumKitBundle v2
 * @throws Error if the chopped sample is not a drum-kit variant
 */
export function choppedSampleToDrumKitBundle(
  chopped: ChoppedSample,
  targetSampleRate: 15000 | 30000
): DrumKitBundle {
  if (chopped.variant !== 'drum-kit') {
    throw new Error('Only drum-kit variant ChoppedSamples can be converted to DrumKitBundle');
  }

  const drumKit = chopped as DrumKitChoppedSample;

  const slices: SliceDefinition[] = chopped.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return {
    format: 'drum-kit-bundle',
    version: 2,
    name: chopped.name,
    description: chopped.description,
    sampleRate: targetSampleRate,
    baseNote: drumKit.drumKit.baseNote,
    transpose: drumKit.drumKit.transpose,
    velocitySensitivity: drumKit.drumKit.velocitySensitivity,
    source: chopped.source,
    slices,
  };
}

/**
 * Create a generic ChoppedSample from raw slice data.
 *
 * Convenience function for creating a generic (non-drum-kit) chopped sample.
 *
 * @param name - Sample name
 * @param sampleRate - Audio sample rate
 * @param slices - Slice definitions
 * @returns A generic variant ChoppedSample
 */
export function createGenericChoppedSample(
  name: string,
  sampleRate: number,
  slices: SliceDefinition[]
): GenericChoppedSample {
  return {
    format: 'chopped-sample',
    version: 1,
    variant: 'generic',
    name,
    source: 'source.wav',
    sampleRate,
    slices,
  };
}
