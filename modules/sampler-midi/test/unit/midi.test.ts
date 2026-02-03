/**
 * Tests for MIDI system abstraction
 *
 * These tests use a mock backend to avoid hardware dependencies and
 * easymidi's strict validation issues.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { MidiSystem } from '@/midi.js';
import type { MidiBackend, RawMidiInput, RawMidiOutput } from '@/backend.js';
import { newClientOutput } from '@audiocontrol/sampler-lib';

/**
 * Create a mock MIDI backend for testing
 */
function createMockBackend(): MidiBackend {
  const mockInput: RawMidiInput = {
    on: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn()
  };

  const mockOutput: RawMidiOutput = {
    send: vi.fn(),
    close: vi.fn()
  };

  return {
    getInputs: vi.fn().mockReturnValue([
      { name: 'Mock Input 1' },
      { name: 'Mock Input 2' }
    ]),
    getOutputs: vi.fn().mockReturnValue([
      { name: 'Mock Output 1' },
      { name: 'Mock Output 2' }
    ]),
    createInput: vi.fn().mockReturnValue(mockInput),
    createOutput: vi.fn().mockReturnValue(mockOutput)
  };
}

describe('MIDI System', () => {
  describe('MidiSystem Constructor', () => {
    it('should create a MIDI system instance with backend', () => {
      const backend = createMockBackend();
      const system = new MidiSystem(backend);
      expect(system).toBeDefined();
    });

    it('should accept a custom ProcessOutput', () => {
      const customOut = newClientOutput(true);
      const backend = createMockBackend();
      const system = new MidiSystem(backend, customOut);
      expect(system).toBeDefined();
    });
  });

  describe('MidiSystem Interface', () => {
    let system: MidiSystem;
    let backend: MidiBackend;

    beforeEach(() => {
      backend = createMockBackend();
      system = new MidiSystem(backend);
    });

    afterEach(async () => {
      await system.stop();
    });

    describe('start', () => {
      it('should start without errors', async () => {
        await system.start();
      });

      it('should accept configuration options', async () => {
        await system.start({ enableSysex: true, debug: false });
      });

      it('should auto-select first ports if available', async () => {
        await system.start();
        expect(backend.getInputs).toHaveBeenCalled();
        expect(backend.getOutputs).toHaveBeenCalled();
        expect(backend.createInput).toHaveBeenCalledWith('Mock Input 1');
        expect(backend.createOutput).toHaveBeenCalledWith('Mock Output 1');
      });
    });

    describe('stop', () => {
      it('should stop without errors', async () => {
        await system.start();
        await system.stop();
      });

      it('should stop without errors even if not started', async () => {
        await system.stop();
      });

      it('should close input and output ports', async () => {
        await system.start();
        const input = system.getCurrentInput();
        const output = system.getCurrentOutput();

        await system.stop();

        expect(system.getCurrentInput()).toBeUndefined();
        expect(system.getCurrentOutput()).toBeUndefined();
      });
    });

    describe('getInputs', () => {
      it('should return an array', () => {
        const inputs = system.getInputs();
        expect(inputs).toBeInstanceOf(Array);
      });

      it('should return ports with name property', () => {
        const inputs = system.getInputs();
        expect(inputs).toHaveLength(2);
        inputs.forEach(input => {
          expect(input).toHaveProperty('name');
          expect(typeof input.name).toBe('string');
        });
      });

      it('should delegate to backend', () => {
        system.getInputs();
        expect(backend.getInputs).toHaveBeenCalled();
      });
    });

    describe('getOutputs', () => {
      it('should return an array', () => {
        const outputs = system.getOutputs();
        expect(outputs).toBeInstanceOf(Array);
      });

      it('should return ports with name property', () => {
        const outputs = system.getOutputs();
        expect(outputs).toHaveLength(2);
        outputs.forEach(output => {
          expect(output).toHaveProperty('name');
          expect(typeof output.name).toBe('string');
        });
      });

      it('should delegate to backend', () => {
        system.getOutputs();
        expect(backend.getOutputs).toHaveBeenCalled();
      });
    });

    describe('getCurrentInput', () => {
      it('should return undefined when no input selected', () => {
        expect(system.getCurrentInput()).toBeUndefined();
      });

      it('should return input after start if available', async () => {
        await system.start();
        const input = system.getCurrentInput();
        expect(input).toBeDefined();
        expect(input?.name).toBe('Mock Input 1');
      });
    });

    describe('getCurrentOutput', () => {
      it('should return undefined when no output selected', () => {
        expect(system.getCurrentOutput()).toBeUndefined();
      });

      it('should return output after start if available', async () => {
        await system.start();
        const output = system.getCurrentOutput();
        expect(output).toBeDefined();
        expect(output?.name).toBe('Mock Output 1');
      });
    });

    describe('setInput', () => {
      it('should accept string input name', async () => {
        await system.start();
        const inputs = system.getInputs();
        expect(() => system.setInput(inputs[0].name)).not.toThrow();
      });

      it('should create input using backend', async () => {
        await system.start();
        vi.clearAllMocks(); // Clear start's createInput call

        system.setInput('Mock Input 2');
        expect(backend.createInput).toHaveBeenCalledWith('Mock Input 2');
      });

      it('should close previous input before setting new one', async () => {
        await system.start();
        const firstInput = system.getCurrentInput();

        system.setInput('Mock Input 2');

        // Backend mock's close should have been called
        const mockInput = (backend as any).createInput.mock.results[0].value;
        expect(mockInput.close).toHaveBeenCalled();
      });
    });

    describe('setOutput', () => {
      it('should accept string output name', async () => {
        await system.start();
        const outputs = system.getOutputs();
        expect(() => system.setOutput(outputs[0].name)).not.toThrow();
      });

      it('should create output using backend', async () => {
        await system.start();
        vi.clearAllMocks();

        system.setOutput('Mock Output 2');
        expect(backend.createOutput).toHaveBeenCalledWith('Mock Output 2');
      });

      it('should close previous output before setting new one', async () => {
        await system.start();
        const firstOutput = system.getCurrentOutput();

        system.setOutput('Mock Output 2');

        const mockOutput = (backend as any).createOutput.mock.results[0].value;
        expect(mockOutput.close).toHaveBeenCalled();
      });
    });
  });

  describe('Listener Management', () => {
    let system: MidiSystem;
    let backend: MidiBackend;

    beforeEach(() => {
      backend = createMockBackend();
      system = new MidiSystem(backend);
    });

    afterEach(async () => {
      await system.stop();
    });

    it('should add listeners without error', async () => {
      await system.start();
      const callback = vi.fn();
      expect(() => system.addListener('sysex', callback)).not.toThrow();

      const mockInput = (backend as any).createInput.mock.results[0].value;
      expect(mockInput.on).toHaveBeenCalledWith('sysex', callback);
    });

    it('should remove listeners without error', async () => {
      await system.start();
      const callback = vi.fn();
      system.addListener('sysex', callback);
      expect(() => system.removeListener('sysex', callback)).not.toThrow();

      const mockInput = (backend as any).createInput.mock.results[0].value;
      expect(mockInput.removeListener).toHaveBeenCalledWith('sysex', callback);
    });

    it('should handle adding listener before start', () => {
      const callback = vi.fn();
      expect(() => system.addListener('sysex', callback)).not.toThrow();
    });

    it('should persist listeners when changing inputs', async () => {
      await system.start();
      const callback = vi.fn();
      const inputs = system.getInputs();

      system.addListener('sysex', callback);

      // Should be added to first input
      const mockInput1 = (backend as any).createInput.mock.results[0].value;
      expect(mockInput1.on).toHaveBeenCalledWith('sysex', callback);

      // Change input
      system.setInput(inputs[1].name);

      // Should be removed from first input
      expect(mockInput1.removeListener).toHaveBeenCalledWith('sysex', callback);

      // Should be added to second input
      const mockInput2 = (backend as any).createInput.mock.results[1].value;
      expect(mockInput2.on).toHaveBeenCalledWith('sysex', callback);
    });
  });

  describe('Error Handling', () => {
    let system: MidiSystem;
    let backend: MidiBackend;

    beforeEach(() => {
      backend = createMockBackend();
      system = new MidiSystem(backend);
    });

    afterEach(async () => {
      await system.stop();
    });

    it('should handle start when no ports available', async () => {
      (backend.getInputs as any).mockReturnValue([]);
      (backend.getOutputs as any).mockReturnValue([]);

      await system.start();

      expect(system.getCurrentInput()).toBeUndefined();
      expect(system.getCurrentOutput()).toBeUndefined();
    });

    it('should handle stop when not started', async () => {
      await system.stop();
    });

    it('should handle multiple start calls', async () => {
      await system.start();
      await system.start();
    });

    it('should handle multiple stop calls', async () => {
      await system.start();
      await system.stop();
      await system.stop();
    });
  });

  describe('Configuration', () => {
    let system: MidiSystem;
    let backend: MidiBackend;

    beforeEach(() => {
      backend = createMockBackend();
    });

    afterEach(async () => {
      if (system) {
        await system.stop();
      }
    });

    it('should accept debug configuration', async () => {
      system = new MidiSystem(backend);
      await system.start({ debug: true });
    });

    it('should accept sysex configuration', async () => {
      system = new MidiSystem(backend);
      await system.start({ enableSysex: true });
    });

    it('should accept combined configuration', async () => {
      system = new MidiSystem(backend);
      await system.start({ debug: true, enableSysex: true });
    });
  });

  describe('MidiOutput Methods', () => {
    let system: MidiSystem;
    let backend: MidiBackend;

    beforeEach(async () => {
      backend = createMockBackend();
      system = new MidiSystem(backend);
      await system.start();
    });

    afterEach(async () => {
      await system.stop();
    });

    it('should send sysex messages', () => {
      const output = system.getCurrentOutput();
      expect(output).toBeDefined();

      output!.sendSysex([0x47, 0x5E, 0x00]);

      const mockOutput = (backend as any).createOutput.mock.results[0].value;
      expect(mockOutput.send).toHaveBeenCalledWith('sysex', {
        bytes: [0xF0, 0x47, 0x5E, 0x00, 0xF7]
      });
    });

    it('should not double-wrap sysex data', () => {
      const output = system.getCurrentOutput();
      expect(output).toBeDefined();

      output!.sendSysex([0xF0, 0x47, 0x5E, 0x00, 0xF7]);

      const mockOutput = (backend as any).createOutput.mock.results[0].value;
      expect(mockOutput.send).toHaveBeenCalledWith('sysex', {
        bytes: [0xF0, 0x47, 0x5E, 0x00, 0xF7]
      });
    });

    it('should send note on messages', () => {
      const output = system.getCurrentOutput();
      expect(output).toBeDefined();

      output!.sendNoteOn(60, 127, 1);

      const mockOutput = (backend as any).createOutput.mock.results[0].value;
      expect(mockOutput.send).toHaveBeenCalledWith('noteon', {
        note: 60,
        velocity: 127,
        channel: 1
      });
    });

    it('should send note off messages', () => {
      const output = system.getCurrentOutput();
      expect(output).toBeDefined();

      output!.sendNoteOff(60, 64, 1);

      const mockOutput = (backend as any).createOutput.mock.results[0].value;
      expect(mockOutput.send).toHaveBeenCalledWith('noteoff', {
        note: 60,
        velocity: 64,
        channel: 1
      });
    });
  });
});
