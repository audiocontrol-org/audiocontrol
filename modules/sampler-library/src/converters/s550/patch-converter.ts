/**
 * S-550 patch converter for bidirectional YAML conversion.
 *
 * @packageDocumentation
 */

import type {
    S550Patch,
    S550PatchCommon,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
} from '@audiocontrol/sampler-devices/s550';
import type { PatchConverter } from '@/converters/converter-registry.js';
import type { PatchYaml, S550PatchExtension } from '@/schemas/index.js';

/**
 * Map S-550 key mode to YAML format.
 */
function mapKeyModeToYaml(
    mode: SSeriesKeyMode
): 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison' {
    return mode;
}

/**
 * Map YAML key mode to S-550 format.
 */
function mapKeyModeFromYaml(
    mode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'
): SSeriesKeyMode {
    return mode;
}

/**
 * Map S-550 aftertouch assign to YAML format.
 */
function mapAftertouchAssignToYaml(
    assign: SSeriesAftertouchAssign
): 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter' {
    return assign;
}

/**
 * Map YAML aftertouch assign to S-550 format.
 */
function mapAftertouchAssignFromYaml(
    assign: 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter'
): SSeriesAftertouchAssign {
    return assign;
}

/**
 * Map S-550 key assign to YAML format.
 */
function mapKeyAssignToYaml(assign: SSeriesKeyAssign): 'rotary' | 'fix' {
    return assign;
}

/**
 * Map YAML key assign to S-550 format.
 */
function mapKeyAssignFromYaml(assign: 'rotary' | 'fix'): SSeriesKeyAssign {
    return assign;
}

/**
 * Create an empty S-550 tone layer (109 entries, all OFF).
 *
 * @param layer 1 for layer 1 (-1 = OFF), 2 for layer 2 (0 default)
 */
function createEmptyToneLayer(layer: 1 | 2): number[] {
    return new Array(109).fill(layer === 1 ? -1 : 0);
}

/**
 * Set tone index for a MIDI key range in a tone layer.
 */
function setToneForMidiRange(
    layer: number[],
    lowKey: number,
    highKey: number,
    toneIndex: number
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
 * S-550 patch converter implementation.
 */
export const s550PatchConverter: PatchConverter<S550Patch, PatchYaml> = {
    deviceType: 's550',

    toYaml(patch: S550Patch): PatchYaml {
        const common = patch.common;

        const s550Extension: S550PatchExtension = {
            benderRange: common.benderRange,
            aftertouchSens: common.aftertouchSens,
            keyMode: mapKeyModeToYaml(common.keyMode),
            velocityThreshold: common.velocityThreshold,
            octaveShift: common.octaveShift,
            detune: common.detune,
            velocityMixRatio: common.velocityMixRatio,
            aftertouchAssign: mapAftertouchAssignToYaml(common.aftertouchAssign),
            keyAssign: mapKeyAssignToYaml(common.keyAssign),
            outputAssign: common.outputAssign,
            toneLayer1: common.toneLayer1,
            toneLayer2: common.toneLayer2,
        };

        return {
            format: 'sampler-patch',
            device: 's550',
            version: 1,
            name: common.name,
            level: common.level,
            s550: s550Extension,
        };
    },

    fromYaml(yaml: PatchYaml): S550Patch {
        if (yaml.device !== 's550') {
            throw new Error('Invalid YAML: expected s550 device');
        }

        const ext = yaml.s550;

        // Build tone layer mappings
        let toneLayer1: number[] = ext?.toneLayer1 ?? createEmptyToneLayer(1);
        let toneLayer2: number[] = ext?.toneLayer2 ?? createEmptyToneLayer(2);

        const common: S550PatchCommon = {
            name: yaml.name,
            benderRange: ext?.benderRange ?? 2,
            aftertouchSens: ext?.aftertouchSens ?? 64,
            keyMode: ext?.keyMode ? mapKeyModeFromYaml(ext.keyMode) : 'normal',
            velocityThreshold: ext?.velocityThreshold ?? 64,
            toneLayer1,
            toneLayer2,
            copySource: 0,
            octaveShift: ext?.octaveShift ?? 0,
            level: yaml.level ?? 100,
            detune: ext?.detune ?? 0,
            velocityMixRatio: ext?.velocityMixRatio ?? 64,
            aftertouchAssign: ext?.aftertouchAssign
                ? mapAftertouchAssignFromYaml(ext.aftertouchAssign)
                : 'modulation',
            keyAssign: ext?.keyAssign ? mapKeyAssignFromYaml(ext.keyAssign) : 'rotary',
            outputAssign: ext?.outputAssign ?? 8,
        };

        return {
            common,
        };
    },
};

/**
 * Helper to create a simple patch from key groups.
 *
 * This is a utility function for creating patches from the simplified
 * keyGroups format. It requires a mapping from tone names to indices.
 *
 * @param name - Patch name
 * @param keyGroups - Simplified key group definitions
 * @param toneNameToIndex - Map from tone name to device tone index
 * @returns S550Patch with proper tone layer mappings
 */
export function createPatchFromKeyGroups(
    name: string,
    keyGroups: Array<{
        tone: string;
        keyRange: [number, number];
        layer?: 1 | 2;
    }>,
    toneNameToIndex: Map<string, number>
): S550Patch {
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
            name: name.slice(0, 12), // S-550 names are 12 chars max
            benderRange: 2,
            aftertouchSens: 64,
            keyMode: 'normal',
            velocityThreshold: 64,
            toneLayer1,
            toneLayer2,
            copySource: 0,
            octaveShift: 0,
            level: 100,
            detune: 0,
            velocityMixRatio: 64,
            aftertouchAssign: 'modulation',
            keyAssign: 'rotary',
            outputAssign: 8,
        },
    };
}
