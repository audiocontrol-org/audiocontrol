/**
 * Unit Tests for ControlMapper
 *
 * Tests control registration, MIDI message mapping, value transformations,
 * range mapping, behavior modes, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ControlMapper, ValueTransformers, RelativeHandlers } from '@/mapping/ControlMapper';
import { ControlMapping, ControlType, ControlBehaviour } from '@/types/index';
import { MidiMessage } from '@/core/MidiInterface';
import { setupFakeTimers, createControlChangeMessage } from '../helpers/test-utils';

describe('ControlMapper', () => {
  setupFakeTimers();

  let controlMapper: ControlMapper;

  beforeEach(() => {
    controlMapper = new ControlMapper({
      defaultChannel: 1,
      enableValueSmoothing: false,
      enableDeadzone: false,
    });
  });

  describe('Control Registration and Lookup', () => {
    it('should map a control successfully', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 20,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('SEND_A1', 'knob', mapping);

      const mapped = controlMapper.getMapping('SEND_A1');
      expect(mapped).toBeDefined();
      expect(mapped!.id).toBe('SEND_A1');
      expect(mapped!.type).toBe('knob');
      expect(mapped!.mapping).toEqual(mapping);
    });

    it('should emit control:mapped event when mapping a control', () => {
      const onMapped = vi.fn();
      controlMapper.on('control:mapped', onMapped);

      const mapping: ControlMapping = {
        type: 'fader',
        channel: 2,
        cc: 50,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('FADER1', 'fader', mapping);

      expect(onMapped).toHaveBeenCalledWith('FADER1', mapping);
    });

    it('should unmap a control successfully', () => {
      const mapping: ControlMapping = {
        type: 'button',
        channel: 1,
        cc: 60,
        min: 0,
        max: 127,
        behaviour: 'toggle',
      };

      controlMapper.mapControl('FOCUS1', 'button', mapping);
      expect(controlMapper.getMapping('FOCUS1')).toBeDefined();

      controlMapper.unmapControl('FOCUS1');
      expect(controlMapper.getMapping('FOCUS1')).toBeUndefined();
    });

    it('should emit control:unmapped event when unmapping a control', () => {
      const onUnmapped = vi.fn();
      controlMapper.on('control:unmapped', onUnmapped);

      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 30,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('PAN1', 'knob', mapping);
      controlMapper.unmapControl('PAN1');

      expect(onUnmapped).toHaveBeenCalledWith('PAN1');
    });

    it('should return undefined for unmapped control', () => {
      const mapped = controlMapper.getMapping('UNMAPPED_CONTROL');
      expect(mapped).toBeUndefined();
    });

    it('should update control mapping', () => {
      const originalMapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 40,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('SEND_B1', 'knob', originalMapping);

      const updates = {
        channel: 5,
        cc: 85,
        max: 100,
      };

      controlMapper.updateMapping('SEND_B1', updates);

      const updated = controlMapper.getMapping('SEND_B1');
      expect(updated!.mapping.channel).toBe(5);
      expect(updated!.mapping.cc).toBe(85);
      expect(updated!.mapping.max).toBe(100);
      expect(updated!.mapping.min).toBe(0); // Should preserve unchanged values
    });

    it('should throw error when updating non-existent mapping', () => {
      expect(() => {
        controlMapper.updateMapping('NON_EXISTENT', { channel: 5 });
      }).toThrow('Control NON_EXISTENT is not mapped');
    });
  });

  describe('MIDI Message Generation', () => {
    it('should generate correct MIDI CC message for absolute control', () => {
      const onMidiOut = vi.fn();
      controlMapper.on('midi:out', onMidiOut);

      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 21,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('SEND_A2', 'knob', mapping);

      const result = controlMapper.processControlValue('SEND_A2', 64);

      expect(result).toBeDefined();
      expect(result!.type).toBe('controlChange');
      expect(result!.data).toEqual([0xB0, 21, 64]); // CC on channel 1, CC 21, value 64
      expect(onMidiOut).toHaveBeenCalledWith(result);
    });

    it('should not generate MIDI message for unmapped control', () => {
      const result = controlMapper.processControlValue('UNMAPPED', 64);
      expect(result).toBeNull();
    });

    it('should handle different MIDI channels correctly', () => {
      const mapping: ControlMapping = {
        type: 'fader',
        channel: 15, // Max MIDI channel
        cc: 127, // Max CC number
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('FADER8', 'fader', mapping);

      const result = controlMapper.processControlValue('FADER8', 100);

      expect(result!.data[0]).toBe(0xBE); // CC on channel 15 (0xB0 | 14)
      expect(result!.data[1]).toBe(127);
      expect(result!.data[2]).toBe(100);
    });
  });

  describe('Value Transformations', () => {
    it('should apply min/max range scaling', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 20,
        max: 80,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('TEST_KNOB', 'knob', mapping);

      // Test minimum value
      let result = controlMapper.processControlValue('TEST_KNOB', 0);
      expect(result!.data[2]).toBe(20); // Should map to min value

      // Test maximum value
      result = controlMapper.processControlValue('TEST_KNOB', 127);
      expect(result!.data[2]).toBe(80); // Should map to max value

      // Test middle value
      result = controlMapper.processControlValue('TEST_KNOB', 64);
      expect(result!.data[2]).toBeCloseTo(50, 0); // Should map to middle of range
    });

    it('should apply custom transform function', () => {
      const customTransform = vi.fn((value: number) => Math.floor(value / 2));

      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: customTransform,
      };

      controlMapper.mapControl('CUSTOM_KNOB', 'knob', mapping);

      const result = controlMapper.processControlValue('CUSTOM_KNOB', 100);

      expect(customTransform).toHaveBeenCalledWith(100);
      // Value should be transformed then range-mapped
      expect(result!.data[2]).toBe(50); // 100 / 2 = 50
    });

    it('should apply exponential transform', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'exponential',
          curve: 2,
        },
      };

      controlMapper.mapControl('EXP_KNOB', 'knob', mapping);

      const result = controlMapper.processControlValue('EXP_KNOB', 64);

      // Should apply exponential curve (squared in this case)
      const expected = ValueTransformers.exponential(64, 0, 127, 2);
      expect(result!.data[2]).toBe(expected);
    });

    it('should apply toggle transform', () => {
      const mapping: ControlMapping = {
        type: 'button',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'toggle',
          threshold: 64,
        },
      };

      controlMapper.mapControl('TOGGLE_BTN', 'button', mapping);

      // Below threshold
      let result = controlMapper.processControlValue('TOGGLE_BTN', 30);
      expect(result!.data[2]).toBe(0);

      // Above threshold
      result = controlMapper.processControlValue('TOGGLE_BTN', 100);
      expect(result!.data[2]).toBe(127);
    });
  });

  describe('Behavior Modes', () => {
    describe('Absolute Mode', () => {
      it('should pass through values unchanged in absolute mode', () => {
        const mapping: ControlMapping = {
          type: 'knob',
          channel: 1,
          cc: 10,
          min: 0,
          max: 127,
          behaviour: 'absolute',
        };

        controlMapper.mapControl('ABS_KNOB', 'knob', mapping);

        const result = controlMapper.processControlValue('ABS_KNOB', 75);
        expect(result!.data[2]).toBe(75);
      });
    });

    describe('Relative Mode 1 (Two\'s Complement)', () => {
      it('should handle relative1 mode correctly', () => {
        const mapping: ControlMapping = {
          type: 'knob',
          channel: 1,
          cc: 10,
          min: 0,
          max: 127,
          behaviour: 'relative1',
        };

        controlMapper.mapControl('REL1_KNOB', 'knob', mapping);

        // Initial value should be at center (64)
        let result = controlMapper.processControlValue('REL1_KNOB', 1); // +1
        let expectedValue = RelativeHandlers.twosComplement(1, 64);
        expect(result!.data[2]).toBe(expectedValue);

        // Negative increment
        result = controlMapper.processControlValue('REL1_KNOB', 127); // -1 in two's complement
        expectedValue = RelativeHandlers.twosComplement(127, expectedValue);
        expect(result!.data[2]).toBe(expectedValue);
      });
    });

    describe('Relative Mode 2 (Binary Offset)', () => {
      it('should handle relative2 mode correctly', () => {
        const mapping: ControlMapping = {
          type: 'knob',
          channel: 1,
          cc: 10,
          min: 0,
          max: 127,
          behaviour: 'relative2',
        };

        controlMapper.mapControl('REL2_KNOB', 'knob', mapping);

        // Positive increment
        let result = controlMapper.processControlValue('REL2_KNOB', 1);
        let expectedValue = RelativeHandlers.binaryOffset(1, 64);
        expect(result!.data[2]).toBe(expectedValue);

        // Negative increment
        result = controlMapper.processControlValue('REL2_KNOB', 65); // 64 + 1
        expectedValue = RelativeHandlers.binaryOffset(65, expectedValue);
        expect(result!.data[2]).toBe(expectedValue);
      });
    });

    describe('Relative Mode 3 (Sign Magnitude)', () => {
      it('should handle relative3 mode correctly', () => {
        const mapping: ControlMapping = {
          type: 'knob',
          channel: 1,
          cc: 10,
          min: 0,
          max: 127,
          behaviour: 'relative3',
        };

        controlMapper.mapControl('REL3_KNOB', 'knob', mapping);

        // Positive direction
        let result = controlMapper.processControlValue('REL3_KNOB', 5); // +5
        let expectedValue = RelativeHandlers.signMagnitude(5, 64);
        expect(result!.data[2]).toBe(expectedValue);

        // Negative direction
        result = controlMapper.processControlValue('REL3_KNOB', 0x40 | 5); // -5
        expectedValue = RelativeHandlers.signMagnitude(0x40 | 5, expectedValue);
        expect(result!.data[2]).toBe(expectedValue);
      });
    });
  });

  describe('Value Smoothing', () => {
    beforeEach(() => {
      controlMapper = new ControlMapper({
        enableValueSmoothing: true,
        smoothingFactor: 3,
      });
    });

    it('should smooth values using moving average', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('SMOOTH_KNOB', 'knob', mapping);

      // First value - no smoothing yet
      let result = controlMapper.processControlValue('SMOOTH_KNOB', 60);
      expect(result!.data[2]).toBe(60);

      // Second value - average of 60, 80 = 70
      result = controlMapper.processControlValue('SMOOTH_KNOB', 80);
      expect(result!.data[2]).toBe(70);

      // Third value - average of 60, 80, 90 = 77 (rounded)
      result = controlMapper.processControlValue('SMOOTH_KNOB', 90);
      expect(result!.data[2]).toBe(77);

      // Fourth value - uses last 3 values: 80, 90, 100 = 90
      result = controlMapper.processControlValue('SMOOTH_KNOB', 100);
      expect(result!.data[2]).toBe(90);
    });
  });

  describe('Deadzone', () => {
    beforeEach(() => {
      controlMapper = new ControlMapper({
        enableDeadzone: true,
        deadzoneThreshold: 5,
      });
    });

    it('should ignore small value changes within deadzone', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('DEADZONE_KNOB', 'knob', mapping);

      // First value
      let result = controlMapper.processControlValue('DEADZONE_KNOB', 60);
      expect(result).toBeDefined();

      // Small change within deadzone - should be ignored
      result = controlMapper.processControlValue('DEADZONE_KNOB', 63);
      expect(result).toBeNull();

      // Large change outside deadzone - should be processed
      result = controlMapper.processControlValue('DEADZONE_KNOB', 70);
      expect(result).toBeDefined();
      expect(result!.data[2]).toBe(70);
    });
  });

  describe('Default Mappings', () => {
    it('should create comprehensive default mappings', () => {
      const defaultMappings = ControlMapper.createDefaultMappings();

      // Should have send A knobs (8)
      for (let i = 1; i <= 8; i++) {
        const mapping = defaultMappings.get(`SEND_A${i}`);
        expect(mapping).toBeDefined();
        expect(mapping!.type).toBe('knob');
        expect(mapping!.cc).toBe(12 + i); // CC 13-20
      }

      // Should have send B knobs (8)
      for (let i = 1; i <= 8; i++) {
        const mapping = defaultMappings.get(`SEND_B${i}`);
        expect(mapping).toBeDefined();
        expect(mapping!.type).toBe('knob');
        expect(mapping!.cc).toBe(28 + i); // CC 29-36
      }

      // Should have pan knobs (8)
      for (let i = 1; i <= 8; i++) {
        const mapping = defaultMappings.get(`PAN${i}`);
        expect(mapping).toBeDefined();
        expect(mapping!.type).toBe('knob');
        expect(mapping!.cc).toBe(48 + i); // CC 49-56
      }

      // Should have faders (8)
      for (let i = 1; i <= 8; i++) {
        const mapping = defaultMappings.get(`FADER${i}`);
        expect(mapping).toBeDefined();
        expect(mapping!.type).toBe('fader');
        expect(mapping!.cc).toBe(76 + i); // CC 77-84
      }
    });
  });

  describe('Custom Mode Integration', () => {
    it('should load mappings from custom mode', () => {
      const customMode = {
        name: 'Test Mode',
        controls: {
          SEND_A1: {
            type: 'knob',
            channel: 5,
            cc: 100,
            min: 10,
            max: 90,
            behaviour: 'relative1',
          },
          FADER1: {
            type: 'fader',
            channel: 3,
            cc: 50,
            min: 0,
            max: 127,
            behaviour: 'absolute',
          },
        },
      };

      controlMapper.loadFromCustomMode(customMode);

      const sendMapping = controlMapper.getMapping('SEND_A1');
      expect(sendMapping).toBeDefined();
      expect(sendMapping!.mapping.channel).toBe(5);
      expect(sendMapping!.mapping.cc).toBe(100);

      const faderMapping = controlMapper.getMapping('FADER1');
      expect(faderMapping).toBeDefined();
      expect(faderMapping!.mapping.channel).toBe(3);
      expect(faderMapping!.mapping.cc).toBe(50);
    });

    it('should export mappings to custom mode format', () => {
      const mapping1: ControlMapping = {
        type: 'knob',
        channel: 2,
        cc: 25,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      const mapping2: ControlMapping = {
        type: 'button',
        channel: 1,
        cc: 60,
        min: 0,
        max: 127,
        behaviour: 'toggle',
      };

      controlMapper.mapControl('SEND_A3', 'knob', mapping1);
      controlMapper.mapControl('FOCUS2', 'button', mapping2);

      const exported = controlMapper.exportToCustomMode();

      expect(exported.SEND_A3).toEqual(mapping1);
      expect(exported.FOCUS2).toEqual(mapping2);
    });
  });

  describe('Control State Management', () => {
    it('should track control values and timestamps', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('STATE_KNOB', 'knob', mapping);

      const result = controlMapper.processControlValue('STATE_KNOB', 75);
      const mapped = controlMapper.getMapping('STATE_KNOB');

      expect(mapped!.currentValue).toBe(75);
      expect(mapped!.lastValue).toBe(75);
      expect(mapped!.timestamp).toBeGreaterThan(0);
    });

    it('should reset control state', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('RESET_KNOB', 'knob', mapping);
      controlMapper.processControlValue('RESET_KNOB', 85);

      let mapped = controlMapper.getMapping('RESET_KNOB');
      expect(mapped!.currentValue).toBe(85);

      controlMapper.resetControl('RESET_KNOB');

      mapped = controlMapper.getMapping('RESET_KNOB');
      expect(mapped!.currentValue).toBe(0);
      expect(mapped!.lastValue).toBe(0);
    });

    it('should reset all controls', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('RESET_KNOB1', 'knob', mapping);
      controlMapper.mapControl('RESET_KNOB2', 'knob', mapping);

      controlMapper.processControlValue('RESET_KNOB1', 50);
      controlMapper.processControlValue('RESET_KNOB2', 100);

      controlMapper.resetAll();

      expect(controlMapper.getMapping('RESET_KNOB1')!.currentValue).toBe(0);
      expect(controlMapper.getMapping('RESET_KNOB2')!.currentValue).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid control values gracefully', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('ERROR_KNOB', 'knob', mapping);

      // Should clamp values to valid MIDI range
      let result = controlMapper.processControlValue('ERROR_KNOB', -10);
      expect(result!.data[2]).toBeGreaterThanOrEqual(0);

      result = controlMapper.processControlValue('ERROR_KNOB', 200);
      expect(result!.data[2]).toBeLessThanOrEqual(127);
    });

    it('should handle missing transform gracefully', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: { type: 'unknown' } as any,
      };

      controlMapper.mapControl('UNKNOWN_TRANSFORM', 'knob', mapping);

      // Should fall back to original value
      const result = controlMapper.processControlValue('UNKNOWN_TRANSFORM', 64);
      expect(result!.data[2]).toBe(64);
    });
  });

  describe('Events', () => {
    it('should emit value:changed event', () => {
      const onValueChanged = vi.fn();
      controlMapper.on('value:changed', onValueChanged);

      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('EVENT_KNOB', 'knob', mapping);
      controlMapper.processControlValue('EVENT_KNOB', 42);

      expect(onValueChanged).toHaveBeenCalledWith('EVENT_KNOB', 42, mapping);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      const mapping: ControlMapping = {
        type: 'knob',
        channel: 1,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      controlMapper.mapControl('CLEANUP_KNOB', 'knob', mapping);

      expect(controlMapper.getAllMappings().size).toBe(1);

      controlMapper.cleanup();

      expect(controlMapper.getAllMappings().size).toBe(0);
    });
  });
});

describe('ValueTransformers', () => {
  describe('linear', () => {
    it('should scale linearly', () => {
      expect(ValueTransformers.linear(0, 0, 127)).toBe(0);
      expect(ValueTransformers.linear(127, 0, 127)).toBe(127);
      expect(ValueTransformers.linear(64, 0, 127)).toBeCloseTo(64, 0);
      expect(ValueTransformers.linear(64, 10, 90)).toBeCloseTo(50, 0);
    });
  });

  describe('exponential', () => {
    it('should apply exponential curve', () => {
      const result = ValueTransformers.exponential(64, 0, 127, 2);
      expect(result).toBeCloseTo(32, 0); // (64/127)^2 * 127 ≈ 32
    });
  });

  describe('logarithmic', () => {
    it('should apply logarithmic curve', () => {
      const result = ValueTransformers.logarithmic(64, 0, 127);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(127);
    });
  });

  describe('stepped', () => {
    it('should quantize to steps', () => {
      expect(ValueTransformers.stepped(0, 0, 127, 8)).toBe(0);
      expect(ValueTransformers.stepped(127, 0, 127, 8)).toBe(127);
      expect(ValueTransformers.stepped(64, 0, 127, 8)).toBeCloseTo(73, 0); // Step 4 of 8
    });
  });

  describe('toggle', () => {
    it('should create binary output', () => {
      expect(ValueTransformers.toggle(30, 64)).toBe(0);
      expect(ValueTransformers.toggle(100, 64)).toBe(127);
      expect(ValueTransformers.toggle(64, 64)).toBe(127);
    });
  });

  describe('invert', () => {
    it('should invert values', () => {
      expect(ValueTransformers.invert(0)).toBe(127);
      expect(ValueTransformers.invert(127)).toBe(0);
      expect(ValueTransformers.invert(64)).toBe(63);
    });
  });

  describe('bipolar', () => {
    it('should convert to bipolar range', () => {
      expect(ValueTransformers.bipolar(0)).toBe(-64);
      expect(ValueTransformers.bipolar(64)).toBe(0);
      expect(ValueTransformers.bipolar(127)).toBe(63);
    });
  });
});

describe('RelativeHandlers', () => {
  describe('twosComplement', () => {
    it('should handle positive increments', () => {
      expect(RelativeHandlers.twosComplement(1, 64)).toBe(65);
      expect(RelativeHandlers.twosComplement(5, 64)).toBe(69);
    });

    it('should handle negative increments', () => {
      expect(RelativeHandlers.twosComplement(127, 64)).toBe(63); // -1
      expect(RelativeHandlers.twosComplement(123, 64)).toBe(59); // -5
    });

    it('should clamp to valid range', () => {
      expect(RelativeHandlers.twosComplement(50, 100)).toBe(127); // Clamped to max
      expect(RelativeHandlers.twosComplement(100, 5)).toBe(0); // Clamped to min
    });
  });

  describe('binaryOffset', () => {
    it('should handle binary offset encoding', () => {
      expect(RelativeHandlers.binaryOffset(1, 64)).toBe(65);
      expect(RelativeHandlers.binaryOffset(65, 64)).toBe(63); // 64 + 1 = negative
    });
  });

  describe('signMagnitude', () => {
    it('should handle sign magnitude encoding', () => {
      expect(RelativeHandlers.signMagnitude(5, 64)).toBe(69); // +5
      expect(RelativeHandlers.signMagnitude(0x40 | 5, 64)).toBe(59); // -5
    });
  });
});
