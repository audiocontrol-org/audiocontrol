import {nibbles2byte} from "@oletizi/sampler-lib"

/**
 * Akai character encoding alphabet.
 *
 * @remarks
 * Akai samplers use a custom character encoding for names (programs, samples, volumes).
 * This alphabet defines the mapping from byte values to characters. Only uppercase letters,
 * digits, and a few special characters are supported.
 *
 * @internal
 */
const ALPHABET = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q',
    'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#', '+', '-', '.']

/**
 * Convert Akai byte values to string.
 *
 * @remarks
 * Decodes Akai's custom character encoding used for names. Each byte value maps to a
 * specific character in the Akai alphabet. Unknown values are converted to '?'.
 *
 * @param bytes - Array of Akai-encoded byte values
 * @returns Decoded string
 *
 * @example
 * ```typescript
 * const bytes = [11, 12, 22, 22, 26]; // "HELLO"
 * const name = akaiByte2String(bytes);
 * console.log(name); // "HELLO"
 * ```
 *
 * @public
 */
export function akaiByte2String(bytes: number[]) {
    let rv = ''
    for (let v of bytes) {
        rv += v < ALPHABET.length ? ALPHABET[v] : '?'
    }
    return rv
}

/**
 * Convert string to Akai byte values.
 *
 * @remarks
 * Encodes a string into Akai's custom character format. The input string is converted
 * to uppercase and limited to 12 characters. Unsupported characters are converted to
 * space (value 10). The result is always 12 bytes, padded with spaces if needed.
 *
 * @param s - String to encode (max 12 characters)
 * @returns Array of 12 Akai-encoded byte values
 *
 * @example
 * ```typescript
 * const bytes = string2AkaiBytes("Hello");
 * // Returns: [11, 12, 22, 22, 26, 10, 10, 10, 10, 10, 10, 10]
 * // "HELLO" followed by 7 spaces
 * ```
 *
 * @public
 */
export function string2AkaiBytes(s: string) {
    s = s.toUpperCase()
    const data = []
    for (let i = 0; i < 12; i++) {
        let akaiValue = 10 // default value is ' '
        if (s.length > i) {
            const c = s.charAt(i)
            for (let j = 0; j < ALPHABET.length; j++) {
                if (ALPHABET[j] === c) {
                    akaiValue = j
                }
            }
        }
        data.push(akaiValue)
    }
    return data
}

/**
 * Read next byte from nibble array with offset tracking.
 *
 * @remarks
 * Utility function for parsing Akai data stored as nibbles. Combines two nibbles
 * into a byte and automatically advances the offset by 2. The value object is
 * mutated in place.
 *
 * @param nibbles - Array of nibbles (4-bit values)
 * @param v - Value object with `value` and `offset` properties (mutated)
 * @returns Updated value object (same reference as input)
 *
 * @example
 * ```typescript
 * const nibbles = [0x0A, 0x0B, 0x0C, 0x0D];
 * const v = { value: 0, offset: 0 };
 *
 * nextByte(nibbles, v);
 * console.log(v.value);  // 0xAB (first byte)
 * console.log(v.offset); // 2
 *
 * nextByte(nibbles, v);
 * console.log(v.value);  // 0xCD (second byte)
 * console.log(v.offset); // 4
 * ```
 *
 * @public
 */
export function nextByte(nibbles: number[], v: { value: number, offset: number }) {
    v.value = nibbles2byte(nibbles[v.offset], nibbles[v.offset + 1])
    v.offset += 2
    return v
}
