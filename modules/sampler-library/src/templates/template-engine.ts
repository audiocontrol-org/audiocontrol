/**
 * Template engine for generating sampler configurations.
 *
 * Provides high-level functions for creating patches from templates
 * like drum kits and velocity-layered instruments.
 *
 * @packageDocumentation
 */

import type { DeviceType } from '@/types/index.js';
import type { ToneYaml, DrumKitTemplateYaml, VelocityLayerTemplateYaml } from '@/schemas/index.js';
import { parseMidiNote, resolveKey } from '@/midi-notes.js';

// Re-export for backward compatibility — consumers import parseNoteName and resolveKey
// from this module via the templates/index.ts barrel.
export { resolveKey } from '@/midi-notes.js';

/**
 * Parse a MIDI note name to a note number.
 *
 * @deprecated Use `parseMidiNote` from `@/midi-notes.js` directly.
 * This wrapper exists for backward compatibility with consumers that
 * import `parseNoteName` from the templates module.
 */
export function parseNoteName(noteName: string): number {
  return parseMidiNote(noteName);
}

/**
 * Result of applying a template.
 */
export interface TemplateApplicationResult<TPatch> {
  /** Generated patches */
  patches: TPatch[];
  /** Names of tones referenced by the template */
  referencedTones: string[];
  /** Any warnings generated during template application */
  warnings: string[];
}

/**
 * Validate that all referenced tones exist in the library.
 *
 * @param toneNames - Array of tone names to validate
 * @param availableTones - Map of available tones
 * @returns Array of missing tone names
 */
export function validateToneReferences(
  toneNames: string[],
  availableTones: Map<string, ToneYaml>
): string[] {
  return toneNames.filter((name) => !availableTones.has(name));
}

/**
 * Interface for device-specific template handlers.
 */
export interface TemplateHandler<TPatch> {
  readonly deviceType: DeviceType;

  /**
   * Apply a drum kit template.
   */
  applyDrumKit(
    template: DrumKitTemplateYaml,
    availableTones: Map<string, ToneYaml>,
    toneNameToIndex: Map<string, number>
  ): TemplateApplicationResult<TPatch>;

  /**
   * Apply a velocity layer template.
   */
  applyVelocityLayer(
    template: VelocityLayerTemplateYaml,
    availableTones: Map<string, ToneYaml>,
    toneNameToIndex: Map<string, number>
  ): TemplateApplicationResult<TPatch>;
}

/**
 * Registry for device-specific template handlers.
 */
export class TemplateHandlerRegistry {
  private handlers = new Map<DeviceType, TemplateHandler<unknown>>();

  /**
   * Register a template handler for a device type.
   */
  register<TPatch>(handler: TemplateHandler<TPatch>): void {
    this.handlers.set(handler.deviceType, handler as TemplateHandler<unknown>);
  }

  /**
   * Get the template handler for a device type.
   */
  get<TPatch>(deviceType: DeviceType): TemplateHandler<TPatch> | undefined {
    return this.handlers.get(deviceType) as TemplateHandler<TPatch> | undefined;
  }

  /**
   * Check if a handler exists for a device type.
   */
  has(deviceType: DeviceType): boolean {
    return this.handlers.has(deviceType);
  }
}

/**
 * Global template handler registry.
 */
export const templateHandlerRegistry = new TemplateHandlerRegistry();
