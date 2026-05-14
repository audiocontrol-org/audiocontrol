/**
 * S-Series shared tone converter for bidirectional YAML conversion.
 *
 * Contains all the helper functions and the generic converter factory
 * used by both S-330 and S-550 tone converters.
 *
 * @packageDocumentation
 */

import type {
    SSeriesBaseTone,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEnvelope,
    SSeriesLfoParams,
    SSeriesTvfParams,
    SSeriesTvaParams,
} from '@audiocontrol/sampler-devices/roland-s-series';
import { sampleRateLabelToHz } from '@audiocontrol/sampler-devices/roland-s-series';
import type { ToneConverter } from '@/converters/converter-registry.js';
import type { ToneYaml, S330ToneExtension, S550ToneExtension } from '@/schemas/index.js';
import type { LoopMode } from '@/types/index.js';

type SeriesToneExtension = S330ToneExtension | S550ToneExtension;

type DeviceType = 's330' | 's550';

export function mapLoopModeToYaml(mode: SSeriesLoopMode): LoopMode {
    switch (mode) {
        case 'forward':
            return 'forward';
        case 'alternating':
            return 'alternating';
        case 'one-shot':
            return 'oneShot';
        case 'reverse':
            return 'reverse';
    }
}

export function mapLoopModeFromYaml(mode: LoopMode): SSeriesLoopMode {
    switch (mode) {
        case 'forward':
            return 'forward';
        case 'alternating':
            return 'alternating';
        case 'oneShot':
            return 'one-shot';
        case 'reverse':
            return 'reverse';
    }
}

// `mapSampleRateToHz` was previously defined here; consolidated onto
// `sampleRateLabelToHz` from `@audiocontrol/sampler-devices/roland-s-series`
// (#401). The Hz → label inverse stays local — it's not duplicated elsewhere.
export function mapSampleRateFromHz(hz: number): SSeriesSampleRate {
    return hz >= 30000 ? '30kHz' : '15kHz';
}

export function envelopeToYaml(env: SSeriesEnvelope): {
    levels: [number, number, number, number, number, number, number, number];
    rates: [number, number, number, number, number, number, number, number];
    sustainPoint: number;
    endPoint: number;
} {
    return {
        levels: env.levels,
        rates: env.rates,
        sustainPoint: env.sustainPoint,
        endPoint: env.endPoint,
    };
}

export function envelopeFromYaml(yaml: {
    levels: [number, number, number, number, number, number, number, number];
    rates: [number, number, number, number, number, number, number, number];
    sustainPoint: number;
    endPoint: number;
}): SSeriesEnvelope {
    return {
        levels: yaml.levels,
        rates: yaml.rates,
        sustainPoint: yaml.sustainPoint,
        endPoint: yaml.endPoint,
    };
}

export function lfoToYaml(lfo: SSeriesLfoParams): NonNullable<SeriesToneExtension['lfo']> {
    return {
        rate: lfo.rate,
        sync: lfo.sync,
        delay: lfo.delay,
        mode: lfo.mode === 'one-shot' ? 'one-shot' : 'normal',
        polarity: lfo.polarity,
        offset: lfo.offset,
    };
}

export function lfoFromYaml(yaml: NonNullable<SeriesToneExtension['lfo']>): SSeriesLfoParams {
    return {
        rate: yaml.rate,
        sync: yaml.sync,
        delay: yaml.delay,
        mode: yaml.mode,
        polarity: yaml.polarity ?? false,
        offset: yaml.offset ?? 0,
    };
}

export function tvfToYaml(tvf: SSeriesTvfParams): NonNullable<SeriesToneExtension['tvf']> {
    return {
        cutoff: tvf.cutoff,
        resonance: tvf.resonance,
        keyFollow: tvf.keyFollow,
        lfoDepth: tvf.lfoDepth,
        egDepth: tvf.egDepth,
        egPolarity: tvf.egPolarity,
        levelCurve: tvf.levelCurve,
        keyRateFollow: tvf.keyRateFollow,
        velRateFollow: tvf.velRateFollow,
        enabled: tvf.enabled,
        envelope: envelopeToYaml(tvf.envelope),
    };
}

export function tvfFromYaml(yaml: NonNullable<SeriesToneExtension['tvf']>): SSeriesTvfParams {
    const defaultEnvelope: SSeriesEnvelope = {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 6,
        endPoint: 8,
    };

    return {
        cutoff: yaml.cutoff,
        resonance: yaml.resonance,
        keyFollow: yaml.keyFollow,
        lfoDepth: yaml.lfoDepth ?? 0,
        egDepth: yaml.egDepth,
        egPolarity: yaml.egPolarity,
        levelCurve: (yaml.levelCurve ?? 0) as 0 | 1 | 2 | 3 | 4 | 5,
        keyRateFollow: yaml.keyRateFollow ?? 0,
        velRateFollow: yaml.velRateFollow ?? 0,
        enabled: yaml.enabled,
        envelope: yaml.envelope ? envelopeFromYaml(yaml.envelope) : defaultEnvelope,
    };
}

