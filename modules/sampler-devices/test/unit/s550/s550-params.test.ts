/**
 * S-550 Parameter Tests
 */

import { describe, it, expect } from 'vitest';
import {
    // Value conversion
    parseKeyMode,
    encodeKeyMode,
    parseAftertouchAssign,
    encodeAftertouchAssign,
    parseKeyAssign,
    encodeKeyAssign,
    parseLoopMode,
    encodeLoopMode,
    parseEgPolarity,
    encodeEgPolarity,
    parseLfoMode,
    encodeLfoMode,
    parseLevelCurve,
    parseSampleRate,
    encodeSampleRate,
    parseName,
    encodeName,
    parseSignedValue,
    encodeSignedValue,

    // Structure parsing
    parseSystemParams,
    parsePatchCommon,
    parseTone,

    // Structure creation
    createEmptyPatchCommon,

    // Structure encoding
    encodePatchCommon,
    encodeTone,

    // Validation
    isValidPatchNumber,
    isValidToneNumber,
    isValidDeviceId,
    isValidMidiChannel,
    isValid7BitValue,
    clamp7Bit,

    // Constants
    PATCH_PARAMS,
    TONE_OFFSETS,
    MAX_PATCHES,
    MAX_TONES,
} from '@/devices/s550/index.js';

