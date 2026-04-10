/**
 * Drum kit import to S3000XL device.
 *
 * Orchestrates the full import pipeline:
 * 1. Load chopped sample from library (WAV + slice definitions)
 * 2. Extract each slice as a separate Int16Array
 * 3. Send each slice to the device via SDS
 * 4. Create a new S3K program with one keygroup per slice
 * 5. Configure each keygroup: LONOTE=HINOTE=MIDI note, SNAME1=sample name
 *
 * @packageDocumentation
 */

import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadChoppedSample } from '@audiocontrol/sampler-library/browser';
import type {
  S3000xlClientInterface,
  KeygroupHeader,
} from '@audiocontrol/sampler-devices/s3k';
import { SampleHeader_writeSHNAME } from '@audiocontrol/sampler-devices/s3k';
import type { SdsTransferProgress } from '@audiocontrol/midi-core';
import type { ChoppedSample, DrumKitChoppedSample } from '@audiocontrol/sampler-library/browser';
import { parseWavFile } from '@/lib/wav-reader';
import { parseMidiNote } from '@/lib/midi-note-parser';
import { writeKeygroupField } from '@/lib/keygroup-writers';
import { writeProgramField } from '@/lib/program-writers';

// =========================================================================
// Types
// =========================================================================

/** Progress callback for the drum kit import pipeline. */
export interface DrumKitImportProgress {
  /** Current phase of the import */
  phase: 'loading' | 'sending-samples' | 'creating-program' | 'creating-keygroups';
  /** Human-readable description of the current step */
  stepLabel: string;
  /** Current step within the phase (1-based) */
  currentStep: number;
  /** Total steps in the current phase */
  totalSteps: number;
  /** SDS progress for sample transfers (only during 'sending-samples' phase) */
  sdsProgress?: SdsTransferProgress | null;
}

export interface DrumKitImportOptions {
  /** S3000XL MIDI client */
  client: S3000xlClientInterface;
  /** Library storage root */
  libraryRoot: StorageDirectoryHandle;
  /** Sample directory name in the library */
  sampleName: string;
  /** Path within the samples directory */
  samplePath: string[];
  /** Progress callback */
  onProgress: (progress: DrumKitImportProgress) => void;
}

export interface DrumKitImportResult {
  /** Device program index where the program was created */
  programIndex: number;
  /** Program name on the device */
  programName: string;
  /** Number of samples sent */
  sampleCount: number;
  /** Number of keygroups created */
  keygroupCount: number;
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
 * Generate a unique Akai-safe sample name for a slice.
 *
 * Strategy: use the slice label truncated to fit, with a numeric suffix
 * if needed for disambiguation. If labels are unique, uses them as-is.
 */
function generateSliceSampleNames(
  sliceLabels: string[],
  kitPrefix: string,
): string[] {
  // Try label-based names first; fall back to prefix + index
  const names: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < sliceLabels.length; i++) {
    // Clean the label: uppercase, remove non-ASCII
    let candidate = sliceLabels[i].toUpperCase().replace(/[^A-Z0-9 _-]/g, '');
    if (!candidate) {
      candidate = `${kitPrefix}${String(i + 1).padStart(2, '0')}`;
    }

    candidate = candidate.substring(0, AKAI_NAME_MAX);

    // Deduplicate
    if (seen.has(candidate)) {
      const suffix = String(i + 1).padStart(2, '0');
      candidate = candidate.substring(0, AKAI_NAME_MAX - suffix.length) + suffix;
    }

    seen.add(candidate);
    names.push(toAkaiName(candidate));
  }

  return names;
}

/**
 * Extract a slice from full PCM data as a new Int16Array.
 */
function extractSlice(
  fullSamples: Int16Array,
  startSample: number,
  endSample: number,
): Int16Array {
  // endSample is exclusive per the schema
  const clampedStart = Math.max(0, Math.min(startSample, fullSamples.length));
  const clampedEnd = Math.max(clampedStart, Math.min(endSample, fullSamples.length));
  return fullSamples.slice(clampedStart, clampedEnd);
}

