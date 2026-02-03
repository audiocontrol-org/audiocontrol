/**
 * EasyMIDI Adapter for Roland S-330 Client
 *
 * Adapts easymidi Input/Output to the S330MidiIO interface.
 */

import type { S330MidiIO } from './client-roland-s330.js';
import type * as easymidi from 'easymidi';

type SysExCallback = (message: number[]) => void;

/**
 * Create an S330MidiIO adapter from easymidi Input/Output
 *
 * @param input - easymidi Input instance
 * @param output - easymidi Output instance
 * @returns S330MidiIO interface
 *
 * @example
 * ```typescript
 * import * as easymidi from 'easymidi';
 * import { createEasymidiAdapter } from './s330-easymidi-adapter.js';
 * import { createS330Client } from './client-roland-s330.js';
 *
 * const input = new easymidi.Input('Volt 4');
 * const output = new easymidi.Output('Volt 4');
 * const midiIO = createEasymidiAdapter(input, output);
 * const client = createS330Client(midiIO);
 * ```
 */
export function createEasymidiAdapter(
    input: easymidi.Input,
    output: easymidi.Output
): S330MidiIO {
    // Map our callbacks to easymidi listeners
    const callbackMap = new Map<SysExCallback, (msg: { bytes: number[] }) => void>();

    return {
        send(message: number[]): void {
            // easymidi expects the byte array directly for sysex
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
