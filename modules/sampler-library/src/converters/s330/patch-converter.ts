/**
 * S-330 patch converter — thin wrapper around shared S-series converter.
 *
 * @packageDocumentation
 */

import type { S330Patch } from '@audiocontrol/sampler-devices/s330';
import {
    createSeriesPatchConverter,
    createSeriesPatchFromKeyGroups,
} from '@/converters/s-series/patch-converter.js';

export const s330PatchConverter = createSeriesPatchConverter<S330Patch>('s330');

export function createPatchFromKeyGroups(
    name: string,
    keyGroups: Array<{
        tone: string;
        keyRange: [number, number];
        layer?: 1 | 2;
    }>,
    toneNameToIndex: Map<string, number>,
): S330Patch {
    return createSeriesPatchFromKeyGroups<S330Patch>(name, keyGroups, toneNameToIndex);
}
