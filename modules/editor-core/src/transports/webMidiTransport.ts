import {
  createWebMidiAdapter,
  getBrowserCompatibility,
  isWebMidiSupported,
  requestMidiAccess,
} from '@audiocontrol/midi-core';
import type { MidiPortInfo } from '@audiocontrol/midi-core';
import type { MidiTransport, MidiTransportConnection, MidiTransportPorts } from './types';

function getInputById(inputs: MIDIInputMap, targetId: string): MIDIInput | null {
  let result: MIDIInput | null = null;
  inputs.forEach((input) => {
    if (input.id === targetId) result = input;
  });
  return result;
}

function getOutputById(outputs: MIDIOutputMap, targetId: string): MIDIOutput | null {
  let result: MIDIOutput | null = null;
  outputs.forEach((output) => {
    if (output.id === targetId) result = output;
  });
  return result;
}

function toPortInfo(port: MIDIInput | MIDIOutput): MidiPortInfo {
  const namePrefix = port.type === 'input' ? 'Input' : 'Output';
  return {
    id: port.id,
    name: port.name ?? `${namePrefix} ${port.id}`,
    ...(port.manufacturer ? { manufacturer: port.manufacturer } : {}),
    state: port.state,
  };
}

export function createWebMidiTransport(): MidiTransport {
  let midiAccess: MIDIAccess | null = null;

  const ensureAccess = async (): Promise<MIDIAccess> => {
    if (midiAccess) return midiAccess;
    midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    return midiAccess;
  };

  const listPortsFromAccess = (access: MIDIAccess): MidiTransportPorts => {
    const inputs: MidiPortInfo[] = [];
    const outputs: MidiPortInfo[] = [];
    access.inputs.forEach((port) => inputs.push(toPortInfo(port)));
    access.outputs.forEach((port) => outputs.push(toPortInfo(port)));
    return { inputs, outputs, sysExEnabled: access.sysexEnabled };
  };

  return {
    kind: 'web-midi',
    isSupported: () => isWebMidiSupported(),
    getBrowserInfo: () => getBrowserCompatibility(),
    initialize: async () => {
      // Keep using the shared helper for browser-permission behavior parity.
      const accessSummary = await requestMidiAccess();
      const access = await ensureAccess();
      return {
        inputs: accessSummary.inputs,
        outputs: accessSummary.outputs,
        sysExEnabled: accessSummary.sysExEnabled ?? access.sysexEnabled,
      };
    },
    refresh: async () => {
      const access = await ensureAccess();
      return listPortsFromAccess(access);
    },
    onStateChange: (handler) => {
      if (!midiAccess) return;
      midiAccess.onstatechange = handler ? () => handler() : null;
    },
    connect: async (inputId: string, outputId: string): Promise<MidiTransportConnection> => {
      const access = await ensureAccess();
      const input = getInputById(access.inputs, inputId);
      const output = getOutputById(access.outputs, outputId);
      if (!input) throw new Error(`Input port not found: ${inputId}`);
      if (!output) throw new Error(`Output port not found: ${outputId}`);

      await input.open();
      await output.open();

      return {
        adapter: createWebMidiAdapter(input, output),
        inputInfo: toPortInfo(input),
        outputInfo: toPortInfo(output),
        nativeInput: input,
        nativeOutput: output,
        disconnect: async () => {
          await input.close();
          await output.close();
        },
      };
    },
    getNativeAccess: () => midiAccess,
  };
}
