/**
 * S-330 patch converter for bidirectional YAML conversion.
 *
 * @packageDocumentation
 */

import type {
  S330Patch,
  S330PatchCommon,
  S330KeyMode,
  S330AftertouchAssign,
  S330KeyAssign,
} from '@audiocontrol/sampler-devices/s330';
import type { PatchConverter } from '@/converters/converter-registry.js';
import type { PatchYaml, S330PatchExtension } from '@/schemas/index.js';

/**
 * Map S-330 key mode to YAML format.
 */
function mapKeyModeToYaml(
  mode: S330KeyMode
): 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison' {
  return mode;
}

/**
 * Map YAML key mode to S-330 format.
 */
function mapKeyModeFromYaml(
  mode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'
): S330KeyMode {
  return mode;
}

/**
 * Map S-330 aftertouch assign to YAML format.
 */
function mapAftertouchAssignToYaml(
  assign: S330AftertouchAssign
): 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter' {
  return assign;
}

/**
 * Map YAML aftertouch assign to S-330 format.
 */
function mapAftertouchAssignFromYaml(
  assign: 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter'
): S330AftertouchAssign {
  return assign;
}

/**
 * Map S-330 key assign to YAML format.
 */
function mapKeyAssignToYaml(assign: S330KeyAssign): 'rotary' | 'fix' {
  return assign;
}

/**
 * Map YAML key assign to S-330 format.
 */
function mapKeyAssignFromYaml(assign: 'rotary' | 'fix'): S330KeyAssign {
  return assign;
}

/**
 * Create an empty 109-element tone layer array.
 * S-330 patches use 109 entries for MIDI notes 21-127.
 */
function createEmptyToneLayer(defaultValue: number): number[] {
  return new Array(109).fill(defaultValue);
}

/**
 * S-330 patch converter implementation.
 */
export const s330PatchConverter: PatchConverter<S330Patch, PatchYaml> = {
  deviceType: 's330',

  toYaml(patch: S330Patch): PatchYaml {
    const common = patch.common;

    const s330Extension: S330PatchExtension = {
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
      device: 's330',
      version: 1,
      name: common.name,
      level: common.level,
      s330: s330Extension,
    };
  },

  fromYaml(yaml: PatchYaml): S330Patch {
    if (yaml.device !== 's330') {
      throw new Error('Invalid YAML: expected s330 device');
    }

    const ext = yaml.s330;

    // Build tone layer mappings
    // If keyGroups are provided, convert them to tone layers
    let toneLayer1: number[] = ext?.toneLayer1 ?? createEmptyToneLayer(-1);
    let toneLayer2: number[] = ext?.toneLayer2 ?? createEmptyToneLayer(0);

    // If keyGroups are provided in the simplified format, we would need
    // to resolve tone references to tone indices. This is handled at a
    // higher level since it requires access to the tone library.
    // For now, we only support the raw toneLayer format.

    const common: S330PatchCommon = {
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
 * @returns S330Patch with proper tone layer mappings
 */
export function createPatchFromKeyGroups(
  name: string,
  keyGroups: Array<{
    tone: string;
    keyRange: [number, number];
    layer?: 1 | 2;
  }>,
  toneNameToIndex: Map<string, number>
): S330Patch {
  // Initialize empty tone layers
  // Layer 1: -1 means no tone assigned
  // Layer 2: 0 is the default
  const toneLayer1 = createEmptyToneLayer(-1);
  const toneLayer2 = createEmptyToneLayer(0);

  for (const group of keyGroups) {
    const toneIndex = toneNameToIndex.get(group.tone);
    if (toneIndex === undefined) {
      throw new Error(`Tone not found in library: ${group.tone}`);
    }

    const [lowKey, highKey] = group.keyRange;
    const layer = group.layer ?? 1;
    const targetLayer = layer === 1 ? toneLayer1 : toneLayer2;

    // S-330 tone layers cover MIDI notes 21-127 (indices 0-108)
    for (let key = lowKey; key <= highKey; key++) {
      const layerIndex = key - 21;
      if (layerIndex >= 0 && layerIndex < 109) {
        targetLayer[layerIndex] = toneIndex;
      }
    }
  }

  return {
    common: {
      name: name.slice(0, 12), // S-330 names are 12 chars max
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
