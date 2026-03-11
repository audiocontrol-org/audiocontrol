/**
 * S-330 specific template handler.
 *
 * Implements drum kit and velocity layer template application for the Roland S-330.
 *
 * @packageDocumentation
 */

import type { S330Patch, S330PatchCommon } from '@audiocontrol/sampler-devices/s330';
import {
  createEmptyToneLayer,
  midiNoteToLayerIndex,
} from '@audiocontrol/sampler-devices/s330';
import type { ToneYaml, DrumKitTemplateYaml, VelocityLayerTemplateYaml } from '@/schemas/index.js';
import type { TemplateHandler, TemplateApplicationResult } from './template-engine.js';
import { resolveKey, validateToneReferences } from './template-engine.js';

/**
 * Create a default S-330 patch common structure.
 */
function createDefaultPatchCommon(name: string): S330PatchCommon {
  return {
    name: name.slice(0, 12),
    benderRange: 2,
    aftertouchSens: 64,
    keyMode: 'normal',
    velocityThreshold: 64,
    toneLayer1: createEmptyToneLayer(1),
    toneLayer2: createEmptyToneLayer(2),
    copySource: 0,
    octaveShift: 0,
    level: 100,
    detune: 0,
    velocityMixRatio: 64,
    aftertouchAssign: 'modulation',
    keyAssign: 'rotary',
    outputAssign: 8,
  };
}

/**
 * S-330 template handler implementation.
 */
export const s330TemplateHandler: TemplateHandler<S330Patch> = {
  deviceType: 's330',

  applyDrumKit(
    template: DrumKitTemplateYaml,
    availableTones: Map<string, ToneYaml>,
    toneNameToIndex: Map<string, number>
  ): TemplateApplicationResult<S330Patch> {
    const warnings: string[] = [];
    const referencedTones: string[] = [];

    // Collect all referenced tone names
    for (const entry of template.kit) {
      referencedTones.push(entry.tone);
    }

    // Validate tone references
    const missingTones = validateToneReferences(referencedTones, availableTones);
    if (missingTones.length > 0) {
      for (const missing of missingTones) {
        warnings.push(`Tone not found in library: ${missing}`);
      }
    }

    // Create the patch
    const common = createDefaultPatchCommon(template.name);

    // Track mute groups for later implementation
    const muteGroups = new Map<number, number[]>();

    // Map each kit entry to the tone layer
    for (const entry of template.kit) {
      const toneIndex = toneNameToIndex.get(entry.tone);
      if (toneIndex === undefined) {
        // Skip entries with missing tones
        continue;
      }

      const midiNote = resolveKey(entry.key);
      const layerIndex = midiNoteToLayerIndex(midiNote);

      if (layerIndex < 0) {
        warnings.push(
          `Key ${entry.key} (MIDI ${midiNote}) is outside S-330 range (21-127), skipping ${entry.name}`
        );
        continue;
      }

      // Assign tone to layer 1
      common.toneLayer1[layerIndex] = toneIndex;

      // Track mute groups
      if (entry.muteGroup !== undefined) {
        const group = muteGroups.get(entry.muteGroup) ?? [];
        group.push(midiNote);
        muteGroups.set(entry.muteGroup, group);
      }
    }

    // Note: S-330 doesn't have native mute groups.
    // We could potentially implement them using velocity switching,
    // but that's beyond the scope of this basic implementation.
    if (muteGroups.size > 0) {
      warnings.push(
        'Mute groups are not natively supported on S-330. They have been ignored.'
      );
    }

    const patch: S330Patch = { common };

    return {
      patches: [patch],
      referencedTones: [...new Set(referencedTones)],
      warnings,
    };
  },

  applyVelocityLayer(
    template: VelocityLayerTemplateYaml,
    availableTones: Map<string, ToneYaml>,
    toneNameToIndex: Map<string, number>
  ): TemplateApplicationResult<S330Patch> {
    const warnings: string[] = [];
    const referencedTones: string[] = [];

    // Collect all referenced tone names
    for (const layer of template.velocityLayers) {
      referencedTones.push(layer.tone);
    }

    // Validate tone references
    const missingTones = validateToneReferences(referencedTones, availableTones);
    if (missingTones.length > 0) {
      for (const missing of missingTones) {
        warnings.push(`Tone not found in library: ${missing}`);
      }
    }

    // For S-330, velocity layers are implemented using:
    // - keyMode: 'v-sw' for 2 layers (velocity switch)
    // - For more than 2 layers, we'd need multiple patches

    const layers = template.velocityLayers;

    if (layers.length > 2) {
      warnings.push(
        `S-330 only supports 2 velocity layers. Using first and last of ${layers.length} layers.`
      );
    }

    // Get the soft (first) and loud (last) layers
    const softLayer = layers[0];
    const loudLayer = layers[layers.length - 1];

    if (!softLayer || !loudLayer) {
      return {
        patches: [],
        referencedTones: [...new Set(referencedTones)],
        warnings: ['No velocity layers defined'],
      };
    }

    const softToneIndex = toneNameToIndex.get(softLayer.tone);
    const loudToneIndex = toneNameToIndex.get(loudLayer.tone);

    if (softToneIndex === undefined || loudToneIndex === undefined) {
      return {
        patches: [],
        referencedTones: [...new Set(referencedTones)],
        warnings,
      };
    }

    // Create the patch with velocity switching
    const common = createDefaultPatchCommon(template.name);
    common.keyMode = 'v-sw';

    // Calculate velocity threshold
    // Use the crossover point between the first two layers
    if (layers.length >= 2 && layers[1]) {
      common.velocityThreshold = layers[1].range[0];
    } else {
      common.velocityThreshold = 64;
    }

    // Map keys to tone layers
    const [lowKey, highKey] = template.keyRange;

    for (let midiNote = lowKey; midiNote <= highKey; midiNote++) {
      const layerIndex = midiNoteToLayerIndex(midiNote);
      if (layerIndex >= 0) {
        // Layer 1: soft tone (below threshold)
        common.toneLayer1[layerIndex] = softToneIndex;
        // Layer 2: loud tone (above threshold)
        common.toneLayer2[layerIndex] = loudToneIndex;
      }
    }

    const patch: S330Patch = { common };

    return {
      patches: [patch],
      referencedTones: [...new Set(referencedTones)],
      warnings,
    };
  },
};
