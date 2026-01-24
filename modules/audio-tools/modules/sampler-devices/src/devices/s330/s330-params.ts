/**
 * Roland S-330 Parameter Definitions
 *
 * Parameter parsing, validation, and conversion utilities.
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * @packageDocumentation
 */

import {
    S330SystemParams,
    S330PatchCommon,
    S330Tone,
    S330KeyMode,
    S330AftertouchAssign,
    S330KeyAssign,
    S330LoopMode,
    S330LfoDestination,
    S330SampleRate,
} from './s330-types.js';

import {
    SYSTEM_OFFSETS,
    PATCH_COMMON_OFFSETS,
    TONE_OFFSETS,
    PATCH_PARAMS,
} from './s330-addresses.js';

// =============================================================================
// Value Conversion Functions
// =============================================================================

/**
 * Convert key mode byte to enum
 */
export function parseKeyMode(value: number): S330KeyMode {
    switch (value) {
        case 0: return 'normal';
        case 1: return 'v-sw';
        case 2: return 'x-fade';
        case 3: return 'v-mix';
        case 4: return 'unison';
        default: return 'normal';
    }
}

/**
 * Convert key mode enum to byte
 */
export function encodeKeyMode(mode: S330KeyMode): number {
    switch (mode) {
        case 'normal': return 0;
        case 'v-sw': return 1;
        case 'x-fade': return 2;
        case 'v-mix': return 3;
        case 'unison': return 4;
    }
}

/**
 * Convert aftertouch assign byte to enum
 */
export function parseAftertouchAssign(value: number): S330AftertouchAssign {
    switch (value) {
        case 0: return 'modulation';
        case 1: return 'volume';
        case 2: return 'bend+';
        case 3: return 'bend-';
        case 4: return 'filter';
        default: return 'modulation';
    }
}

/**
 * Convert aftertouch assign enum to byte
 */
export function encodeAftertouchAssign(assign: S330AftertouchAssign): number {
    switch (assign) {
        case 'modulation': return 0;
        case 'volume': return 1;
        case 'bend+': return 2;
        case 'bend-': return 3;
        case 'filter': return 4;
    }
}

/**
 * Convert key assign byte to enum
 */
export function parseKeyAssign(value: number): S330KeyAssign {
    return value === 1 ? 'fix' : 'rotary';
}

/**
 * Convert key assign enum to byte
 */
export function encodeKeyAssign(assign: S330KeyAssign): number {
    return assign === 'fix' ? 1 : 0;
}

/**
 * Convert loop mode byte to enum
 */
export function parseLoopMode(value: number): S330LoopMode {
    switch (value) {
        case 0: return 'forward';
        case 1: return 'alternating';
        case 2: return 'one-shot';
        default: return 'forward';
    }
}

/**
 * Convert loop mode enum to byte
 */
export function encodeLoopMode(mode: S330LoopMode): number {
    switch (mode) {
        case 'forward': return 0;
        case 'alternating': return 1;
        case 'one-shot': return 2;
    }
}

/**
 * Convert LFO destination byte to enum
 */
export function parseLfoDestination(value: number): S330LfoDestination {
    switch (value) {
        case 0: return 'pitch';
        case 1: return 'tvf';
        case 2: return 'tva';
        default: return 'pitch';
    }
}

/**
 * Convert LFO destination enum to byte
 */
export function encodeLfoDestination(dest: S330LfoDestination): number {
    switch (dest) {
        case 'pitch': return 0;
        case 'tvf': return 1;
        case 'tva': return 2;
    }
}

/**
 * Convert sample rate byte to enum
 */
export function parseSampleRate(value: number): S330SampleRate {
    return value === 1 ? '30kHz' : '15kHz';
}

/**
 * Convert sample rate enum to byte
 */
export function encodeSampleRate(rate: S330SampleRate): number {
    return rate === '30kHz' ? 1 : 0;
}

/**
 * Extract ASCII name from buffer (supports variable length for S-330 patches)
 * S-330 patches use 12 characters, tones use 8 characters
 */
export function parseName(data: number[], offset: number, length: number = 8): string {
    let name = '';
    for (let i = 0; i < length; i++) {
        const char = data[offset + i] & 0x7F;
        if (char >= 0x20 && char <= 0x7E) {
            name += String.fromCharCode(char);
        } else {
            name += ' ';
        }
    }
    return name.trimEnd();
}

/**
 * Encode ASCII name to buffer (supports variable length for S-330 patches)
 */
export function encodeName(name: string, length: number = 8): number[] {
    const result: number[] = [];
    const padded = name.padEnd(length, ' ').substring(0, length);
    for (let i = 0; i < length; i++) {
        result.push(padded.charCodeAt(i) & 0x7F);
    }
    return result;
}

