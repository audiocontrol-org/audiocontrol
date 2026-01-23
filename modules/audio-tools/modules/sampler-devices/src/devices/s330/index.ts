/**
 * Roland S-330 Sampler Device Support
 *
 * This module provides TypeScript interfaces, constants, and utilities
 * for communicating with Roland S-330 samplers via MIDI SysEx.
 *
 * ## Documentation
 *
 * See `/docs/s330_sysex.md` for complete SysEx protocol documentation.
 *
 * ## Device Overview
 *
 * The Roland S-330 is a 16-voice, 12-bit digital sampler (1987).
 * It uses Roland's standard SysEx format with model ID 0x1E.
 *
 * ## Module Structure
 *
 * - `s330-types.ts` - TypeScript interfaces for all data structures
 * - `s330-addresses.ts` - SysEx address map and constants
 * - `s330-params.ts` - Parameter parsing and encoding utilities
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *     S330Tone,
 *     S330Patch,
 *     buildToneAddress,
 *     calculateChecksum,
 * } from '@oletizi/sampler-devices/s330';
 *
 * // Build address for tone 5, level parameter
 * const address = buildToneAddress(5, TONE_OFFSETS.LEVEL);
 *
 * // Calculate checksum for message
 * const checksum = calculateChecksum(address, [0x64]);
 * ```
 *
 * ## Status
 *
 * This module is a stub for future implementation. Core types and
 * constants are defined, but MIDI communication is not yet implemented.
 *
 * TODO:
 * - [ ] Implement complete parameter parsing
 * - [ ] Implement parameter encoding
 * - [ ] Add bulk dump support
 * - [ ] Add wave data transfer
 * - [ ] Integration with sampler-midi client
 *
 * @packageDocumentation
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
    // MIDI Adapter
    S330MidiAdapter,

    // System types
    S330SystemParams,

    // Patch types
    S330KeyMode,
    S330AftertouchAssign,
    S330KeyAssign,
    S330PatchCommon,
    S330Patch,

    // Tone types
    S330LoopMode,
    S330LfoDestination,
    S330SampleRate,
    S330TvaEnvelope,
    S330TvfParams,
    S330LfoParams,
    S330Tone,

    // SysEx types
    S330Command,
    S330BulkDumpType,
    S330ErrorCode,
    S330SysExMessage,
    S330Response,

    // Device state types
    S330DeviceState,
    S330ClientOptions,
} from './s330-types.js';

// =============================================================================
// Constant Exports
// =============================================================================

export {
    // Device identification
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,

    // Command bytes
    S330_COMMANDS,

    // Base addresses
    ADDR_SYSTEM,
    ADDR_PATCH_BASE,
    ADDR_TONE_BASE,
    ADDR_WAVE_DATA,

    // System parameter offsets
    SYSTEM_OFFSETS,
    SYSTEM_BLOCK_SIZE,

    // Patch parameter offsets
    PATCH_COMMON_OFFSETS,
    PATCH_TOTAL_SIZE,
    TONE_MAP_ENTRIES,
    MAX_PATCHES,

    // Tone parameter offsets
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    MAX_TONES,

    // Bulk dump types
    BULK_DUMP_TYPES,

    // Error codes
    ERROR_CODES,

    // Timing constants
    TIMING,

    // Value ranges
    VALUE_RANGES,

    // Address builders
    buildPatchAddress,
    buildToneAddress,
    buildSystemAddress,
    calculateChecksum,
} from './s330-addresses.js';

// =============================================================================
// Parameter Function Exports
// =============================================================================

export {
    // Value conversion
    parseKeyMode,
    encodeKeyMode,
    parseAftertouchAssign,
    encodeAftertouchAssign,
    parseKeyAssign,
    encodeKeyAssign,
    parseLoopMode,
    encodeLoopMode,
    parseLfoDestination,
    encodeLfoDestination,
    parseSampleRate,
    encodeSampleRate,
    parseName,
    encodeName,
    parse21BitAddress,
    encode21BitAddress,
    parseSignedValue,
    encodeSignedValue,

    // Structure parsing
    parseSystemParams,
    parsePatchCommon,
    parseTone,

    // Structure encoding (stub implementations)
    encodeSystemParams,
    encodePatchCommon,
    encodeTone,

    // Validation
    isValidDeviceId,
    isValidMidiChannel,
    isValidPatchNumber,
    isValidToneNumber,
    isValid7BitValue,
    clamp7Bit,
} from './s330-params.js';

// =============================================================================
// Message Building Exports
// =============================================================================

export {
    // Nibblization
    nibblize,
    denibblize,

    // Size encoding
    encodeSize,

    // Message builders
    buildRQDMessage,
    buildWSDMessage,
    buildDATMessage,
    buildACKMessage,
    buildEODMessage,
    buildRJCMessage,
    buildERRMessage,

    // Helper functions
    buildPatchAddressRQD,
} from './s330-messages.js';

// =============================================================================
// Client Exports
// =============================================================================

export type {
    // Client interface and data types
    S330ClientInterface,
    PatchNameInfo,
    ToneNameInfo,
    MultiPartConfig,
    S330DataType,
} from './s330-client.js';

export {
    // Client factory function
    createS330Client,

    // Data type constants
    S330_DATA_TYPES,
    S330_FUNCTION_ADDRESSES,
} from './s330-client.js';
