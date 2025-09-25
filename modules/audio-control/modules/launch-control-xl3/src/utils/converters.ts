/**
 * Format converters with type guards for data transformation
 */

import type { CustomMode, ControlConfig } from '@/types/protocol.js';
import type { ParsedMidiMessage } from '@/types/midi.js';

/**
 * Convert custom mode to JSON-serializable format
 */
export function customModeToJSON(mode: CustomMode): string {
  return JSON.stringify(
    {
      ...mode,
      createdAt: mode.createdAt?.toISOString(),
      modifiedAt: mode.modifiedAt?.toISOString(),
    },
    null,
    2
  );
}

/**
 * Convert JSON back to CustomMode with proper Date objects
 */
export function customModeFromJSON(json: string): CustomMode {
  const parsed = JSON.parse(json);

  return {
    ...parsed,
    createdAt: parsed.createdAt ? new Date(parsed.createdAt) : undefined,
    modifiedAt: parsed.modifiedAt ? new Date(parsed.modifiedAt) : undefined,
  };
}

/**
 * Convert CustomMode to YAML-compatible object
 */
export function customModeToYAML(mode: CustomMode): Record<string, unknown> {
  return {
    slot: mode.slot,
    name: mode.name,
    description: mode.description,
    globalChannel: mode.globalChannel,
    controls: mode.controls.map(controlToYAML),
    metadata: {
      createdAt: mode.createdAt?.toISOString(),
      modifiedAt: mode.modifiedAt?.toISOString(),
    },
  };
}

/**
 * Convert ControlConfig to YAML-compatible object
 */
function controlToYAML(control: ControlConfig): Record<string, unknown> {
  return {
    id: {
      type: control.id.type,
      position: control.id.position,
      row: control.id.row,
    },
    midi: {
      channel: control.midiChannel,
      cc: control.ccNumber,
    },
    behavior: control.controlType.behavior,
    name: control.name,
    color: control.color,
    range: control.range,
  };
}

/**
 * Convert MIDI message to human-readable string
 */
export function midiMessageToString(message: ParsedMidiMessage): string {
  switch (message.type) {
    case 'controlChange':
      return `CC ${message.cc} = ${message.value} (ch ${message.channel})`;

    case 'noteOn':
      return `Note On ${message.note} vel ${message.velocity} (ch ${message.channel})`;

    case 'noteOff':
      return `Note Off ${message.note} (ch ${message.channel})`;

    case 'pitchBend':
      return `Pitch Bend ${message.value} (ch ${message.channel})`;

    case 'sysEx':
      return `SysEx ${message.data.length} bytes`;

    default:
      return `Unknown MIDI message`;
  }
}

/**
 * Convert raw MIDI data to hex string
 */
export function midiDataToHex(data: readonly number[]): string {
  return data.map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/**
 * Convert hex string to MIDI data array
 */
export function hexToMidiData(hex: string): number[] {
  return hex
    .split(/\s+/)
    .filter(byte => byte.length > 0)
    .map(byte => parseInt(byte, 16))
    .filter(byte => !isNaN(byte) && byte >= 0 && byte <= 255);
}

/**
 * Type guard to check if data represents a valid CustomMode
 */
export function isCustomModeData(data: unknown): data is CustomMode {
  return (
    typeof data === 'object' &&
    data !== null &&
    'slot' in data &&
    'name' in data &&
    'controls' in data
  );
}

/**
 * Type guard to check if data represents a valid ControlConfig
 */
export function isControlConfigData(data: unknown): data is ControlConfig {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'midiChannel' in data &&
    'ccNumber' in data &&
    'controlType' in data
  );
}

/**
 * Convert control position to linear index
 */
export function controlPositionToIndex(type: 'knob' | 'button' | 'fader', position: number, row?: number): number {
  switch (type) {
    case 'knob':
      if (!row || row < 1 || row > 3) {
        throw new Error('Knob controls require a row number (1-3)');
      }
      return (row - 1) * 8 + (position - 1);

    case 'button':
      return position - 1;

    case 'fader':
      return position - 1;

    default:
      throw new Error(`Unknown control type: ${type}`);
  }
}

/**
 * Convert linear index back to control position
 */
export function indexToControlPosition(type: 'knob' | 'button' | 'fader', index: number): { position: number; row?: number } {
  switch (type) {
    case 'knob':
      const row = Math.floor(index / 8) + 1;
      const position = (index % 8) + 1;
      return { position, row };

    case 'button':
    case 'fader':
      return { position: index + 1 };

    default:
      throw new Error(`Unknown control type: ${type}`);
  }
}

/**
 * Convert between different CC numbering schemes
 */
export function convertCCNumbering(
  ccNumber: number,
  fromScheme: 'zero-based' | 'one-based',
  toScheme: 'zero-based' | 'one-based'
): number {
  if (fromScheme === toScheme) {
    return ccNumber;
  }

  if (fromScheme === 'zero-based' && toScheme === 'one-based') {
    return ccNumber + 1;
  }

  if (fromScheme === 'one-based' && toScheme === 'zero-based') {
    return ccNumber - 1;
  }

  return ccNumber;
}