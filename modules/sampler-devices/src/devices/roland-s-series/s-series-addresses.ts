/**
 * Roland S-Series Shared Address Constants
 *
 * Address definitions shared between S-330 and S-550 samplers.
 * Both devices use identical patch/tone address layouts, parameter offsets,
 * and address-building functions.
 *
 * @packageDocumentation
 */

// =============================================================================
// Patch Parameter Offsets
// =============================================================================

/**
 * Patch parameter offsets (byte positions after de-nibblization)
 *
 * Each patch is 512 bytes total (1024 nibbles)
 */
export const PATCH_COMMON_OFFSETS = {
    NAME: 0,                 // 12 bytes
    BENDER_RANGE: 12,
    AFTERTOUCH_SENS: 14,
    KEY_MODE: 15,
    VELOCITY_THRESHOLD: 16,
    TONE_LAYER_1: 17,        // 109 entries
    TONE_LAYER_2: 126,       // 109 entries
    COPY_SOURCE: 235,
    OCTAVE_SHIFT: 284,
    LEVEL: 285,
    DETUNE: 287,
    VELOCITY_MIX_RATIO: 288,
    AFTERTOUCH_ASSIGN: 289,
    KEY_ASSIGN: 290,
    OUTPUT_ASSIGN: 291,
} as const;

/** Total size of patch data (512 bytes after de-nibblization) */
export const PATCH_TOTAL_SIZE = 512;

// =============================================================================
// Patch Parameter Definitions (Semantic API)
// =============================================================================

/**
 * Defines a patch parameter with both address and byte offset.
 */
export interface PatchParam {
    /** Human-readable parameter name for debugging */
    name: string;
    /** [high, low] nibble offset within patch address space */
    address: readonly [number, number];
    /** Offset in parsed (de-nibblized) patch data */
    byteOffset: number;
    /** Size in bytes (default 1) */
    size: number;
}

/**
 * All patch parameters with their addresses and byte offsets.
 */
export const PATCH_PARAMS = {
    name: {
        name: 'Name',
        address: [0x00, 0x00] as const,
        byteOffset: 0,
        size: 12,
    },
    benderRange: {
        name: 'Bender Range',
        address: [0x00, 0x18] as const,
        byteOffset: 12,
        size: 1,
    },
    aftertouchSens: {
        name: 'A.T. Sensitivity',
        address: [0x00, 0x1c] as const,
        byteOffset: 14,
        size: 1,
    },
    keyMode: {
        name: 'Key Mode',
        address: [0x00, 0x1e] as const,
        byteOffset: 15,
        size: 1,
    },
    velocityThreshold: {
        name: 'V-Sw Threshold',
        address: [0x00, 0x20] as const,
        byteOffset: 16,
        size: 1,
    },
    toneLayer1: {
        name: 'Tone Layer 1',
        address: [0x00, 0x22] as const,
        byteOffset: 17,
        size: 109,
    },
    toneLayer2: {
        name: 'Tone Layer 2',
        address: [0x01, 0x7c] as const,
        byteOffset: 126,
        size: 109,
    },
    copySource: {
        name: 'Copy Source',
        address: [0x03, 0x56] as const,
        byteOffset: 235,
        size: 1,
    },
    octaveShift: {
        name: 'Octave Shift',
        address: [0x03, 0x58] as const,
        byteOffset: 236,
        size: 1,
    },
    level: {
        name: 'Level',
        address: [0x03, 0x5a] as const,
        byteOffset: 237,
        size: 1,
    },
    detune: {
        name: 'Detune',
        address: [0x03, 0x5e] as const,
        byteOffset: 239,
        size: 1,
    },
    velocityMixRatio: {
        name: 'V-Mix Ratio',
        address: [0x03, 0x60] as const,
        byteOffset: 240,
        size: 1,
    },
    aftertouchAssign: {
        name: 'A.T. Assign',
        address: [0x03, 0x62] as const,
        byteOffset: 241,
        size: 1,
    },
    keyAssign: {
        name: 'Key Assign',
        address: [0x03, 0x64] as const,
        byteOffset: 242,
        size: 1,
    },
    outputAssign: {
        name: 'Output Assign',
        address: [0x03, 0x66] as const,
        byteOffset: 243,
        size: 1,
    },
} as const satisfies Record<string, PatchParam>;

/** Number of tone mapping entries per layer (MIDI notes 12-120, C0-C9) */
export const TONE_MAP_ENTRIES = 109;

// =============================================================================
// Tone Parameter Offsets
// =============================================================================

/**
 * Tone parameter offsets (byte positions after de-nibblization)
 */
