/**
 * Converter for Launch Control XL3 controller configurations to canonical MIDI map format.
 * Maps LCXL3-specific control IDs to canonical control IDs.
 *
 * @module controller-workflow/converters
 */

import type { CanonicalMidiMap, ControlDefinition } from '@audiocontrol/canonical-midi-maps';
import type {
  CanonicalConverterInterface,
  ConversionOptions,
  ConverterInfo,
} from '@/types/canonical-converter.js';
import type { ControllerConfiguration, ControlMapping, ControlType } from '@/types/controller-adapter.js';

/**
 * Converts Launch Control XL3 custom mode configurations to canonical MIDI maps.
 * Handles all 48 controls across 3 rows of encoders, 8 sliders, and 16 buttons.
 */
export class LaunchControlXL3Converter implements CanonicalConverterInterface {
  /**
   * LCXL3 control ID to canonical control ID mapping.
   * Maps device-specific names (SEND_A1, FADER1, etc.) to canonical IDs.
   */
  private static readonly CONTROL_ID_MAP: Record<string, string> = {
    // Row 1: Send A encoders (8 encoders)
    SEND_A1: 'encoder_1',
    SEND_A2: 'encoder_2',
    SEND_A3: 'encoder_3',
    SEND_A4: 'encoder_4',
    SEND_A5: 'encoder_5',
    SEND_A6: 'encoder_6',
    SEND_A7: 'encoder_7',
    SEND_A8: 'encoder_8',

    // Row 2: Send B encoders (8 encoders)
    SEND_B1: 'encoder_9',
    SEND_B2: 'encoder_10',
    SEND_B3: 'encoder_11',
    SEND_B4: 'encoder_12',
    SEND_B5: 'encoder_13',
    SEND_B6: 'encoder_14',
    SEND_B7: 'encoder_15',
    SEND_B8: 'encoder_16',

    // Row 3: Pan encoders (8 encoders)
    PAN1: 'encoder_17',
    PAN2: 'encoder_18',
    PAN3: 'encoder_19',
    PAN4: 'encoder_20',
    PAN5: 'encoder_21',
    PAN6: 'encoder_22',
    PAN7: 'encoder_23',
    PAN8: 'encoder_24',

    // Faders (8 sliders)
    FADER1: 'slider_1',
    FADER2: 'slider_2',
    FADER3: 'slider_3',
    FADER4: 'slider_4',
    FADER5: 'slider_5',
    FADER6: 'slider_6',
    FADER7: 'slider_7',
    FADER8: 'slider_8',

    // Focus buttons (8 buttons)
    FOCUS1: 'button_1',
    FOCUS2: 'button_2',
    FOCUS3: 'button_3',
    FOCUS4: 'button_4',
    FOCUS5: 'button_5',
    FOCUS6: 'button_6',
    FOCUS7: 'button_7',
    FOCUS8: 'button_8',

    // Control buttons (8 buttons)
    CONTROL1: 'button_9',
    CONTROL2: 'button_10',
    CONTROL3: 'button_11',
    CONTROL4: 'button_12',
    CONTROL5: 'button_13',
    CONTROL6: 'button_14',
    CONTROL7: 'button_15',
    CONTROL8: 'button_16',
  };

  /**
   * Get metadata about this converter implementation.
   */
  getConverterInfo(): ConverterInfo {
    return {
      supportedController: 'Novation Launch Control XL 3',
      version: '1.0.0',
      features: ['custom-modes', 'label-preservation', 'all-control-types', '48-controls'],
    };
  }

  /**
   * Validate that a controller configuration can be converted.
   * Checks for required structure and MIDI CC assignments.
   */
  canConvert(config: ControllerConfiguration): boolean {
    if (!config.controls || config.controls.length === 0) {
      return false;
    }

    // All controls must have CC numbers defined for LCXL3
    return config.controls.every((control) => control.cc !== undefined && control.cc >= 0 && control.cc <= 127);
  }

