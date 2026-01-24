import { describe, it, expect } from 'vitest';
// Import from index.ts to get coverage on re-exports
import {
    // Value conversion functions
    parseKeyMode,
    encodeKeyMode,
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
    parse21BitAddress,
    encode21BitAddress,
    parse24BitAddress,
    encode24BitAddress,
    parseSignedValue,
    encodeSignedValue,
    parseEnvelope,
    encodeEnvelope,

    // Structure parsing
    parseSystemParams,
    parsePatchCommon,
    parseTone,

    // Structure encoding
    encodeSystemParams,
    encodePatchCommon,
    encodeTone,

    // Validation functions
    isValidDeviceId,
    isValidMidiChannel,
    isValidPatchNumber,
    isValidToneNumber,
    isValid7BitValue,
    clamp7Bit,

    // Constants
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
} from '@/devices/s330/index.js';

import type {
    S330SystemParams,
    S330PatchCommon,
    S330Tone,
    S330Envelope,
} from '@/devices/s330/index.js';

describe('S-330 Key Mode Conversion', () => {
    describe('parseKeyMode', () => {
        it('should parse 0 as normal', () => {
            expect(parseKeyMode(0)).toBe('normal');
        });

        it('should parse 1 as v-sw', () => {
            expect(parseKeyMode(1)).toBe('v-sw');
        });

        it('should parse 2 as x-fade', () => {
            expect(parseKeyMode(2)).toBe('x-fade');
        });

        it('should parse 3 as v-mix', () => {
            expect(parseKeyMode(3)).toBe('v-mix');
        });

        it('should parse 4 as unison', () => {
            expect(parseKeyMode(4)).toBe('unison');
        });

        it('should default to normal for unknown values', () => {
            expect(parseKeyMode(5)).toBe('normal');
            expect(parseKeyMode(255)).toBe('normal');
        });
    });

    describe('encodeKeyMode', () => {
        it('should encode normal as 0', () => {
            expect(encodeKeyMode('normal')).toBe(0);
        });

        it('should encode v-sw as 1', () => {
            expect(encodeKeyMode('v-sw')).toBe(1);
        });

        it('should encode x-fade as 2', () => {
            expect(encodeKeyMode('x-fade')).toBe(2);
        });

        it('should encode v-mix as 3', () => {
            expect(encodeKeyMode('v-mix')).toBe(3);
        });

        it('should encode unison as 4', () => {
            expect(encodeKeyMode('unison')).toBe(4);
        });
    });

    describe('round-trip', () => {
        it('should round-trip all key modes', () => {
            expect(parseKeyMode(encodeKeyMode('normal'))).toBe('normal');
            expect(parseKeyMode(encodeKeyMode('v-sw'))).toBe('v-sw');
            expect(parseKeyMode(encodeKeyMode('x-fade'))).toBe('x-fade');
            expect(parseKeyMode(encodeKeyMode('v-mix'))).toBe('v-mix');
            expect(parseKeyMode(encodeKeyMode('unison'))).toBe('unison');
        });
    });
});

describe('S-330 Loop Mode Conversion', () => {
    describe('parseLoopMode', () => {
        it('should parse 0 as forward', () => {
            expect(parseLoopMode(0)).toBe('forward');
        });

        it('should parse 1 as alternating', () => {
            expect(parseLoopMode(1)).toBe('alternating');
        });

        it('should parse 2 as one-shot', () => {
            expect(parseLoopMode(2)).toBe('one-shot');
        });

        it('should parse 3 as reverse', () => {
            expect(parseLoopMode(3)).toBe('reverse');
        });

        it('should default to forward for unknown values', () => {
            expect(parseLoopMode(4)).toBe('forward');
            expect(parseLoopMode(255)).toBe('forward');
        });
    });

    describe('encodeLoopMode', () => {
        it('should encode forward as 0', () => {
            expect(encodeLoopMode('forward')).toBe(0);
        });

        it('should encode alternating as 1', () => {
            expect(encodeLoopMode('alternating')).toBe(1);
        });

        it('should encode one-shot as 2', () => {
            expect(encodeLoopMode('one-shot')).toBe(2);
        });

        it('should encode reverse as 3', () => {
            expect(encodeLoopMode('reverse')).toBe(3);
        });
    });

    describe('round-trip', () => {
        it('should round-trip all loop modes', () => {
            expect(parseLoopMode(encodeLoopMode('forward'))).toBe('forward');
            expect(parseLoopMode(encodeLoopMode('alternating'))).toBe('alternating');
            expect(parseLoopMode(encodeLoopMode('one-shot'))).toBe('one-shot');
            expect(parseLoopMode(encodeLoopMode('reverse'))).toBe('reverse');
        });
    });
});

