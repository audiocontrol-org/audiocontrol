/**
 * Control Mapper for Launch Control XL 3
 *
 * Maps hardware controls to MIDI messages and handles value transformation,
 * scaling, and behavior management for different control types.
 */

import { EventEmitter } from 'events';
import {
  ControlMapping,
  ControlBehaviour,
  MidiMessage,
  ControlType,
  ValueTransform,
  MidiChannel,
  CCNumber
} from '@/types';

export interface ControlMapperOptions {
  defaultChannel?: number;
  enableValueSmoothing?: boolean;
  smoothingFactor?: number;
  enableDeadzone?: boolean;
  deadzoneThreshold?: number;
}

export interface MappedControl {
  id: string;
  type: ControlType;
  mapping: ControlMapping;
  currentValue: number;
  lastValue: number;
  timestamp: number;
}

export interface ControlMapperEvents {
  'value:changed': (controlId: string, value: number, mapping: ControlMapping) => void;
  'midi:out': (message: MidiMessage) => void;
  'control:mapped': (controlId: string, mapping: ControlMapping) => void;
  'control:unmapped': (controlId: string) => void;
}

/**
 * Value transformer functions
 */
export class ValueTransformers {
  /**
   * Linear scaling
   */
  static linear(value: number, min: number, max: number): number {
    return Math.round(min + (value / 127) * (max - min));
  }

  /**
   * Exponential scaling
   */
  static exponential(value: number, min: number, max: number, curve: number = 2): number {
    const normalized = value / 127;
    const curved = Math.pow(normalized, curve);
    return Math.round(min + curved * (max - min));
  }

  /**
   * Logarithmic scaling
   */
  static logarithmic(value: number, min: number, max: number): number {
    const normalized = value / 127;
    const curved = Math.log10(normalized * 9 + 1);
    return Math.round(min + curved * (max - min));
  }

  /**
   * Stepped scaling (quantize to steps)
   */
  static stepped(value: number, min: number, max: number, steps: number): number {
    const range = max - min;
    const stepSize = range / (steps - 1);
    const stepIndex = Math.round((value / 127) * (steps - 1));
    return Math.round(min + stepIndex * stepSize);
  }

  /**
   * Toggle (binary)
   */
  static toggle(value: number, threshold: number = 64): number {
    return value >= threshold ? 127 : 0;
  }

  /**
   * Invert
   */
  static invert(value: number): number {
    return 127 - value;
  }

  /**
   * Bipolar (-64 to +63)
   */
  static bipolar(value: number): number {
    return value - 64;
  }
}

/**
 * Relative value handlers
 */
export class RelativeHandlers {
  /**
   * Relative mode 1: Two's complement
   */
  static twosComplement(value: number, currentValue: number, speed: number = 1): number {
    const delta = value > 64 ? value - 128 : value;
    const newValue = currentValue + (delta * speed);
    return Math.max(0, Math.min(127, newValue));
  }

  /**
   * Relative mode 2: Binary offset
   */
  static binaryOffset(value: number, currentValue: number, speed: number = 1): number {
    const delta = value >= 64 ? -(value - 64) : value;
    const newValue = currentValue + (delta * speed);
    return Math.max(0, Math.min(127, newValue));
  }

  /**
   * Relative mode 3: Sign magnitude
   */
  static signMagnitude(value: number, currentValue: number, speed: number = 1): number {
    const direction = (value & 0x40) ? -1 : 1;
    const magnitude = value & 0x3F;
    const newValue = currentValue + (direction * magnitude * speed);
    return Math.max(0, Math.min(127, newValue));
  }
}

/**
 * Control Mapper
 */
export class ControlMapper extends EventEmitter {
  private options: Required<ControlMapperOptions>;
  private mappings: Map<string, MappedControl> = new Map();
  private smoothingBuffers: Map<string, number[]> = new Map();
  private relativeAccumulators: Map<string, number> = new Map();

  constructor(options: ControlMapperOptions = {}) {
    super();

    this.options = {
      defaultChannel: options.defaultChannel ?? 0,
      enableValueSmoothing: options.enableValueSmoothing ?? false,
      smoothingFactor: options.smoothingFactor ?? 3,
      enableDeadzone: options.enableDeadzone ?? false,
      deadzoneThreshold: options.deadzoneThreshold ?? 2,
    };
  }

