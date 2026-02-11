/**
 * EasyMIDI Adapter for Roland D-110 Client
 *
 * Adapts easymidi Input/Output to the D110MidiIO interface for Node.js testing.
 */

import type { D110MidiIO, SysExCallback } from '@/core/midi/types';
import type * as easymidi from 'easymidi';

/**
 * Create a D110MidiIO adapter from easymidi Input/Output
 *
 * @param input - easymidi Input instance
 * @param output - easymidi Output instance
 * @returns D110MidiIO interface
 *
 * @example
 * ```typescript
 * import * as easymidi from 'easymidi';
 * import { createEasymidiAdapter } from './EasymidiAdapter';
 * import { createD110Client } from './D110Client';
 *
 * const input = new easymidi.Input('Virtual D-110', true);
 * const output = new easymidi.Output('Virtual D-110', true);
 * const midiIO = createEasymidiAdapter(input, output);
 * const client = createD110Client(midiIO);
 * ```
 */
export function createEasymidiAdapter(
  input: easymidi.Input,
  output: easymidi.Output
): D110MidiIO {
  // Map our callbacks to easymidi listeners
  const callbackMap = new Map<SysExCallback, (msg: { bytes: number[] }) => void>();

  return {
    send(message: number[]): void {
      // easymidi expects the raw byte array for sysex (not wrapped in object)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output.send('sysex', message as any);
    },

    onSysEx(callback: SysExCallback): void {
      const listener = (msg: { bytes: number[] }) => {
        callback(msg.bytes);
      };
      callbackMap.set(callback, listener);
      input.on('sysex', listener);
    },

    removeSysExListener(callback: SysExCallback): void {
      const listener = callbackMap.get(callback);
      if (listener) {
        input.removeListener('sysex', listener);
        callbackMap.delete(callback);
      }
    },
  };
}

/**
 * Find a MIDI port by name pattern
 *
 * @param ports - Array of port names
 * @param pattern - String or RegExp to match
 * @returns Matching port name or undefined
 */
export function findMidiPort(ports: string[], pattern: string | RegExp): string | undefined {
  for (const port of ports) {
    if (typeof pattern === 'string') {
      if (port.includes(pattern)) {
        return port;
      }
    } else {
      if (pattern.test(port)) {
        return port;
      }
    }
  }
  return undefined;
}
