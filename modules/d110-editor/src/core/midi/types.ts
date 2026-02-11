/**
 * TypeScript types for Roland D-110 MIDI communication
 */

/**
 * MIDI port information
 */
export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: 'connected' | 'disconnected';
}

/**
 * Callback for SysEx messages
 */
export type SysExCallback = (message: number[]) => void;

/**
 * MIDI I/O interface for D-110 communication
 */
export interface D110MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}

/**
 * Connection status
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * MIDI connection state
 */
export interface MidiConnectionState {
  status: ConnectionStatus;
  inputPort: MidiPortInfo | null;
  outputPort: MidiPortInfo | null;
  sysExEnabled: boolean;
  error: string | null;
}

/**
 * Web MIDI access result
 */
export interface WebMidiAccess {
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
}

/**
 * D-110 3-byte address
 */
export interface D110Address {
  aa: number;
  bb: number;
  cc: number;
}

/**
 * Tone group enumeration
 */
export enum ToneGroup {
  PresetA = 0,
  PresetB = 1,
  Internal = 2,
  Card = 3,
}

/**
 * Part assignment mode
 */
export enum AssignMode {
  Poly1 = 0,
  Poly2 = 1,
  Poly3 = 2,
  Poly4 = 3,
}

/**
 * Output assignment
 */
export enum OutputAssign {
  Mix = 0,
  Rev = 1,
  Dir1 = 2,
  Dir2 = 3,
}

/**
 * Reverb mode
 */
export enum ReverbMode {
  Room1 = 0,
  Room2 = 1,
  Hall1 = 2,
  Hall2 = 3,
  Plate = 4,
  Delay = 5,
  PanDelay = 6,
  Off = 7,
}

/**
 * Partial structure (algorithm)
 */
export type PartialStructure = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/**
 * Partial mute flags (bitfield)
 */
export interface PartialMutes {
  partial1: boolean;
  partial2: boolean;
  partial3: boolean;
  partial4: boolean;
}

/**
 * Pitch envelope parameters
 */
export interface PitchEnvelope {
  depth: number;
  velocitySensitivity: number;
  timeKeyfollow: number;
  time1: number;
  time2: number;
  time3: number;
  time4: number;
  level0: number;
  level1: number;
  level2: number;
  sustainLevel: number;
  endLevel: number;
}

/**
 * Filter (TVF) envelope parameters
 */
export interface TvfEnvelope {
  depth: number;
  velocitySensitivity: number;
  depthKeyfollow: number;
  timeKeyfollow: number;
  time1: number;
  time2: number;
  time3: number;
  time4: number;
  time5: number;
  level1: number;
  level2: number;
  level3: number;
  sustainLevel: number;
}

/**
 * Amplifier (TVA) envelope parameters
 */
export interface TvaEnvelope {
  timeKeyfollow: number;
  time1Velocity: number;
  time1: number;
  time2: number;
  time3: number;
  time4: number;
  time5: number;
  level1: number;
  level2: number;
  level3: number;
  sustainLevel: number;
}

/**
 * LFO parameters
 */
export interface LfoParams {
  rate: number;
  depth: number;
  modulationSensitivity: number;
}

/**
 * Partial parameters
 */
export interface PartialParams {
  // Pitch section
  pitchCoarse: number;
  pitchFine: number;
  pitchKeyfollow: number;
  pitchBenderSwitch: boolean;
  waveform: number;
  pcmWaveNumber: number;
  pulseWidth: number;
  pulseWidthVelocity: number;

  // Pitch envelope
  pitchEnvelope: PitchEnvelope;

  // Filter (TVF) section
  tvfCutoff: number;
  tvfResonance: number;
  tvfKeyfollow: number;
  tvfBiasPoint: number;
  tvfBiasLevel: number;
  tvfEnvelope: TvfEnvelope;

  // Amplifier (TVA) section
  tvaLevel: number;
  tvaVelocitySensitivity: number;
  tvaBiasPoint1: number;
  tvaBiasLevel1: number;
  tvaBiasPoint2: number;
  tvaBiasLevel2: number;
  tvaEnvelope: TvaEnvelope;

  // LFO section
  lfo: LfoParams;
}

/**
 * Tone common parameters
 */
export interface ToneCommon {
  name: string;
  structure12: PartialStructure;
  structure34: PartialStructure;
  partialMutes: PartialMutes;
  envMode: number;
}

/**
 * Complete tone data
 */
export interface D110Tone {
  common: ToneCommon;
  partial1: PartialParams;
  partial2: PartialParams;
  partial3: PartialParams;
  partial4: PartialParams;
}

/**
 * Part configuration in a multi/patch
 */
export interface PartConfig {
  toneGroup: ToneGroup;
  toneNumber: number;
  keyShift: number;
  fineTune: number;
  benderRange: number;
  assignMode: AssignMode;
  outputAssign: OutputAssign;
  outputLevel: number;
  pan: number;
  keyRangeLower: number;
  keyRangeUpper: number;
}

/**
 * System parameters
 */
export interface SystemParams {
  reverbMode: ReverbMode;
  reverbTime: number;
  reverbLevel: number;
  partialReserve: number[];
  midiChannels: number[];
}

/**
 * Complete multi/patch data
 */
export interface D110Patch {
  name: string;
  system: SystemParams;
  parts: PartConfig[];
}

/**
 * D-110 client options
 */
export interface D110ClientOptions {
  deviceId?: number;
  timeoutMs?: number;
}

/**
 * D-110 client interface
 */
export interface D110ClientInterface {
  // Tone operations
  requestTone(partIndex: number): Promise<D110Tone>;
  sendToneParameter(partIndex: number, address: D110Address, value: number): Promise<void>;

  // Patch operations
  requestPatch(): Promise<D110Patch>;
  sendPatchParameter(address: D110Address, value: number): Promise<void>;

  // Part operations
  requestPartConfig(partIndex: number): Promise<PartConfig>;
  sendPartParameter(partIndex: number, paramOffset: number, value: number): Promise<void>;

  // System operations
  requestSystemParams(): Promise<SystemParams>;
  sendSystemParameter(offset: number, value: number): Promise<void>;
}
