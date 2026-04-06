/**
 * Multi-sample instrument (program) import to S3000XL device.
 *
 * Converts a common-area ProgramYaml (device-agnostic zones mapping
 * samples to key ranges) into an S3K program with keygroups:
 *
 * 1. Resolve zone sample references against device sample names
 * 2. Create a new program in the next available slot
 * 3. Map each zone to a keygroup with LONOTE/HINOTE and SNAME1
 *
 * This is distinct from ImportProgramDialog which handles S3K-specific
 * program bundles (program.s3k.yaml with raw SysEx). This module handles
 * the device-agnostic format by converting zones to keygroups.
 *
 * @packageDocumentation
 */

import type { ProgramYaml, Zone } from '@audiocontrol/sampler-library/browser';
import type {
  S3000xlClientInterface,
  KeygroupHeader,
} from '@audiocontrol/sampler-devices/s3k';
import { writeKeygroupField } from '@/lib/keygroup-writers';
import { writeProgramField } from '@/lib/program-writers';

// =========================================================================
// Types
// =========================================================================

/** Progress callback for instrument import. */
export interface InstrumentImportProgress {
  phase: 'resolving' | 'creating-program' | 'creating-keygroups';
  stepLabel: string;
  currentStep: number;
  totalSteps: number;
}

export interface InstrumentImportResult {
  programIndex: number;
  programName: string;
  keygroupsCreated: number;
  missingSamples: string[];
}

export interface InstrumentImportOptions {
  client: S3000xlClientInterface;
  program: ProgramYaml;
  deviceSampleNames: string[];
  onProgress: (progress: InstrumentImportProgress) => void;
}

/** Akai S3000XL sample name max length */
const AKAI_NAME_MAX = 12;

// =========================================================================
// Helpers
// =========================================================================

/**
 * Truncate a name to fit Akai's 12-character limit.
 * Pads with spaces if shorter (Akai convention).
 */
function toAkaiName(name: string): string {
  return name.substring(0, AKAI_NAME_MAX).padEnd(AKAI_NAME_MAX, ' ');
}

/**
 * Resolve a zone's sample reference against device sample names.
 *
 * Matching strategy (case-insensitive, trimmed):
 * 1. Exact match
 * 2. Prefix match (zone sample name is prefix of device name)
 * 3. Stripped extension match (zone references "kick.wav", device has "KICK")
 */
function resolveZoneSample(
  zoneSample: string,
  deviceSampleNames: string[],
): string | null {
  const needle = zoneSample.trim().toUpperCase();
  // Strip common audio extensions for matching
  const needleNoExt = needle.replace(/\.(WAV|AIF|AIFF)$/i, '');

  for (const deviceName of deviceSampleNames) {
    const dn = deviceName.trim().toUpperCase();
    // Exact match
    if (dn === needle || dn === needleNoExt) return deviceName;
  }

  // Prefix match: zone name is a prefix of a device name
  for (const deviceName of deviceSampleNames) {
    const dn = deviceName.trim().toUpperCase();
    if (dn.startsWith(needleNoExt)) return deviceName;
  }

  return null;
}

/**
 * Resolve all zone sample references against device names.
 * Returns a map of zone index -> device sample name, plus missing list.
 */
export function resolveZoneSamples(
  zones: Zone[],
  deviceSampleNames: string[],
): { resolved: Map<number, string>; missing: string[] } {
  const resolved = new Map<number, string>();
  const missing: string[] = [];

  for (let i = 0; i < zones.length; i++) {
    const match = resolveZoneSample(zones[i].sample, deviceSampleNames);
    if (match) {
      resolved.set(i, match);
    } else {
      missing.push(zones[i].sample);
    }
  }

  return { resolved, missing };
}

// =========================================================================
// Main import function
// =========================================================================

/**
 * Import a common-area program (instrument) to the S3000XL device.
 *
 * Converts ProgramYaml zones into S3K keygroups. Each zone becomes one
 * keygroup with the zone's key range, velocity range, and sample assignment.
 *
 * Zones whose samples are not found on the device are skipped (tracked in
 * missingSamples). If a zone has no keyRange, it defaults to [0, 127].
 */
