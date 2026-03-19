/**
 * Migrates chopped-sample format to the new sample + program format pair.
 *
 * A chopped sample (format: 'chopped-sample') is superseded by:
 * - SampleYaml (format: 'sample') representing the source audio file
 * - ProgramYaml (format: 'program') representing the instrument mapping
 *
 * @packageDocumentation
 */

import type { ChoppedSample } from '@/schemas/chopped-sample-schema.js';
import type { SampleYaml } from '@/schemas/sample-schema.js';
import type { ProgramYaml, Zone } from '@/schemas/program-schema.js';

import { resolveKey } from '@/templates/template-engine.js';

/**
 * Result of migrating a chopped sample to the new format.
 */
export interface MigrationResult {
  /** The source audio as a SampleYaml document */
  sample: SampleYaml;
  /** The instrument mapping as a ProgramYaml document */
  program: ProgramYaml;
}

/**
 * Build a Zone from a slice, applying drum-kit key mapping when applicable.
 */
function buildZone(
  chopped: ChoppedSample,
  sliceIndex: number,
): Zone {
  const slice = chopped.slices[sliceIndex];
  if (!slice) {
    throw new Error(`Slice index ${sliceIndex} out of bounds`);
  }

  const zone: Zone = {
    sample: chopped.source,
    label: slice.label,
  };

  // Drum-kit variant: assign each slice to a single MIDI key
  if (chopped.variant === 'drum-kit') {
    const baseNote = resolveKey(chopped.drumKit.baseNote);
    const noteNumber = baseNote + sliceIndex;
    zone.keyRange = [noteNumber, noteNumber];
  }

  // Mute group assignment (only non-zero values)
  const muteGroup = chopped.playback?.muteGroups[sliceIndex];
  if (muteGroup !== undefined && muteGroup !== 0) {
    zone.muteGroup = muteGroup;
  }

  return zone;
}

/**
 * Migrate a chopped sample to the new sample + program format.
 *
 * The source audio becomes a SampleYaml document (one-shot, no loop points).
 * The slice mappings become a ProgramYaml document with one zone per slice.
 *
 * @param chopped - The chopped sample to migrate
 * @returns A MigrationResult containing the sample and program documents
 */
export function migrateChoppedSample(chopped: ChoppedSample): MigrationResult {
  const sample: SampleYaml = {
    format: 'sample',
    version: 1,
    name: chopped.name,
    file: chopped.source,
    sampleRate: chopped.sampleRate,
    description: chopped.description,
    createdAt: chopped.createdAt,
    modifiedAt: chopped.modifiedAt,
  };

  const zones: Zone[] = chopped.slices.map((_, index) =>
    buildZone(chopped, index),
  );

  const program: ProgramYaml = {
    format: 'program',
    version: 1,
    name: chopped.name,
    zones,
    polyphony: chopped.playback?.polyphony,
    playbackMode: chopped.playback?.playbackMode,
    description: chopped.description,
    createdAt: chopped.createdAt,
    modifiedAt: chopped.modifiedAt,
  };

  return { sample, program };
}
