import dayjs from "dayjs";

/**
 * Creates a sequence generator function for unique identifiers.
 *
 * @param base - Base prefix for the sequence (default: 'seq')
 * @returns A function that generates sequential strings in the format: base-timestamp-counter
 *
 * @example
 * ```typescript
 * const genId = newSequence('job');
 * const id1 = genId(); // 'job-1234567890-0'
 * const id2 = genId(); // 'job-1234567890-1'
 * ```
 */
export function newSequence(base: string = 'seq'): () => string {
    let s = 0
    base += '-' + Date.now()
    return () => base + '-' + s++
}

/**
 * Formats a Date object into a timestamp string.
 *
 * @param date - The date to format (default: current date/time)
 * @returns Formatted timestamp in the format: YYYY-MM-DD:HH:mm:ss.SSS
 *
 * @example
 * ```typescript
 * const ts = timestamp(); // '2025-10-04:14:30:45.123'
 * const customTs = timestamp(new Date('2025-01-01')); // '2025-01-01:00:00:00.0'
 * ```
 */
export function timestamp(date: Date = new Date()) {
    const d = dayjs(date)
    return `${d.year()}-${pad(d.month(), 2)}-${pad(d.date(), 2)}:${pad(d.hour(), 2)}:${pad(d.minute(), 2)}:${pad(d.second(), 2)}.${d.millisecond()}`
}

/**
 * Pads a number with leading zeros to reach a specified size.
 *
 * @param v - The number to pad
 * @param size - The desired string length
 * @returns Zero-padded string representation of the number
 *
 * @example
 * ```typescript
 * pad(5, 3);   // '005'
 * pad(42, 4);  // '0042'
 * pad(100, 2); // '100' (no padding needed)
 * ```
 */
export function pad(v: number, size: number) {
    let s = "" + v
    while (s.length < size) {
        s = "0" + s
    }
    return s
}

/**
 * Mapping of note names to their chromatic scale degree (0-11).
 * Supports multiple enharmonic spellings (e.g., C#, Db).
 */
const degrees: Map<string, number> = new Map([
    ['C', 0],
    ['C#', 1],
    ['Db', 1],
    ['DB', 1],    ['D', 2],
    ['D#', 3],
    ['Eb', 3],
    ['EB', 3],    ['E', 4],
    ['E#', 5],
    ['F', 5],
    ['F#', 6],
    ['Gb', 6],
    ['GB', 6],    ['G', 7],
    ['G#', 8],
    ['Ab', 8],
    ['AB', 8],    ['A', 9],
    ['A#', 10],
    ['Bb', 10],
    ['BB', 10],    ['B', 11],
    ['Cb', 11],
    ['CB', 11],])

/**
 * MIDI note number for middle C (C3)
 */
export const C3 = 60

/**
 * MIDI note number for C0
 */
export const C0 = C3 - 3 * 12

/**
 * Parses a note string or number into a MIDI note number.
 *
 * @param n - Note representation as either a MIDI number (e.g., "60") or note name (e.g., "C3", "D#4")
 * @returns MIDI note number (0-127), or NaN if parsing fails
 *
 * @example
 * ```typescript
 * parseNote('60');   // 60
 * parseNote('C3');   // 60
 * parseNote('A4');   // 69
 * parseNote('Bb2');  // 46
 * parseNote('D#5');  // 75
 * ```
 *
 * @remarks
 * - Accepts both numeric strings and scientific pitch notation
 * - Case-insensitive for note names
 * - Supports sharps (#) and flats (b)
 * - Octave numbers range from 0-9
 */
export function parseNote(n: string) {
    n = n.trim()
    let rv = Number.parseInt(n)
    if (Number.isNaN(rv) && n && n.length >= 2 && n.length <= 3) {
        // parse as scale note
        const letter = (n.length == 3 ? n.substring(0, 2) : n.substring(0, 1)).toUpperCase()
        const octave = Number.parseInt(n.charAt(n.length - 1))
        if (!Number.isNaN(octave)) {
            const degree = degrees.get(letter)
            if (degree != undefined) {
                rv = C0 + (12 * octave) + degree
            }
        }
    }
    return rv
}

/**
 * The data and possible errors from an operation (e.g., HTTP requests or MIDI sysex).
 *
 * @remarks
 * Base interface for operation results that may contain errors.
 * More specific result types extend this interface with typed data.
 */
export interface Result {
    /** Array of errors encountered during the operation */
    errors: any[]
    /** The result data (type varies by operation) */
    data: any
}

/**
 * Result containing a byte array.
 */
export interface ByteArrayResult extends Result {
    /** The byte array result data */
    data: number[]
}

/**
 * Result containing a numeric value.
 */
export interface NumberResult extends Result {
    /** The numeric result data */
    data: number
}

/**
 * Result containing a string value.
 */
export interface StringResult extends Result {
    /** The string result data */
    data: string
}

/**
 * Result containing a boolean value.
 */
export interface BooleanResult extends Result {
    /** The boolean result data */
    data: boolean
}

/**
 * A mutable numeric parameter with constraints and an async mutation function.
 *
 * @remarks
 * Commonly used for MIDI CC parameters or sampler settings that have
 * defined ranges and require asynchronous updates (e.g., hardware communication).
 */
export interface MutableNumber {
    /** Minimum allowed value */
    min: number
    /** Maximum allowed value */
    max: number
    /** Step/increment size for value changes */
    step: number
    /** Async function to apply value changes */
    mutator: (value: number) => Promise<Result>
    /** Current value */
    value: number
}

