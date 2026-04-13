/**
 * Shared kit configuration types for the sample chopper dialog.
 *
 * {@link BaseKitConfig} defines the common fields that all device-specific
 * kit configs must provide: name, base note, transpose, and velocity
 * sensitivity. Device editors extend this with device-specific fields
 * (e.g., S-330 adds sampleRate).
 *
 * {@link KitOutputConfigProps} is the generic props interface for kit
 * output configuration components, parameterized by the device-specific
 * config type.
 */

import type { ChopperOutputState } from '@audiocontrol/sample-chopper/ui';

/**
 * Base kit configuration shared across all device editors.
 *
 * Device-specific configs extend this interface with additional fields
 * (e.g., S330KitConfig adds sampleRate: 15000 | 30000).
 */
export interface BaseKitConfig {
  name: string;
  baseNote: number;
  transpose: number;
  velocitySensitivity: number;
}

/**
 * Generic props interface for kit output configuration components.
 *
 * Each device editor provides a concrete TConfig that extends BaseKitConfig.
 * The component receives the chopper output state, the current config,
 * and a callback to update the config.
 */
export interface KitOutputConfigProps<TConfig extends BaseKitConfig> {
  state: ChopperOutputState;
  config: TConfig;
  onConfigChange: (config: TConfig) => void;
  /** When true, hides name/labels (for the standalone drum kit editor) */
  editMode?: boolean;
}
