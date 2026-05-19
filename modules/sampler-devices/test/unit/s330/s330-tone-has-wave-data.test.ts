/**
 * Pins the `toneHasWaveData` predicate's authoritative semantic.
 *
 * Earlier drift: the UI gated export + Loop Editor affordances on
 * `endPoint > startPoint`, while the library exporter used
 * `segmentLength > 0`. Tones with populated segments but an unwritten
 * in-segment play range (start = end = 0) were a real device state —
 * a clearly-loaded, audible tone — that the UI mis-classified as
 * empty. This file pins the corrected predicate:
 *
 *   - segmentLength > 0  -> has wave data
 *   - segmentLength == 0 -> no wave data, regardless of start/end
 *   - undefined / null   -> no wave data (sparse-array safety)
 *
 * Type-guard contract: the truthy branch narrows the tone away from
 * `undefined | null`, so callers can drop preceding null-checks.
 */
import { describe, it, expect } from 'vitest';
import { toneHasWaveData } from '@audiocontrol/sampler-devices/roland-s-series';
import type { SSeriesBaseTone } from '@audiocontrol/sampler-devices/roland-s-series';

function makeTone(
    overrides: Partial<SSeriesBaseTone['wave']> = {},
): SSeriesBaseTone {
    return {
        name: 'test',
        sampleRate: '30kHz',
        originalKey: 60,
        keyMode: 'normal',
        sourceTone: 0,
        loopMode: 'forward',
        outputAssign: 0,
        loopTune: 0,
        wave: {
            bank: 0,
            segmentTop: 0,
            segmentLength: 0,
            startPoint: 0,
            endPoint: 0,
            loopPoint: 0,
            loopLength: 0,
            ...overrides,
        },
        tva: {
            level: 100,
            velocity: 0,
            lfoDepth: 0,
            envelope: {
                sustainPoint: 0,
                endPoint: 0,
                levels: [0, 0, 0, 0, 0, 0, 0, 0],
                times: [0, 0, 0, 0, 0, 0, 0, 0],
            },
            biasPoint: 60,
            biasLevel: 0,
            keyFollow: 0,
            levelCurve: 'linear',
        },
        tvf: {
            cutoff: 127,
            resonance: 0,
            lfoDepth: 0,
            envelopeDepth: 0,
            envelope: {
                sustainPoint: 0,
                endPoint: 0,
                levels: [0, 0, 0, 0, 0, 0, 0, 0],
                times: [0, 0, 0, 0, 0, 0, 0, 0],
            },
            biasPoint: 60,
            biasLevel: 0,
            keyFollow: 0,
            envelopeKeyFollow: 0,
            velocity: 0,
        },
        lfo: {
            rate: 0,
            sync: false,
            delay: 0,
            mode: 'triangle',
            polarity: false,
            offset: 0,
        },
        pitch: {
            coarse: 0,
            fine: 0,
            lfoDepth: 0,
            envelopeDepth: 0,
            envelope: {
                sustainPoint: 0,
                endPoint: 0,
                levels: [0, 0, 0, 0, 0, 0, 0, 0],
                times: [0, 0, 0, 0, 0, 0, 0, 0],
            },
            keyFollow: 0,
            velocity: 0,
        },
        aftertouch: { assign: 'off', depth: 0 },
        keyAssign: 'normal',
    } as unknown as SSeriesBaseTone;
}

describe('toneHasWaveData', () => {
    it('returns true when segmentLength > 0 even if start/end are both zero', () => {
        // The T11 case from the field report: a real audible tone whose
        // in-segment play range was never written but whose segments
        // are populated. Old predicate (endPoint > startPoint) returned
        // false; new predicate returns true.
        const tone = makeTone({ segmentLength: 1, startPoint: 0, endPoint: 0 });
        expect(toneHasWaveData(tone)).toBe(true);
    });

    it('returns true when both segments and play range are populated', () => {
        const tone = makeTone({ segmentLength: 4, startPoint: 0, endPoint: 0x10000 });
        expect(toneHasWaveData(tone)).toBe(true);
    });

    it('returns false when segmentLength is zero, regardless of start/end', () => {
        const tone = makeTone({ segmentLength: 0, startPoint: 0, endPoint: 0x10000 });
        expect(toneHasWaveData(tone)).toBe(false);
    });

    it('returns false for undefined (sparse tone array)', () => {
        expect(toneHasWaveData(undefined)).toBe(false);
    });

    it('returns false for null (Promise-resolves-to-null fetch path)', () => {
        expect(toneHasWaveData(null)).toBe(false);
    });

    it('narrows the type inside the truthy branch (compile-time contract)', () => {
        const tone: SSeriesBaseTone | undefined = makeTone({ segmentLength: 1 });
        if (toneHasWaveData(tone)) {
            // No null/undefined check needed — type guard narrowed it.
            expect(tone.wave.segmentLength).toBeGreaterThan(0);
        } else {
            throw new Error('expected truthy branch');
        }
    });
});
