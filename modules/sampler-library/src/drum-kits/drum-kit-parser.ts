/**
 * Drum kit filename parsing and bundle loading.
 *
 * Provides functions to auto-detect drum samples from filenames
 * following the convention `{TYPE} {##}.wav` and merge with
 * optional kit.yaml configuration.
 *
 * @packageDocumentation
 */

import type { DrumKitBundle } from '@/schemas/drum-kit-bundle-schema.js';

/**
 * Recognized drum sample types.
 */
export type DrumSampleType = 'kick' | 'snare' | 'hhClosed' | 'hhOpen';

/**
 * Result of parsing a single drum sample filename.
 */
export interface DetectedDrumSample {
  /** Drum type (kick, snare, etc.) */
  type: DrumSampleType;
  /** Kit number (1, 2, 3...) */
  kitNumber: number;
  /** Original filename */
  filename: string;
}

/**
 * Sample references for a single 4-piece kit.
 */
export interface KitSamples {
  kick?: string;
  snare?: string;
  hhClosed?: string;
  hhOpen?: string;
}

/**
 * MIDI note assignments for a single 4-piece kit.
 */
export interface KitMidiNotes {
  kick: number;
  snare: number;
  hhClosed: number;
  hhOpen: number;
}

/**
 * A complete detected kit with samples and MIDI mapping.
 */
export interface DetectedKit {
  /** Kit number (1, 2, 3...) */
  kitNumber: number;
  /** Sample filenames (may have missing entries) */
  samples: KitSamples;
  /** MIDI note assignments */
  midiNotes: KitMidiNotes;
  /** Whether all 4 samples are present */
  isComplete: boolean;
}

/**
 * Resolved drum kit bundle with all kits and metadata.
 */
export interface ResolvedDrumKitBundle {
  /** Bundle name */
  name: string;
  /** Optional description */
  description?: string;
  /** Sample rate (15000 or 30000 Hz) */
  sampleRate: 15000 | 30000;
  /** Base MIDI note for first kit */
  baseNote: number;
  /** Detected/configured kits */
  kits: DetectedKit[];
  /** Total number of samples across all kits */
  totalSamples: number;
  /** Whether all kits have complete sample sets */
  allComplete: boolean;
}

/**
 * Filename patterns for drum sample types.
 *
 * Preferred format: "01 KICK.wav" (kit number first)
 * Also supports: "KICK 01.wav", "kick01.wav", "kick_01.wav"
 */
const DRUM_PATTERNS: Array<{ pattern: RegExp; type: DrumSampleType }> = [
  // Preferred format: number first (e.g., "01 KICK", "01_KICK", "01-KICK")
  { pattern: /^(\d+)[_\s-]?kick/i, type: 'kick' },
  { pattern: /^(\d+)[_\s-]?snare/i, type: 'snare' },
  { pattern: /^(\d+)[_\s-]?hhc/i, type: 'hhClosed' },
  { pattern: /^(\d+)[_\s-]?hho/i, type: 'hhOpen' },
  // Legacy format: name first (e.g., "KICK 01", "kick01", "kick_01")
  { pattern: /^kick[_\s-]?(\d+)/i, type: 'kick' },
  { pattern: /^snare[_\s-]?(\d+)/i, type: 'snare' },
  { pattern: /^hhc[_\s-]?(\d+)/i, type: 'hhClosed' },
  { pattern: /^hho[_\s-]?(\d+)/i, type: 'hhOpen' },
  // Additional patterns for common naming conventions
  { pattern: /^(\d+)[_\s-]?closed[_\s-]?hat/i, type: 'hhClosed' },
  { pattern: /^(\d+)[_\s-]?open[_\s-]?hat/i, type: 'hhOpen' },
  { pattern: /^closed[_\s-]?hat[_\s-]?(\d+)/i, type: 'hhClosed' },
  { pattern: /^open[_\s-]?hat[_\s-]?(\d+)/i, type: 'hhOpen' },
  { pattern: /^hihat[_\s-]?closed[_\s-]?(\d+)/i, type: 'hhClosed' },
  { pattern: /^hihat[_\s-]?open[_\s-]?(\d+)/i, type: 'hhOpen' },
];

/**
 * MIDI note name to number mapping.
 */
const NOTE_NAMES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

/**
 * Parse a MIDI note name to a note number.
 *
 * @param noteName - Note name like "C1", "F#4", "Bb3"
 * @returns MIDI note number (0-127)
 */
export function parseNoteName(noteName: string): number {
  const match = noteName.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, letter, accidental, octaveStr] = match;
  const baseName = (letter?.toUpperCase() ?? 'C') + (accidental ?? '');
  const octave = parseInt(octaveStr ?? '0', 10);

  const semitone = NOTE_NAMES[baseName];
  if (semitone === undefined) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  // MIDI note = (octave + 1) * 12 + semitone
  // C-1 = 0, C0 = 12, C1 = 24, C2 = 36, etc.
  return (octave + 1) * 12 + semitone;
}

/**
 * Resolve a key specification to a MIDI note number.
 *
 * @param key - Note name (e.g., "C1") or MIDI number
 * @returns MIDI note number
 */
export function resolveKey(key: string | number): number {
  if (typeof key === 'number') {
    return key;
  }
  return parseNoteName(key);
}

/**
 * Parse a single filename to detect drum type and kit number.
 *
 * @param filename - WAV filename (e.g., "KICK 01.wav")
 * @returns Detected sample info or null if not recognized
 */
