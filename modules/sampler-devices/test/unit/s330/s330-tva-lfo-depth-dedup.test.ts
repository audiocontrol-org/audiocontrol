/**
 * #408 Phase A — pin the dedup contract for the TVA LFO depth byte.
 *
 * Prior shape: `SSeriesBaseTone` had a top-level `tvaLfoDepth: number` field
 * AND `tva.lfoDepth: number`. Both aliased the same byte at
 * `TONE_OFFSETS.TVA_LFO_DEPTH` (offset 26), with the parser writing the
 * byte into both fields and the encoder reading only from the top-level
 * one. The UI mutated `tva.lfoDepth`, so every slider edit was silently
 * dropped at encode time.
 *
 * Phase A collapsed onto `tva.lfoDepth` as the single source of truth.
 * This file pins:
 *
 *   1. Parsing reads the byte into `tva.lfoDepth` and ONLY there.
 *   2. The parsed object has no `tvaLfoDepth` own property (TS-level
 *      change verified at runtime).
 *   3. Mutating `tva.lfoDepth` and re-encoding produces the mutated byte
 *      at offset 26 — i.e. UI edits actually reach the device now.
 *
 * S-330 covers both devices for this contract because S-330 and S-550
 * share `parseSeriesTone` / `encodeSeriesTone` and the same
 * `TVA_LFO_DEPTH` offset (the only thing that differs across devices is
 * the bit-mask `SSeriesDeviceLimits`, which doesn't apply to the TVA
 * LFO depth byte).
 */
import { describe, it, expect } from 'vitest';
import {
    parseTone,
    encodeTone,
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
} from '@/devices/s330/index.js';

describe('#408 Phase A — TVA LFO depth dedup', () => {
    it('parses the byte at TONE_OFFSETS.TVA_LFO_DEPTH into tva.lfoDepth', () => {
        const data = new Array<number>(TONE_BLOCK_SIZE).fill(0);
        data[TONE_OFFSETS.TVA_LFO_DEPTH] = 73;

        const parsed = parseTone(data);

        expect(parsed.tva.lfoDepth).toBe(73);
    });

    it('does NOT expose a top-level tvaLfoDepth property on the parsed tone', () => {
        const data = new Array<number>(TONE_BLOCK_SIZE).fill(0);
        data[TONE_OFFSETS.TVA_LFO_DEPTH] = 73;

        const parsed = parseTone(data);

        // Runtime check that complements the type-level removal. If a
        // future change re-introduces the top-level alias, this test
        // fails loudly.
        expect(Object.prototype.hasOwnProperty.call(parsed, 'tvaLfoDepth')).toBe(false);
        expect((parsed as unknown as Record<string, unknown>).tvaLfoDepth).toBeUndefined();
    });

    it('encodes mutations to tva.lfoDepth back to the same offset', () => {
        const data = new Array<number>(TONE_BLOCK_SIZE).fill(0);
        data[TONE_OFFSETS.TVA_LFO_DEPTH] = 73;

        const parsed = parseTone(data);
        parsed.tva.lfoDepth = 45;
        const encoded = encodeTone(parsed);

        expect(encoded[TONE_OFFSETS.TVA_LFO_DEPTH]).toBe(45);
    });
});