/**
 * Get the base MIDI note from a chopped sample manifest.
 * Drum kit variants specify baseNote; generic defaults to C2 (36).
 */
function getBaseNote(manifest: ChoppedSample): number {
  if (manifest.variant === 'drum-kit') {
    const drumKit = manifest as DrumKitChoppedSample;
    return parseMidiNote(drumKit.drumKit.baseNote);
  }
  // Default base note for generic chopped samples
  return 36; // C2
}

/**
 * Derive a short kit prefix from the sample name for naming slices.
 * e.g., "My Drum Kit" -> "MYDRM"
 */
function deriveKitPrefix(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Take up to 5 chars to leave room for 2-digit suffix + padding
  return cleaned.substring(0, 5) || 'KIT';
}

// =========================================================================
// Main import function
// =========================================================================

/**
 * Import a drum kit from the library to the S3000XL device.
 *
 * This is the core orchestration function. It:
 * 1. Loads the chopped sample (manifest + WAV) from the library
 * 2. Parses the WAV to get PCM data
 * 3. Sends each slice as a separate SDS sample to the device
 * 4. Creates a new program with one keygroup per slice
 * 5. Configures each keygroup's note range and sample assignment
 *
 * @throws If the manifest has no slices, the device rejects a transfer, etc.
 */