  /**
   * Convert LCXL3 controller configuration to canonical MIDI map format.
   *
   * @param config - LCXL3 custom mode configuration
   * @param options - Conversion options (plugin info, channel, label preservation)
   * @returns Canonical MIDI map with properly mapped control IDs
   * @throws Error if configuration is invalid
   */
  convert(config: ControllerConfiguration, options: ConversionOptions): CanonicalMidiMap {
    if (!this.canConvert(config)) {
      throw new Error('Invalid LCXL3 configuration: missing controls or CC assignments');
    }

    const currentDate = new Date().toISOString().split('T')[0];

    const map: CanonicalMidiMap = {
      version: '1.0.0',
      device: {
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
        ...(options.deviceOverrides ?? {}),
      },
      metadata: {
        name: config.name,
        description: `Converted from LCXL3 custom mode: ${config.name}`,
        tags: ['launch-control-xl3', 'auto-generated'] as string[],
      },
      controls: this.mapControls(config.controls, options),
    };

    // Add optional date if it exists
    if (currentDate) {
      map.metadata.date = currentDate;
    }

    // Add optional properties only if they exist
    if (options.pluginInfo !== undefined) {
      map.plugin = options.pluginInfo;
    }
    if (options.midiChannel !== undefined) {
      map.midi_channel = options.midiChannel;
    }

    return map;
  }

  /**
   * Map all LCXL3 controls to canonical control definitions.
   *
   * @param controls - Array of LCXL3 control mappings
   * @param options - Conversion options
   * @returns Array of canonical control definitions
   */
  private mapControls(controls: ControlMapping[], options: ConversionOptions): ControlDefinition[] {
    return controls.map((control) => this.mapControl(control, options));
  }

  /**
   * Map a single LCXL3 control to canonical control definition.
   *
   * @param control - LCXL3 control mapping
   * @param options - Conversion options
   * @returns Canonical control definition
   */
  private mapControl(control: ControlMapping, options: ConversionOptions): ControlDefinition {
    const canonicalId = this.mapControlId(control.id);
    const name = options.preserveLabels === true && control.name ? control.name : this.getDefaultName(canonicalId);

    const controlDef: ControlDefinition = {
      id: canonicalId,
      name,
      type: this.mapControlType(control.type),
      cc: control.cc!,
      channel: control.channel ?? options.midiChannel ?? 0,
      range: control.range ?? [0, 127],
      description: `Mapped from LCXL3 control: ${control.id}`,
    };

    // Preserve plugin_parameter from AI matching (if present)
    if (control.plugin_parameter !== undefined) {
      controlDef.plugin_parameter = control.plugin_parameter;
    }

    return controlDef;
  }

  /**
   * Map LCXL3 control ID to canonical control ID.
   * Falls back to lowercase version if no mapping exists.
   *
   * @param lcxl3Id - LCXL3-specific control ID (e.g., SEND_A1, FADER1)
   * @returns Canonical control ID (e.g., encoder_1, slider_1)
   */
  private mapControlId(lcxl3Id: string): string {
    const mapped = LaunchControlXL3Converter.CONTROL_ID_MAP[lcxl3Id];
    if (mapped) {
      return mapped;
    }

    // Fallback for unknown control IDs
    return lcxl3Id.toLowerCase();
  }

  /**
   * Map LCXL3 control type to canonical control type.
   * Direct pass-through as types are already compatible.
   *
   * @param type - LCXL3 control type
   * @returns Canonical control type
   */
  private mapControlType(type: ControlType): 'encoder' | 'slider' | 'button' | 'button_group' {
    return type;
  }

  /**
   * Generate a default human-readable name from a canonical control ID.
   * Converts underscores to spaces and capitalizes words.
   *
   * @param controlId - Canonical control ID (e.g., encoder_1, slider_8)
   * @returns Human-readable name (e.g., "Encoder 1", "Slider 8")
   */
  private getDefaultName(controlId: string): string {
    return controlId
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/**
 * Factory function for creating LaunchControlXL3Converter instances.
 * Provides backward compatibility and easier instantiation.
 *
 * @returns New converter instance
 */
export function createLaunchControlXL3Converter(): LaunchControlXL3Converter {
  return new LaunchControlXL3Converter();
}