/**
 * Extract 21-bit address from 3 bytes
 */
export function parse21BitAddress(data: number[], offset: number): number {
    return (
        ((data[offset] & 0x7F) << 14) |
        ((data[offset + 1] & 0x7F) << 7) |
        (data[offset + 2] & 0x7F)
    );
}

/**
 * Encode 21-bit address to 3 bytes
 */
export function encode21BitAddress(value: number): number[] {
    return [
        (value >> 14) & 0x7F,
        (value >> 7) & 0x7F,
        value & 0x7F,
    ];
}

/**
 * Convert signed 7-bit value (64 = 0, range -64 to +63)
 */
export function parseSignedValue(value: number, center: number = 64): number {
    return value - center;
}

/**
 * Encode signed value to 7-bit (center = 64)
 */
export function encodeSignedValue(value: number, center: number = 64): number {
    return Math.max(0, Math.min(127, value + center));
}

// =============================================================================
// Structure Parsing Functions
// =============================================================================

/**
 * Parse system parameters from SysEx data
 * TODO: Implement actual parsing logic
 */
export function parseSystemParams(_data: number[]): S330SystemParams {
    // Stub implementation - returns default values
    return {
        masterTune: 64,
        masterLevel: 127,
        midiChannel: 0,
        deviceId: 0,
        exclusiveEnabled: true,
        progChangeEnabled: true,
        ctrlChangeEnabled: true,
        benderEnabled: true,
        modWheelEnabled: true,
        aftertouchEnabled: true,
        holdPedalEnabled: true,
    };
}

/**
 * Parse patch common parameters from de-nibblized SysEx data
 *
 * Data should be de-nibblized patch data (512 bytes total).
 * Offsets are taken from PATCH_PARAMS for consistency with the client setters.
 *
 * @param data De-nibblized patch data (512 bytes)
 * @returns Parsed patch common parameters
 */
export function parsePatchCommon(data: number[]): S330PatchCommon {
    // Patch name (12 characters)
    const name = parseName(data, PATCH_PARAMS.name.byteOffset, PATCH_PARAMS.name.size);

    // Bend range
    const benderRange = data[PATCH_PARAMS.benderRange.byteOffset];

    // Aftertouch sensitivity
    const aftertouchSens = data[PATCH_PARAMS.aftertouchSens.byteOffset];

    // Key mode
    const keyMode = parseKeyMode(data[PATCH_PARAMS.keyMode.byteOffset]);

    // Velocity threshold
    const velocityThreshold = data[PATCH_PARAMS.velocityThreshold.byteOffset];

    // Tone layer 1 (109 entries, each is -1 to 31; 0xFF = -1 = OFF)
    const toneLayer1: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = data[PATCH_PARAMS.toneLayer1.byteOffset + i];
        toneLayer1.push(value === 0xFF ? -1 : value);
    }

    // Tone layer 2 (109 entries)
    const toneLayer2: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer2.size; i++) {
        toneLayer2.push(data[PATCH_PARAMS.toneLayer2.byteOffset + i]);
    }

    // Copy source
    const copySource = data[PATCH_PARAMS.copySource.byteOffset];

    // Octave shift (signed value -2 to +2)
    const octaveShift = parseSignedValue(data[PATCH_PARAMS.octaveShift.byteOffset], 2);

    // Output level
    const level = data[PATCH_PARAMS.level.byteOffset];

    // Detune (signed value -64 to +63)
    const detune = parseSignedValue(data[PATCH_PARAMS.detune.byteOffset]);

    // Velocity mix ratio
    const velocityMixRatio = data[PATCH_PARAMS.velocityMixRatio.byteOffset];

    // Aftertouch assign
    const aftertouchAssign = parseAftertouchAssign(data[PATCH_PARAMS.aftertouchAssign.byteOffset]);

    // Key assign
    const keyAssign = parseKeyAssign(data[PATCH_PARAMS.keyAssign.byteOffset]);

    // Output assign
    const outputAssign = data[PATCH_PARAMS.outputAssign.byteOffset];

    return {
        name,
        benderRange,
        aftertouchSens,
        keyMode,
        velocityThreshold,
        toneLayer1,
        toneLayer2,
        copySource,
        octaveShift,
        level,
        detune,
        velocityMixRatio,
        aftertouchAssign,
        keyAssign,
        outputAssign,
    };
}

/**
 * Parse tone parameters from SysEx data
 * TODO: Implement actual parsing logic
 */