export async function importInstrumentToDevice(
  options: InstrumentImportOptions,
): Promise<InstrumentImportResult> {
  const { client, program, deviceSampleNames, onProgress } = options;

  // -------------------------------------------------------------------
  // Phase 1: Resolve sample references
  // -------------------------------------------------------------------
  onProgress({
    phase: 'resolving',
    stepLabel: 'Resolving sample references...',
    currentStep: 1,
    totalSteps: 1,
  });

  const { resolved, missing } = resolveZoneSamples(
    program.zones,
    deviceSampleNames,
  );

  // Build list of zones that have resolved samples
  const validZones: Array<{ zoneIndex: number; zone: Zone; deviceSampleName: string }> = [];
  for (let i = 0; i < program.zones.length; i++) {
    const deviceSampleName = resolved.get(i);
    if (deviceSampleName) {
      validZones.push({ zoneIndex: i, zone: program.zones[i], deviceSampleName });
    }
  }

  if (validZones.length === 0) {
    throw new Error(
      `Cannot import "${program.name}": none of the ${program.zones.length} zone sample(s) were found on the device. ` +
      `Missing: ${missing.join(', ')}`,
    );
  }

  // -------------------------------------------------------------------
  // Phase 2: Create program
  // -------------------------------------------------------------------
  onProgress({
    phase: 'creating-program',
    stepLabel: 'Creating program...',
    currentStep: 1,
    totalSteps: 1,
  });

  const existingProgramNames = await client.fetchProgramNames();
  const programIndex = existingProgramNames.length;

  const templateProgram = await client.fetchProgramHeader(0);
  const programHeader = { ...templateProgram, raw: [...templateProgram.raw] };

  const programName = toAkaiName(program.name.toUpperCase());
  writeProgramField(programHeader, 'PRNAME', programName);
  writeProgramField(programHeader, 'GROUPS', validZones.length);

  await client.createProgram(programIndex, programHeader);

  // -------------------------------------------------------------------
  // Phase 3: Create keygroups
  // -------------------------------------------------------------------
  const templateKeygroup = await client.fetchKeygroupHeader(programIndex, 0);

  for (let i = 0; i < validZones.length; i++) {
    const { zone, deviceSampleName } = validZones[i];

    onProgress({
      phase: 'creating-keygroups',
      stepLabel: `Creating keygroup ${i + 1}/${validZones.length}: ${zone.sample}`,
      currentStep: i + 1,
      totalSteps: validZones.length,
    });

    const kgHeader = {
      ...templateKeygroup,
      raw: [...templateKeygroup.raw],
    } as KeygroupHeader;

    // Key range: default [0, 127] if not specified
    const loNote = zone.keyRange?.[0] ?? 0;
    const hiNote = zone.keyRange?.[1] ?? 127;
    writeKeygroupField(kgHeader, 'LONOTE', Math.max(0, Math.min(127, loNote)));
    writeKeygroupField(kgHeader, 'HINOTE', Math.max(0, Math.min(127, hiNote)));

    // Velocity range: default [1, 127]
    const loVel = zone.velocityRange?.[0] ?? 0;
    const hiVel = zone.velocityRange?.[1] ?? 127;
    writeKeygroupField(kgHeader, 'LOVEL1', loVel);
    writeKeygroupField(kgHeader, 'HIVEL1', hiVel);

    // Sample assignment
    writeKeygroupField(kgHeader, 'SNAME1', toAkaiName(deviceSampleName));

    // Tune: root key override
    if (zone.rootKey !== undefined) {
      writeKeygroupField(kgHeader, 'TUNE1', zone.rootKey);
    }

    if (i === 0) {
      // Keygroup 0 already exists from createProgram — overwrite with our config
      await client.writeKeygroupHeader(kgHeader);
    } else {
      await client.createKeygroup(programIndex, i, kgHeader);
    }
  }

  // Invalidate caches
  client.invalidateProgramCache();
  client.invalidateKeygroupCache();

  return {
    programIndex,
    programName: programName.trim(),
    keygroupsCreated: validZones.length,
    missingSamples: missing,
  };
}
