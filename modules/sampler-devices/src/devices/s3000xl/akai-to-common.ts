/**
 * Translation: Akai S3000XL disk format → vendor-neutral common library format.
 *
 * Converts AkaiDiskProgram → ProgramYaml and AkaiDiskSampleHeader → SampleYaml.
 * These types come from sampler-library schemas and are the canonical
 * vendor-neutral representation used by the common area of the library.
 */

import type { AkaiDiskProgram, AkaiDiskKeygroup } from '@/devices/s3000xl/akai-disk-program.js';
import type { AkaiDiskSampleHeader } from '@/devices/s3000xl/akai-disk-sample.js';

// =========================================================================
// Types (re-declared locally to avoid cross-module dependency on
// sampler-library — the caller provides these to the save functions)
// =========================================================================

/** Vendor-neutral zone (matches sampler-library ProgramYaml Zone). */
export interface CommonZone {
  sample: string;
  keyRange?: [number, number];
  velocityRange?: [number, number];
  rootKey?: number;
}

/** Vendor-neutral program (matches sampler-library ProgramYaml). */
export interface CommonProgram {
  format: 'program';
  version: 1;
  name: string;
  zones: CommonZone[];
  polyphony?: 'mono' | 'poly';
  createdAt?: string;
  sourceDevice?: string;
}

/** Vendor-neutral sample metadata (matches sampler-library SampleYaml). */
export interface CommonSample {
  format: 'sample';
  version: 1;
  name: string;
  file: string;
  sampleRate: number;
  loopMode?: 'oneShot' | 'forward' | 'alternating' | 'reverse';
  loopStart?: number;
  loopEnd?: number;
  rootKey?: number;
  sourceDevice?: string;
  createdAt?: string;
}

// =========================================================================
// Akai → Common translation
// =========================================================================

/**
 * Convert an Akai S3000XL playback type to a vendor-neutral loop mode.
 *
 * S3000XL playback types:
 *   0 = no looping (one-shot)
 *   1 = loop in release (forward loop, release plays to end)
 *   2 = loop until release
 *   3 = no looping (alternate encoding)
 */
function playbackTypeToLoopMode(
  playbackType: number,
  loopCount: number,
): 'oneShot' | 'forward' | undefined {
  if (loopCount === 0) return 'oneShot';
  if (playbackType === 1 || playbackType === 2) return 'forward';
  return 'oneShot';
}

/**
 * Convert an Akai disk sample header to vendor-neutral SampleYaml format.
 */
export function akaiSampleToCommon(header: AkaiDiskSampleHeader): CommonSample {
  const loopMode = playbackTypeToLoopMode(header.playbackType, header.loopCount);

  const result: CommonSample = {
    format: 'sample',
    version: 1,
    name: header.name.trim(),
    file: 'sample.wav',
    sampleRate: header.sampleRate,
    rootKey: header.originalPitch,
    sourceDevice: 's3000xl',
    createdAt: new Date().toISOString(),
  };

  if (loopMode && loopMode !== 'oneShot') {
    result.loopMode = loopMode;
    result.loopStart = header.playStart;
    result.loopEnd = header.playEnd;
  }

  return result;
}

/**
 * Convert an Akai disk program to vendor-neutral ProgramYaml format.
 *
 * Each Akai keygroup becomes 1-4 zones (one per velocity zone that has
 * a sample assigned). Velocity ranges are distributed evenly across the
 * zones within each keygroup.
 *
 * @param program - Parsed Akai disk program.
 * @param sampleHeaders - Map of sample name → header (for root key info).
 *   If not provided, rootKey is omitted from zones.
 */
export function akaiProgramToCommon(
  program: AkaiDiskProgram,
  sampleHeaders?: Map<string, AkaiDiskSampleHeader>,
): CommonProgram {
  const zones: CommonZone[] = [];

  for (const kg of program.keygroups) {
    const kgZones = akaiKeygroupToZones(kg, sampleHeaders);
    zones.push(...kgZones);
  }

  return {
    format: 'program',
    version: 1,
    name: program.name.trim(),
    zones,
    polyphony: program.polyphony > 1 ? 'poly' : 'mono',
    sourceDevice: 's3000xl',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Convert one Akai keygroup to 1-4 vendor-neutral zones.
 *
 * The S3000XL supports up to 4 velocity zones per keygroup (SNAME1-4).
 * Velocity ranges are distributed evenly: with 2 zones, zone 1 gets
 * 1-64 and zone 2 gets 65-127.
 */
export function akaiKeygroupToZones(
  kg: AkaiDiskKeygroup,
  sampleHeaders?: Map<string, AkaiDiskSampleHeader>,
): CommonZone[] {
  // Collect non-empty sample names
  const activeSamples = kg.sampleNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (activeSamples.length === 0) return [];

  const zones: CommonZone[] = [];
  const velocityStep = Math.floor(127 / activeSamples.length);

  for (let i = 0; i < activeSamples.length; i++) {
    const sampleName = activeSamples[i];
    const velLow = i * velocityStep + 1;
    const velHigh = i === activeSamples.length - 1 ? 127 : (i + 1) * velocityStep;

    const zone: CommonZone = {
      sample: `${sampleName}.wav`,
      keyRange: [kg.lowNote, kg.highNote],
    };

    // Only add velocity range if there are multiple zones
    if (activeSamples.length > 1) {
      zone.velocityRange = [velLow, velHigh];
    }

    // Look up root key from sample header if available
    if (sampleHeaders) {
      const header = sampleHeaders.get(sampleName);
      if (header) {
        zone.rootKey = header.originalPitch;
      }
    }

    zones.push(zone);
  }

  return zones;
}