  /**
   * Map a control to MIDI
   */
  mapControl(controlId: string, type: ControlType, mapping: ControlMapping): void {
    const mappedControl: MappedControl = {
      id: controlId,
      type,
      mapping,
      currentValue: 0,
      lastValue: 0,
      timestamp: Date.now(),
    };

    this.mappings.set(controlId, mappedControl);

    // Initialize smoothing buffer if needed
    if (this.options.enableValueSmoothing) {
      this.smoothingBuffers.set(controlId, []);
    }

    // Initialize relative accumulator if needed
    if (this.isRelativeBehaviour(mapping.behaviour)) {
      this.relativeAccumulators.set(controlId, 64); // Middle value
    }

    this.emit('control:mapped', controlId, mapping);
  }

  /**
   * Unmap a control
   */
  unmapControl(controlId: string): void {
    if (this.mappings.delete(controlId)) {
      this.smoothingBuffers.delete(controlId);
      this.relativeAccumulators.delete(controlId);
      this.emit('control:unmapped', controlId);
    }
  }

  /**
   * Process incoming control value
   */
  processControlValue(controlId: string, rawValue: number): MidiMessage | null {
    const mapped = this.mappings.get(controlId);
    if (!mapped) {
      return null;
    }

    // Apply deadzone if enabled
    if (this.options.enableDeadzone) {
      const delta = Math.abs(rawValue - mapped.lastValue);
      if (delta < this.options.deadzoneThreshold) {
        return null;
      }
    }

    // Apply smoothing if enabled
    let processedValue = rawValue;
    if (this.options.enableValueSmoothing) {
      processedValue = this.smoothValue(controlId, rawValue);
    }

    // Handle different control behaviours
    let outputValue: number;

    switch (mapped.mapping.behaviour) {
      case 'absolute':
        outputValue = this.processAbsoluteValue(processedValue, mapped.mapping);
        break;

      case 'relative1':
        outputValue = this.processRelativeValue(processedValue, controlId, 'twosComplement');
        break;

      case 'relative2':
        outputValue = this.processRelativeValue(processedValue, controlId, 'binaryOffset');
        break;

      case 'relative3':
        outputValue = this.processRelativeValue(processedValue, controlId, 'signMagnitude');
        break;

      default:
        outputValue = processedValue;
    }

    // Apply value transform if specified
    if (mapped.mapping.transform) {
      outputValue = this.applyTransform(outputValue, mapped.mapping.transform);
    }

    // Scale to min/max range
    outputValue = ValueTransformers.linear(
      outputValue,
      mapped.mapping.min,
      mapped.mapping.max
    );

    // Update state
    mapped.lastValue = rawValue;
    mapped.currentValue = outputValue;
    mapped.timestamp = Date.now();

    // Emit events
    this.emit('value:changed', controlId, outputValue, mapped.mapping);

    // Create MIDI message
    const message: MidiMessage = {
      type: 'controlchange',
      channel: mapped.mapping.channel,
      controller: mapped.mapping.cc,
      value: outputValue,
    };

    this.emit('midi:out', message);

    return message;
  }

  /**
   * Process absolute value
   */
  private processAbsoluteValue(value: number, mapping: ControlMapping): number {
    // For absolute mode, just pass through the value
    return value;
  }

  /**
   * Process relative value
   */
  private processRelativeValue(
    value: number,
    controlId: string,
    mode: 'twosComplement' | 'binaryOffset' | 'signMagnitude'
  ): number {
    const currentValue = this.relativeAccumulators.get(controlId) ?? 64;
    let newValue: number;

    switch (mode) {
      case 'twosComplement':
        newValue = RelativeHandlers.twosComplement(value, currentValue);
        break;
      case 'binaryOffset':
        newValue = RelativeHandlers.binaryOffset(value, currentValue);
        break;
      case 'signMagnitude':
        newValue = RelativeHandlers.signMagnitude(value, currentValue);
        break;
    }

    this.relativeAccumulators.set(controlId, newValue);
    return newValue;
  }

  /**
   * Apply value transform
   */
  private applyTransform(value: number, transform: ValueTransform): number {
    switch (transform.type) {
      case 'linear':
        return value; // Already linear

      case 'exponential':
        return ValueTransformers.exponential(
          value,
          0,
          127,
          transform.curve ?? 2
        );

      case 'logarithmic':
        return ValueTransformers.logarithmic(value, 0, 127);

      case 'stepped':
        return ValueTransformers.stepped(
          value,
          0,
          127,
          transform.steps ?? 8
        );

      case 'toggle':
        return ValueTransformers.toggle(value, transform.threshold ?? 64);

      case 'invert':
        return ValueTransformers.invert(value);

      case 'bipolar':
        return ValueTransformers.bipolar(value);

      default:
        return value;
    }
  }

