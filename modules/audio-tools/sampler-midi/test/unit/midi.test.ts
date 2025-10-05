/**
 * Tests for MIDI system abstraction
 *
 * Note: These tests work with the actual easymidi library since it doesn't
 * support stubbing. Tests are designed to work without real MIDI hardware.
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  createMidiSystem,
  Midi,
  MidiSystem
} from '@/midi';
import { newClientOutput } from '@oletizi/sampler-lib';

describe('MIDI System', () => {
  describe('createMidiSystem', () => {
    it('should create a MIDI system instance', () => {
      const system = createMidiSystem();
      expect(system).to.exist;
    });

    it('should accept a custom ProcessOutput', () => {
      const customOut = newClientOutput(true);
      const system = createMidiSystem(customOut);
      expect(system).to.exist;
    });
  });

  describe('MidiSystem Interface', () => {
    let system: MidiSystem;

    beforeEach(() => {
      system = createMidiSystem();
    });

    afterEach(async () => {
      await system.stop();
    });

    describe('start', () => {
      it('should start without errors', async () => {
        await system.start();
      });

      it('should accept configuration options', async () => {
        await (
          system.start({ enableSysex: true, debug: false })
        );
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
    });

    describe('getInputs', () => {
      it('should return an array', () => {
        const inputs = system.getInputs();
        expect(inputs).to.be.an('array');
      });

      it('should return ports with name property', () => {
        const inputs = system.getInputs();
        inputs.forEach(input => {
          expect(input).to.have.property('name');
          expect(input.name).to.be.a('string');
        });
      });
    });

    describe('getOutputs', () => {
      it('should return an array', () => {
        const outputs = system.getOutputs();
        expect(outputs).to.be.an('array');
      });

      it('should return ports with name property', () => {
        const outputs = system.getOutputs();
        outputs.forEach(output => {
          expect(output).to.have.property('name');
          expect(output.name).to.be.a('string');
        });
      });
    });

    describe('getCurrentInput', () => {
      it('should return undefined when no input selected', () => {
        expect(system.getCurrentInput()).to.be.undefined;
      });

      it('should return input after start if available', async () => {
        await system.start();
        const inputs = system.getInputs();
        if (inputs.length > 0) {
          expect(system.getCurrentInput()).to.not.be.undefined;
        }
      });
    });

    describe('getCurrentOutput', () => {
      it('should return undefined when no output selected', () => {
        expect(system.getCurrentOutput()).to.be.undefined;
      });

      it('should return output after start if available', async () => {
        await system.start();
        const outputs = system.getOutputs();
        if (outputs.length > 0) {
          expect(system.getCurrentOutput()).to.not.be.undefined;
        }
      });
    });

    describe('setInput', () => {
      it('should accept string input name', async () => {
        await system.start();
        const inputs = system.getInputs();
        if (inputs.length > 0) {
          expect(() => system.setInput(inputs[0].name)).to.not.throw();
        }
      });
    });

    describe('setOutput', () => {
      it('should accept string output name', async () => {
        await system.start();
        const outputs = system.getOutputs();
        if (outputs.length > 0) {
          expect(() => system.setOutput(outputs[0].name)).to.not.throw();
        }
      });
    });
  });

  describe('Legacy Midi Class', () => {
    let midi: Midi;

    beforeEach(() => {
      midi = new Midi();
    });

    afterEach(async () => {
      await midi.stop();
    });

    it('should create instance', () => {
      expect(midi).to.exist;
    });

    it('should start and stop', async () => {
      await midi.start();
      await midi.stop();
    });

    it('should get inputs and outputs', () => {
      expect(midi.getInputs()).to.be.an('array');
      expect(midi.getOutputs()).to.be.an('array');
    });

    describe('setInputByName', () => {
      it('should return undefined if input does not exist', async () => {
        await midi.start();
        const result = midi.setInputByName('Nonexistent Input');
        expect(result).to.be.undefined;
      });

      it('should set input if it exists', async () => {
        await midi.start();
        const inputs = midi.getInputs();
        if (inputs.length > 0) {
          const result = midi.setInputByName(inputs[0].name);
          expect(result).to.not.be.undefined;
        }
      });
    });

    describe('setOutputByName', () => {
      it('should return undefined if output does not exist', async () => {
        await midi.start();
        const result = midi.setOutputByName('Nonexistent Output');
        expect(result).to.be.undefined;
      });

      it('should set output if it exists', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          const result = midi.setOutputByName(outputs[0].name);
          expect(result).to.not.be.undefined;
        }
      });
    });

    describe('isCurrentInput', () => {
      it('should return false when no input selected', () => {
        expect(midi.isCurrentInput('Any Input')).to.be.false;
      });

      it('should return true for current input', async () => {
        await midi.start();
        const inputs = midi.getInputs();
        if (inputs.length > 0) {
          midi.setInputByName(inputs[0].name);
          expect(midi.isCurrentInput(inputs[0].name)).to.be.true;
        }
      });

      it('should return false for non-current input', async () => {
        await midi.start();
        expect(midi.isCurrentInput('Wrong Input')).to.be.false;
      });
    });

    describe('isCurrentOutput', () => {
      it('should return false when no output selected', () => {
        expect(midi.isCurrentOutput('Any Output')).to.be.false;
      });

      it('should return true for current output', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          midi.setOutputByName(outputs[0].name);
          expect(midi.isCurrentOutput(outputs[0].name)).to.be.true;
        }
      });

      it('should return false for non-current output', async () => {
        await midi.start();
        expect(midi.isCurrentOutput('Wrong Output')).to.be.false;
      });
    });

    describe('sendSysex', () => {
      it('should throw error when no output selected', () => {
        expect(() => midi.sendSysex(0x47, [0x5E, 0x00])).to.throw(
          'No MIDI output selected'
        );
      });

      it('should not throw when output is available', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          expect(() => midi.sendSysex(0x47, [0x5E, 0x00])).to.not.throw();
        }
      });

      it('should accept array identifier', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          expect(() => midi.sendSysex([0x47, 0x5E], [0x00])).to.not.throw();
        }
      });

      it('should return self for chaining', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          const result = midi.sendSysex(0x47, [0x5E, 0x00]);
          expect(result).to.equal(midi);
        }
      });
    });

    describe('noteOn', () => {
      it('should throw error when no output selected', () => {
        expect(() => midi.noteOn(1, 60, 127)).to.throw(
          'No MIDI output selected'
        );
      });

      it('should accept single channel', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          expect(() => midi.noteOn(1, 60, 127)).to.not.throw();
        }
      });

      it('should accept multiple channels', async () => {
        await midi.start();
        const outputs = midi.getOutputs();
        if (outputs.length > 0) {
          expect(() => midi.noteOn([1, 2, 3], 60, 127)).to.not.throw();
        }
      });
    });
  });

  describe('Listener Management', () => {
    let system: MidiSystem;

    beforeEach(() => {
      system = createMidiSystem();
    });

    afterEach(async () => {
      await system.stop();
    });

    it('should add listeners without error', async () => {
      await system.start();
      const callback = () => {};
      expect(() => system.addListener('sysex', callback)).to.not.throw();
    });

    it('should remove listeners without error', async () => {
      await system.start();
      const callback = () => {};
      system.addListener('sysex', callback);
      expect(() => system.removeListener('sysex', callback)).to.not.throw();
    });

    it('should handle adding listener before start', () => {
      const callback = () => {};
      expect(() => system.addListener('sysex', callback)).to.not.throw();
    });

    it('should persist listeners when changing inputs', async () => {
      await system.start();
      const callback = () => {};
      const inputs = system.getInputs();

      system.addListener('sysex', callback);

      if (inputs.length > 0) {
        system.setInput(inputs[0].name);
        expect(() => system.removeListener('sysex', callback)).to.not.throw();
      }
    });
  });

  describe('Error Handling', () => {
    let system: MidiSystem;

    beforeEach(() => {
      system = createMidiSystem();
    });

    afterEach(async () => {
      await system.stop();
    });

    it('should handle start when no ports available', async () => {
      // Even with no ports, start should not throw
      await system.start();
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

    afterEach(async () => {
      if (system) {
        await system.stop();
      }
    });

    it('should accept debug configuration', async () => {
      system = createMidiSystem();
      await system.start({ debug: true });
    });

    it('should accept sysex configuration', async () => {
      system = createMidiSystem();
      await system.start({ enableSysex: true });
    });

    it('should accept combined configuration', async () => {
      system = createMidiSystem();
      await (
        system.start({ debug: true, enableSysex: true })
      );
    });
  });
});
