import dayjs from "dayjs";

export function newSequence(base: string = 'seq'): () => string {
    let s = 0
    base += '-' + Date.now()
    return () => base + '-' + s++
}

export function timestamp() {
    const d = dayjs()
    return `${d.year()}-${d.month()}-${d.day()}:${d.hour()}:${d.minute()}:${d.second()}`
}

export function pad(v: number, size: number) {
    let s = "" + v
    while (s.length < size) {
        s = "0" + s
    }
    return s
}

const degrees = {
    'C': 0,
    'C#': 1,
    'Db': 1,
    'D': 2,
    'D#': 3,
    'Eb': 3,
    'E': 4,
    'E#': 5,
    'F': 5,
    'F#': 6,
    'Gb': 6,
    'G': 7,
    'G#': 8,
    'Ab': 8,
    'A': 9,
    'A#': 10,
    'Bb': 10,
    'B': 11,
    'Cb': 11
}
export const C3 = 60
export const C0 = C3 - 3 * 12

export function parseNote(n: string) {
    n = n.trim()
    let rv = Number.parseInt(n)
    if (Number.isNaN(rv) && n && n.length >= 2 && n.length <= 3) {
        // parse as scale note
        const letter = (n.length == 3 ? n.substring(0, 2) : n.substring(0, 1)).toUpperCase()
        const octave = Number.parseInt(n.charAt(n.length - 1))
        if (!Number.isNaN(octave)) {
            const degree = degrees[letter]
            if (degree != undefined) {
                rv = C0 + (12 * octave) + degree
            }
        }
    }
    return rv
}

/**
 * The data and possible errors from an operation (e.g., http requests or midi sysex)
 */
export interface Result {
    errors: Error[]
    data: any
}

export interface ByteArrayResult extends Result {
    data: number[]
}

export interface NumberResult extends Result {
    data: number
}

export interface StringResult extends Result {
    data: string
}

export interface BooleanResult extends Result {
    data: boolean
}

export interface MutableNumber {
    min: number
    max: number
    step: number
    mutator: (value: number) => Promise<Result>
    value: number
}

export interface MutableString {
    mutator: (value: string) => Promise<Result>
    value: string
}

export function scale(value: number | string, xmin: number | string, xmax: number | string, ymin: number | string, ymax: number | string) {
    const xrange = Number(xmax) - Number(xmin)
    const yrange = Number(ymax) - Number(ymin)
    return (Number(value) - Number(xmin)) * yrange / xrange + Number(ymin)
}

export function real2natural(value: number | string, min: number | string, max: number | string) {
    return scale(Number(value), Number(min), Number(max), 0, Number(max) - Number(min))
}

export function natural2real(value: number | string, min: number | string, max: number | string) {
    return scale(Number(value), 0, Number(max) - Number(min), Number(min), Number(max))
}

export function bytes2numberLE(b: number[]) {
    return bytes2numberBE(Array.from(b).reverse())
}

export function bytes2numberBE(b: number[]) {
    let rv = 0;
    for (let i = 0; i < b.length; i++) {
        rv = (rv << 8) | b[i];
    }
    return rv
}

export function byte2nibblesLE(byte) {
    // Ensure the input is a valid byte (0-255)
    if (byte < 0 || byte > 255) {
        throw new Error("Input must be a valid byte (0-255).");
    }
    // Extract the high and low nibbles
    const highNibble = (byte >> 4) & 0x0F; // Shift right 4 bits and mask with 0x0F
    const lowNibble = byte & 0x0F;         // Mask with 0x0F to get the lower nibble
    return [lowNibble, highNibble]
}

export function nibbles2byte(lowNibble, highNibble) {
    if (highNibble < 0 || highNibble > 15 || lowNibble < 0 || lowNibble > 15) {
        throw new Error("Both nibbles must be between 0 and 15.");
    }
    // Combine the nibbles into a byte
    return (highNibble << 4) | lowNibble;
}