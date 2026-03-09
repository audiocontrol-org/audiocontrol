/**
 * Drum kit bundle parsing and loading.
 * @packageDocumentation
 */

export {
  parseDrumFilename,
  parseDrumKitDirectory,
  loadDrumKitBundle,
  resolveMidiNotes,
  resolveKey,
  parseNoteName,
  getAllSampleFilenames,
  midiNoteToName,
} from './drum-kit-parser.js';

export type {
  DrumSampleType,
  DetectedDrumSample,
  KitSamples,
  KitMidiNotes,
  DetectedKit,
  ResolvedDrumKitBundle,
  SliceDefinition,
} from './drum-kit-parser.js';
