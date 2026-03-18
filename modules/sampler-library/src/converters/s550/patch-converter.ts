/**
 * S-550 patch converter — thin wrapper around shared S-series converter.
 *
 * @packageDocumentation
 */

import type { S550Patch } from '@audiocontrol/sampler-devices/s550';
import {
    createSeriesPatchConverter,
    createSeriesPatchFromKeyGroups,
} from '@/converters/s-series/patch-converter.js';

export const s550PatchConverter = createSeriesPatchConverter<S550Patch>('s550');

export function createPatchFromKeyGroups(
    name: string,
    keyGroups: Array<{
        tone: string;
        keyRange: [number, number];
        layer?: 1 | 2;
    }>,
    toneNameToIndex: Map<string, number>,
): S550Patch {
    return createSeriesPatchFromKeyGroups<S550Patch>(name, keyGroups, toneNameToIndex);
}
