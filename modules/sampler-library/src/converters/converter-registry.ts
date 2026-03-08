/**
 * Device converter registry for managing device-specific converters.
 *
 * @packageDocumentation
 */

import type { DeviceType, BaseTone, BasePatch } from '@/types/index.js';

/**
 * Interface for device-specific tone converters.
 */
export interface ToneConverter<TDeviceTone, TYamlTone extends BaseTone = BaseTone> {
  /** Device type this converter handles */
  readonly deviceType: DeviceType;

  /**
   * Convert device tone to YAML format.
   * @param tone - Device-native tone data
   * @param wavFilename - Filename for the associated WAV file
   * @returns YAML-serializable tone object
   */
  toYaml(tone: TDeviceTone, wavFilename: string): TYamlTone;

  /**
   * Convert YAML tone back to device format.
   * @param yaml - Parsed YAML tone data
   * @returns Device-native tone data
   */
  fromYaml(yaml: TYamlTone): TDeviceTone;
}

/**
 * Interface for device-specific patch converters.
 */
export interface PatchConverter<TDevicePatch, TYamlPatch extends BasePatch = BasePatch> {
  /** Device type this converter handles */
  readonly deviceType: DeviceType;

  /**
   * Convert device patch to YAML format.
   * @param patch - Device-native patch data
   * @returns YAML-serializable patch object
   */
  toYaml(patch: TDevicePatch): TYamlPatch;

  /**
   * Convert YAML patch back to device format.
   * @param yaml - Parsed YAML patch data
   * @returns Device-native patch data
   */
  fromYaml(yaml: TYamlPatch): TDevicePatch;
}

/**
 * Registry for device-specific converters.
 *
 * Allows registering and retrieving converters by device type.
 *
 * @example
 * ```typescript
 * const registry = new ConverterRegistry();
 * registry.registerToneConverter(s330ToneConverter);
 *
 * const converter = registry.getToneConverter('s330');
 * if (converter) {
 *   const yaml = converter.toYaml(s330Tone, 'kick.wav');
 * }
 * ```
 */
export class ConverterRegistry {
  private toneConverters = new Map<DeviceType, ToneConverter<unknown>>();
  private patchConverters = new Map<DeviceType, PatchConverter<unknown>>();

  /**
   * Register a tone converter for a device type.
   */
  registerToneConverter<T>(converter: ToneConverter<T>): void {
    this.toneConverters.set(converter.deviceType, converter as ToneConverter<unknown>);
  }

  /**
   * Register a patch converter for a device type.
   */
  registerPatchConverter<T>(converter: PatchConverter<T>): void {
    this.patchConverters.set(converter.deviceType, converter as PatchConverter<unknown>);
  }

  /**
   * Get the tone converter for a device type.
   */
  getToneConverter<T>(deviceType: DeviceType): ToneConverter<T> | undefined {
    return this.toneConverters.get(deviceType) as ToneConverter<T> | undefined;
  }

  /**
   * Get the patch converter for a device type.
   */
  getPatchConverter<T>(deviceType: DeviceType): PatchConverter<T> | undefined {
    return this.patchConverters.get(deviceType) as PatchConverter<T> | undefined;
  }

  /**
   * Check if a tone converter exists for a device type.
   */
  hasToneConverter(deviceType: DeviceType): boolean {
    return this.toneConverters.has(deviceType);
  }

  /**
   * Check if a patch converter exists for a device type.
   */
  hasPatchConverter(deviceType: DeviceType): boolean {
    return this.patchConverters.has(deviceType);
  }

  /**
   * Get all registered device types for tone converters.
   */
  getRegisteredToneDevices(): DeviceType[] {
    return Array.from(this.toneConverters.keys());
  }

  /**
   * Get all registered device types for patch converters.
   */
  getRegisteredPatchDevices(): DeviceType[] {
    return Array.from(this.patchConverters.keys());
  }
}

/**
 * Global converter registry instance.
 */
export const converterRegistry = new ConverterRegistry();
