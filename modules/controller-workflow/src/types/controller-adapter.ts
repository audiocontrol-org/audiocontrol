/**
 * Abstract interface for MIDI controller interrogation and configuration management.
 * Each controller type implements this interface to provide a uniform API.
 *
 * @module controller-workflow/types
 */

/**
 * Core interface for controller interrogation and configuration management.
 * Implementations wrap controller-specific libraries to provide a uniform API.
 */
export interface ControllerAdapterInterface {
  /** Controller metadata */
  readonly manufacturer: string;
  readonly model: string;
  readonly capabilities: ControllerCapabilities;

  /** Connection management */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Configuration retrieval */
  listConfigurations(): Promise<ConfigurationSlot[]>;
  readConfiguration(slot: number): Promise<ControllerConfiguration>;
  writeConfiguration?(slot: number, config: ControllerConfiguration): Promise<void>;

  /** Device information */
  getDeviceInfo(): Promise<DeviceInfo>;
}

/**
 * Defines the capabilities of a MIDI controller.
 */
export interface ControllerCapabilities {
  /** Whether the controller supports custom mode programming */
  supportsCustomModes: boolean;
  /** Maximum number of configuration slots available */
  maxConfigSlots: number;
  /** Whether configurations can be read from the device */
  supportsRead: boolean;
  /** Whether configurations can be written to the device */
  supportsWrite: boolean;
  /** Types of controls supported by this controller */
  supportedControlTypes: ControlType[];
}

/**
 * Generic controller configuration format.
 * Controller-specific formats are converted to/from this representation.
 */
export interface ControllerConfiguration {
  /** Human-readable configuration name */
  name: string;
  /** List of control mappings */
  controls: ControlMapping[];
  /** Additional controller-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a configuration slot on the controller.
 */
export interface ConfigurationSlot {
  /** Zero-based slot index */
  index: number;
  /** Optional user-defined slot name */
  name?: string;
  /** Whether this slot contains a configuration */
  isEmpty: boolean;
}

/**
 * Represents a single control mapping within a controller configuration.
 */
export interface ControlMapping {
  /** Unique identifier for this control (e.g., "SEND_A1", "FADER1") */
  id: string;
  /** Optional human-readable control name */
  name?: string;
  /** Type of control */
  type: ControlType;
  /** MIDI CC number for this control */
  cc?: number;
  /** MIDI channel (0-15) */
  channel?: number;
  /** Value range [min, max] */
  range?: [number, number];
  /** AI-matched plugin parameter index (optional, populated by ParameterMatcher) */
  plugin_parameter?: number;
}

/**
 * Types of MIDI controls supported.
 */
export type ControlType = 'encoder' | 'slider' | 'button' | 'button_group';

/**
 * Device information retrieved from the controller.
 */
export interface DeviceInfo {
  /** Device manufacturer name */
  manufacturer: string;
  /** Device model name */
  model: string;
  /** Optional firmware version string */
  firmwareVersion?: string;
}
