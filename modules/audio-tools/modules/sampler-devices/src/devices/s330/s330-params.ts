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
    S330Partial,
    S330Tone,
    S330KeyMode,
    S330LoopMode,
    S330LfoDestination,
    S330SampleRate,
} from './s330-types.js';

import {
    SYSTEM_OFFSETS,
    PATCH_COMMON_OFFSETS,
    PARTIAL_OFFSETS,
    PARTIAL_SIZE,
    PATCH_PARTIALS_OFFSET,
    TONE_OFFSETS,
} from './s330-addresses.js';

// =============================================================================
// Value Conversion Functions
// =============================================================================

/**
 * Convert key mode byte to enum
 */
export function parseKeyMode(value: number): S330KeyMode {
    switch (value) {
        case 0: return 'whole';
        case 1: return 'dual';
        case 2: return 'split';
        default: return 'whole';
    }
}

/**
 * Convert key mode enum to byte
 */
export function encodeKeyMode(mode: S330KeyMode): number {
    switch (mode) {
        case 'whole': return 0;
        case 'dual': return 1;
        case 'split': return 2;
    }
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
 * Extract 8-character ASCII name from buffer
 */
export function parseName(data: number[], offset: number): string {
    let name = '';
    for (let i = 0; i < 8; i++) {
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
 * Encode 8-character ASCII name to buffer
 */
export function encodeName(name: string): number[] {
    const result: number[] = [];
    const padded = name.padEnd(8, ' ').substring(0, 8);
    for (let i = 0; i < 8; i++) {
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
 * Parse patch common parameters from SysEx data
 * TODO: Implement actual parsing logic
 */
export function parsePatchCommon(_data: number[]): S330PatchCommon {
    // Stub implementation - returns default values
    return {
        name: 'INIT',
        benderRange: 2,
        aftertouchSens: 64,
        keyMode: 'whole',
        splitPoint: 60,
        portamentoTime: 0,
        portamentoEnabled: false,
        outputAssign: 0,
        level: 127,
    };
}

/**
 * Parse partial parameters from SysEx data
 * TODO: Implement actual parsing logic
 */
export function parsePartial(_data: number[], _index: number): S330Partial {
    // Stub implementation - returns default values
    return {
        toneNumber: 0,
        keyRangeLow: 0,
        keyRangeHigh: 127,
        velRangeLow: 1,
        velRangeHigh: 127,
        level: 127,
        pan: 64,
        coarseTune: 64,
        fineTune: 64,
        outputAssign: 0,
        muted: false,
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
 * Encode patch common parameters to SysEx data
 * TODO: Implement actual encoding logic
 */
export function encodePatchCommon(_params: S330PatchCommon): number[] {
    // Stub implementation
    return [];
}

/**
 * Encode partial parameters to SysEx data
 * TODO: Implement actual encoding logic
 */
export function encodePartial(_partial: S330Partial): number[] {
    // Stub implementation
    return [];
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
