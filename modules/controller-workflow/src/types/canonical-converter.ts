/**
 * Abstract interface for converting controller-specific configurations to canonical MIDI map format.
 * Each controller type implements its own converter with controller-specific conversion logic.
 *
 * @module controller-workflow/types
 */

import type { CanonicalMidiMap, DeviceDefinition, PluginDefinition } from '@audiocontrol/canonical-midi-maps';
import type { ControllerConfiguration } from './controller-adapter.js';

/**
 * Interface for converting controller configurations to canonical format.
 * Each controller type provides its own implementation.
 */
export interface CanonicalConverterInterface {
  /**
   * Convert controller-specific configuration to canonical MIDI map format.
   *
   * @param config - Controller configuration to convert
   * @param options - Conversion options (plugin info, MIDI channel, etc.)
   * @returns Canonical MIDI map representation
   * @throws Error if conversion fails or config is invalid
   */
  convert(
    config: ControllerConfiguration,
    options: ConversionOptions
  ): CanonicalMidiMap;

  /**
   * Validate that a configuration can be converted.
   *
   * @param config - Controller configuration to validate
   * @returns true if conversion is possible, false otherwise
   */
  canConvert(config: ControllerConfiguration): boolean;

  /**
   * Get metadata about this converter.
   *
   * @returns Converter information including supported controller and features
   */
  getConverterInfo(): ConverterInfo;
}

/**
 * Options for controlling the conversion process.
 */
export interface ConversionOptions {
  /** Plugin information to include in the canonical map */
  pluginInfo?: PluginDefinition;
  /** MIDI channel override (0-15) */
  midiChannel?: number;
  /** Whether to preserve controller-specific control labels */
  preserveLabels?: boolean;
  /** Device definition overrides */
  deviceOverrides?: Partial<DeviceDefinition>;
}

/**
 * Metadata about a converter implementation.
 */
export interface ConverterInfo {
  /** Name of the controller this converter supports */
  supportedController: string;
  /** Converter version */
  version: string;
  /** List of features this converter supports */
  features: string[];
}
