/**
 * @module sampler-midi
 * @description MIDI communication library for sampler control with dependency injection architecture.
 *
 * This library provides a complete MIDI system for sampler communication with:
 * - Interface-first design with dependency injection
 * - Backend abstraction (supports EasyMidi, Web MIDI API, etc.)
 * - Type-safe MIDI port management
 * - Instrument abstraction for simplified note control
 *
 * @example
 * ```typescript
 * import { MidiSystem, EasyMidiBackend } from '@oletizi/sampler-midi';
 *
 * // Explicit backend injection (recommended)
 * const backend = new EasyMidiBackend();
 * const midiSystem = new MidiSystem(backend);
 * await midiSystem.start({ debug: true });
 *
 * // Send MIDI messages
 * const output = midiSystem.getCurrentOutput();
 * if (output) {
 *   output.sendNoteOn(60, 127, 0);
 * }
 * ```
 */

// Re-export akaitools from sampler-devices for backward compatibility
export {
    newAkaitools,
    newAkaiToolsConfig,
    readAkaiData,
    writeAkaiData,
    CHUNK_LENGTH,
    RAW_LEADER,
    type Akaitools,
    type AkaiProgramFile,
    type ExecutionResult
} from "@oletizi/sampler-devices"

// Export client implementations
export * from "@/client/client-akai-s3000xl.js"

// Export MIDI system
export { MidiSystem } from "@/midi.js"
export type {
  MidiSystemInterface,
  MidiPort,
  MidiInput,
  MidiOutput,
  MidiConfig
} from "@/midi.js"

// Export instrument abstraction
export * from "@/instrument.js"

// Export backend interfaces and implementations
export type {
  MidiBackend,
  MidiPortInfo,
  RawMidiInput,
  RawMidiOutput
} from "@/backend.js"

export { EasyMidiBackend } from "@/easymidi-backend.js"
