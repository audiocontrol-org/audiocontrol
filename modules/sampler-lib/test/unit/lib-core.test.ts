// noinspection ExceptionCaughtLocallyJS

import {
    byte2nibblesLE,
    bytes2numberBE,
    bytes2numberLE,
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
})
