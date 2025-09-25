/**
 * Tests for Zod schema validators
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  MidiChannelSchema,
  CCNumberSchema,
  MidiValueSchema,
  SlotNumberSchema,
  ControlTypeSchema,
  ControlIdSchema,
  ControlConfigSchema,
  CustomModeSchema,
  SysExMessageSchema,
  ControlChangeMessageSchema,
  NoteMessageSchema,
  DeviceOptionsSchema,
  validateCustomMode,
  validateControlConfig,
  validateDeviceOptions,
  isValidSlotNumber,
} from '@/utils/validators.js';

describe('validators', () => {
  describe('Basic MIDI schemas', () => {
    describe('MidiChannelSchema', () => {
      it('should validate valid MIDI channels', () => {
        expect(MidiChannelSchema.parse(1)).toBe(1);
        expect(MidiChannelSchema.parse(16)).toBe(16);
      });

      it('should reject invalid MIDI channels', () => {
        expect(() => MidiChannelSchema.parse(0)).toThrow();
        expect(() => MidiChannelSchema.parse(17)).toThrow();
        expect(() => MidiChannelSchema.parse(-1)).toThrow();
        expect(() => MidiChannelSchema.parse(1.5)).toThrow();
      });
    });

    describe('CCNumberSchema', () => {
      it('should validate valid CC numbers', () => {
        expect(CCNumberSchema.parse(0)).toBe(0);
        expect(CCNumberSchema.parse(127)).toBe(127);
        expect(CCNumberSchema.parse(64)).toBe(64);
      });

      it('should reject invalid CC numbers', () => {
        expect(() => CCNumberSchema.parse(-1)).toThrow();
        expect(() => CCNumberSchema.parse(128)).toThrow();
        expect(() => CCNumberSchema.parse(1.5)).toThrow();
      });
    });

    describe('MidiValueSchema', () => {
      it('should validate valid MIDI values', () => {
        expect(MidiValueSchema.parse(0)).toBe(0);
        expect(MidiValueSchema.parse(127)).toBe(127);
        expect(MidiValueSchema.parse(64)).toBe(64);
      });

      it('should reject invalid MIDI values', () => {
        expect(() => MidiValueSchema.parse(-1)).toThrow();
        expect(() => MidiValueSchema.parse(128)).toThrow();
        expect(() => MidiValueSchema.parse(1.5)).toThrow();
      });
    });

    describe('SlotNumberSchema', () => {
      it('should validate valid slot numbers', () => {
        expect(SlotNumberSchema.parse(1)).toBe(1);
        expect(SlotNumberSchema.parse(8)).toBe(8);
        expect(SlotNumberSchema.parse(4)).toBe(4);
      });

      it('should reject invalid slot numbers', () => {
        expect(() => SlotNumberSchema.parse(0)).toThrow();
        expect(() => SlotNumberSchema.parse(9)).toThrow();
        expect(() => SlotNumberSchema.parse(-1)).toThrow();
      });
    });
  });

  describe('Control schemas', () => {
    describe('ControlTypeSchema', () => {
      it('should validate knob control types', () => {
        const knobControl = { type: 'knob', behavior: 'absolute' };
        expect(ControlTypeSchema.parse(knobControl)).toEqual(knobControl);

        const relativeKnob = { type: 'knob', behavior: 'relative' };
        expect(ControlTypeSchema.parse(relativeKnob)).toEqual(relativeKnob);
      });

      it('should validate button control types', () => {
        const momentaryButton = { type: 'button', behavior: 'momentary' };
        expect(ControlTypeSchema.parse(momentaryButton)).toEqual(momentaryButton);

        const toggleButton = { type: 'button', behavior: 'toggle' };
        expect(ControlTypeSchema.parse(toggleButton)).toEqual(toggleButton);

        const triggerButton = { type: 'button', behavior: 'trigger' };
        expect(ControlTypeSchema.parse(triggerButton)).toEqual(triggerButton);
      });

      it('should validate fader control types', () => {
        const faderControl = { type: 'fader', behavior: 'absolute' };
        expect(ControlTypeSchema.parse(faderControl)).toEqual(faderControl);
      });

      it('should reject invalid control types', () => {
        expect(() => ControlTypeSchema.parse({ type: 'invalid', behavior: 'absolute' })).toThrow();
        expect(() => ControlTypeSchema.parse({ type: 'knob', behavior: 'invalid' })).toThrow();
        expect(() => ControlTypeSchema.parse({ type: 'fader', behavior: 'relative' })).toThrow();
      });
    });

    describe('ControlIdSchema', () => {
      it('should validate control IDs', () => {
        const controlId = { type: 'knob', position: 1, row: 2 };
        expect(ControlIdSchema.parse(controlId)).toEqual(controlId);

        const buttonId = { type: 'button', position: 1 };
        expect(ControlIdSchema.parse(buttonId)).toEqual(buttonId);
      });

      it('should reject invalid control IDs', () => {
        expect(() => ControlIdSchema.parse({ type: 'invalid', position: 1 })).toThrow();
        expect(() => ControlIdSchema.parse({ type: 'knob', position: 0 })).toThrow();
        expect(() => ControlIdSchema.parse({ type: 'knob', position: 1, row: 0 })).toThrow();
        expect(() => ControlIdSchema.parse({ type: 'knob', position: 1, row: 4 })).toThrow();
      });
    });

    describe('ControlConfigSchema', () => {
      it('should validate complete control configurations', () => {
        const config = {
          id: { type: 'knob', position: 1, row: 1 },
          midiChannel: 1,
          ccNumber: 21,
          controlType: { type: 'knob', behavior: 'absolute' },
          name: 'Test Knob',
          color: { red: 127, green: 0, blue: 0 },
          range: { min: 0, max: 127, default: 64 },
        };

        expect(ControlConfigSchema.parse(config)).toEqual(config);
      });

      it('should validate minimal control configurations', () => {
        const config = {
          id: { type: 'button', position: 1 },
          midiChannel: 1,
          ccNumber: 41,
          controlType: { type: 'button', behavior: 'momentary' },
        };

        expect(ControlConfigSchema.parse(config)).toEqual(config);
      });
    });
  });

  describe('CustomModeSchema', () => {
    it('should validate custom modes', () => {
      const mode = {
        slot: 1,
        name: 'Test Mode',
        controls: [{
          id: { type: 'knob', position: 1 },
          midiChannel: 1,
          ccNumber: 21,
          controlType: { type: 'knob', behavior: 'absolute' },
        }],
        globalChannel: 1,
        description: 'Test mode for unit testing',
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      expect(CustomModeSchema.parse(mode)).toEqual(mode);
    });

    it('should reject modes with too many controls', () => {
      const controls = Array.from({ length: 50 }, (_, i) => ({
        id: { type: 'knob', position: i + 1 },
        midiChannel: 1,
        ccNumber: i,
        controlType: { type: 'knob', behavior: 'absolute' },
      }));

      const mode = {
        slot: 1,
        name: 'Overloaded Mode',
        controls,
      };

      expect(() => CustomModeSchema.parse(mode)).toThrow();
    });

    it('should reject invalid mode names', () => {
      const mode = {
        slot: 1,
        name: '', // Empty name
        controls: [],
      };

      expect(() => CustomModeSchema.parse(mode)).toThrow();
    });
  });

  describe('MIDI Message schemas', () => {
    describe('SysExMessageSchema', () => {
      it('should validate SysEx messages', () => {
        const sysex = {
          manufacturerId: [0x00, 0x20, 0x29],
          deviceId: [0x02, 0x0D],
          data: [0x45, 0x01, 0x00],
        };

        expect(SysExMessageSchema.parse(sysex)).toEqual(sysex);
      });

      it('should validate SysEx without device ID', () => {
        const sysex = {
          manufacturerId: [0x00, 0x20, 0x29],
          data: [0x45, 0x01, 0x00],
        };

        expect(SysExMessageSchema.parse(sysex)).toEqual(sysex);
      });

      it('should reject invalid SysEx data', () => {
        expect(() => SysExMessageSchema.parse({
          manufacturerId: [0x00, 0x20, 128], // Invalid byte
          data: [0x45],
        })).toThrow();
      });
    });

    describe('ControlChangeMessageSchema', () => {
      it('should validate CC messages', () => {
        const cc = {
          type: 'controlChange',
          channel: 1,
          cc: 21,
          value: 64,
          timestamp: Date.now(),
          data: [0xB0, 21, 64],
        };

        expect(ControlChangeMessageSchema.parse(cc)).toEqual(cc);
      });
    });

    describe('NoteMessageSchema', () => {
      it('should validate note messages', () => {
        const noteOn = {
          type: 'noteOn',
          channel: 1,
          note: 60,
          velocity: 127,
          timestamp: Date.now(),
          data: [0x90, 60, 127],
        };

        expect(NoteMessageSchema.parse(noteOn)).toEqual(noteOn);

        const noteOff = {
          type: 'noteOff',
          channel: 1,
          note: 60,
          velocity: 0,
          timestamp: Date.now(),
          data: [0x80, 60, 0],
        };

        expect(NoteMessageSchema.parse(noteOff)).toEqual(noteOff);
      });
    });
  });

  describe('DeviceOptionsSchema', () => {
    it('should validate complete device options', () => {
      const options = {
        retryPolicy: {
          maxRetries: 3,
          backoffMs: 1000,
          exponentialBackoff: true,
        },
        heartbeat: {
          intervalMs: 5000,
          timeoutMs: 2000,
          enabled: true,
        },
        errorRecovery: {
          autoReconnect: true,
          reconnectDelayMs: 2000,
          maxReconnectAttempts: 5,
        },
        timeout: {
          connectionMs: 5000,
          commandMs: 2000,
          sysexMs: 3000,
        },
      };

      expect(DeviceOptionsSchema.parse(options)).toEqual(options);
    });

    it('should validate minimal device options', () => {
      const options = {};
      expect(DeviceOptionsSchema.parse(options)).toEqual(options);
    });

    it('should reject invalid timeout values', () => {
      const options = {
        heartbeat: {
          intervalMs: 500, // Too low
        },
      };

      expect(() => DeviceOptionsSchema.parse(options)).toThrow();
    });
  });

  describe('Validation helper functions', () => {
    describe('validateCustomMode', () => {
      it('should validate and return parsed custom mode', () => {
        const mode = {
          slot: 1,
          name: 'Test',
          controls: [],
        };

        expect(validateCustomMode(mode)).toEqual(mode);
      });

      it('should throw on invalid custom mode', () => {
        expect(() => validateCustomMode({ slot: 0, name: 'Test', controls: [] })).toThrow();
      });
    });

    describe('validateControlConfig', () => {
      it('should validate and return parsed control config', () => {
        const config = {
          id: { type: 'knob', position: 1 },
          midiChannel: 1,
          ccNumber: 21,
          controlType: { type: 'knob', behavior: 'absolute' },
        };

        expect(validateControlConfig(config)).toEqual(config);
      });
    });

    describe('validateDeviceOptions', () => {
      it('should validate and return parsed device options', () => {
        const options = { timeout: { connectionMs: 5000, commandMs: 2000, sysexMs: 3000 } };
        expect(validateDeviceOptions(options)).toEqual(options);
      });
    });

    describe('isValidSlotNumber', () => {
      it('should return true for valid slot numbers', () => {
        expect(isValidSlotNumber(1)).toBe(true);
        expect(isValidSlotNumber(8)).toBe(true);
        expect(isValidSlotNumber(4)).toBe(true);
      });

      it('should return false for invalid slot numbers', () => {
        expect(isValidSlotNumber(0)).toBe(false);
        expect(isValidSlotNumber(9)).toBe(false);
        expect(isValidSlotNumber('invalid')).toBe(false);
        expect(isValidSlotNumber(1.5)).toBe(false);
      });
    });
  });
});