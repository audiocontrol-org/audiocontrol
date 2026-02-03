/**
 * Akai String Encoding Utilities
 *
 * Akai samplers use a proprietary character encoding for text fields like
 * sample names and program names. This module provides conversion functions
 * between Akai format bytes and ASCII/Unicode strings.
 */

/**
 * Convert Akai format bytes to ASCII string
 *
 * Akai character encoding mapping:
 * - 0x0a: Space
 * - 0x11-0x1a: Digits '0'-'9'
 * - 0x1b-0x34: Letters 'A'-'Z'
 * - 0x3c: '#'
 * - 0x3d: '+'
 * - 0x3e: '-'
 * - 0x3f: '.'
 * - All other values: Space
 *
 * @param akaiBytes - Array of bytes in Akai format
 * @returns ASCII string (trimmed)
 */
export function akaiToAscii(akaiBytes: number[] | Uint8Array): string {
    const bytes = Array.isArray(akaiBytes) ? akaiBytes : Array.from(akaiBytes);

    let result = "";
    for (const b of bytes) {
        if (b === 0x0a) {
            result += " ";
        } else if (b >= 0x11 && b <= 0x1a) {
            // Digits 0-9
            result += String.fromCharCode('0'.charCodeAt(0) + (b - 0x11));
        } else if (b >= 0x1b && b <= 0x34) {
            // Letters A-Z
            result += String.fromCharCode('A'.charCodeAt(0) + (b - 0x1b));
        } else if (b === 0x3c) {
            result += "#";
        } else if (b === 0x3d) {
            result += "+";
        } else if (b === 0x3e) {
            result += "-";
        } else if (b === 0x3f) {
            result += ".";
        } else {
            result += " ";
        }
    }

    return result.trim();
}

/**
 * Convert ASCII string to Akai format bytes
 *
 * @param asciiString - ASCII string to convert
 * @param length - Target length (pads with spaces if needed)
 * @returns Array of bytes in Akai format
 */
export function asciiToAkai(asciiString: string, length?: number): number[] {
    const result: number[] = [];
    const str = asciiString.toUpperCase();

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const code = char.charCodeAt(0);

        if (char === ' ') {
            result.push(0x0a);
        } else if (char >= '0' && char <= '9') {
            result.push(0x11 + (code - '0'.charCodeAt(0)));
        } else if (char >= 'A' && char <= 'Z') {
            result.push(0x1b + (code - 'A'.charCodeAt(0)));
        } else if (char === '#') {
            result.push(0x3c);
        } else if (char === '+') {
            result.push(0x3d);
        } else if (char === '-') {
            result.push(0x3e);
        } else if (char === '.') {
            result.push(0x3f);
        } else {
            // Unknown character - use space
            result.push(0x0a);
        }
    }

    // Pad with spaces if length specified
    if (length !== undefined && result.length < length) {
        while (result.length < length) {
            result.push(0x0a);
        }
    }

    // Truncate if too long
    if (length !== undefined && result.length > length) {
        return result.slice(0, length);
    }

    return result;
}

/**
 * Sanitize a filename by converting Akai-encoded name to safe ASCII
 *
 * @param akaiBytes - Akai format bytes
 * @returns Safe filename string (lowercase, spaces replaced with underscores)
 */
export function akaiToFilename(akaiBytes: number[] | Uint8Array): string {
    const ascii = akaiToAscii(akaiBytes);
    return ascii
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-\.]/g, '');
}
