/**
 * S-550 Tone Factory
 *
 * Thin wrapper around shared S-series tone factory with S-550 specific
 * type constraints (wave bank 0-3, source tone 0-63).
 *
 * @packageDocumentation
 */

import type { S550Tone, SSeriesLoopMode } from './s550-types.js';
import {
    createSeriesTone,
    createSeriesSubTone,
    createSeriesMonolithicPrimaryTone,
    type SSeriesCreateToneConfig,
    type SSeriesCreateSubToneConfig,
} from '../roland-s-series/s-series-tone-factory.js';
import { S550_DEVICE_LIMITS } from '../roland-s-series/index.js';

export interface CreateToneConfig extends Omit<SSeriesCreateToneConfig, 'waveBank'> {
    /** Wave bank (0=A, 1=B, 2=C, 3=D for S-550) */
    waveBank: 0 | 1 | 2 | 3;
}

export interface CreateSubToneConfig extends SSeriesCreateSubToneConfig {
    /** Index of the source tone (0-63 for S-550) that owns the wave data */
    sourceToneIndex: number;
}

export function createTone(config: CreateToneConfig): S550Tone {
    return createSeriesTone(config) as S550Tone;
}

export function createSubTone(config: CreateSubToneConfig): S550Tone {
    return createSeriesSubTone(config, S550_DEVICE_LIMITS) as S550Tone;
}

export function createMonolithicPrimaryTone(
    config: CreateToneConfig,
    startPoint: number,
    endPoint: number,
): S550Tone {
    return createSeriesMonolithicPrimaryTone(config, startPoint, endPoint) as S550Tone;
}
