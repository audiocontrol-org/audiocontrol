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
 * MIDI note name to number mapping.
 */
const NOTE_NAMES: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

/**
 * Parse a MIDI note name to a note number.
 *
 * @param noteName - Note name like "C2", "F#4", "Bb3"
 * @returns MIDI note number (0-127)
 */
export function parseNoteName(noteName: string): number {
  // Match note name pattern: letter, optional sharp/flat, octave number
  const match = noteName.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, letter, accidental, octaveStr] = match;
  const baseName = (letter?.toUpperCase() ?? 'C') + (accidental ?? '');
  const octave = parseInt(octaveStr ?? '0', 10);

  const semitone = NOTE_NAMES[baseName];
  if (semitone === undefined) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  // MIDI note = (octave + 1) * 12 + semitone
  // C-1 = 0, C0 = 12, C1 = 24, C2 = 36, etc.
  return (octave + 1) * 12 + semitone;
}

/**
 * Resolve a key specification to a MIDI note number.
 *
 * @param key - Note name (e.g., "C2") or MIDI number
 * @returns MIDI note number
 */
export function resolveKey(key: string | number): number {
  if (typeof key === 'number') {
    return key;
  }
  return parseNoteName(key);
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
