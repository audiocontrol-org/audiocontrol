/**
 * Tests for MIDI Instrument abstraction
 *
 * Note: These tests work with the actual easymidi library since it doesn't
 * support stubbing. Tests are designed to work without real MIDI hardware.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  createMidiInstrument,
  newMidiInstrument,
  MidiInstrument
} from '@/instrument';
import { createMidiSystem, MidiSystem } from '@/midi';

describe('MIDI Instrument', () => {
  let midiSystem: MidiSystem;

  beforeEach(() => {
    midiSystem = createMidiSystem();
  });

  afterEach(async () => {
    await midiSystem.stop();
  });

  describe('createMidiInstrument', () => {
    it('should create a MIDI instrument', async () => {
      await midiSystem.start();
      const instrument = createMidiInstrument(midiSystem, 0);
      expect(instrument).toBeDefined();
    });

    it('should throw error for invalid channel (negative)', async () => {
      await midiSystem.start();
      expect(() => createMidiInstrument(midiSystem, -1)).toThrow(
        'Invalid MIDI channel'
      );
    });

    it('should throw error for invalid channel (too high)', async () => {
      await midiSystem.start();
      expect(() => createMidiInstrument(midiSystem, 16)).toThrow(
        'Invalid MIDI channel'
      );
    });

    it('should accept valid channels 0-15', async () => {
      await midiSystem.start();
      for (let channel = 0; channel <= 15; channel++) {
        expect(() => createMidiInstrument(midiSystem, channel)).not.toThrow();
      }
    });
  });

  describe('newMidiInstrument (legacy)', () => {
    it('should create a MIDI instrument', async () => {
      await midiSystem.start();
      const instrument = newMidiInstrument(midiSystem, 0);
      expect(instrument).toBeDefined();
    });

    it('should behave identically to createMidiInstrument', async () => {
      await midiSystem.start();
      const instrument1 = createMidiInstrument(midiSystem, 5);
      const instrument2 = newMidiInstrument(midiSystem, 5);

      expect(instrument1.getChannel()).toBe(instrument2.getChannel());
    });
  });

  describe('MidiInstrument Interface', () => {
    let instrument: MidiInstrument;
    const testChannel = 3;

    beforeEach(async () => {
      await midiSystem.start();
      instrument = createMidiInstrument(midiSystem, testChannel);
    });

    describe('getChannel', () => {
      it('should return the configured channel', () => {
        expect(instrument.getChannel()).toBe(testChannel);
      });
    });

    describe('noteOn', () => {
      it('should throw error when no output available', async () => {
        // Create a fresh system with no outputs selected
        const freshSystem = createMidiSystem();
        const freshInstrument = createMidiInstrument(freshSystem, 0);

        expect(() => freshInstrument.noteOn(60, 127)).toThrow(
          'No MIDI output available for instrument'
        );

        await freshSystem.stop();
      });

      it('should not throw when output is available', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOn(60, 127)).not.toThrow();
        }
      });

      it('should accept different note values', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOn(0, 127)).not.toThrow();
          expect(() => instrument.noteOn(60, 127)).not.toThrow();
          expect(() => instrument.noteOn(127, 127)).not.toThrow();
        }
      });

      it('should accept different velocity values', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOn(60, 0)).not.toThrow();
          expect(() => instrument.noteOn(60, 64)).not.toThrow();
          expect(() => instrument.noteOn(60, 127)).not.toThrow();
        }
      });
    });

    describe('noteOff', () => {
      it('should throw error when no output available', async () => {
        // Create a fresh system with no outputs selected
        const freshSystem = createMidiSystem();
        const freshInstrument = createMidiInstrument(freshSystem, 0);

        expect(() => freshInstrument.noteOff(60, 64)).toThrow(
          'No MIDI output available for instrument'
        );

        await freshSystem.stop();
      });

      it('should not throw when output is available', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOff(60, 64)).not.toThrow();
        }
      });

      it('should accept different note values', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOff(0, 64)).not.toThrow();
          expect(() => instrument.noteOff(60, 64)).not.toThrow();
          expect(() => instrument.noteOff(127, 64)).not.toThrow();
        }
      });

      it('should accept different velocity values', () => {
        const outputs = midiSystem.getOutputs();
        if (outputs.length > 0) {
          expect(() => instrument.noteOff(60, 0)).not.toThrow();
          expect(() => instrument.noteOff(60, 64)).not.toThrow();
          expect(() => instrument.noteOff(60, 127)).not.toThrow();
        }
      });
    });
  });

  describe('Multiple Instruments', () => {
    it('should support multiple instruments on different channels', async () => {
      await midiSystem.start();

      const instrument1 = createMidiInstrument(midiSystem, 0);
      const instrument2 = createMidiInstrument(midiSystem, 1);
      const instrument3 = createMidiInstrument(midiSystem, 2);

      expect(instrument1.getChannel()).toBe(0);
      expect(instrument2.getChannel()).toBe(1);
      expect(instrument3.getChannel()).toBe(2);
    });

    it('should allow instruments to play notes independently', async () => {
      await midiSystem.start();
      const outputs = midiSystem.getOutputs();

      if (outputs.length > 0) {
        const drums = createMidiInstrument(midiSystem, 9);
        const bass = createMidiInstrument(midiSystem, 1);
        const keys = createMidiInstrument(midiSystem, 0);

        expect(() => {
          drums.noteOn(36, 127); // Kick drum
          bass.noteOn(40, 100); // E2
          keys.noteOn(60, 80); // Middle C
        }).not.toThrow();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid note on/off sequences', async () => {
      await midiSystem.start();
      const outputs = midiSystem.getOutputs();

      if (outputs.length > 0) {
        const instrument = createMidiInstrument(midiSystem, 0);

        expect(() => {
          for (let i = 0; i < 100; i++) {
            instrument.noteOn(60, 127);
            instrument.noteOff(60, 64);
          }
        }).not.toThrow();
      }
    });

    it('should handle all MIDI notes (0-127)', async () => {
      await midiSystem.start();
      const outputs = midiSystem.getOutputs();

      if (outputs.length > 0) {
        const instrument = createMidiInstrument(midiSystem, 0);

        for (let note = 0; note <= 127; note++) {
          expect(() => {
            instrument.noteOn(note, 127);
            instrument.noteOff(note, 64);
          }).not.toThrow();
        }
      }
    });

    it('should handle all MIDI velocities (0-127)', async () => {
      await midiSystem.start();
      const outputs = midiSystem.getOutputs();

      if (outputs.length > 0) {
        const instrument = createMidiInstrument(midiSystem, 0);

        for (let velocity = 0; velocity <= 127; velocity++) {
          expect(() => {
            instrument.noteOn(60, velocity);
            instrument.noteOff(60, velocity);
          }).not.toThrow();
        }
      }
    });
  });

  describe('Channel Validation', () => {
    it('should reject channel -1', () => {
      expect(() => createMidiInstrument(midiSystem, -1)).toThrow();
    });

    it('should reject channel 16', () => {
      expect(() => createMidiInstrument(midiSystem, 16)).toThrow();
    });

    it('should accept channel 0', () => {
      expect(() => createMidiInstrument(midiSystem, 0)).not.toThrow();
    });

    it('should accept channel 15', () => {
      expect(() => createMidiInstrument(midiSystem, 15)).not.toThrow();
    });

    it('should reject channel 100', () => {
      expect(() => createMidiInstrument(midiSystem, 100)).toThrow();
    });
  });
});
