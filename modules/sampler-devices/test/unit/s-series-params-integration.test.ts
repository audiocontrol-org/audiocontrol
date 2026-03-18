/**
 * S-Series Shared Parameter Integration Tests
 *
 * Verifies that both S-330 and S-550 device wrappers correctly roundtrip
 * patch parameters through the shared parse/encode code, with particular
 * focus on octave shift — a signed value that previously required a
 * clamping fix applied independently in both files.
 */

import { describe, it, expect } from 'vitest';

import {
    parsePatchCommon as parseS330Patch,
    encodePatchCommon as encodeS330Patch,
    createEmptyPatchCommon as createS330Empty,
} from '@/devices/s330/index.js';

import {
    PATCH_PARAMS as S330_PATCH_PARAMS,
} from '@/devices/s330/s330-addresses.js';

import {
    parsePatchCommon as parseS550Patch,
    encodePatchCommon as encodeS550Patch,
    createEmptyPatchCommon as createS550Empty,
} from '@/devices/s550/index.js';

import {
    PATCH_PARAMS as S550_PATCH_PARAMS,
} from '@/devices/s550/s550-addresses.js';

describe('S-Series Octave Shift Roundtrip', () => {
    const octaveShiftValues = [-2, -1, 0, 1, 2];

    describe('S-330', () => {
        it.each(octaveShiftValues)(
            'should roundtrip octave shift %d',
            (shift) => {
                const patch = createS330Empty();
                patch.name = 'OctTest';
                patch.octaveShift = shift;

                const encoded = encodeS330Patch(patch);
                const decoded = parseS330Patch(encoded);

                expect(decoded.octaveShift).toBe(shift);
            }
        );

        it('should clamp out-of-range octave shift byte to 0', () => {
            const data = new Array(512).fill(0);
            // Set a non-empty name so level isn't defaulted
            for (let i = 0; i < 4; i++) {
                data[S330_PATCH_PARAMS.name.byteOffset + i] = 0x41 + i;
            }
            // Set octave shift byte to 0xFF (uninitialized memory)
            data[S330_PATCH_PARAMS.octaveShift.byteOffset] = 0xFF;

            const decoded = parseS330Patch(data);

            expect(decoded.octaveShift).toBe(0);
        });

        it('should clamp octave shift byte value 5 to 0', () => {
            const data = new Array(512).fill(0);
            for (let i = 0; i < 4; i++) {
                data[S330_PATCH_PARAMS.name.byteOffset + i] = 0x41 + i;
            }
            data[S330_PATCH_PARAMS.octaveShift.byteOffset] = 5;

            const decoded = parseS330Patch(data);

            expect(decoded.octaveShift).toBe(0);
        });
    });

    describe('S-550', () => {
        it.each(octaveShiftValues)(
            'should roundtrip octave shift %d',
            (shift) => {
                const patch = createS550Empty();
                patch.name = 'OctTest';
                patch.octaveShift = shift;

                const encoded = encodeS550Patch(patch);
                const decoded = parseS550Patch(encoded);

                expect(decoded.octaveShift).toBe(shift);
            }
        );

        it('should clamp out-of-range octave shift byte to 0', () => {
            const data = new Array(512).fill(0);
            for (let i = 0; i < 4; i++) {
                data[S550_PATCH_PARAMS.name.byteOffset + i] = 0x41 + i;
            }
            data[S550_PATCH_PARAMS.octaveShift.byteOffset] = 0xFF;

            const decoded = parseS550Patch(data);

            expect(decoded.octaveShift).toBe(0);
        });

        it('should clamp octave shift byte value 5 to 0', () => {
            const data = new Array(512).fill(0);
            for (let i = 0; i < 4; i++) {
                data[S550_PATCH_PARAMS.name.byteOffset + i] = 0x41 + i;
            }
            data[S550_PATCH_PARAMS.octaveShift.byteOffset] = 5;

            const decoded = parseS550Patch(data);

            expect(decoded.octaveShift).toBe(0);
        });
    });

    describe('Cross-device consistency', () => {
        it('should produce identical encoded octave shift bytes for both devices', () => {
            for (const shift of octaveShiftValues) {
                const s330Patch = createS330Empty();
                s330Patch.octaveShift = shift;
                const s330Encoded = encodeS330Patch(s330Patch);

                const s550Patch = createS550Empty();
                s550Patch.octaveShift = shift;
                const s550Encoded = encodeS550Patch(s550Patch);

                expect(s330Encoded[S330_PATCH_PARAMS.octaveShift.byteOffset])
                    .toBe(s550Encoded[S550_PATCH_PARAMS.octaveShift.byteOffset]);
            }
        });
    });
});