describe('S-330 EG Polarity Conversion', () => {
    describe('parseEgPolarity', () => {
        it('should parse 0 as normal', () => {
            expect(parseEgPolarity(0)).toBe('normal');
        });

        it('should parse 1 as reverse', () => {
            expect(parseEgPolarity(1)).toBe('reverse');
        });
    });

    describe('encodeEgPolarity', () => {
        it('should encode normal as 0', () => {
            expect(encodeEgPolarity('normal')).toBe(0);
        });

        it('should encode reverse as 1', () => {
            expect(encodeEgPolarity('reverse')).toBe(1);
        });
    });

    describe('round-trip', () => {
        it('should round-trip EG polarity values', () => {
            expect(parseEgPolarity(encodeEgPolarity('normal'))).toBe('normal');
            expect(parseEgPolarity(encodeEgPolarity('reverse'))).toBe('reverse');
        });
    });
});

describe('S-330 LFO Mode Conversion', () => {
    describe('parseLfoMode', () => {
        it('should parse 0 as normal', () => {
            expect(parseLfoMode(0)).toBe('normal');
        });

        it('should parse 1 as one-shot', () => {
            expect(parseLfoMode(1)).toBe('one-shot');
        });
    });

    describe('encodeLfoMode', () => {
        it('should encode normal as 0', () => {
            expect(encodeLfoMode('normal')).toBe(0);
        });

        it('should encode one-shot as 1', () => {
            expect(encodeLfoMode('one-shot')).toBe(1);
        });
    });

    describe('round-trip', () => {
        it('should round-trip LFO mode values', () => {
            expect(parseLfoMode(encodeLfoMode('normal'))).toBe('normal');
            expect(parseLfoMode(encodeLfoMode('one-shot'))).toBe('one-shot');
        });
    });
});

describe('S-330 Level Curve Conversion', () => {
    describe('parseLevelCurve', () => {
        it('should parse valid values 0-5', () => {
            expect(parseLevelCurve(0)).toBe(0);
            expect(parseLevelCurve(3)).toBe(3);
            expect(parseLevelCurve(5)).toBe(5);
        });

        it('should clamp values above 5', () => {
            expect(parseLevelCurve(6)).toBe(5);
            expect(parseLevelCurve(127)).toBe(5);
        });

        it('should clamp negative values to 0', () => {
            expect(parseLevelCurve(-1)).toBe(0);
        });
    });
});

describe('S-330 Sample Rate Conversion', () => {
    describe('parseSampleRate', () => {
        it('should parse 0 as 15kHz', () => {
            expect(parseSampleRate(0)).toBe('15kHz');
        });

        it('should parse 1 as 30kHz', () => {
            expect(parseSampleRate(1)).toBe('30kHz');
        });

        it('should parse any non-1 value as 15kHz', () => {
            expect(parseSampleRate(2)).toBe('15kHz');
            expect(parseSampleRate(255)).toBe('15kHz');
        });
    });

    describe('encodeSampleRate', () => {
        it('should encode 15kHz as 0', () => {
            expect(encodeSampleRate('15kHz')).toBe(0);
        });

        it('should encode 30kHz as 1', () => {
            expect(encodeSampleRate('30kHz')).toBe(1);
        });
    });

    describe('round-trip', () => {
        it('should round-trip both sample rates', () => {
            expect(parseSampleRate(encodeSampleRate('15kHz'))).toBe('15kHz');
            expect(parseSampleRate(encodeSampleRate('30kHz'))).toBe('30kHz');
        });
    });
});

