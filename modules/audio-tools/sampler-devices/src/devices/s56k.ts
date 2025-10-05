/**
 * Akai S5000/S6000 Program File Format Handler
 *
 * Re-export module for backward compatibility.
 * Implementation is now split across focused modules:
 * - s56k-types.ts: TypeScript interfaces and types
 * - s56k-chunks.ts: Chunk factory functions and parsing
 * - s56k-parser.ts: Binary parsing logic
 * - s56k-writer.ts: Binary writing logic
 * - s56k-program.ts: Main program API
 */

// Re-export all public types
export type {
    AkaiS56ProgramResult,
    AkaiS56kProgram,
    AmpEnvelope,
    AmpEnvelopeChunk,
    AuxEnvelope,
    AuxEnvelopeChunk,
    Chunk,
    Filter,
    FilterChunk,
    FilterEnvelope,
    FilterEnvelopeChunk,
    HeaderChunk,
    Keygroup,
    KeygroupChunk,
    Kloc,
    KlocChunk,
    Lfo1,
    Lfo1Chunk,
    Lfo2,
    Lfo2Chunk,
    Mods,
    ModsChunk,
    Output,
    OutputChunk,
    ProgramChunk,
    Tune,
    TuneChunk,
    Zone,
    ZoneChunk
} from '@/devices/s56k-types.js';

// Re-export chunk factories and utilities
export {
    bytes2Number,
    bytes2String,
    newHeaderChunk,
    newKeygroupChunk,
    newLfo1Chunk,
    newLfo2Chunk,
    newModsChunk,
    newOutputChunk,
    newProgramChunk,
    newTuneChunk,
    parseChunkHeader
} from '@/devices/s56k-chunks.js';

// Re-export main program API
export {
    newProgramFromBuffer,
    newProgramFromJson
} from '@/devices/s56k-program.js';