export const TONE_OFFSETS = {
    // === Basic Info ===
    NAME: 0,
    OUTPUT_ASSIGN: 8,
    SOURCE_TONE: 9,
    ORIG_SUB_TONE: 10,
    SAMPLING_FREQ: 11,
    ORIG_KEY_NUMBER: 12,
    WAVE_BANK: 13,
    WAVE_SEGMENT_TOP: 14,
    WAVE_SEGMENT_LENGTH: 15,

    // === Wave Points (24-bit addresses) ===
    START_POINT: 16,
    END_POINT: 19,
    LOOP_POINT: 22,
    LOOP_MODE: 25,

    // === LFO Parameters ===
    TVA_LFO_DEPTH: 26,
    LFO_RATE: 28,
    LFO_SYNC: 29,
    LFO_DELAY: 30,
    LFO_MODE: 32,
    TVA_LFO_DEPTH_2: 33,
    LFO_POLARITY: 34,
    LFO_OFFSET: 35,

    // === Pitch Parameters ===
    TRANSPOSE: 36,
    FINE_TUNE: 37,

    // === TVF Parameters ===
    TVF_CUTOFF: 38,
    TVF_RESONANCE: 39,
    TVF_KEY_FOLLOW: 40,
    TVF_LFO_DEPTH: 42,
    TVF_EG_DEPTH: 43,
    TVF_EG_POLARITY: 44,
    TVF_LEVEL_CURVE: 45,
    TVF_KEY_RATE_FOLLOW: 46,
    TVF_VEL_RATE_FOLLOW: 47,
    TVF_SWITCH: 49,

    // === Bender Switch ===
    BENDER_SWITCH: 50,

    // === TVA Envelope Config ===
    TVA_ENV_SUSTAIN_POINT: 51,
    TVA_ENV_END_POINT: 52,

    // === TVA Envelope Points 1-8 ===
    TVA_ENV_LEVEL_1: 53,
    TVA_ENV_RATE_1: 54,
    TVA_ENV_LEVEL_2: 55,
    TVA_ENV_RATE_2: 56,
    TVA_ENV_LEVEL_3: 57,
    TVA_ENV_RATE_3: 58,
    TVA_ENV_LEVEL_4: 59,
    TVA_ENV_RATE_4: 60,
    TVA_ENV_LEVEL_5: 61,
    TVA_ENV_RATE_5: 62,
    TVA_ENV_LEVEL_6: 63,
    TVA_ENV_RATE_6: 64,
    TVA_ENV_LEVEL_7: 65,
    TVA_ENV_RATE_7: 66,
    TVA_ENV_LEVEL_8: 67,
    TVA_ENV_RATE_8: 68,

    // === TVA Additional Parameters ===
    TVA_KEY_RATE: 70,
    TVA_LEVEL: 71,
    TVA_VEL_RATE: 72,
    REC_THRESHOLD: 73,
    REC_PRE_TRIGGER: 74,
    REC_SAMPLING_FREQ: 75,
    REC_START_POINT: 76,
    REC_END_POINT: 79,
    REC_LOOP_POINT: 82,
    ZOOM_T: 85,
    ZOOM_L: 86,
    COPY_SOURCE: 87,
    LOOP_TUNE: 88,
    TVA_LEVEL_CURVE: 89,

    // === Loop Length ===
    LOOP_LENGTH: 102,

    // === Additional Settings ===
    PITCH_FOLLOW: 105,
    ENV_ZOOM: 106,

    // === TVF Envelope Config ===
    TVF_ENV_SUSTAIN_POINT: 107,
    TVF_ENV_END_POINT: 108,

    // === TVF Envelope Points 1-8 ===
    TVF_ENV_LEVEL_1: 109,
    TVF_ENV_RATE_1: 110,
    TVF_ENV_LEVEL_2: 111,
    TVF_ENV_RATE_2: 112,
    TVF_ENV_LEVEL_3: 113,
    TVF_ENV_RATE_3: 114,
    TVF_ENV_LEVEL_4: 115,
    TVF_ENV_RATE_4: 116,
    TVF_ENV_LEVEL_5: 117,
    TVF_ENV_RATE_5: 118,
    TVF_ENV_LEVEL_6: 119,
    TVF_ENV_RATE_6: 120,
    TVF_ENV_LEVEL_7: 121,
    TVF_ENV_RATE_7: 122,
    TVF_ENV_LEVEL_8: 123,
    TVF_ENV_RATE_8: 124,

    // === Aftertouch Switch ===
    AFTERTOUCH_SWITCH: 125,
} as const;

/** Size of tone block in bytes (after de-nibblization) */
export const TONE_BLOCK_SIZE = 256;

/** Size of tone block in nibbles (for RQD size calculation) */
export const TONE_BLOCK_NIBBLES = 512;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build patch address from patch number and offset
 */
export function buildPatchAddress(patchNumber: number, offset: number): number[] {
    return [0x00, 0x00, (patchNumber * 4) & 0x7F, offset & 0x7F];
}

/**
 * Build patch parameter address from patch index and PatchParam definition
 */
export function buildPatchParamAddress(patchIndex: number, param: PatchParam): number[] {
    const [high, low] = param.address;
    return [0x00, 0x00, (patchIndex * 4 + high) & 0x7f, low & 0x7f];
}

/**
 * Build tone address from tone number and offset
 */
export function buildToneAddress(toneNumber: number, offset: number): number[] {
    const byte2 = toneNumber * 2;
    return [0x00, 0x03, byte2 & 0x7F, offset & 0x7F];
}

/**
 * Build system parameter address from offset
 */
export function buildSystemAddress(offset: number): number[] {
    return [0x00, 0x00, 0x00, offset & 0x7F];
}
