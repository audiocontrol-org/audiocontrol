/**
 * Drum Kit Import Service
 *
 * Handles importing drum kit samples to the S-330 device.
 * This service encapsulates the business logic for drum kit import,
 * making it testable independently of UI components.
 *
 * @packageDocumentation
 */

import type { S330Tone, S330Patch, S330PatchCommon } from './s330-types.js';
import type { S330ClientInterface } from './s330-client.js';
import { prepareWavForS330 } from './s330-wave-format.js';
import { createEmptyToneLayer, setToneAtMidiNote } from './s330-tone-layer.js';

/**
 * A single drum sample ready for import.
 */
export interface DrumSampleInput {
  /** WAV file data as ArrayBuffer */
  wavData: ArrayBuffer;
  /** Drum type identifier */
  drumType: 'kick' | 'snare' | 'hhClosed' | 'hhOpen';
  /** Kit number (1, 2, 3...) */
  kitNumber: number;
  /** MIDI note to map this sample to */
  midiNote: number;
}

/**
 * Configuration for a drum kit import operation.
 */
export interface DrumKitImportConfig {
  /** Samples to import */
  samples: DrumSampleInput[];
  /** Target sample rate */
  sampleRate: 15000 | 30000;
  /** Starting tone slot (0-31) */
  startingToneSlot: number;
  /** Wave bank (0=A, 1=B) */
  waveBank: 0 | 1;
  /** Starting segment */
  startingSegment: number;
  /** Starting patch slot (0-15) */
  startingPatchSlot: number;
  /** Original key MIDI note (default: 60 = C4) */
  originalKey?: number;
}

/**
 * Result of importing a single sample.
 */
export interface ImportedSample {
  /** Tone slot used */
  toneSlot: number;
  /** Patch slot used */
  patchSlot: number;
  /** Segment used */
  segmentTop: number;
  /** Number of segments used */
  segmentLength: number;
  /** Sample count */
  sampleCount: number;
  /** The created tone */
  tone: S330Tone;
  /** The created patch */
  patch: S330Patch;
}

/**
 * Result of a drum kit import operation.
 */
export interface DrumKitImportResult {
  /** Successfully imported samples */
  samples: ImportedSample[];
  /** Total segments used */
  totalSegments: number;
}

/**
 * Progress callback for import operations.
 */
export type ImportProgressCallback = (
  currentSample: number,
  totalSamples: number,
  status: string
) => void;

/**
 * Default original key for drum samples (C4 / middle C).
 * Since drums use pitchFollow: false, the sample plays at its recorded pitch
 * regardless of the triggering MIDI note. The originalKey value doesn't
 * affect playback but is set to a sensible default.
 */
const DEFAULT_ORIGINAL_KEY = 60;

/**
 * Create a drum tone with one-shot loop mode.
 */
export function createDrumTone(
  name: string,
  sampleRate: 15000 | 30000,
  waveBank: 0 | 1,
  segmentTop: number,
  segmentLength: number,
  sampleCount: number,
  originalKey: number = DEFAULT_ORIGINAL_KEY
): S330Tone {
  return {
    name: name.slice(0, 8).toUpperCase().padEnd(8, ' '),
    outputAssign: 0,
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: sampleRate === 30000 ? '30kHz' : '15kHz',
    originalKey,
    wave: {
      bank: waveBank,
      segmentTop,
      segmentLength,
      startPoint: 0,
      endPoint: sampleCount,
      loopPoint: 0,
      loopLength: 0,
    },
    loopMode: 'one-shot',
    lfo: {
      rate: 50,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 64,
    },
    tvaLfoDepth: 0,
    transpose: 0, // Raw value: 0 = no pitch change (not standard MIDI bipolar)
    fineTune: 0,
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: false,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 127],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 7,
        endPoint: 8,
      },
    },
    tva: {
      lfoDepth: 0,
      keyRate: 0,
      level: 127,
      velRate: 0,
      levelCurve: 0,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 30],
        sustainPoint: 6,
        endPoint: 8,
      },
    },
    benderEnabled: false,
    aftertouchEnabled: false,
    pitchFollow: false,
    recThreshold: 64,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
  };
}

/**
 * Create a patch that maps a single MIDI note to a tone.
 */
function createSingleNotePatch(
  name: string,
  toneSlot: number,
  midiNote: number
): S330Patch {
  const toneLayer1 = createEmptyToneLayer(1);
  setToneAtMidiNote(toneLayer1, midiNote, toneSlot);

  const common: S330PatchCommon = {
    name: name.slice(0, 12).toUpperCase().padEnd(12, ' '),
    benderRange: 2,
    aftertouchSens: 64,
    keyMode: 'normal',
    velocityThreshold: 64,
    toneLayer1,
    toneLayer2: createEmptyToneLayer(2),
    copySource: 0,
    octaveShift: 0,
    level: 127,
    detune: 0,
    velocityMixRatio: 64,
    aftertouchAssign: 'modulation',
    keyAssign: 'rotary',
    outputAssign: 8,
  };

  return { common };
}

