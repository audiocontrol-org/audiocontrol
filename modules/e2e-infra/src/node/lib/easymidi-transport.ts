/**
 * Node-side `MidiTransport` over the easymidi library.
 *
 * Lets `probeForRolandDevice` (and any other transport-agnostic
 * code in editor-core) run from a tsx CLI without a browser. This
 * is the test surface that proves the probe is decoupled from
 * the Web MIDI / React frontend — if the algorithm only worked in
 * the browser, you couldn't construct one of these.
 */

import * as easymidi from 'easymidi';
import type { MidiIO, MidiPortInfo } from '@audiocontrol/midi-core';
import type {
  MidiTransport,
  MidiTransportConnection,
  MidiTransportPorts,
} from '@audiocontrol/editor-core/transports';

type SysExCallback = (msg: number[]) => void;

function createMidiIO(input: easymidi.Input, output: easymidi.Output): MidiIO {
  const callbackMap = new Map<SysExCallback, (msg: { bytes: number[] }) => void>();
  const sendTyped = output as unknown as {
    send: (kind: 'sysex', bytes: number[]) => void;
  };

  return {
    send(data: number[]): void {
      if (data.length === 0) return;
      // The probe only sends SysEx (F0 .. F7). Other status bytes
      // aren't part of the contract — fail loud if we ever get one.
      if (data[0] !== 0xf0) {
        throw new Error(
          `easymidi-transport: unsupported leading status 0x${data[0].toString(16)}; probe expects SysEx only`,
        );
      }
      sendTyped.send('sysex', data);
    },
    onSysEx(cb: SysExCallback): void {
      const wrapped = (msg: { bytes: number[] }) => cb(msg.bytes);
      callbackMap.set(cb, wrapped);
      input.on('sysex', wrapped);
    },
    removeSysExListener(cb: SysExCallback): void {
      const wrapped = callbackMap.get(cb);
      if (!wrapped) return;
      input.removeListener('sysex', wrapped);
      callbackMap.delete(cb);
    },
  };
}

function listPorts(): MidiTransportPorts {
  const inputs: MidiPortInfo[] = easymidi.getInputs().map((name) => ({
    id: name,
    name,
    manufacturer: '',
    sysExEnabled: true,
  }));
  const outputs: MidiPortInfo[] = easymidi.getOutputs().map((name) => ({
    id: name,
    name,
    manufacturer: '',
    sysExEnabled: true,
  }));
  return { inputs, outputs, sysExEnabled: true };
}

export function createEasymidiTransport(): MidiTransport {
  return {
    kind: 'easymidi',
    isSupported: () => true,
    getBrowserInfo: () => ({ supported: true, browser: 'node-easymidi', notes: '' }),
    initialize: async (): Promise<MidiTransportPorts> => listPorts(),
    refresh: async (): Promise<MidiTransportPorts> => listPorts(),
    onStateChange: () => { /* easymidi doesn't expose state changes; OS-level hotplug not handled here */ },
    connect: async (inputId: string, outputId: string): Promise<MidiTransportConnection> => {
      const input = new easymidi.Input(inputId);
      const output = new easymidi.Output(outputId);
      const adapter = createMidiIO(input, output);
      return {
        adapter,
        inputInfo: { id: inputId, name: inputId, manufacturer: '', sysExEnabled: true },
        outputInfo: { id: outputId, name: outputId, manufacturer: '', sysExEnabled: true },
        nativeInput: null,
        nativeOutput: null,
        disconnect: async (): Promise<void> => {
          try { input.close(); } catch { /* best-effort */ }
          try { output.close(); } catch { /* best-effort */ }
        },
      };
    },
  };
}