  /**
   * Smooth value using moving average
   */
  private smoothValue(controlId: string, value: number): number {
    const buffer = this.smoothingBuffers.get(controlId) ?? [];

    // Add new value to buffer
    buffer.push(value);

    // Keep buffer size limited
    if (buffer.length > this.options.smoothingFactor) {
      buffer.shift();
    }

    // Calculate average
    const sum = buffer.reduce((a, b) => a + b, 0);
    const smoothed = Math.round(sum / buffer.length);

    // Update buffer
    this.smoothingBuffers.set(controlId, buffer);

    return smoothed;
  }

  /**
   * Check if behaviour is relative
   */
  private isRelativeBehaviour(behaviour: ControlBehaviour): boolean {
    return behaviour.startsWith('relative');
  }

  /**
   * Get mapping for control
   */
  getMapping(controlId: string): MappedControl | undefined {
    return this.mappings.get(controlId);
  }

  /**
   * Get all mappings
   */
  getAllMappings(): Map<string, MappedControl> {
    return new Map(this.mappings);
  }

  /**
   * Update control mapping
   */
  updateMapping(controlId: string, updates: Partial<ControlMapping>): void {
    const mapped = this.mappings.get(controlId);
    if (!mapped) {
      throw new Error(`Control ${controlId} is not mapped`);
    }

    mapped.mapping = {
      ...mapped.mapping,
      ...updates,
    };

    this.emit('control:mapped', controlId, mapped.mapping);
  }

  /**
   * Reset control state
   */
  resetControl(controlId: string): void {
    const mapped = this.mappings.get(controlId);
    if (mapped) {
      mapped.currentValue = 0;
      mapped.lastValue = 0;
      mapped.timestamp = Date.now();
    }

    this.smoothingBuffers.delete(controlId);
    this.relativeAccumulators.delete(controlId);
  }

  /**
   * Reset all controls
   */
  resetAll(): void {
    for (const controlId of this.mappings.keys()) {
      this.resetControl(controlId);
    }
  }

  /**
   * Create default mappings for Launch Control XL 3
   */
  static createDefaultMappings(): Map<string, ControlMapping> {
    const mappings = new Map<string, ControlMapping>();

    // Send A knobs - CC 13-20
    for (let i = 0; i < 8; i++) {
      mappings.set(`SEND_A${i + 1}`, {
        type: 'knob',
        channel: 0,
        cc: (13 + i) as CCNumber,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });
    }

    // Send B knobs - CC 29-36
    for (let i = 0; i < 8; i++) {
      mappings.set(`SEND_B${i + 1}`, {
        type: 'knob',
        channel: 0,
        cc: (29 + i) as CCNumber,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });
    }

    // Pan knobs - CC 49-56
    for (let i = 0; i < 8; i++) {
      mappings.set(`PAN${i + 1}`, {
        type: 'knob',
        channel: 0,
        cc: (49 + i) as CCNumber,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });
    }

    // Faders - CC 77-84
    for (let i = 0; i < 8; i++) {
      mappings.set(`FADER${i + 1}`, {
        type: 'fader',
        channel: 0,
        cc: (77 + i) as CCNumber,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });
    }

    return mappings;
  }

  /**
   * Load mappings from custom mode
   */
  loadFromCustomMode(mode: any): void {
    // Clear existing mappings
    this.mappings.clear();
    this.smoothingBuffers.clear();
    this.relativeAccumulators.clear();

    // Load control mappings
    if (mode.controls) {
      for (const [controlId, control] of Object.entries(mode.controls)) {
        this.mapControl(controlId, control.type as ControlType, control as ControlMapping);
      }
    }
  }

  /**
   * Export mappings to custom mode format
   */
  exportToCustomMode(): Record<string, ControlMapping> {
    const controls: Record<string, ControlMapping> = {};

    for (const [controlId, mapped] of this.mappings.entries()) {
      controls[controlId] = mapped.mapping;
    }

    return controls;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.mappings.clear();
    this.smoothingBuffers.clear();
    this.relativeAccumulators.clear();
    this.removeAllListeners();
  }
}

export default ControlMapper;