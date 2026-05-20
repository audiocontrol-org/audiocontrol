/**
 * S-330 Tone Factory
 *
 * Thin wrapper around shared S-series tone factory with S-330 specific
 * type constraints (wave bank 0-1, source tone 0-31).
 *
 * @packageDocumentation
 */

import type { S330Tone, SSeriesLoopMode } from './s330-types.js';
import {
    createSeriesTone,
    createSeriesSubTone,
    createSeriesMonolithicPrimaryTone,
    type SSeriesCreateToneConfig,
    type SSeriesCreateSubToneConfig,
} from '../roland-s-series/s-series-tone-factory.js';
import { S330_DEVICE_LIMITS } from '../roland-s-series/index.js';

export interface CreateToneConfig extends Omit<SSeriesCreateToneConfig, 'waveBank'> {
    /**
     * Wave bank. S-330 accepts 0/1 (A/B); the unified editor uses this factory
     * for S-550 as well, which accepts 0..3 (A/B/C/D). Out-of-range values
     * are rejected at the device-client boundary, not here.
     */
    waveBank: number;
}

export interface CreateSubToneConfig extends SSeriesCreateSubToneConfig {
    /** Index of the source tone (0-31) that owns the wave data */
    sourceToneIndex: number;
}

export function createTone(config: CreateToneConfig): S330Tone {
    return createSeriesTone(config) as S330Tone;
}

export function createSubTone(config: CreateSubToneConfig): S330Tone {
    return createSeriesSubTone(config, S330_DEVICE_LIMITS) as S330Tone;
}

export function createMonolithicPrimaryTone(
    config: CreateToneConfig,
    startPoint: number,
    endPoint: number,
): S330Tone {
    return createSeriesMonolithicPrimaryTone(config, startPoint, endPoint) as S330Tone;
}
