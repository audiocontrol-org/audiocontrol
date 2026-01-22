import { describe, it, expect } from 'vitest';
// Import from index.ts to get coverage on re-exports
import {
    // Value conversion functions
    parseKeyMode,
    encodeKeyMode,
    parseLoopMode,
    encodeLoopMode,
    parseLfoDestination,
    encodeLfoDestination,
    parseSampleRate,
    encodeSampleRate,
    parseName,
    encodeName,
    parse21BitAddress,
    encode21BitAddress,
    parseSignedValue,
    encodeSignedValue,

    // Structure parsing (stubs)
    parseSystemParams,
    parsePatchCommon,
    parsePartial,
    parseTone,

    // Structure encoding (stubs)
    encodeSystemParams,
    encodePatchCommon,
    encodePartial,
    encodeTone,

    // Validation functions
    isValidDeviceId,
    isValidMidiChannel,
    isValidPatchNumber,
    isValidToneNumber,
    isValid7BitValue,
    clamp7Bit,
} from '@/devices/s330/index.js';

import type {
    S330SystemParams,
    S330PatchCommon,
    S330Partial,
    S330Tone,
} from '@/devices/s330/index.js';

describe('S-330 Key Mode Conversion', () => {
    describe('parseKeyMode', () => {
        it('should parse 0 as whole', () => {
            expect(parseKeyMode(0)).toBe('whole');
        });

        it('should parse 1 as dual', () => {
            expect(parseKeyMode(1)).toBe('dual');
        });

        it('should parse 2 as split', () => {
            expect(parseKeyMode(2)).toBe('split');
        });

        it('should default to whole for unknown values', () => {
            expect(parseKeyMode(3)).toBe('whole');
            expect(parseKeyMode(255)).toBe('whole');
        });
    });

    describe('encodeKeyMode', () => {
        it('should encode whole as 0', () => {
            expect(encodeKeyMode('whole')).toBe(0);
        });

        it('should encode dual as 1', () => {
            expect(encodeKeyMode('dual')).toBe(1);
        });

        it('should encode split as 2', () => {
            expect(encodeKeyMode('split')).toBe(2);
        });
    });

    describe('round-trip', () => {
        it('should round-trip all key modes', () => {
            expect(parseKeyMode(encodeKeyMode('whole'))).toBe('whole');
            expect(parseKeyMode(encodeKeyMode('dual'))).toBe('dual');
            expect(parseKeyMode(encodeKeyMode('split'))).toBe('split');
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

        it('should default to forward for unknown values', () => {
            expect(parseLoopMode(3)).toBe('forward');
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
    });

    describe('round-trip', () => {
        it('should round-trip all loop modes', () => {
            expect(parseLoopMode(encodeLoopMode('forward'))).toBe('forward');
            expect(parseLoopMode(encodeLoopMode('alternating'))).toBe('alternating');
            expect(parseLoopMode(encodeLoopMode('one-shot'))).toBe('one-shot');
        });
    });
});

describe('S-330 LFO Destination Conversion', () => {
    describe('parseLfoDestination', () => {
        it('should parse 0 as pitch', () => {
            expect(parseLfoDestination(0)).toBe('pitch');
        });

        it('should parse 1 as tvf', () => {
            expect(parseLfoDestination(1)).toBe('tvf');
        });

        it('should parse 2 as tva', () => {
            expect(parseLfoDestination(2)).toBe('tva');
        });

        it('should default to pitch for unknown values', () => {
            expect(parseLfoDestination(3)).toBe('pitch');
            expect(parseLfoDestination(255)).toBe('pitch');
        });
    });

    describe('encodeLfoDestination', () => {
        it('should encode pitch as 0', () => {
            expect(encodeLfoDestination('pitch')).toBe(0);
        });

        it('should encode tvf as 1', () => {
            expect(encodeLfoDestination('tvf')).toBe(1);
        });

        it('should encode tva as 2', () => {
            expect(encodeLfoDestination('tva')).toBe(2);
        });
    });

    describe('round-trip', () => {
        it('should round-trip all LFO destinations', () => {
            expect(parseLfoDestination(encodeLfoDestination('pitch'))).toBe('pitch');
            expect(parseLfoDestination(encodeLfoDestination('tvf'))).toBe('tvf');
            expect(parseLfoDestination(encodeLfoDestination('tva'))).toBe('tva');
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

describe('S-330 Structure Parsing (Stubs)', () => {
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
        it('should return default patch common params', () => {
            const result = parsePatchCommon([]);
            expect(result.name).toBe('INIT');
            expect(result.benderRange).toBe(2);
            expect(result.keyMode).toBe('whole');
            expect(result.level).toBe(127);
        });
    });

    describe('parsePartial', () => {
        it('should return default partial params', () => {
            const result = parsePartial([], 0);
            expect(result.toneNumber).toBe(0);
            expect(result.keyRangeLow).toBe(0);
            expect(result.keyRangeHigh).toBe(127);
            expect(result.level).toBe(127);
            expect(result.pan).toBe(64);
        });
    });

    describe('parseTone', () => {
        it('should return default tone params', () => {
            const result = parseTone([]);
            expect(result.name).toBe('INIT');
            expect(result.originalKey).toBe(60);
            expect(result.sampleRate).toBe('30kHz');
            expect(result.loopMode).toBe('forward');
            expect(result.lfo.destination).toBe('pitch');
        });
    });
});

describe('S-330 Structure Encoding (Stubs)', () => {
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
        it('should return empty array (stub)', () => {
            const params: S330PatchCommon = {
                name: 'TEST',
                benderRange: 2,
                aftertouchSens: 64,
                keyMode: 'whole',
                splitPoint: 60,
                portamentoTime: 0,
                portamentoEnabled: false,
                outputAssign: 0,
                level: 127,
            };
            expect(encodePatchCommon(params)).toEqual([]);
        });
    });

    describe('encodePartial', () => {
        it('should return empty array (stub)', () => {
            const partial: S330Partial = {
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
            expect(encodePartial(partial)).toEqual([]);
        });
    });

    describe('encodeTone', () => {
        it('should return empty array (stub)', () => {
            const tone: S330Tone = {
                name: 'TEST',
                originalKey: 60,
                sampleRate: '30kHz',
                startAddress: 0,
                loopStart: 0,
                loopEnd: 0,
                loopMode: 'forward',
                coarseTune: 64,
                fineTune: 64,
                level: 127,
                tva: { attack: 0, decay: 64, sustain: 127, release: 64 },
                tvf: {
                    cutoff: 127,
                    resonance: 0,
                    envDepth: 0,
                    envelope: { attack: 0, decay: 64, sustain: 127, release: 64 },
                },
                lfo: { rate: 64, depth: 0, delay: 0, destination: 'pitch' },
            };
            expect(encodeTone(tone)).toEqual([]);
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