/**
 * Import a drum kit to the S-330 device.
 *
 * @param client - S330 client interface
 * @param config - Import configuration
 * @param onProgress - Optional progress callback
 * @returns Import result with details of imported samples
 */
export async function importDrumKit(
  client: S330ClientInterface,
  config: DrumKitImportConfig,
  onProgress?: ImportProgressCallback
): Promise<DrumKitImportResult> {
  const results: ImportedSample[] = [];
  let currentSegment = config.startingSegment;

  for (let i = 0; i < config.samples.length; i++) {
    const sample = config.samples[i]!;
    const toneSlot = config.startingToneSlot + i;
    const patchSlot = config.startingPatchSlot + i;

    onProgress?.(i + 1, config.samples.length, `Converting ${sample.drumType}...`);

    // Convert WAV to S330 format
    const prepared = prepareWavForS330(sample.wavData, config.sampleRate);

    console.log(`[DrumKitImportService] Sample ${i}: ${sample.drumType}`);
    console.log(`  - WAV size: ${sample.wavData.byteLength} bytes`);
    console.log(`  - S330 data: ${prepared.data.length} bytes`);
    console.log(`  - Sample count: ${prepared.sampleCount}`);
    console.log(`  - Segments needed: ${prepared.segmentLength}`);
    console.log(`  - Target segment: ${currentSegment}`);
    console.log(`  - Tone slot: ${toneSlot}`);

    // Create tone name
    const toneName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

    // Create tone object
    const tone = createDrumTone(
      toneName,
      config.sampleRate,
      config.waveBank,
      currentSegment,
      prepared.segmentLength,
      prepared.sampleCount,
      config.originalKey
    );

    onProgress?.(i + 1, config.samples.length, `Uploading ${sample.drumType}...`);

    // Upload to device
    await client.importTone({
      toneIndex: toneSlot,
      waveData: prepared.data,
      waveBank: config.waveBank,
      segmentTop: currentSegment,
      segmentLength: prepared.segmentLength,
      tone,
    });

    // Create and upload patch
    const patchName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;
    const patch = createSingleNotePatch(patchName, toneSlot, sample.midiNote);

    onProgress?.(i + 1, config.samples.length, `Creating patch ${patchName}...`);

    await client.sendPatchData(patchSlot, patch.common);

    // Record result
    results.push({
      toneSlot,
      patchSlot,
      segmentTop: currentSegment,
      segmentLength: prepared.segmentLength,
      sampleCount: prepared.sampleCount,
      tone,
      patch,
    });

    // Move to next segment
    currentSegment += prepared.segmentLength;

    // Give the S-330 time to process
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const totalSegments = currentSegment - config.startingSegment;

  return { samples: results, totalSegments };
}

/**
 * Verify that imported drum kit matches expectations by reading back from device.
 */
export async function verifyDrumKitImport(
  client: S330ClientInterface,
  importResult: DrumKitImportResult
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const sample of importResult.samples) {
    // Read back tone
    const tone = await client.requestToneData(sample.toneSlot);
    if (!tone) {
      errors.push(`Tone ${sample.toneSlot} not found on device`);
      continue;
    }

    // Verify tone parameters
    if (tone.wave.bank !== sample.tone.wave.bank) {
      errors.push(`Tone ${sample.toneSlot}: wave bank mismatch (expected ${sample.tone.wave.bank}, got ${tone.wave.bank})`);
    }
    if (tone.wave.segmentTop !== sample.tone.wave.segmentTop) {
      errors.push(`Tone ${sample.toneSlot}: segmentTop mismatch (expected ${sample.tone.wave.segmentTop}, got ${tone.wave.segmentTop})`);
    }
    if (tone.wave.segmentLength !== sample.tone.wave.segmentLength) {
      errors.push(`Tone ${sample.toneSlot}: segmentLength mismatch (expected ${sample.tone.wave.segmentLength}, got ${tone.wave.segmentLength})`);
    }
    if (tone.loopMode !== 'one-shot') {
      errors.push(`Tone ${sample.toneSlot}: loopMode should be 'one-shot', got '${tone.loopMode}'`);
    }

    // Read back patch
    const patch = await client.requestPatchData(sample.patchSlot);
    if (!patch) {
      errors.push(`Patch ${sample.patchSlot} not found on device`);
      continue;
    }

    // Verify patch has the correct tone mapping
    const expectedToneSlot = sample.toneSlot;
    const toneLayer = patch.common.toneLayer1;
    const hasToneMapping = toneLayer.some((t) => t === expectedToneSlot);
    if (!hasToneMapping) {
      errors.push(`Patch ${sample.patchSlot}: doesn't map to tone ${expectedToneSlot}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