describe('S-330 Name Conversion', () => {
    describe('parseName', () => {
        it('should parse 8-character name', () => {
            const data = [0x54, 0x45, 0x53, 0x54, 0x4E, 0x41, 0x4D, 0x45]; // "TESTNAME"
            expect(parseName(data, 0)).toBe('TESTNAME');
        });

        it('should trim trailing spaces', () => {
            const data = [0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20]; // "TEST    "
            expect(parseName(data, 0)).toBe('TEST');
        });

        it('should handle offset', () => {
            const data = [0x00, 0x00, 0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20];
            expect(parseName(data, 2)).toBe('TEST');
        });

        it('should replace non-printable characters with spaces', () => {
            const data = [0x54, 0x00, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20];
            expect(parseName(data, 0)).toBe('T ST');
        });

        it('should mask to 7 bits', () => {
            const data = [0xD4, 0xC5, 0xD3, 0xD4, 0x20, 0x20, 0x20, 0x20]; // High bits set
            expect(parseName(data, 0)).toBe('TEST');
        });

        it('should handle empty name (all spaces)', () => {
            const data = [0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20];
            expect(parseName(data, 0)).toBe('');
        });
    });

    describe('encodeName', () => {
        it('should encode 8-character name', () => {
            const result = encodeName('TESTNAME');
            expect(result).toEqual([0x54, 0x45, 0x53, 0x54, 0x4E, 0x41, 0x4D, 0x45]);
        });

        it('should pad short names with spaces', () => {
            const result = encodeName('TEST');
            expect(result).toEqual([0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20]);
        });

        it('should truncate long names', () => {
            const result = encodeName('VERYLONGNAME');
            expect(result.length).toBe(8);
            expect(result).toEqual([0x56, 0x45, 0x52, 0x59, 0x4C, 0x4F, 0x4E, 0x47]);
        });

        it('should handle empty name', () => {
            const result = encodeName('');
            expect(result).toEqual([0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
        });

        it('should mask to 7 bits', () => {
            const result = encodeName('TEST');
            result.forEach(byte => {
                expect(byte & 0x80).toBe(0);
            });
        });
    });

    describe('round-trip', () => {
        it('should round-trip standard names', () => {
            expect(parseName(encodeName('PIANO'), 0)).toBe('PIANO');
            expect(parseName(encodeName('BASS 01'), 0)).toBe('BASS 01');
            expect(parseName(encodeName('STRINGS'), 0)).toBe('STRINGS');
        });
    });
});

describe('S-330 21-bit Address Conversion', () => {
    describe('parse21BitAddress', () => {
        it('should parse zero address', () => {
            const data = [0x00, 0x00, 0x00];
            expect(parse21BitAddress(data, 0)).toBe(0);
        });

        it('should parse maximum 21-bit address', () => {
            const data = [0x7F, 0x7F, 0x7F];
            // (0x7F << 14) | (0x7F << 7) | 0x7F = 2097151
            expect(parse21BitAddress(data, 0)).toBe(2097151);
        });

        it('should parse address with offset', () => {
            const data = [0x00, 0x00, 0x01, 0x02, 0x03];
            expect(parse21BitAddress(data, 2)).toBe((1 << 14) | (2 << 7) | 3);
        });

        it('should handle mid-range values', () => {
            const data = [0x10, 0x20, 0x30];
            // (0x10 << 14) | (0x20 << 7) | 0x30 = 262144 + 4096 + 48 = 266288
            expect(parse21BitAddress(data, 0)).toBe(266288);
        });
    });

    describe('encode21BitAddress', () => {
        it('should encode zero address', () => {
            expect(encode21BitAddress(0)).toEqual([0x00, 0x00, 0x00]);
        });

        it('should encode maximum 21-bit address', () => {
            expect(encode21BitAddress(2097151)).toEqual([0x7F, 0x7F, 0x7F]);
        });

        it('should encode mid-range values', () => {
            expect(encode21BitAddress(266288)).toEqual([0x10, 0x20, 0x30]);
        });

        it('should mask values to 7 bits per byte', () => {
            const result = encode21BitAddress(12345);
            result.forEach(byte => {
                expect(byte & 0x80).toBe(0);
            });
        });
    });

    describe('round-trip', () => {
        it('should round-trip various addresses', () => {
            const testValues = [0, 1, 127, 128, 1000, 50000, 100000, 2097151];
            testValues.forEach(value => {
                const encoded = encode21BitAddress(value);
                const decoded = parse21BitAddress(encoded, 0);
                expect(decoded).toBe(value);
            });
        });
    });
});

describe('S-330 24-bit Address Conversion', () => {
    describe('parse24BitAddress', () => {
        it('should parse zero address', () => {
            const data = [0x00, 0x00, 0x00];
            expect(parse24BitAddress(data, 0)).toBe(0);
        });

        it('should parse maximum 24-bit address', () => {
            const data = [0xFF, 0xFF, 0xFF];
            expect(parse24BitAddress(data, 0)).toBe(0xFFFFFF);
        });

        it('should parse mid-range values', () => {
            const data = [0x12, 0x34, 0x56];
            expect(parse24BitAddress(data, 0)).toBe(0x123456);
        });

        it('should handle offset', () => {
            const data = [0x00, 0x00, 0xAB, 0xCD, 0xEF];
            expect(parse24BitAddress(data, 2)).toBe(0xABCDEF);
        });
    });

    describe('encode24BitAddress', () => {
        it('should encode zero address', () => {
            expect(encode24BitAddress(0)).toEqual([0x00, 0x00, 0x00]);
        });

        it('should encode maximum 24-bit address', () => {
            expect(encode24BitAddress(0xFFFFFF)).toEqual([0xFF, 0xFF, 0xFF]);
        });

        it('should encode mid-range values', () => {
            expect(encode24BitAddress(0x123456)).toEqual([0x12, 0x34, 0x56]);
        });
    });

    describe('round-trip', () => {
        it('should round-trip various addresses', () => {
            const testValues = [0, 1, 255, 256, 0x1234, 0x123456, 0xFFFFFF];
            testValues.forEach(value => {
                const encoded = encode24BitAddress(value);
                const decoded = parse24BitAddress(encoded, 0);
                expect(decoded).toBe(value);
            });
        });
    });
});

describe('S-330 Signed Value Conversion', () => {
    describe('parseSignedValue', () => {
        it('should parse center value as 0', () => {
            expect(parseSignedValue(64)).toBe(0);
        });

        it('should parse 0 as -64', () => {
            expect(parseSignedValue(0)).toBe(-64);
        });

        it('should parse 127 as +63', () => {
            expect(parseSignedValue(127)).toBe(63);
        });

        it('should handle custom center', () => {
            expect(parseSignedValue(50, 50)).toBe(0);
            expect(parseSignedValue(0, 50)).toBe(-50);
            expect(parseSignedValue(100, 50)).toBe(50);
        });
    });

    describe('encodeSignedValue', () => {
        it('should encode 0 as center value', () => {
            expect(encodeSignedValue(0)).toBe(64);
        });

        it('should encode -64 as 0', () => {
            expect(encodeSignedValue(-64)).toBe(0);
        });

        it('should encode +63 as 127', () => {
            expect(encodeSignedValue(63)).toBe(127);
        });

        it('should clamp values below minimum', () => {
            expect(encodeSignedValue(-100)).toBe(0);
        });

        it('should clamp values above maximum', () => {
            expect(encodeSignedValue(100)).toBe(127);
        });

        it('should handle custom center', () => {
            expect(encodeSignedValue(0, 50)).toBe(50);
            expect(encodeSignedValue(-50, 50)).toBe(0);
            expect(encodeSignedValue(50, 50)).toBe(100);
        });
    });

    describe('round-trip', () => {
        it('should round-trip values within range', () => {
            for (let i = -64; i <= 63; i++) {
                const encoded = encodeSignedValue(i);
                const decoded = parseSignedValue(encoded);
                expect(decoded).toBe(i);
            }
        });
    });
});

describe('S-330 Envelope Conversion', () => {
    describe('parseEnvelope', () => {
        it('should parse 8-point envelope from data', () => {
            // Create test data with known values
            // Layout: sustainPoint at offset 0, endPoint at offset 1
            // Levels at even offsets 2,4,6,8,10,12,14,16
            // Rates at odd offsets 3,5,7,9,11,13,15,17
            const data = new Array(20).fill(0);
            data[0] = 5; // sustain point
            data[1] = 8; // end point
            // levels
            data[2] = 127; data[4] = 100; data[6] = 80; data[8] = 60;
            data[10] = 40; data[12] = 20; data[14] = 10; data[16] = 0;
            // rates
            data[3] = 10; data[5] = 20; data[7] = 30; data[9] = 40;
            data[11] = 50; data[13] = 60; data[15] = 70; data[17] = 80;

            const result = parseEnvelope(data, 0, 1, 2);
            expect(result.sustainPoint).toBe(5);
            expect(result.endPoint).toBe(8);
            expect(result.levels).toEqual([127, 100, 80, 60, 40, 20, 10, 0]);
            expect(result.rates).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
        });

        it('should handle missing data with defaults', () => {
            const result = parseEnvelope([], 0, 1, 2);
            expect(result.sustainPoint).toBe(0);
            expect(result.endPoint).toBe(8);
            expect(result.levels).toHaveLength(8);
            expect(result.rates).toHaveLength(8);
            // rates default to 1 (minimum)
            result.rates.forEach(r => expect(r).toBe(1));
        });
    });

    describe('encodeEnvelope', () => {
        it('should encode 8-point envelope to data array', () => {
            const envelope: S330Envelope = {
                levels: [127, 100, 80, 60, 40, 20, 10, 0],
                rates: [10, 20, 30, 40, 50, 60, 70, 80],
                sustainPoint: 5,
                endPoint: 8,
            };
            const output = new Array(20).fill(0);
            encodeEnvelope(envelope, 0, 1, 2, output);

            expect(output[0]).toBe(5); // sustain point
            expect(output[1]).toBe(8); // end point
            // levels at even offsets
            expect(output[2]).toBe(127);
            expect(output[4]).toBe(100);
            expect(output[16]).toBe(0);
            // rates at odd offsets
            expect(output[3]).toBe(10);
            expect(output[5]).toBe(20);
            expect(output[17]).toBe(80);
        });

        it('should ensure minimum rate of 1', () => {
            const envelope: S330Envelope = {
                levels: [0, 0, 0, 0, 0, 0, 0, 0],
                rates: [0, 0, 0, 0, 0, 0, 0, 0], // zeros should become 1
                sustainPoint: 0,
                endPoint: 1,
            };
            const output = new Array(20).fill(0);
            encodeEnvelope(envelope, 0, 1, 2, output);

            // rates should be at least 1
            expect(output[3]).toBe(1);
            expect(output[5]).toBe(1);
        });
    });

    describe('round-trip', () => {
        it('should round-trip envelope values', () => {
            const envelope: S330Envelope = {
                levels: [127, 100, 80, 60, 40, 20, 10, 0],
                rates: [10, 20, 30, 40, 50, 60, 70, 80],
                sustainPoint: 4,
                endPoint: 7,
            };
            const output = new Array(20).fill(0);
            encodeEnvelope(envelope, 0, 1, 2, output);
            const decoded = parseEnvelope(output, 0, 1, 2);

            expect(decoded.sustainPoint).toBe(envelope.sustainPoint);
            expect(decoded.endPoint).toBe(envelope.endPoint);
            expect(decoded.levels).toEqual(envelope.levels);
            expect(decoded.rates).toEqual(envelope.rates);
        });
    });
});

describe('S-330 Structure Parsing', () => {
    describe('parseSystemParams', () => {
        it('should return default system params', () => {
            const result = parseSystemParams([]);
            expect(result.masterTune).toBe(64);
            expect(result.masterLevel).toBe(127);
            expect(result.midiChannel).toBe(0);
            expect(result.deviceId).toBe(0);
            expect(result.exclusiveEnabled).toBe(true);
        });
    });

    describe('parsePatchCommon', () => {
        it('should parse patch common params from data', () => {
            // Create minimal test data (512 bytes)
            const data = new Array(512).fill(0);
            // Set name to "TEST" at bytes 0-11
            const nameBytes = [0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20];
            nameBytes.forEach((b, i) => { data[i] = b; });
            // Bender range at byte 12
            data[12] = 5;
            // Aftertouch sens at byte 14
            data[14] = 100;
            // Key mode at byte 15 (0 = normal)
            data[15] = 0;
            // Velocity threshold at byte 16
            data[16] = 64;
            // Level at byte 237 (nibble address 03 5a: (3<<7|0x5a)/2 = 474/2 = 237)
            data[237] = 120;

            const result = parsePatchCommon(data);
            expect(result.name).toBe('TEST');
            expect(result.benderRange).toBe(5);
            expect(result.aftertouchSens).toBe(100);
            expect(result.keyMode).toBe('normal');
            expect(result.velocityThreshold).toBe(64);
            expect(result.level).toBe(120);
            expect(result.toneLayer1).toHaveLength(109);
            expect(result.toneLayer2).toHaveLength(109);
        });
    });

    describe('parseTone', () => {
        it('should parse tone parameters from data', () => {
            // Build a valid 256-byte tone block
            const data = new Array(TONE_BLOCK_SIZE).fill(0);
            // Name: "TESTNAME"
            data[TONE_OFFSETS.NAME] = 0x54; // T
            data[TONE_OFFSETS.NAME + 1] = 0x45; // E
            data[TONE_OFFSETS.NAME + 2] = 0x53; // S
            data[TONE_OFFSETS.NAME + 3] = 0x54; // T
            data[TONE_OFFSETS.NAME + 4] = 0x4e; // N
            data[TONE_OFFSETS.NAME + 5] = 0x41; // A
            data[TONE_OFFSETS.NAME + 6] = 0x4d; // M
            data[TONE_OFFSETS.NAME + 7] = 0x45; // E
            data[TONE_OFFSETS.ORIG_KEY_NUMBER] = 60;   // Original key
            data[TONE_OFFSETS.SAMPLING_FREQ] = 1;    // Sample rate (1 = 30kHz)
            data[TONE_OFFSETS.LOOP_MODE] = 0;   // Loop mode (forward)
            data[TONE_OFFSETS.TVA_LEVEL] = 100; // Level
            data[TONE_OFFSETS.TVF_CUTOFF] = 127; // Cutoff
            // Set TVA envelope sustain/end points
            data[TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT] = 5;
            data[TONE_OFFSETS.TVA_ENV_END_POINT] = 8;

            const result = parseTone(data);
            expect(result.name).toBe('TESTNAME');
            expect(result.originalKey).toBe(60);
            expect(result.sampleRate).toBe('30kHz');
            expect(result.loopMode).toBe('forward');
            expect(result.tva.level).toBe(100);
            expect(result.tvf.cutoff).toBe(127);
            expect(result.tva.envelope.sustainPoint).toBe(5);
            expect(result.tva.envelope.endPoint).toBe(8);
        });

        it('should handle empty data with defaults', () => {
            const result = parseTone([]);
            expect(result.name).toBe('');
            expect(result.originalKey).toBe(60);
            // Empty data means value 0, which is 15kHz
            expect(result.sampleRate).toBe('15kHz');
            expect(result.loopMode).toBe('forward');
            // 8-point envelope with defaults
            expect(result.tva.envelope.levels).toHaveLength(8);
            expect(result.tva.envelope.rates).toHaveLength(8);
            expect(result.tvf.envelope.levels).toHaveLength(8);
            expect(result.tvf.envelope.rates).toHaveLength(8);
        });

        it('should parse 8-point envelopes correctly', () => {
            const data = new Array(TONE_BLOCK_SIZE).fill(0);
            // Set TVA envelope levels (at even offsets from LEVEL_1)
            data[TONE_OFFSETS.TVA_ENV_LEVEL_1] = 127;
            data[TONE_OFFSETS.TVA_ENV_LEVEL_1 + 2] = 100;
            data[TONE_OFFSETS.TVA_ENV_LEVEL_1 + 4] = 80;
            // Set TVA envelope rates (at odd offsets from LEVEL_1)
            data[TONE_OFFSETS.TVA_ENV_LEVEL_1 + 1] = 10;
            data[TONE_OFFSETS.TVA_ENV_LEVEL_1 + 3] = 20;
            // Set sustain/end points
            data[TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT] = 3;
            data[TONE_OFFSETS.TVA_ENV_END_POINT] = 6;

            const result = parseTone(data);
            expect(result.tva.envelope.levels[0]).toBe(127);
            expect(result.tva.envelope.levels[1]).toBe(100);
            expect(result.tva.envelope.levels[2]).toBe(80);
            expect(result.tva.envelope.rates[0]).toBe(10);
            expect(result.tva.envelope.rates[1]).toBe(20);
            expect(result.tva.envelope.sustainPoint).toBe(3);
            expect(result.tva.envelope.endPoint).toBe(6);
        });
    });
});

describe('S-330 Structure Encoding', () => {
    describe('encodeSystemParams', () => {
        it('should return empty array (stub)', () => {
            const params: S330SystemParams = {
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
            expect(encodeSystemParams(params)).toEqual([]);
        });
    });

    describe('encodePatchCommon', () => {
        it('should encode patch common parameters to 512 bytes', () => {
            const params: S330PatchCommon = {
                name: 'TEST',
                benderRange: 2,
                aftertouchSens: 64,
                keyMode: 'normal',
                velocityThreshold: 64,
                toneLayer1: new Array(109).fill(0),
                toneLayer2: new Array(109).fill(0),
                copySource: 0,
                octaveShift: 0,
                level: 127,
                detune: 0,
                velocityMixRatio: 64,
                aftertouchAssign: 'modulation',
                keyAssign: 'rotary',
                outputAssign: 0,
            };
            const encoded = encodePatchCommon(params);
            expect(encoded.length).toBe(512);
        });

        it('should round-trip encode/decode correctly', () => {
            const params: S330PatchCommon = {
                name: 'TEST PATCH',
                benderRange: 5,
                aftertouchSens: 100,
                keyMode: 'v-sw',
                velocityThreshold: 80,
                toneLayer1: new Array(109).fill(10),
                toneLayer2: new Array(109).fill(20),
                copySource: 3,
                octaveShift: -1,
                level: 100,
                detune: 32,
                velocityMixRatio: 75,
                aftertouchAssign: 'filter',
                keyAssign: 'fix',
                outputAssign: 5,
            };
            const encoded = encodePatchCommon(params);
            const decoded = parsePatchCommon(encoded);

            expect(decoded.name).toBe(params.name);
            expect(decoded.benderRange).toBe(params.benderRange);
            expect(decoded.aftertouchSens).toBe(params.aftertouchSens);
            expect(decoded.keyMode).toBe(params.keyMode);
            expect(decoded.velocityThreshold).toBe(params.velocityThreshold);
            expect(decoded.level).toBe(params.level);
            expect(decoded.detune).toBe(params.detune);
            expect(decoded.octaveShift).toBe(params.octaveShift);
            expect(decoded.velocityMixRatio).toBe(params.velocityMixRatio);
            expect(decoded.aftertouchAssign).toBe(params.aftertouchAssign);
            expect(decoded.keyAssign).toBe(params.keyAssign);
            expect(decoded.outputAssign).toBe(params.outputAssign);
        });
    });

    describe('encodeTone', () => {
        it('should encode tone to 256-byte array', () => {
            const defaultEnvelope: S330Envelope = {
                levels: [127, 100, 80, 60, 40, 20, 10, 0],
                rates: [10, 20, 30, 40, 50, 60, 70, 80],
                sustainPoint: 5,
                endPoint: 8,
            };
            const tone: S330Tone = {
                name: 'TEST',
                outputAssign: 0,
                sourceTone: 0,
                origSubTone: 0,
                sampleRate: '30kHz',
                originalKey: 60,
                wave: {
                    bank: 0,
                    segmentTop: 0,
                    segmentLength: 0,
                    startPoint: 0,
                    endPoint: 0,
                    loopPoint: 0,
                    loopLength: 0,
                },
                loopMode: 'forward',
                lfo: {
                    rate: 64,
                    sync: false,
                    delay: 0,
                    mode: 'normal',
                    polarity: false,
                    offset: 0,
                },
                tvaLfoDepth: 0,
                transpose: 64,
                fineTune: 0,
                tvf: {
                    cutoff: 127,
                    resonance: 0,
                    keyFollow: 0,
                    lfoDepth: 0,
                    egDepth: 0,
                    egPolarity: 'normal',
                    levelCurve: 0,
                    keyRateFollow: 0,
                    velRateFollow: 0,
                    enabled: true,
                    envelope: defaultEnvelope,
                },
                tva: {
                    lfoDepth: 0,
                    keyRate: 0,
                    level: 127,
                    velRate: 0,
                    levelCurve: 0,
                    envelope: defaultEnvelope,
                },
                benderEnabled: true,
                aftertouchEnabled: true,
                pitchFollow: false,
                recThreshold: 0,
                recPreTrigger: 0,
                loopTune: 0,
                envZoom: 0,
                copySource: 0,
            };
            const encoded = encodeTone(tone);
            expect(encoded).toHaveLength(TONE_BLOCK_SIZE);
            // Check name encoding
            expect(encoded[TONE_OFFSETS.NAME]).toBe(0x54); // T
            expect(encoded[TONE_OFFSETS.NAME + 1]).toBe(0x45); // E
            expect(encoded[TONE_OFFSETS.NAME + 2]).toBe(0x53); // S
            expect(encoded[TONE_OFFSETS.NAME + 3]).toBe(0x54); // T
            expect(encoded[TONE_OFFSETS.NAME + 4]).toBe(0x20); // space (padded)
            // Check parameters
            expect(encoded[TONE_OFFSETS.ORIG_KEY_NUMBER]).toBe(60);   // Original key
            expect(encoded[TONE_OFFSETS.SAMPLING_FREQ]).toBe(1);    // Sample rate (30kHz = 1)
            expect(encoded[TONE_OFFSETS.TVA_LEVEL]).toBe(127); // Level
            expect(encoded[TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT]).toBe(5);
            expect(encoded[TONE_OFFSETS.TVA_ENV_END_POINT]).toBe(8);
        });

        it('should round-trip encode/decode correctly', () => {
            const tvaEnvelope: S330Envelope = {
                levels: [127, 100, 80, 60, 40, 20, 10, 0],
                rates: [10, 20, 30, 40, 50, 60, 70, 80],
                sustainPoint: 4,
                endPoint: 7,
            };
            const tvfEnvelope: S330Envelope = {
                levels: [0, 50, 100, 127, 100, 50, 25, 0],
                rates: [5, 15, 25, 35, 45, 55, 65, 75],
                sustainPoint: 3,
                endPoint: 6,
            };
            const tone: S330Tone = {
                name: 'PIANO',
                outputAssign: 1,
                sourceTone: 5,
                origSubTone: 0,
                sampleRate: '15kHz',
                originalKey: 48,
                wave: {
                    bank: 0,
                    segmentTop: 2,
                    segmentLength: 4,
                    startPoint: 0x1234,
                    endPoint: 0x5678,
                    loopPoint: 0x2000,
                    loopLength: 0x1000,
                },
                loopMode: 'alternating',
                lfo: {
                    rate: 50,
                    sync: true,
                    delay: 10,
                    mode: 'one-shot',
                    polarity: true,
                    offset: 20,
                },
                tvaLfoDepth: 30,
                transpose: 70,
                fineTune: -10,
                tvf: {
                    cutoff: 100,
                    resonance: 30,
                    keyFollow: 40,
                    lfoDepth: 20,
                    egDepth: 50,
                    egPolarity: 'reverse',
                    levelCurve: 2,
                    keyRateFollow: 60,
                    velRateFollow: 70,
                    enabled: true,
                    envelope: tvfEnvelope,
                },
                tva: {
                    lfoDepth: 25,
                    keyRate: 35,
                    level: 100,
                    velRate: 45,
                    levelCurve: 3,
                    envelope: tvaEnvelope,
                },
                benderEnabled: true,
                aftertouchEnabled: false,
                pitchFollow: true,
                recThreshold: 64,
                recPreTrigger: 2,
                loopTune: 5,
                envZoom: 3,
                copySource: 10,
            };
            const encoded = encodeTone(tone);
            const decoded = parseTone(encoded);

            expect(decoded.name).toBe(tone.name);
            expect(decoded.originalKey).toBe(tone.originalKey);
            expect(decoded.sampleRate).toBe(tone.sampleRate);
            expect(decoded.loopMode).toBe(tone.loopMode);
            expect(decoded.tva.level).toBe(tone.tva.level);
            expect(decoded.tvf.cutoff).toBe(tone.tvf.cutoff);
            expect(decoded.tvf.resonance).toBe(tone.tvf.resonance);
            expect(decoded.lfo.rate).toBe(tone.lfo.rate);
            expect(decoded.lfo.delay).toBe(tone.lfo.delay);
            // Check envelope round-trip
            expect(decoded.tva.envelope.sustainPoint).toBe(tone.tva.envelope.sustainPoint);
            expect(decoded.tva.envelope.endPoint).toBe(tone.tva.envelope.endPoint);
            expect(decoded.tva.envelope.levels).toEqual(tone.tva.envelope.levels);
            expect(decoded.tva.envelope.rates).toEqual(tone.tva.envelope.rates);
        });
    });
});

describe('S-330 Validation Functions', () => {
    describe('isValidDeviceId', () => {
        it('should accept valid device IDs (0-31)', () => {
            expect(isValidDeviceId(0)).toBe(true);
            expect(isValidDeviceId(15)).toBe(true);
            expect(isValidDeviceId(31)).toBe(true);
        });

        it('should reject invalid device IDs', () => {
            expect(isValidDeviceId(-1)).toBe(false);
            expect(isValidDeviceId(32)).toBe(false);
            expect(isValidDeviceId(127)).toBe(false);
        });
    });

    describe('isValidMidiChannel', () => {
        it('should accept valid MIDI channels (0-15)', () => {
            expect(isValidMidiChannel(0)).toBe(true);
            expect(isValidMidiChannel(8)).toBe(true);
            expect(isValidMidiChannel(15)).toBe(true);
        });

        it('should reject invalid MIDI channels', () => {
            expect(isValidMidiChannel(-1)).toBe(false);
            expect(isValidMidiChannel(16)).toBe(false);
            expect(isValidMidiChannel(127)).toBe(false);
        });
    });

    describe('isValidPatchNumber', () => {
        it('should accept valid patch numbers (0-63)', () => {
            expect(isValidPatchNumber(0)).toBe(true);
            expect(isValidPatchNumber(32)).toBe(true);
            expect(isValidPatchNumber(63)).toBe(true);
        });

        it('should reject invalid patch numbers', () => {
            expect(isValidPatchNumber(-1)).toBe(false);
            expect(isValidPatchNumber(64)).toBe(false);
            expect(isValidPatchNumber(127)).toBe(false);
        });
    });

    describe('isValidToneNumber', () => {
        it('should accept valid tone numbers (0-31)', () => {
            expect(isValidToneNumber(0)).toBe(true);
            expect(isValidToneNumber(16)).toBe(true);
            expect(isValidToneNumber(31)).toBe(true);
        });

        it('should reject invalid tone numbers', () => {
            expect(isValidToneNumber(-1)).toBe(false);
            expect(isValidToneNumber(32)).toBe(false);
            expect(isValidToneNumber(127)).toBe(false);
        });
    });

    describe('isValid7BitValue', () => {
        it('should accept valid 7-bit values (0-127)', () => {
            expect(isValid7BitValue(0)).toBe(true);
            expect(isValid7BitValue(64)).toBe(true);
            expect(isValid7BitValue(127)).toBe(true);
        });

        it('should reject invalid 7-bit values', () => {
            expect(isValid7BitValue(-1)).toBe(false);
            expect(isValid7BitValue(128)).toBe(false);
            expect(isValid7BitValue(255)).toBe(false);
        });
    });

    describe('clamp7Bit', () => {
        it('should pass through values in range', () => {
            expect(clamp7Bit(0)).toBe(0);
            expect(clamp7Bit(64)).toBe(64);
            expect(clamp7Bit(127)).toBe(127);
        });

        it('should clamp values below 0', () => {
            expect(clamp7Bit(-1)).toBe(0);
            expect(clamp7Bit(-100)).toBe(0);
        });

        it('should clamp values above 127', () => {
            expect(clamp7Bit(128)).toBe(127);
            expect(clamp7Bit(255)).toBe(127);
        });

        it('should round floating point values', () => {
            expect(clamp7Bit(64.4)).toBe(64);
            expect(clamp7Bit(64.5)).toBe(65);
            expect(clamp7Bit(64.6)).toBe(65);
        });
    });
});
