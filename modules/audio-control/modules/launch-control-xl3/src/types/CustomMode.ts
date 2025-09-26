/**
 * Type definitions for Launch Control XL 3 custom modes
 */

export type ControlType = 0x00 | 0x05 | 0x09 | 0x0D | 0x19 | 0x25;

export type ControlBehavior = 'absolute' | 'relative' | 'toggle';

export interface Control {
  controlId: number;      // Hardware control ID (0x00-0x3F)
  controlType: ControlType; // Type determines row/type of control
  midiChannel: number;    // 0-15 (0-based)
  ccNumber: number;       // CC number 0-127
  minValue: number;       // Minimum value (usually 0)
  maxValue: number;       // Maximum value (usually 127)
  behavior: ControlBehavior;
}

export interface CustomMode {
  name: string;           // Mode name (max 8 chars)
  controls: Control[];    // Control mappings
  labels?: Map<number, string>;  // Control labels by ID
  colors?: Map<number, number>;  // Control colors by ID
}

export interface CustomModeMessage {
  slot: number;           // Target slot (0-15)
  data: number[];         // Complete message bytes
}

export interface CustomModeResponse {
  type: 'custom_mode_response';
  slot: number;
  name?: string;
  controls: Control[];
  rawData?: number[];
}