export function tvaToYaml(tva: SSeriesTvaParams): NonNullable<SeriesToneExtension['tva']> {
    return {
        level: tva.level,
        lfoDepth: tva.lfoDepth,
        keyRate: tva.keyRate,
        velRate: tva.velRate,
        levelCurve: tva.levelCurve,
        envelope: envelopeToYaml(tva.envelope),
    };
}

export function tvaFromYaml(yaml: NonNullable<SeriesToneExtension['tva']>): SSeriesTvaParams {
    return {
        level: yaml.level,
        lfoDepth: yaml.lfoDepth ?? 0,
        keyRate: yaml.keyRate ?? 0,
        velRate: yaml.velRate ?? 0,
        levelCurve: (yaml.levelCurve ?? 0) as 0 | 1 | 2 | 3 | 4 | 5,
        envelope: envelopeFromYaml(yaml.envelope),
    };
}

function toneToExtension(tone: SSeriesBaseTone): SeriesToneExtension {
    return {
        originalKey: tone.originalKey,
        outputAssign: tone.outputAssign,
        sourceTone: tone.sourceTone,
        transpose: tone.transpose,
        fineTune: tone.fineTune,
        lfo: lfoToYaml(tone.lfo),
        tvf: tvfToYaml(tone.tvf),
        tva: tvaToYaml(tone.tva),
        benderEnabled: tone.benderEnabled,
        aftertouchEnabled: tone.aftertouchEnabled,
        pitchFollow: tone.pitchFollow,
    };
}

function extensionToTone(ext: SeriesToneExtension, yaml: ToneYaml): SSeriesBaseTone {
    const defaultLfo: SSeriesLfoParams = {
        rate: 0, sync: false, delay: 0, mode: 'normal', polarity: false, offset: 0,
    };

    const defaultTvf: SSeriesTvfParams = {
        cutoff: 127, resonance: 0, keyFollow: 0, lfoDepth: 0, egDepth: 0,
        egPolarity: 'normal', levelCurve: 0, keyRateFollow: 0, velRateFollow: 0,
        enabled: true,
        envelope: {
            levels: [127, 127, 127, 127, 127, 127, 127, 0],
            rates: [127, 127, 127, 127, 127, 127, 127, 127],
            sustainPoint: 6, endPoint: 8,
        },
    };

    const defaultTva: SSeriesTvaParams = {
        level: 127, lfoDepth: 0, keyRate: 0, velRate: 0, levelCurve: 0,
        envelope: {
            levels: [127, 127, 127, 127, 127, 127, 127, 0],
            rates: [127, 127, 127, 127, 127, 127, 127, 127],
            sustainPoint: 6, endPoint: 8,
        },
    };

    return {
        name: yaml.name,
        outputAssign: ext.outputAssign,
        sourceTone: ext.sourceTone ?? 0,
        origSubTone: 0,
        sampleRate: mapSampleRateFromHz(yaml.wave.sampleRate),
        originalKey: ext.originalKey,
        wave: {
            bank: 0, segmentTop: 0, segmentLength: 0,
            startPoint: yaml.wave.startPoint ?? 0,
            endPoint: yaml.wave.endPoint ?? 0,
            loopPoint: yaml.wave.loopPoint ?? 0, loopLength: 0,
        },
        loopMode: mapLoopModeFromYaml(yaml.wave.loopMode),
        lfo: ext.lfo ? lfoFromYaml(ext.lfo) : defaultLfo,
        transpose: ext.transpose ?? 0,
        fineTune: ext.fineTune ?? 0,
        tvf: ext.tvf ? tvfFromYaml(ext.tvf) : defaultTvf,
        tva: ext.tva ? tvaFromYaml(ext.tva) : defaultTva,
        benderEnabled: ext.benderEnabled ?? true,
        aftertouchEnabled: ext.aftertouchEnabled ?? true,
        pitchFollow: ext.pitchFollow ?? true,
        recThreshold: 0, recPreTrigger: 0, loopTune: 0, envZoom: 0, copySource: 0,
    };
}

/**
 * Create an S-series tone converter for a specific device type.
 */
export function createSeriesToneConverter<TTone extends SSeriesBaseTone>(
    deviceType: DeviceType,
): ToneConverter<TTone, ToneYaml> {
    return {
        deviceType,

        toYaml(tone: TTone, wavFilename: string): ToneYaml {
            const extension = toneToExtension(tone);
            return {
                format: 'sampler-tone',
                device: deviceType,
                version: 1,
                name: tone.name,
                wave: {
                    file: wavFilename,
                    sampleRate: sampleRateLabelToHz(tone.sampleRate),
                    loopMode: mapLoopModeToYaml(tone.loopMode),
                    startPoint: tone.wave.startPoint || undefined,
                    endPoint: tone.wave.endPoint || undefined,
                    loopPoint: tone.wave.loopPoint || undefined,
                },
                [deviceType]: extension,
            } as ToneYaml;
        },

        fromYaml(yaml: ToneYaml): TTone {
            const ext = yaml[deviceType as keyof ToneYaml] as SeriesToneExtension | undefined;
            if (yaml.device !== deviceType || !ext) {
                throw new Error(`Invalid YAML: expected ${deviceType} device with ${deviceType} extension`);
            }
            return extensionToTone(ext, yaml) as TTone;
        },
    };
}