export async function importDrumKitToDevice(
  options: DrumKitImportOptions,
): Promise<DrumKitImportResult> {
  const { client, libraryRoot, sampleName, samplePath, onProgress } = options;

  // -----------------------------------------------------------------------
  // Phase 1: Load from library
  // -----------------------------------------------------------------------
  onProgress({
    phase: 'loading',
    stepLabel: `Loading "${sampleName}" from library...`,
    currentStep: 1,
    totalSteps: 1,
  });

  const { manifest, wavData } = await loadChoppedSample(libraryRoot, sampleName, samplePath);

  if (!manifest.slices || manifest.slices.length === 0) {
    throw new Error(`Drum kit "${sampleName}" has no slices defined`);
  }

  const wavInfo = parseWavFile(wavData);
  const slices = manifest.slices;
  const baseNote = getBaseNote(manifest);
  const sampleRate = manifest.sampleRate;

  // Generate Akai-safe names for each slice
  const kitPrefix = deriveKitPrefix(manifest.name);
  const sliceSampleNames = generateSliceSampleNames(
    slices.map((s) => s.label),
    kitPrefix,
  );

  // -----------------------------------------------------------------------
  // Phase 2: Send all slices via SDS (no SysEx between uploads)
  // -----------------------------------------------------------------------
  // The S3000XL can't handle SysEx interleaved with SDS transfers —
  // SDS disables MIDI-over-SCSI mode. Send all audio first, then do
  // all SysEx (verification, renames, program, keygroups) afterward.
  const existingSampleNames = await client.fetchSampleNames();
  const startSlot = existingSampleNames.length;

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i];
    const sliceAudio = extractSlice(wavInfo.samples, slice.startSample, slice.endSample);
    const sliceName = sliceSampleNames[i];

    onProgress({
      phase: 'sending-samples',
      stepLabel: `Sending sample ${i + 1}/${slices.length}: ${sliceName.trim()}`,
      currentStep: i + 1,
      totalSteps: slices.length,
      sdsProgress: null,
    });

    await client.uploadSampleRaw(startSlot + i, sliceAudio, sampleRate, (sdsProgress) => {
      onProgress({
        phase: 'sending-samples',
        stepLabel: `Sending sample ${i + 1}/${slices.length}: ${sliceName.trim()}`,
        currentStep: i + 1,
        totalSteps: slices.length,
        sdsProgress,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Phase 2b: Verify all samples arrived and rename them
  // -----------------------------------------------------------------------
  const refreshedSampleNames = await client.refreshSampleNames();
  if (refreshedSampleNames.length < startSlot + slices.length) {
    throw new Error(
      `Expected ${startSlot + slices.length} samples after SDS, got ${refreshedSampleNames.length}`,
    );
  }

  for (let i = 0; i < slices.length; i++) {
    const idx = startSlot + i;
    const header = await client.fetchSampleHeader(idx);
    header.SHNAME = sliceSampleNames[i];
    SampleHeader_writeSHNAME(header, sliceSampleNames[i]);
    await client.writeSampleHeader(header);
  }

  // Re-fetch names after rename so keygroup sample assignment uses correct names
  const renamedSampleNames = await client.refreshSampleNames();

  // -----------------------------------------------------------------------
  // Phase 3: Create program
  // -----------------------------------------------------------------------
  onProgress({
    phase: 'creating-program',
    stepLabel: 'Creating program...',
    currentStep: 1,
    totalSteps: 1,
  });

  // Find the next available program slot
  const existingProgramNames = await client.fetchProgramNames();
  const programIndex = existingProgramNames.length;

  // Use program 0 as a template for the new program's raw data
  const templateProgram = await client.fetchProgramHeader(0);
  const programHeader = { ...templateProgram, raw: [...templateProgram.raw] };

  // Set program name (truncated to 12 chars)
  const programName = toAkaiName(manifest.name.toUpperCase());
  writeProgramField(programHeader, 'PRNAME', programName);
  writeProgramField(programHeader, 'GROUPS', slices.length);

  await client.createProgram(programIndex, programHeader);

  // -----------------------------------------------------------------------
  // Phase 4: Create keygroups
  // -----------------------------------------------------------------------
  // Fetch keygroup 0 from the newly written program as a template
  const templateKeygroup = await client.fetchKeygroupHeader(programIndex, 0);

  for (let i = 0; i < slices.length; i++) {
    const midiNote = baseNote + i;
    // Clamp to valid MIDI note range (21-127 for Akai, per LONOTE spec)
    const clampedNote = Math.max(21, Math.min(127, midiNote));

    // Use the renamed sample name
    const deviceSampleName = renamedSampleNames[startSlot + i] ?? sliceSampleNames[i];

    onProgress({
      phase: 'creating-keygroups',
      stepLabel: `Creating keygroup ${i + 1}/${slices.length}: ${sliceSampleNames[i].trim()}`,
      currentStep: i + 1,
      totalSteps: slices.length,
    });

    // Clone the template raw data for this keygroup
    const kgHeader = {
      ...templateKeygroup,
      raw: [...templateKeygroup.raw],
    } as KeygroupHeader;

    // Set note range: single note per keygroup
    writeKeygroupField(kgHeader, 'LONOTE', clampedNote);
    writeKeygroupField(kgHeader, 'HINOTE', clampedNote);

    // Assign sample to velocity zone 1
    writeKeygroupField(kgHeader, 'SNAME1', toAkaiName(deviceSampleName));

    // Full velocity range for zone 1
    writeKeygroupField(kgHeader, 'LOVEL1', 0);
    writeKeygroupField(kgHeader, 'HIVEL1', 127);

    // Playback mode: play to sample end (one-shot for drums)
    writeKeygroupField(kgHeader, 'ZPLAY1', 4);

    if (i === 0) {
      // Keygroup 0 already exists from createProgram — overwrite with our config
      await client.writeKeygroupHeader(kgHeader);
    } else {
      await client.createKeygroup(programIndex, i, kgHeader);
    }
  }

  // Invalidate caches so fresh data is fetched
  client.invalidateProgramCache();
  client.invalidateKeygroupCache();
  client.invalidateSampleCache();

  return {
    programIndex,
    programName: programName.trim(),
    sampleCount: slices.length,
    keygroupCount: slices.length,
  };
}