describe('S-550 Parameter Value Conversion', () => {
    describe('Key Mode', () => {
        it('should parse key modes correctly', () => {
            expect(parseKeyMode(0)).toBe('normal');
            expect(parseKeyMode(1)).toBe('v-sw');
            expect(parseKeyMode(2)).toBe('x-fade');
            expect(parseKeyMode(3)).toBe('v-mix');
            expect(parseKeyMode(4)).toBe('unison');
        });

        it('should encode key modes correctly', () => {
            expect(encodeKeyMode('normal')).toBe(0);
            expect(encodeKeyMode('v-sw')).toBe(1);
            expect(encodeKeyMode('x-fade')).toBe(2);
            expect(encodeKeyMode('v-mix')).toBe(3);
            expect(encodeKeyMode('unison')).toBe(4);
        });
    });

    describe('Aftertouch Assign', () => {
        it('should parse aftertouch assigns correctly', () => {
            expect(parseAftertouchAssign(0)).toBe('modulation');
            expect(parseAftertouchAssign(1)).toBe('volume');
            expect(parseAftertouchAssign(2)).toBe('bend+');
            expect(parseAftertouchAssign(3)).toBe('bend-');
            expect(parseAftertouchAssign(4)).toBe('filter');
        });

        it('should encode aftertouch assigns correctly', () => {
            expect(encodeAftertouchAssign('modulation')).toBe(0);
            expect(encodeAftertouchAssign('volume')).toBe(1);
            expect(encodeAftertouchAssign('bend+')).toBe(2);
            expect(encodeAftertouchAssign('bend-')).toBe(3);
            expect(encodeAftertouchAssign('filter')).toBe(4);
        });
    });

    describe('Key Assign', () => {
        it('should parse key assigns correctly', () => {
            expect(parseKeyAssign(0)).toBe('rotary');
            expect(parseKeyAssign(1)).toBe('fix');
        });

        it('should encode key assigns correctly', () => {
            expect(encodeKeyAssign('rotary')).toBe(0);
            expect(encodeKeyAssign('fix')).toBe(1);
        });
    });

    describe('Loop Mode', () => {
        it('should parse loop modes correctly', () => {
            expect(parseLoopMode(0)).toBe('forward');
            expect(parseLoopMode(1)).toBe('alternating');
            expect(parseLoopMode(2)).toBe('one-shot');
            expect(parseLoopMode(3)).toBe('reverse');
        });

        it('should encode loop modes correctly', () => {
            expect(encodeLoopMode('forward')).toBe(0);
            expect(encodeLoopMode('alternating')).toBe(1);
            expect(encodeLoopMode('one-shot')).toBe(2);
            expect(encodeLoopMode('reverse')).toBe(3);
        });
    });

    describe('EG Polarity', () => {
        it('should parse EG polarities correctly', () => {
            expect(parseEgPolarity(0)).toBe('normal');
            expect(parseEgPolarity(1)).toBe('reverse');
        });

        it('should encode EG polarities correctly', () => {
            expect(encodeEgPolarity('normal')).toBe(0);
            expect(encodeEgPolarity('reverse')).toBe(1);
        });
    });

    describe('LFO Mode', () => {
        it('should parse LFO modes correctly', () => {
            expect(parseLfoMode(0)).toBe('normal');
            expect(parseLfoMode(1)).toBe('one-shot');
        });

        it('should encode LFO modes correctly', () => {
            expect(encodeLfoMode('normal')).toBe(0);
            expect(encodeLfoMode('one-shot')).toBe(1);
        });
    });

    describe('Sample Rate', () => {
        it('should parse sample rates correctly', () => {
            expect(parseSampleRate(0)).toBe('30kHz');
            expect(parseSampleRate(1)).toBe('15kHz');
        });

        it('should encode sample rates correctly', () => {
            expect(encodeSampleRate('30kHz')).toBe(0);
            expect(encodeSampleRate('15kHz')).toBe(1);
        });
    });

    describe('Level Curve', () => {
        it('should parse level curves correctly (clamped 0-5)', () => {
            expect(parseLevelCurve(0)).toBe(0);
            expect(parseLevelCurve(4)).toBe(4);
            expect(parseLevelCurve(5)).toBe(5);
            expect(parseLevelCurve(7)).toBe(5);  // Clamped to max 5
        });
    });

    describe('Name Encoding', () => {
        it('should parse names correctly', () => {
            const data = [0x50, 0x69, 0x61, 0x6E, 0x6F, 0x20, 0x20, 0x20]; // "Piano   "
            expect(parseName(data, 0, 8)).toBe('Piano');
        });

        it('should encode names correctly', () => {
            const encoded = encodeName('Piano', 8);
            expect(encoded).toHaveLength(8);
            expect(encoded[0]).toBe(0x50); // P
            expect(encoded[1]).toBe(0x69); // i
            expect(encoded[2]).toBe(0x61); // a
            expect(encoded[3]).toBe(0x6E); // n
            expect(encoded[4]).toBe(0x6F); // o
            expect(encoded[5]).toBe(0x20); // space
        });

        it('should handle empty names', () => {
            const encoded = encodeName('', 8);
            expect(encoded).toEqual([0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
        });
    });

    describe('Signed Value', () => {
        it('should parse positive signed values correctly', () => {
            expect(parseSignedValue(64)).toBe(0);
            expect(parseSignedValue(127)).toBe(63);
        });

        it('should parse negative signed values correctly', () => {
            expect(parseSignedValue(0)).toBe(-64);
            expect(parseSignedValue(63)).toBe(-1);
        });

        it('should encode positive signed values correctly', () => {
            expect(encodeSignedValue(0)).toBe(64);
            expect(encodeSignedValue(63)).toBe(127);
        });

        it('should encode negative signed values correctly', () => {
            expect(encodeSignedValue(-64)).toBe(0);
            expect(encodeSignedValue(-1)).toBe(63);
        });
    });
});

describe('S-550 Validation Functions', () => {
    describe('isValidPatchNumber', () => {
        it('should validate S-550 patch range (0-31)', () => {
            expect(isValidPatchNumber(0)).toBe(true);
            expect(isValidPatchNumber(15)).toBe(true);
            expect(isValidPatchNumber(31)).toBe(true);
            expect(isValidPatchNumber(32)).toBe(false);
            expect(isValidPatchNumber(63)).toBe(false);
            expect(isValidPatchNumber(-1)).toBe(false);
        });
    });

    describe('isValidToneNumber', () => {
        it('should validate S-550 tone range (0-63)', () => {
            expect(isValidToneNumber(0)).toBe(true);
            expect(isValidToneNumber(31)).toBe(true);
            expect(isValidToneNumber(32)).toBe(true);  // Extended S-550 range
            expect(isValidToneNumber(63)).toBe(true);  // Max S-550 tone
            expect(isValidToneNumber(64)).toBe(false);
            expect(isValidToneNumber(-1)).toBe(false);
        });
    });

    describe('isValidDeviceId', () => {
        it('should validate device ID range', () => {
            expect(isValidDeviceId(0)).toBe(true);
            expect(isValidDeviceId(31)).toBe(true);
            expect(isValidDeviceId(32)).toBe(false);
        });
    });

    describe('isValidMidiChannel', () => {
        it('should validate MIDI channel range', () => {
            expect(isValidMidiChannel(0)).toBe(true);
            expect(isValidMidiChannel(15)).toBe(true);
            expect(isValidMidiChannel(16)).toBe(false);
        });
    });

    describe('isValid7BitValue', () => {
        it('should validate 7-bit value range', () => {
            expect(isValid7BitValue(0)).toBe(true);
            expect(isValid7BitValue(127)).toBe(true);
            expect(isValid7BitValue(128)).toBe(false);
            expect(isValid7BitValue(-1)).toBe(false);
        });
    });

    describe('clamp7Bit', () => {
        it('should clamp values to 7-bit range', () => {
            expect(clamp7Bit(0)).toBe(0);
            expect(clamp7Bit(127)).toBe(127);
            expect(clamp7Bit(200)).toBe(127);
            expect(clamp7Bit(-10)).toBe(0);
        });
    });
});

describe('S-550 Structure Parsing', () => {
    describe('createEmptyPatchCommon', () => {
        it('should create empty patch with correct defaults', () => {
            const patch = createEmptyPatchCommon();

            expect(patch.name).toBe('');
            expect(patch.keyMode).toBe('normal');
            expect(patch.benderRange).toBe(2);
            expect(patch.level).toBe(127);
            expect(patch.toneLayer1).toHaveLength(109);
            expect(patch.toneLayer2).toHaveLength(109);
            expect(patch.toneLayer1.every(v => v === -1)).toBe(true);
            expect(patch.toneLayer2.every(v => v === 0)).toBe(true);
        });
    });

    describe('parsePatchCommon', () => {
        it('should parse patch with empty tone layers', () => {
            const data = new Array(512).fill(0);
            // Set name to spaces
            for (let i = 0; i < 12; i++) {
                data[PATCH_PARAMS.name.byteOffset + i] = 0x20;
            }
            // Set tone layer 1 to all OFF
            for (let i = 0; i < 109; i++) {
                data[PATCH_PARAMS.toneLayer1.byteOffset + i] = 0xFF;
            }

            const patch = parsePatchCommon(data);

            expect(patch.toneLayer1).toHaveLength(109);
            expect(patch.toneLayer1.every(v => v === -1)).toBe(true);
        });

        it('should parse patch with S-550 tone references (0-63)', () => {
            const data = new Array(512).fill(0);
            // Set name
            for (let i = 0; i < 12; i++) {
                data[PATCH_PARAMS.name.byteOffset + i] = 0x20;
            }
            // Set tone layer 1 with various tone numbers including extended range
            data[PATCH_PARAMS.toneLayer1.byteOffset + 0] = 0;   // Tone 0
            data[PATCH_PARAMS.toneLayer1.byteOffset + 1] = 31;  // Tone 31
            data[PATCH_PARAMS.toneLayer1.byteOffset + 2] = 32;  // Tone 32 (S-550 extended)
            data[PATCH_PARAMS.toneLayer1.byteOffset + 3] = 63;  // Tone 63 (S-550 max)
            data[PATCH_PARAMS.toneLayer1.byteOffset + 4] = 0xFF; // OFF

            const patch = parsePatchCommon(data);

            expect(patch.toneLayer1[0]).toBe(0);
            expect(patch.toneLayer1[1]).toBe(31);
            expect(patch.toneLayer1[2]).toBe(32);
            expect(patch.toneLayer1[3]).toBe(63);
            expect(patch.toneLayer1[4]).toBe(-1);
        });
    });

    describe('encodePatchCommon', () => {
        it('should encode patch common parameters', () => {
            const patch = createEmptyPatchCommon();
            patch.name = 'Test';
            patch.level = 100;
            patch.benderRange = 5;
            patch.toneLayer1[0] = 32;  // Extended S-550 tone
            patch.toneLayer1[1] = 63;  // Max S-550 tone

            const encoded = encodePatchCommon(patch);

            expect(encoded).toHaveLength(512);
            expect(encoded[PATCH_PARAMS.level.byteOffset]).toBe(100);
            expect(encoded[PATCH_PARAMS.benderRange.byteOffset]).toBe(5);
            expect(encoded[PATCH_PARAMS.toneLayer1.byteOffset + 0]).toBe(32);
            expect(encoded[PATCH_PARAMS.toneLayer1.byteOffset + 1]).toBe(63);
        });

        it('should encode OFF values as 0xFF', () => {
            const patch = createEmptyPatchCommon();
            patch.toneLayer1[0] = -1;

            const encoded = encodePatchCommon(patch);

            expect(encoded[PATCH_PARAMS.toneLayer1.byteOffset]).toBe(0xFF);
        });
    });

    describe('parseTone', () => {
        it('should parse tone with basic parameters', () => {
            const data = new Array(256).fill(0);
            // Set name
            const name = 'Strings';
            for (let i = 0; i < 8; i++) {
                data[TONE_OFFSETS.NAME + i] = name.charCodeAt(i) || 0x20;
            }
            // Set wave bank to C (S-550 extended)
            data[TONE_OFFSETS.WAVE_BANK] = 2;
            // Set source tone to 32 (S-550 extended)
            data[TONE_OFFSETS.SOURCE_TONE] = 32;
            // Set output assign
            data[TONE_OFFSETS.OUTPUT_ASSIGN] = 3;
            // Set original key
            data[TONE_OFFSETS.ORIG_KEY_NUMBER] = 60;

            const tone = parseTone(data);

            expect(tone.name).toBe('Strings');
            expect(tone.wave.bank).toBe(2);  // Bank C
            expect(tone.sourceTone).toBe(32);
            expect(tone.outputAssign).toBe(3);
            expect(tone.originalKey).toBe(60);
        });

        it('should parse tone with all 4 wave banks', () => {
            for (let bank = 0; bank <= 3; bank++) {
                const data = new Array(256).fill(0);
                data[TONE_OFFSETS.WAVE_BANK] = bank;

                const tone = parseTone(data);

                expect(tone.wave.bank).toBe(bank);
            }
        });

        it('should parse extended tone source references', () => {
            // Test all valid S-550 tone numbers (0-63)
            for (const sourceTone of [0, 31, 32, 63]) {
                const data = new Array(256).fill(0);
                data[TONE_OFFSETS.SOURCE_TONE] = sourceTone;

                const tone = parseTone(data);

                expect(tone.sourceTone).toBe(sourceTone);
            }
        });
    });

    describe('encodeTone', () => {
        it('should encode tone with S-550 wave bank', () => {
            const tone = parseTone(new Array(256).fill(0));
            tone.name = 'Test';
            tone.wave.bank = 3;  // Bank D (S-550)
            tone.sourceTone = 63;  // Max S-550 tone
            tone.copySource = 32;  // Extended copy source

            const encoded = encodeTone(tone);

            expect(encoded[TONE_OFFSETS.WAVE_BANK]).toBe(3);
            expect(encoded[TONE_OFFSETS.SOURCE_TONE]).toBe(63);
            expect(encoded[TONE_OFFSETS.COPY_SOURCE]).toBe(32);
        });

        it('should mask wave bank to 2 bits for S-550', () => {
            const tone = parseTone(new Array(256).fill(0));
            tone.wave.bank = 3;

            const encoded = encodeTone(tone);

            expect(encoded[TONE_OFFSETS.WAVE_BANK] & 0x03).toBe(3);
        });
    });
});

describe('S-550 Constants', () => {
    it('should have correct MAX_PATCHES for S-550', () => {
        expect(MAX_PATCHES).toBe(32);
    });

    it('should have correct MAX_TONES for S-550', () => {
        expect(MAX_TONES).toBe(64);
    });
});
