/**
 * Roland S-Series Shared Parameter Utilities
 *
 * Parameter parsing, encoding, and conversion utilities shared between
 * S-330 and S-550 samplers.
 *
 * @packageDocumentation
 */

import type {
    SSeriesEnvelope,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEgPolarity,
    SSeriesLfoMode,
    SSeriesLevelCurve,
} from './s-series-types.js';

// =============================================================================
// Value Conversion Functions
// =============================================================================

/**
 * Convert key mode byte to enum
 */
export function parseKeyMode(value: number): SSeriesKeyMode {
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
export function encodeKeyMode(mode: SSeriesKeyMode): number {
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
export function parseAftertouchAssign(value: number): SSeriesAftertouchAssign {
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
export function encodeAftertouchAssign(assign: SSeriesAftertouchAssign): number {
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
export function parseKeyAssign(value: number): SSeriesKeyAssign {
    return value === 1 ? 'fix' : 'rotary';
}

/**
 * Convert key assign enum to byte
 */
export function encodeKeyAssign(assign: SSeriesKeyAssign): number {
    return assign === 'fix' ? 1 : 0;
}

/**
 * Convert loop mode byte to enum
 */
export function parseLoopMode(value: number): SSeriesLoopMode {
    switch (value) {
        case 0: return 'forward';
        case 1: return 'alternating';
        case 2: return 'one-shot';
        case 3: return 'reverse';
        default: return 'forward';
    }
}

/**
 * Convert loop mode enum to byte
 */
export function encodeLoopMode(mode: SSeriesLoopMode): number {
    switch (mode) {
        case 'forward': return 0;
        case 'alternating': return 1;
        case 'one-shot': return 2;
        case 'reverse': return 3;
    }
}

/**
 * Convert EG polarity byte to enum
 */
export function parseEgPolarity(value: number): SSeriesEgPolarity {
    return value === 1 ? 'reverse' : 'normal';
}

/**
 * Convert EG polarity enum to byte
 */
export function encodeEgPolarity(polarity: SSeriesEgPolarity): number {
    return polarity === 'reverse' ? 1 : 0;
}

/**
 * Convert LFO mode byte to enum
 */
export function parseLfoMode(value: number): SSeriesLfoMode {
    return value === 1 ? 'one-shot' : 'normal';
}

/**
 * Convert LFO mode enum to byte
 */
export function encodeLfoMode(mode: SSeriesLfoMode): number {
    return mode === 'one-shot' ? 1 : 0;
}

/**
 * Parse level curve value (clamp to 0-5)
 */
export function parseLevelCurve(value: number): SSeriesLevelCurve {
    const clamped = Math.max(0, Math.min(5, value));
    return clamped as SSeriesLevelCurve;
}

/**
 * Convert sample rate byte to enum
 * Per S-series spec: 0=30kHz, 1=15kHz
 */
export function parseSampleRate(value: number): SSeriesSampleRate {
    return value === 0 ? '30kHz' : '15kHz';
}

/**
 * Convert sample rate enum to byte
 * Per S-series spec: 0=30kHz, 1=15kHz
 */
export function encodeSampleRate(rate: SSeriesSampleRate): number {
    return rate === '30kHz' ? 0 : 1;
}

// =============================================================================
// Name Parsing/Encoding
// =============================================================================

/**
 * Extract ASCII name from buffer (supports variable length)
 * S-series patches use 12 characters, tones use 8 characters
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
 * Encode ASCII name to buffer (supports variable length)
 */
export function encodeName(name: string, length: number = 8): number[] {
    const result: number[] = [];
    const padded = name.padEnd(length, ' ').substring(0, length);
    for (let i = 0; i < length; i++) {
        result.push(padded.charCodeAt(i) & 0x7F);
    }
    return result;
}

// =============================================================================
// Address Encoding/Decoding
// =============================================================================

/**
 * Extract 21-bit address from 3 bytes (7-bit MIDI encoding)
 */
export function parse21BitAddress(data: number[], offset: number): number {
    return (
        ((data[offset] & 0x7F) << 14) |
        ((data[offset + 1] & 0x7F) << 7) |
        (data[offset + 2] & 0x7F)
    );
}

/**
 * Encode 21-bit address to 3 bytes (7-bit MIDI encoding)
 */
export function encode21BitAddress(value: number): number[] {
    return [
        (value >> 14) & 0x7F,
        (value >> 7) & 0x7F,
        value & 0x7F,
    ];
}

/**
 * Extract 24-bit wave address from 3 bytes
 * Used for tone wave parameters (START/END/LOOP points)
 */
export function parse24BitAddress(data: number[], offset: number): number {
    const b0 = data[offset] ?? 0;
    const b1 = data[offset + 1] ?? 0;
    const b2 = data[offset + 2] ?? 0;
    return (b0 << 16) | (b1 << 8) | b2;
}

/**
 * Encode 24-bit wave address to 3 bytes
 */
export function encode24BitAddress(value: number): number[] {
    return [
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
    ];
}

// =============================================================================
// Signed Value Encoding
// =============================================================================

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
// Envelope Parsing/Encoding
// =============================================================================

/**
 * Parse 8-point envelope from tone data
 *
 * @param data - De-nibblized tone data
 * @param sustainOffset - Byte offset for sustain point
 * @param endOffset - Byte offset for end point
 * @param levelsStart - Byte offset for first level
 * @returns Parsed envelope
 */
export function parseEnvelope(
    data: number[],
    sustainOffset: number,
    endOffset: number,
    levelsStart: number
): SSeriesEnvelope {
    const levels: [number, number, number, number, number, number, number, number] = [
        data[levelsStart] ?? 0,
        data[levelsStart + 2] ?? 0,
        data[levelsStart + 4] ?? 0,
        data[levelsStart + 6] ?? 0,
        data[levelsStart + 8] ?? 0,
        data[levelsStart + 10] ?? 0,
        data[levelsStart + 12] ?? 0,
        data[levelsStart + 14] ?? 0,
    ];

    const rates: [number, number, number, number, number, number, number, number] = [
        data[levelsStart + 1] ?? 1,
        data[levelsStart + 3] ?? 1,
        data[levelsStart + 5] ?? 1,
        data[levelsStart + 7] ?? 1,
        data[levelsStart + 9] ?? 1,
        data[levelsStart + 11] ?? 1,
        data[levelsStart + 13] ?? 1,
        data[levelsStart + 15] ?? 1,
    ];

    // Ensure endPoint is clamped to valid range 1-8 to prevent display issues
    const rawEndPoint = data[endOffset] ?? 8;
    const endPoint = Math.max(1, Math.min(8, rawEndPoint));

    return {
        levels,
        rates,
        sustainPoint: data[sustainOffset] ?? 0,
        endPoint,
    };
}

/**
 * Encode 8-point envelope to byte array
 *
 * @param envelope - Envelope to encode
 * @param sustainOffset - Byte offset for sustain point in output
 * @param endOffset - Byte offset for end point in output
 * @param levelsStart - Byte offset for first level in output
 * @param output - Output array to write to
 */
export function encodeEnvelope(
    envelope: SSeriesEnvelope,
    sustainOffset: number,
    endOffset: number,
    levelsStart: number,
    output: number[]
): void {
    output[sustainOffset] = envelope.sustainPoint & 0x7F;
    output[endOffset] = envelope.endPoint & 0x7F;

    for (let i = 0; i < 8; i++) {
        output[levelsStart + i * 2] = envelope.levels[i] & 0x7F;
        output[levelsStart + i * 2 + 1] = Math.max(1, envelope.rates[i]) & 0x7F;
    }
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