export function parseDrumFilename(filename: string): DetectedDrumSample | null {
  // Remove .wav extension and path
  const baseName = filename.replace(/\.wav$/i, '').split('/').pop() ?? '';

  for (const { pattern, type } of DRUM_PATTERNS) {
    const match = baseName.match(pattern);
    if (match?.[1]) {
      const kitNumber = parseInt(match[1], 10);
      if (!isNaN(kitNumber) && kitNumber > 0) {
        return {
          type,
          kitNumber,
          filename,
        };
      }
    }
  }

  return null;
}

/**
 * Calculate MIDI notes for a kit given base note and kit index.
 *
 * Each kit gets 4 consecutive MIDI notes starting at:
 * baseNote + (kitIndex * 4)
 *
 * @param baseNote - Base MIDI note (e.g., 24 for C1)
 * @param kitIndex - Zero-based kit index
 * @returns MIDI note assignments for kick, snare, hhClosed, hhOpen
 */
export function resolveMidiNotes(baseNote: number, kitIndex: number): KitMidiNotes {
  const start = baseNote + kitIndex * 4;
  return {
    kick: start,
    snare: start + 1,
    hhClosed: start + 2,
    hhOpen: start + 3,
  };
}

/**
 * Scan filenames and detect drum kits.
 *
 * Groups samples by kit number and returns detected kits
 * sorted by kit number.
 *
 * @param files - Array of filenames in the directory
 * @param baseNote - Base MIDI note for first kit (default: 36 = C2)
 * @returns Array of detected kits
 */
export function parseDrumKitDirectory(
  files: string[],
  baseNote: number = 36
): DetectedKit[] {
  // Parse all filenames
  const samples = files
    .map(parseDrumFilename)
    .filter((s): s is DetectedDrumSample => s !== null);

  // Group by kit number
  const kitMap = new Map<number, KitSamples>();

  for (const sample of samples) {
    let kit = kitMap.get(sample.kitNumber);
    if (!kit) {
      kit = {};
      kitMap.set(sample.kitNumber, kit);
    }
    kit[sample.type] = sample.filename;
  }

  // Convert to array and sort by kit number
  const kitNumbers = Array.from(kitMap.keys()).sort((a, b) => a - b);

  return kitNumbers.map((kitNumber, index) => {
    const samples = kitMap.get(kitNumber)!;
    const isComplete = Boolean(
      samples.kick && samples.snare && samples.hhClosed && samples.hhOpen
    );

    return {
      kitNumber,
      samples,
      midiNotes: resolveMidiNotes(baseNote, index),
      isComplete,
    };
  });
}

/**
 * Count the number of samples in a kit.
 */
function countKitSamples(samples: KitSamples): number {
  let count = 0;
  if (samples.kick) count++;
  if (samples.snare) count++;
  if (samples.hhClosed) count++;
  if (samples.hhOpen) count++;
  return count;
}

/**
 * Load and resolve a drum kit bundle.
 *
 * Merges the optional kit.yaml configuration with auto-detected
 * samples from filenames. If kit.yaml specifies explicit kits,
 * those override auto-detection.
 *
 * @param yaml - Parsed kit.yaml or null for auto-detection only
 * @param files - Array of filenames in the directory
 * @param directoryName - Name of the kit directory (used as fallback name)
 * @returns Resolved drum kit bundle
 */
export function loadDrumKitBundle(
  yaml: DrumKitBundle | null,
  files: string[],
  directoryName: string
): ResolvedDrumKitBundle {
  // Determine base note (default C2 = MIDI 36)
  const baseNoteRaw = yaml?.baseNote ?? 'C2';
  const baseNote = typeof baseNoteRaw === 'number' ? baseNoteRaw : resolveKey(baseNoteRaw);

  // Use name from YAML or directory name
  const name = yaml?.name ?? directoryName;
  const description = yaml?.description;
  const sampleRate = yaml?.sampleRate ?? 15000;

  let kits: DetectedKit[];

  if (yaml?.kits && yaml.kits.length > 0) {
    // Use explicit kit definitions from YAML
    kits = yaml.kits.map((entry, index) => ({
      kitNumber: index + 1,
      samples: {
        kick: entry.samples.kick,
        snare: entry.samples.snare,
        hhClosed: entry.samples.hhClosed,
        hhOpen: entry.samples.hhOpen,
      },
      midiNotes: resolveMidiNotes(baseNote, index),
      isComplete: true, // YAML-specified kits are assumed complete
    }));
  } else {
    // Auto-detect from filenames
    kits = parseDrumKitDirectory(files, baseNote);
  }

  // Calculate totals
  const totalSamples = kits.reduce(
    (sum, kit) => sum + countKitSamples(kit.samples),
    0
  );
  const allComplete = kits.every((kit) => kit.isComplete);

  return {
    name,
    description,
    sampleRate,
    baseNote,
    kits,
    totalSamples,
    allComplete,
  };
}

/**
 * Get a list of all sample filenames in a resolved bundle.
 *
 * @param bundle - Resolved drum kit bundle
 * @returns Array of sample filenames
 */
export function getAllSampleFilenames(bundle: ResolvedDrumKitBundle): string[] {
  const filenames: string[] = [];

  for (const kit of bundle.kits) {
    if (kit.samples.kick) filenames.push(kit.samples.kick);
    if (kit.samples.snare) filenames.push(kit.samples.snare);
    if (kit.samples.hhClosed) filenames.push(kit.samples.hhClosed);
    if (kit.samples.hhOpen) filenames.push(kit.samples.hhOpen);
  }

  return filenames;
}

/**
 * Convert MIDI note number to note name.
 *
 * @param midiNote - MIDI note number (0-127)
 * @returns Note name like "C1", "F#4"
 */
export function midiNoteToName(midiNote: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const note = noteNames[midiNote % 12];
  return `${note}${octave}`;
}
