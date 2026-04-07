/**
 * Translation: vendor-neutral common library format → Akai S3000XL disk format.
 *
 * Converts ProgramYaml zones → Akai keygroup structure and
 * SampleYaml → Akai sample header fields.
 *
 * The reverse direction (Akai → common) is in akai-to-common.ts.
 */

import { BLOCK_SIZE, asciiToAkai } from '@/devices/s3000xl/akai-disk-format.js';
import type { CommonZone, CommonProgram, CommonSample } from '@/devices/s3000xl/akai-to-common.js';

// =========================================================================
// Common → Akai translation
// =========================================================================

/** A keygroup assembled from common library zones. */
export interface AkaiKeygroupSpec {
  lowNote: number;
  highNote: number;
  /** Up to 4 sample names (12-char Akai encoding). */
  sampleNames: string[];
}

/** A program assembled from common library data. */
export interface AkaiProgramSpec {
  name: string;
  keygroups: AkaiKeygroupSpec[];
  polyphony: number;
}

/**
 * Convert vendor-neutral program zones into Akai keygroup specs.
 *
 * Zones are grouped by key range — zones sharing the same [lowNote, highNote]
 * become velocity layers within the same keygroup. Up to 4 velocity layers
 * per keygroup (S3000XL limit).
 *
 * Zones without key ranges are assigned to a single keygroup spanning C1-C6
 * (MIDI 36-96).
 */
export function commonToAkaiProgram(program: CommonProgram): AkaiProgramSpec {
  // Group zones by key range
  const groups = new Map<string, CommonZone[]>();

  for (const zone of program.zones) {
    const key = zone.keyRange
      ? `${zone.keyRange[0]}-${zone.keyRange[1]}`
      : '36-96'; // default range if unspecified
    const existing = groups.get(key) ?? [];
    existing.push(zone);
    groups.set(key, existing);
  }

  const keygroups: AkaiKeygroupSpec[] = [];

  for (const [rangeKey, zones] of groups) {
    const [low, high] = rangeKey.split('-').map(Number);

    // Sort zones by velocity low bound (ascending)
    const sorted = [...zones].sort((a, b) => {
      const aLow = a.velocityRange?.[0] ?? 1;
      const bLow = b.velocityRange?.[0] ?? 1;
      return aLow - bLow;
    });

    // Take up to 4 velocity layers
    const sampleNames = sorted.slice(0, 4).map((z) => {
      // Strip .wav extension and truncate to 12 chars for Akai encoding
      const name = z.sample.replace(/\.wav$/i, '');
      return name.substring(0, 12).toUpperCase();
    });

    keygroups.push({
      lowNote: low,
      highNote: high,
      sampleNames,
    });
  }

  return {
    name: program.name.substring(0, 12).toUpperCase(),
    keygroups,
    polyphony: program.polyphony === 'mono' ? 1 : 16,
  };
}

/**
 * Convert vendor-neutral sample metadata to Akai sample header fields.
 *
 * Returns the fields needed to construct an Akai on-disk sample header.
 * The caller is responsible for assembling the binary header from these values.
 */
export interface AkaiSampleSpec {
  name: string;
  sampleRate: number;
  originalPitch: number;
  playbackType: number;
  loopCount: number;
  playStart: number;
  playEnd: number;
}

export function commonToAkaiSample(sample: CommonSample, sampleLength: number): AkaiSampleSpec {
  let playbackType = 0; // one-shot
  let loopCount = 0;

  if (sample.loopMode === 'forward') {
    playbackType = 1;
    loopCount = 1;
  } else if (sample.loopMode === 'alternating') {
    playbackType = 1;
    loopCount = 1;
  }

  return {
    name: sample.name.substring(0, 12).toUpperCase(),
    sampleRate: sample.sampleRate,
    originalPitch: sample.rootKey ?? 60, // default to middle C
    playbackType,
    loopCount,
    playStart: sample.loopStart ?? 0,
    playEnd: sample.loopEnd ?? sampleLength,
  };
}
