/**
 * Plugin Descriptor Types
 *
 * Defines the structure for canonical plugin parameter descriptions
 * that can be reused across different MIDI mapping configurations.
 */

export interface PluginParameter {
  /** Parameter index in the plugin */
  index: number;

  /** Human-readable parameter name */
  name: string;

  /** Parameter unit label (if any) */
  label?: string;

  /** Parameter unit (if any) */
  unit?: string;

  /** Minimum parameter value */
  min: number;

  /** Maximum parameter value */
  max: number;

  /** Default parameter value */
  default: number;

  /** Parameter group/category for organization */
  group?: string;

  /** Parameter description */
  description?: string;

  /** Whether this parameter is automatable */
  automatable?: boolean;

  /** Parameter data type */
  type?: 'continuous' | 'discrete' | 'boolean' | 'choice';

  /** For choice parameters, available options */
  choices?: string[];
}

export interface PluginDescriptor {
  /** Plugin metadata */
  plugin: {
    /** Plugin manufacturer */
    manufacturer: string;

    /** Plugin name */
    name: string;

    /** Plugin version */
    version: string;

    /** Plugin format (VST3, AU, etc.) */
    format: string;

    /** Plugin unique identifier */
    uid?: string;
  };

  /** Metadata about this descriptor */
  metadata: {
    /** Descriptor version */
    version: string;

    /** When this descriptor was created */
    created: string;

    /** Last update timestamp */
    updated: string;

    /** Author/generator of this descriptor */
    author: string;

    /** Description of the plugin */
    description?: string;

    /** Tags for categorization */
    tags?: string[];
  };

  /** All plugin parameters */
  parameters: PluginParameter[];

  /** Parameter groups for logical organization */
  groups?: {
    [groupName: string]: {
      name: string;
      description?: string;
      parameters: number[]; // Parameter indices
    };
  };

  /** Commonly used parameter mappings/presets */
  presets?: {
    [presetName: string]: {
      name: string;
      description?: string;
      parameters: { [paramIndex: number]: number };
    };
  };
}

export interface PluginRegistry {
  /** Registry metadata */
  metadata: {
    version: string;
    created: string;
    updated: string;
  };

  /** Map of plugin identifiers to descriptors */
  plugins: {
    [pluginId: string]: PluginDescriptor;
  };
}