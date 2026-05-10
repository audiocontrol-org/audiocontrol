/**
 * Easymidi-backed adapter for Roland S-series clients.
 *
 * Implements `SSeriesMidiAdapter` over Node's `easymidi` library so the
 * S-330 / S-550 client (and the recording proxy that wraps it) can drive
 * a real Roland device from a CLI script.
 *
 * Mirrors the d110-editor `EasymidiAdapter` pattern.
 */

import type * as easymidi from 'easymidi';
import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';

/**
 * Build an `SSeriesMidiAdapter` from easymidi Input + Output ports.
 */
export function createEasymidiSSeriesAdapter(
    input: easymidi.Input,
    output: easymidi.Output,
): SSeriesMidiAdapter {
    const callbackMap = new Map<
        (data: number[]) => void,
        (msg: { bytes: number[] }) => void
    >();

    return {
        send(data: number[]): void {
            // easymidi accepts the raw byte array for sysex.
            // The cast keeps the call site honest about the third-party signature shape.
            (output as unknown as { send: (kind: 'sysex', bytes: number[]) => void }).send(
                'sysex',
                data,
            );
        },

        onSysEx(callback: (data: number[]) => void): void {
            const listener = (msg: { bytes: number[] }): void => {
                callback(msg.bytes);
            };
            callbackMap.set(callback, listener);
            input.on('sysex', listener);
        },

        removeSysExListener(callback: (data: number[]) => void): void {
            const listener = callbackMap.get(callback);
            if (listener) {
                input.removeListener('sysex', listener);
                callbackMap.delete(callback);
            }
        },
    };
}

/**
 * Find a MIDI port name matching a string (substring) or regular expression.
 * Returns undefined if no port matches.
 */
export function findMidiPort(
    ports: string[],
    pattern: string | RegExp,
): string | undefined {
    for (const port of ports) {
        if (typeof pattern === 'string') {
            if (port.includes(pattern)) return port;
        } else if (pattern.test(port)) {
            return port;
        }
    }
    return undefined;
}
