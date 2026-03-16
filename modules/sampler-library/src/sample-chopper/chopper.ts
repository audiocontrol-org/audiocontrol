/**
 * Sample chopper orchestrator.
 *
 * Re-exports generic functions from @audiocontrol/sample-chopper
 * and provides device-specific drum kit conversion.
 *
 * @packageDocumentation
 */

import type { ResolvedDrumKitBundle, DetectedKit, KitSamples, KitMidiNotes } from '@/drum-kits/index.js';

import type {
  SliceResult,
  DrumKitOutputConfig,
} from '@/sample-chopper/types.js';
import { DEFAULT_BASE_NOTE, DEFAULT_DRUM_TYPES } from '@/sample-chopper/types.js';

// Re-export generic functions from standalone module
export { sliceAudio, analyzeForSlicing } from '@audiocontrol/sample-chopper';

/**
 * Convert slice results to a resolved drum kit bundle structure.
 *
 * Each slice becomes one sample in the kit, mapped to consecutive
 * MIDI notes starting from the base note.
 *
 * @param sliceResult - Result from slicing operation
 * @param config - Drum kit output configuration
 * @returns Resolved drum kit bundle ready for file output
 */
export function slicesToDrumKit(
  sliceResult: SliceResult,
  config: DrumKitOutputConfig
): ResolvedDrumKitBundle {
  const baseNote = config.baseNote ?? DEFAULT_BASE_NOTE;
  const drumTypes = config.drumTypes ?? DEFAULT_DRUM_TYPES;

  // Group slices into kits of 4 (kick, snare, hhc, hho)
  const kits: DetectedKit[] = [];
  const SAMPLES_PER_KIT = 4;

  for (let i = 0; i < sliceResult.slices.length; i += SAMPLES_PER_KIT) {
    const kitIndex = Math.floor(i / SAMPLES_PER_KIT);
    const kitSlices = sliceResult.slices.slice(i, i + SAMPLES_PER_KIT);

    const samples: KitSamples = {};
    const typeOrder: (keyof KitSamples)[] = ['kick', 'snare', 'hhClosed', 'hhOpen'];

    for (let j = 0; j < kitSlices.length; j++) {
      const slice = kitSlices[j];
      const drumType = typeOrder[j];
      const label = drumTypes[j % drumTypes.length] ?? drumType;
      const filename = formatSampleFilename(kitIndex + 1, label);
      samples[drumType] = filename;
    }

    const midiNotes: KitMidiNotes = {
      kick: baseNote + kitIndex * 4,
      snare: baseNote + kitIndex * 4 + 1,
      hhClosed: baseNote + kitIndex * 4 + 2,
      hhOpen: baseNote + kitIndex * 4 + 3,
    };

    kits.push({
      kitNumber: kitIndex + 1,
      samples,
      midiNotes,
      isComplete: kitSlices.length === SAMPLES_PER_KIT,
    });
  }

  return {
    name: config.name,
    sampleRate: config.sampleRate,
    baseNote,
    kits,
    totalSamples: sliceResult.slices.length,
    allComplete: kits.every(k => k.isComplete),
    transpose: config.transpose,
    velocitySensitivity: config.velocitySensitivity ?? 2,
  };
}

/**
 * Format a sample filename in the standard convention.
 *
 * @param kitNumber - Kit number (1-based)
 * @param drumType - Drum type label
 * @returns Formatted filename (e.g., "01 KICK.wav")
 */
function formatSampleFilename(kitNumber: number, drumType: string): string {
  const paddedNumber = String(kitNumber).padStart(2, '0');
  const label = drumType.toUpperCase();
  return `${paddedNumber} ${label}.wav`;
}
