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
