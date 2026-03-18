/**
 * S-Series Shared Tone Factory
 *
 * Generic factory functions for creating tone objects with sensible defaults.
 * Device-specific factories delegate here with their limits and cast the result.
 *
 * @packageDocumentation
 */

import type {
    SSeriesBaseTone,
    SSeriesDeviceLimits,
    SSeriesLoopMode,
    SSeriesSampleRate,
} from './s-series-types.js';

/**
 * Configuration for creating a new tone.
 */
export interface SSeriesCreateToneConfig {
    name: string;
    sampleRate: 15000 | 30000 | '15kHz' | '30kHz';
    waveBank: number;
    segmentTop: number;
    segmentLength: number;
    sampleCount: number;
    loopMode?: SSeriesLoopMode;
    loopPoint?: number;
    originalKey?: number;
    transpose?: number;
    pitchFollow?: boolean;
    outputAssign?: number;
    velocitySensitivity?: number;
}

/**
 * Configuration for creating a sub-tone that shares wave data with a primary tone.
 */
export interface SSeriesCreateSubToneConfig {
    name: string;
    sourceToneIndex: number;
    sampleRate: 15000 | 30000 | '15kHz' | '30kHz';
    startPoint: number;
    endPoint: number;
    loopMode?: SSeriesLoopMode;
    loopPoint?: number;
    originalKey?: number;
    transpose?: number;
    pitchFollow?: boolean;
    outputAssign?: number;
    velocitySensitivity?: number;
}

function normalizeSampleRate(rate: 15000 | 30000 | '15kHz' | '30kHz'): SSeriesSampleRate {
    if (typeof rate === 'number') {
        return rate === 30000 ? '30kHz' : '15kHz';
    }
    return rate;
}

function buildDefaultToneBody(
    name: string,
    outputAssign: number,
    sampleRate: SSeriesSampleRate,
    originalKey: number,
    transpose: number,
    effectivePitchFollow: boolean,
    velocitySensitivity: number,
): Omit<SSeriesBaseTone, 'wave' | 'loopMode' | 'sourceTone' | 'origSubTone'> {
    return {
        name: name.slice(0, 8).toUpperCase().padEnd(8, ' '),
        outputAssign,
        sampleRate,
        originalKey,
        lfo: {
            rate: 50,
            sync: false,
            delay: 0,
            mode: 'normal',
            polarity: false,
            offset: 64,
        },
        tvaLfoDepth: 0,
        transpose,
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
            enabled: false,
            envelope: {
                levels: [127, 127, 127, 127, 127, 127, 127, 127],
                rates: [127, 127, 127, 127, 127, 127, 127, 127],
                sustainPoint: 7,
                endPoint: 8,
            },
        },
        tva: {
            lfoDepth: 0,
            keyRate: 0,
            level: 127,
            velRate: 0,
            levelCurve: Math.max(0, Math.min(5, velocitySensitivity)) as 0 | 1 | 2 | 3 | 4 | 5,
            envelope: {
                levels: [127, 127, 127, 127, 127, 127, 127, 0],
                rates: [127, 127, 127, 127, 127, 127, 127, 30],
                sustainPoint: 6,
                endPoint: 8,
            },
        },
        benderEnabled: effectivePitchFollow,
        aftertouchEnabled: false,
        pitchFollow: effectivePitchFollow,
        recThreshold: 64,
        recPreTrigger: 0,
        loopTune: 0,
        envZoom: 0,
        copySource: 0,
    };
}

/**
 * Create a new tone with sensible defaults for one-shot samples.
 */
export function createSeriesTone(config: SSeriesCreateToneConfig): SSeriesBaseTone {
    const {
        name,
        sampleRate,
        waveBank,
        segmentTop,
        segmentLength,
        sampleCount,
        loopMode = 'one-shot',
        loopPoint = 0,
        originalKey = 60,
        transpose = 0,
        pitchFollow,
        outputAssign = 0,
        velocitySensitivity = 0,
    } = config;

    const effectivePitchFollow = pitchFollow ?? (loopMode !== 'one-shot');

    return {
        ...buildDefaultToneBody(
            name, outputAssign, normalizeSampleRate(sampleRate),
            originalKey, transpose, effectivePitchFollow, velocitySensitivity,
        ),
        sourceTone: 0,
        origSubTone: 0,
        wave: {
            bank: waveBank,
            segmentTop,
            segmentLength,
            startPoint: 0,
            endPoint: Math.max(0, sampleCount - 1),
            loopPoint,
            loopLength: Math.max(0, sampleCount - 1 - loopPoint),
        },
        loopMode,
    };
}

/**
 * Create a sub-tone that shares wave data with a primary tone.
 * The `limits.sourcetoneMask` controls the bit mask for sourceToneIndex.
 */
export function createSeriesSubTone(
    config: SSeriesCreateSubToneConfig,
    limits: SSeriesDeviceLimits,
): SSeriesBaseTone {
    const {
        name,
        sourceToneIndex,
        sampleRate,
        startPoint,
        endPoint,
        loopMode = 'one-shot',
        loopPoint = startPoint,
        originalKey = 60,
        transpose = 0,
        pitchFollow,
        outputAssign = 0,
        velocitySensitivity = 0,
    } = config;

    const effectivePitchFollow = pitchFollow ?? (loopMode !== 'one-shot');

    return {
        ...buildDefaultToneBody(
            name, outputAssign, normalizeSampleRate(sampleRate),
            originalKey, transpose, effectivePitchFollow, velocitySensitivity,
        ),
        sourceTone: sourceToneIndex & limits.sourcetoneMask,
        origSubTone: 1,
        wave: {
            bank: 0,
            segmentTop: 0,
            segmentLength: 0,
            startPoint,
            endPoint,
            loopPoint,
            loopLength: Math.max(0, endPoint - loopPoint),
        },
        loopMode,
    };
}

/**
 * Create a primary tone for monolithic wave data (all slices in one wave).
 */
export function createSeriesMonolithicPrimaryTone(
    config: SSeriesCreateToneConfig,
    startPoint: number,
    endPoint: number,
): SSeriesBaseTone {
    const tone = createSeriesTone(config);

    tone.wave.startPoint = startPoint;
    tone.wave.endPoint = endPoint;
    tone.wave.loopPoint = startPoint;
    tone.wave.loopLength = endPoint - startPoint;

    tone.sourceTone = 0;
    tone.origSubTone = 0;

    return tone;
}