/**
 * A mutable string parameter with an async mutation function.
 *
 * @remarks
 * Used for text parameters that require asynchronous updates (e.g., hardware communication).
 */
export interface MutableString {
    /** Async function to apply value changes */
    mutator: (value: string) => Promise<Result>
    /** Current value */
    value: string
}

/**
 * Scales a value from one range to another using linear interpolation.
 *
 * @param value - The value to scale
 * @param xmin - Minimum of the input range
 * @param xmax - Maximum of the input range
 * @param ymin - Minimum of the output range
 * @param ymax - Maximum of the output range
 * @returns The scaled value in the output range
 *
 * @example
 * ```typescript
 * scale(50, 0, 100, 0, 1);    // 0.5 (50% -> 0.5)
 * scale(75, 0, 100, -1, 1);   // 0.5 (75% -> halfway between -1 and 1)
 * scale(127, 0, 127, -12, 12); // 12 (max MIDI CC to +12 semitones)
 * ```
 */
export function scale(value: number | string, xmin: number | string, xmax: number | string, ymin: number | string, ymax: number | string) {
    const xrange = Number(xmax) - Number(xmin)
    const yrange = Number(ymax) - Number(ymin)
    return (Number(value) - Number(xmin)) * yrange / xrange + Number(ymin)
}

/**
 * Converts a real value within a range to its natural (zero-based) representation.
 *
 * @param value - The value to convert
 * @param min - Minimum of the real range
 * @param max - Maximum of the real range
 * @returns Zero-based value (0 to max-min)
 *
 * @example
 * ```typescript
 * real2natural(-12, -12, 12); // 0
 * real2natural(0, -12, 12);   // 12
 * real2natural(12, -12, 12);  // 24
 * ```
 */
export function real2natural(value: number | string, min: number | string, max: number | string) {
    return scale(Number(value), Number(min), Number(max), 0, Number(max) - Number(min))
}

/**
 * Converts a natural (zero-based) value to its real representation within a range.
 *
 * @param value - The zero-based value to convert
 * @param min - Minimum of the real range
 * @param max - Maximum of the real range
 * @returns Value in the real range (min to max)
 *
 * @example
 * ```typescript
 * natural2real(0, -12, 12);  // -12
 * natural2real(12, -12, 12); // 0
 * natural2real(24, -12, 12); // 12
 * ```
 */
export function natural2real(value: number | string, min: number | string, max: number | string) {
    return scale(Number(value), 0, Number(max) - Number(min), Number(min), Number(max))
}

/**
 * Converts a byte array to a number using little-endian byte order.
 *
 * @param b - Byte array to convert
 * @returns The numeric value
 *
 * @example
 * ```typescript
 * bytes2numberLE([0x01, 0x00]); // 1
 * bytes2numberLE([0x00, 0x01]); // 256
 * bytes2numberLE([0x44, 0x33, 0x22, 0x11]); // 0x11223344
 * ```
 */
export function bytes2numberLE(b: number[]) {
    return bytes2numberBE(Array.from(b).reverse())
}

/**
 * Converts a byte array to a number using big-endian byte order.
 *
 * @param b - Byte array to convert
 * @returns The numeric value
 *
 * @example
 * ```typescript
 * bytes2numberBE([0x01, 0x00]); // 256
 * bytes2numberBE([0x00, 0x01]); // 1
 * bytes2numberBE([0x11, 0x22, 0x33, 0x44]); // 0x11223344
 * ```
 */
export function bytes2numberBE(b: number[]) {
    let rv = 0;
    for (let i = 0; i < b.length; i++) {
        rv = (rv << 8) | b[i];
    }
    return rv
}

/**
 * Splits a byte into two nibbles (4-bit values) in little-endian order.
 *
 * @param byte - The byte to split (0-255)
 * @returns Array containing [lowNibble, highNibble]
 * @throws {Error} If byte is not in the range 0-255
 *
 * @example
 * ```typescript
 * byte2nibblesLE(0xAB); // [0x0B, 0x0A] (11, 10)
 * byte2nibblesLE(0x3F); // [0x0F, 0x03] (15, 3)
 * ```
 */
export function byte2nibblesLE(byte: number) {
    // Ensure the input is a valid byte (0-255)
    if (byte < 0 || byte > 255) {
        throw new Error("Input must be a valid byte (0-255).");
    }
    // Extract the high and low nibbles
    const highNibble = (byte >> 4) & 0x0F; // Shift right 4 bits and mask with 0x0F
    const lowNibble = byte & 0x0F;         // Mask with 0x0F to get the lower nibble
    return [lowNibble, highNibble]
}

/**
 * Combines two nibbles (4-bit values) into a byte.
 *
 * @param lowNibble - The low nibble (0-15)
 * @param highNibble - The high nibble (0-15)
 * @returns The combined byte (0-255)
 * @throws {Error} If either nibble is not in the range 0-15
 *
 * @example
 * ```typescript
 * nibbles2byte(0x0B, 0x0A); // 0xAB (171)
 * nibbles2byte(0x0F, 0x03); // 0x3F (63)
 * ```
 */
export function nibbles2byte(lowNibble: number, highNibble: number) {
    if (highNibble < 0 || highNibble > 15 || lowNibble < 0 || lowNibble > 15) {
        throw new Error("Both nibbles must be between 0 and 15.");
    }
    // Combine the nibbles into a byte
    return (highNibble << 4) | lowNibble;
}