export function parseTone(_data: number[]): S330Tone {
    // Stub implementation - returns default values
    return {
        name: 'INIT',
        originalKey: 60,
        sampleRate: '30kHz',
        startAddress: 0,
        loopStart: 0,
        loopEnd: 0,
        loopMode: 'forward',
        coarseTune: 64,
        fineTune: 64,
        level: 127,
        tva: {
            attack: 0,
            decay: 64,
            sustain: 127,
            release: 64,
        },
        tvf: {
            cutoff: 127,
            resonance: 0,
            envDepth: 0,
            envelope: {
                attack: 0,
                decay: 64,
                sustain: 127,
                release: 64,
            },
        },
        lfo: {
            rate: 64,
            depth: 0,
            delay: 0,
            destination: 'pitch',
        },
    };
}

// =============================================================================
// Structure Encoding Functions
// =============================================================================

/**
 * Encode system parameters to SysEx data
 * TODO: Implement actual encoding logic
 */
export function encodeSystemParams(_params: S330SystemParams): number[] {
    // Stub implementation
    return [];
}

/**
 * Encode patch common parameters to de-nibblized SysEx data
 *
 * Reverses parsePatchCommon to convert patch parameters back to
 * the 512-byte de-nibblized format expected by the S-330.
 * Offsets are taken from PATCH_PARAMS for consistency with the client setters.
 *
 * @param params Patch common parameters to encode
 * @returns 512-byte array ready for nibblization and transmission
 */
export function encodePatchCommon(params: S330PatchCommon): number[] {
    // Create 512-byte array initialized to 0
    const result = new Array(512).fill(0);

    // Patch name
    const nameBytes = encodeName(params.name, PATCH_PARAMS.name.size);
    for (let i = 0; i < PATCH_PARAMS.name.size; i++) {
        result[PATCH_PARAMS.name.byteOffset + i] = nameBytes[i];
    }

    // Bend range
    result[PATCH_PARAMS.benderRange.byteOffset] = params.benderRange;

    // Aftertouch sensitivity
    result[PATCH_PARAMS.aftertouchSens.byteOffset] = params.aftertouchSens;

    // Key mode
    result[PATCH_PARAMS.keyMode.byteOffset] = encodeKeyMode(params.keyMode);

    // Velocity threshold
    result[PATCH_PARAMS.velocityThreshold.byteOffset] = params.velocityThreshold;

    // Tone layer 1 (109 entries; -1 maps to 0xFF for OFF)
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = params.toneLayer1[i];
        result[PATCH_PARAMS.toneLayer1.byteOffset + i] = value === -1 ? 0xFF : value;
    }

    // Tone layer 2 (109 entries)
    for (let i = 0; i < PATCH_PARAMS.toneLayer2.size; i++) {
        result[PATCH_PARAMS.toneLayer2.byteOffset + i] = params.toneLayer2[i];
    }

    // Copy source
    result[PATCH_PARAMS.copySource.byteOffset] = params.copySource;

    // Octave shift (signed value -2 to +2)
    result[PATCH_PARAMS.octaveShift.byteOffset] = encodeSignedValue(params.octaveShift, 2);

    // Output level
    result[PATCH_PARAMS.level.byteOffset] = params.level;

    // Detune (signed value -64 to +63)
    result[PATCH_PARAMS.detune.byteOffset] = encodeSignedValue(params.detune);

    // Velocity mix ratio
    result[PATCH_PARAMS.velocityMixRatio.byteOffset] = params.velocityMixRatio;

    // Aftertouch assign
    result[PATCH_PARAMS.aftertouchAssign.byteOffset] = encodeAftertouchAssign(params.aftertouchAssign);

    // Key assign
    result[PATCH_PARAMS.keyAssign.byteOffset] = encodeKeyAssign(params.keyAssign);

    // Output assign
    result[PATCH_PARAMS.outputAssign.byteOffset] = params.outputAssign;

    return result;
}


/**
 * Encode tone parameters to SysEx data
 * TODO: Implement actual encoding logic
 */
export function encodeTone(_tone: S330Tone): number[] {
    // Stub implementation
    return [];
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate device ID is in range
 */
export function isValidDeviceId(id: number): boolean {
    return id >= 0 && id <= 31;
}

/**
 * Validate MIDI channel is in range
 */
export function isValidMidiChannel(channel: number): boolean {
    return channel >= 0 && channel <= 15;
}

/**
 * Validate patch number is in range
 */
export function isValidPatchNumber(num: number): boolean {
    return num >= 0 && num <= 63;
}

/**
 * Validate tone number is in range
 */
export function isValidToneNumber(num: number): boolean {
    return num >= 0 && num <= 31;
}

/**
 * Validate 7-bit MIDI value
 */
export function isValid7BitValue(value: number): boolean {
    return value >= 0 && value <= 127;
}

/**
 * Clamp value to 7-bit range
 */
export function clamp7Bit(value: number): number {
    return Math.max(0, Math.min(127, Math.round(value)));
}
