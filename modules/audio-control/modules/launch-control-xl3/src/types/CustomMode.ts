/**
 * Type definitions for Launch Control XL 3 custom modes
 */

export type ControlType = 0x00 | 0x05 | 0x09 | 0x0D | 0x19 | 0x25 | 'knob' | 'fader' | 'button';

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
  controls: Record<string, ControlMapping>;    // Control mappings by ID
  labels?: Map<number, string>;  // Control labels by ID
  colors?: Map<number, number>;  // Control colors by ID
  leds?: Map<number, { color: number; behaviour: string }>; // LED mappings
  metadata?: {
    name?: string;
    description?: string;
    version?: string;
    [key: string]: any;
  };
  slot?: number;          // Mode slot (0-15)
}

export interface CustomModeMessage {
  type: 'custom_mode_response';
  manufacturerId: number[];
  slot: number;           // Target slot (0-15)
  name?: string;
  controls: Control[];
  colors: ColorMapping[];
  data: number[];         // Complete message bytes
}

export interface ColorMapping {
  controlId: number;
  color: number;
  behaviour?: string; // LED behavior: 'static', 'flash', 'pulse'
}

export interface ControlMapping {
  controlId?: number; // Optional - can use string keys in Record instead
  type?: ControlType; // Optional control type
  controlType?: ControlType; // Legacy compatibility
  midiChannel?: number; // Required OR use 'channel' alternative
  ccNumber?: number; // Required OR use 'cc' alternative
  cc?: number; // Alternative CC property
  channel?: number; // Alternative channel property
  minValue?: number; // Minimum value (default 0)
  maxValue?: number; // Maximum value (default 127)
  min?: number; // Alternative min property
  max?: number; // Alternative max property
  behavior?: ControlBehavior;
  behaviour?: string; // Alternative spelling
  transform?: string | ((value: number) => number); // Value transformation
}

export interface CustomModeResponse {
  type: 'custom_mode_response';
  slot: number;
  name?: string;
  controls: Control[];
  rawData?: number[];
}