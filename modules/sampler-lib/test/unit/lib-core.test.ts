// noinspection ExceptionCaughtLocallyJS

import {
    byte2nibblesLE,
    bytes2numberBE,
    bytes2numberLE,
    bytes2signedNumberLE,
    bytes2tuningLE,
    natural2real,
    newSequence, nibbles2byte,
    pad,
    parseNote,
    real2natural,
    scale,
    timestamp
} from "@/lib-core";
import { describe, it, expect } from 'vitest';

describe(`Core library functions`, () => {
    it(`Returns an incrementing sequence`, () => {
        const base = 'the base'
        const sequence = newSequence(base)
        const s1 = sequence()
        const s2 = sequence()

        expect(s1).not.toBe(s2)
        expect(s1.startsWith(base)).toBe(true)
        expect(s1.endsWith("0")).toBe(true)
        expect(s2.startsWith(base)).toBe(true)
        expect(s2.endsWith("1")).toBe(true)
    })

    it(`Returns a timestamp`, () => {
        const t1 = timestamp()
        expect(t1).toBeDefined()
    })

    it(`Pads a number with leading zeroes`, () => {
        expect(pad(1, 2)).toBe('01')
        expect(pad(10, 4)).toBe('0010')
    })

    it(`Parses midi note number`, () => {
        expect(parseNote('C3')).toBe(60)
        expect(parseNote('C0')).toBe(24)
        expect(parseNote('C#3')).toBe(61)
    })

    it('parses note as number', () => {
        expect(parseNote("60")).toBe(60)
    })

    it('scale', () => {
        expect(scale(50, 0, 100, 0, 10)).toBe(5)
        expect(scale(-1, -100, 100, 0, 200)).toBe(99)
    })
    it('real2natural', () => {
        expect(real2natural(0, -100, 100)).toBe(100)
        expect(real2natural(50, 0, 100)).toBe(50)
    })
    it('natural2real', () => {
        expect(natural2real(50, 0, 100)).toBe(50)
        expect(natural2real(100, -100, 100)).toBe(0)
        expect(natural2real(100, -50, 100)).toBe(50)
    })
    it('byte2number', () => {
        let b = [1, 0]
        expect(bytes2numberLE(b)).toBe(1)
        expect(bytes2numberBE(b)).toBe(256)
    })

    it(`Converts a byte to two little-endian nibbles and back again.`, () => {

        let nibbles = byte2nibblesLE(0)
        expect(nibbles[0]).toBe(0)
        expect(nibbles[1]).toBe(0)

        nibbles = byte2nibblesLE(1)
        expect(nibbles[0]).toBe(1)
        expect(nibbles[1]).toBe(0)

        nibbles = byte2nibblesLE(255)
        expect(nibbles[0]).toBe(15)
        expect(nibbles[1]).toBe(15)

        expect(nibbles2byte(nibbles[0], nibbles[1])).toBe(255)

        expect(() => byte2nibblesLE(-129)).toThrow()
        expect(() => byte2nibblesLE(256)).toThrow()
        expect(() => nibbles2byte(-1, 0)).toThrow()
        expect(() => nibbles2byte(0, -1)).toThrow()
        expect(() => nibbles2byte(16, 0)).toThrow()
        expect(() => nibbles2byte(0, 16)).toThrow()
    })

    it(`Converts signed byte values to nibbles via two's complement`, () => {
        // -1 => 255 (0xFF) => [0x0F, 0x0F]
        let nibbles = byte2nibblesLE(-1)
        expect(nibbles[0]).toBe(0x0F)
        expect(nibbles[1]).toBe(0x0F)
        expect(nibbles2byte(nibbles[0], nibbles[1])).toBe(255)

        // -50 => 206 (0xCE) => [0x0E, 0x0C]
        nibbles = byte2nibblesLE(-50)
        expect(nibbles[0]).toBe(0x0E)
        expect(nibbles[1]).toBe(0x0C)
        expect(nibbles2byte(nibbles[0], nibbles[1])).toBe(206)

        // -128 => 128 (0x80) => [0x00, 0x08]
        nibbles = byte2nibblesLE(-128)
        expect(nibbles[0]).toBe(0x00)
        expect(nibbles[1]).toBe(0x08)
        expect(nibbles2byte(nibbles[0], nibbles[1])).toBe(128)

        // Boundary: -128 is valid, -129 is not
        expect(() => byte2nibblesLE(-129)).toThrow()
    })

    describe('bytes2signedNumberLE', () => {
        it('returns positive values unchanged for 1-byte input', () => {
            expect(bytes2signedNumberLE([0])).toBe(0)
            expect(bytes2signedNumberLE([1])).toBe(1)
            expect(bytes2signedNumberLE([50])).toBe(50)
            expect(bytes2signedNumberLE([127])).toBe(127)
        })

        it('converts unsigned 1-byte values to negative via two\'s complement', () => {
            // -50 is stored as 206 (0xCE) in unsigned
            expect(bytes2signedNumberLE([206])).toBe(-50)
            // -1 is stored as 255 (0xFF)
            expect(bytes2signedNumberLE([255])).toBe(-1)
            // -128 is stored as 128 (0x80)
            expect(bytes2signedNumberLE([128])).toBe(-128)
        })

        it('returns positive values unchanged for 2-byte input', () => {
            expect(bytes2signedNumberLE([0, 0])).toBe(0)
            expect(bytes2signedNumberLE([1, 0])).toBe(1)
            expect(bytes2signedNumberLE([0x10, 0x27])).toBe(10000)
            expect(bytes2signedNumberLE([0xFF, 0x7F])).toBe(32767)
        })

        it('converts unsigned 2-byte values to negative via two\'s complement', () => {
            // -50 as signed 16-bit = 0xFFCE = [0xCE, 0xFF] in LE
            expect(bytes2signedNumberLE([0xCE, 0xFF])).toBe(-50)
            // -1 as signed 16-bit = 0xFFFF
            expect(bytes2signedNumberLE([0xFF, 0xFF])).toBe(-1)
            // -9999 as signed 16-bit = 0xD8F1
            expect(bytes2signedNumberLE([0xF1, 0xD8])).toBe(-9999)
            // -32768 as signed 16-bit = 0x8000
            expect(bytes2signedNumberLE([0x00, 0x80])).toBe(-32768)
        })

        it('round-trips with byte2nibblesLE for 1-byte signed values', () => {
            // Simulate the S3000XL sysex path: signed value -> nibbles -> byte -> signed decode
            const signedValue = -50
            const nibbles = byte2nibblesLE(signedValue)
            const unsignedByte = nibbles2byte(nibbles[0], nibbles[1])
            expect(bytes2signedNumberLE([unsignedByte])).toBe(signedValue)
        })
    })

    describe('bytes2tuningLE', () => {
        it('decodes positive tuning values from the low byte', () => {
            expect(bytes2tuningLE([0, 0])).toBe(0)
            expect(bytes2tuningLE([1, 0])).toBe(1)
            expect(bytes2tuningLE([50, 0])).toBe(50)
            expect(bytes2tuningLE([127, 0])).toBe(127)
        })

        it('decodes negative tuning values from the low byte via two\'s complement', () => {
            // -15 stored as 241 (0xF1) in the low byte
            expect(bytes2tuningLE([241, 0])).toBe(-15)
            // -50 stored as 206 (0xCE) in the low byte
            expect(bytes2tuningLE([206, 0])).toBe(-50)
            // -1 stored as 255 (0xFF) in the low byte
            expect(bytes2tuningLE([255, 0])).toBe(-1)
            // -128 stored as 128 (0x80)
            expect(bytes2tuningLE([128, 0])).toBe(-128)
        })

        it('ignores the high byte (fraction)', () => {
            // Fraction byte should not affect the integer result
            expect(bytes2tuningLE([241, 128])).toBe(-15)
            expect(bytes2tuningLE([50, 200])).toBe(50)
            expect(bytes2tuningLE([0, 255])).toBe(0)
            expect(bytes2tuningLE([206, 128])).toBe(-50)
        })

        it('round-trips with byte2nibblesLE for signed tuning values', () => {
            // Simulate the S3000XL sysex write/read path:
            // write: signed value -> byte2nibblesLE -> raw nibbles (low byte only)
            // read:  raw nibbles -> nextByte (reassembles bytes) -> bytes2tuningLE
            for (const value of [-50, -15, -1, 0, 1, 15, 50]) {
                const nibbles = byte2nibblesLE(value)
                const unsignedByte = nibbles2byte(nibbles[0], nibbles[1])
                // High byte is 0 (fraction cleared by setter)
                expect(bytes2tuningLE([unsignedByte, 0])).toBe(value)
            }
        })
    })
})
