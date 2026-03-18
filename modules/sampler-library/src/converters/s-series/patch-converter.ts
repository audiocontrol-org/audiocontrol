/**
 * S-Series shared patch converter for bidirectional YAML conversion.
 *
 * @packageDocumentation
 */

import type {
    SSeriesBasePatchCommon,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
} from '@audiocontrol/sampler-devices/roland-s-series';
import type { PatchConverter } from '@/converters/converter-registry.js';
import type { PatchYaml, S330PatchExtension, S550PatchExtension } from '@/schemas/index.js';

type SeriesPatchExtension = S330PatchExtension | S550PatchExtension;

type DeviceType = 's330' | 's550';

interface SeriesPatch {
    common: SSeriesBasePatchCommon;
}

function createEmptyToneLayer(layer: 1 | 2): number[] {
    return new Array(109).fill(layer === 1 ? -1 : 0);
}

function setToneForMidiRange(
    layer: number[],
    lowKey: number,
    highKey: number,
    toneIndex: number,
): void {
    const TONE_LAYER_MIN_MIDI_NOTE = 12;
    for (let note = lowKey; note <= highKey; note++) {
        const layerIndex = note - TONE_LAYER_MIN_MIDI_NOTE;
        if (layerIndex >= 0 && layerIndex < 109) {
            layer[layerIndex] = toneIndex;
        }
    }
}

/**
 * Create an S-series patch converter for a specific device type.
 */
export function createSeriesPatchConverter<TPatch extends SeriesPatch>(
    deviceType: DeviceType,
): PatchConverter<TPatch, PatchYaml> {
    return {
        deviceType,

        toYaml(patch: TPatch): PatchYaml {
            const common = patch.common;

            const extension: SeriesPatchExtension = {
                benderRange: common.benderRange,
                aftertouchSens: common.aftertouchSens,
                keyMode: common.keyMode,
                velocityThreshold: common.velocityThreshold,
                octaveShift: common.octaveShift,
                detune: common.detune,
                velocityMixRatio: common.velocityMixRatio,
                aftertouchAssign: common.aftertouchAssign,
                keyAssign: common.keyAssign,
                outputAssign: common.outputAssign,
                toneLayer1: common.toneLayer1,
                toneLayer2: common.toneLayer2,
            };

            return {
                format: 'sampler-patch',
                device: deviceType,
                version: 1,
                name: common.name,
                level: common.level,
                [deviceType]: extension,
            } as PatchYaml;
        },

        fromYaml(yaml: PatchYaml): TPatch {
            if (yaml.device !== deviceType) {
                throw new Error(`Invalid YAML: expected ${deviceType} device`);
            }

            const ext = yaml[deviceType as keyof PatchYaml] as SeriesPatchExtension | undefined;

            const toneLayer1: number[] = ext?.toneLayer1 ?? createEmptyToneLayer(1);
            const toneLayer2: number[] = ext?.toneLayer2 ?? createEmptyToneLayer(2);

            const common: SSeriesBasePatchCommon = {
                name: yaml.name,
                benderRange: ext?.benderRange ?? 2,
                aftertouchSens: ext?.aftertouchSens ?? 64,
                keyMode: (ext?.keyMode ?? 'normal') as SSeriesKeyMode,
                velocityThreshold: ext?.velocityThreshold ?? 64,
                toneLayer1,
                toneLayer2,
                copySource: 0,
                octaveShift: ext?.octaveShift ?? 0,
                level: yaml.level ?? 100,
                detune: ext?.detune ?? 0,
                velocityMixRatio: ext?.velocityMixRatio ?? 64,
                aftertouchAssign: (ext?.aftertouchAssign ?? 'modulation') as SSeriesAftertouchAssign,
                keyAssign: (ext?.keyAssign ?? 'rotary') as SSeriesKeyAssign,
                outputAssign: ext?.outputAssign ?? 8,
            };

            return { common } as TPatch;
        },
    };
}

/**
 * Create a patch from simplified key groups.
 */
export function createSeriesPatchFromKeyGroups<TPatch extends SeriesPatch>(
    name: string,
    keyGroups: Array<{
        tone: string;
        keyRange: [number, number];
        layer?: 1 | 2;
    }>,
    toneNameToIndex: Map<string, number>,
): TPatch {
    const toneLayer1 = createEmptyToneLayer(1);
    const toneLayer2 = createEmptyToneLayer(2);

    for (const group of keyGroups) {
        const toneIndex = toneNameToIndex.get(group.tone);
        if (toneIndex === undefined) {
            throw new Error(`Tone not found in library: ${group.tone}`);
        }

        const [lowKey, highKey] = group.keyRange;
        const layer = group.layer ?? 1;
        const targetLayer = layer === 1 ? toneLayer1 : toneLayer2;

        setToneForMidiRange(targetLayer, lowKey, highKey, toneIndex);
    }

    return {
        common: {
            name: name.slice(0, 12),
            benderRange: 2,
            aftertouchSens: 64,
            keyMode: 'normal' as SSeriesKeyMode,
            velocityThreshold: 64,
            toneLayer1,
            toneLayer2,
            copySource: 0,
            octaveShift: 0,
            level: 100,
            detune: 0,
            velocityMixRatio: 64,
            aftertouchAssign: 'modulation' as SSeriesAftertouchAssign,
            keyAssign: 'rotary' as SSeriesKeyAssign,
            outputAssign: 8,
        },
    } as TPatch;
}
