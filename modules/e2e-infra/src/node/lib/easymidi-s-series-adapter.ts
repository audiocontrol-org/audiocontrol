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

    /**
     * easymidi splits MIDI byte-send by message kind ('sysex', 'cc',
     * 'noteon', etc.) — the third-party API doesn't accept a raw byte
     * array. The SSeriesMidiAdapter contract speaks only in raw byte
     * arrays. Dispatch by the leading status byte here so callers (the
     * client, the proxy, scenario runners) stay in the byte-array world.
     *
     * Scenarios that emit non-SysEx (the panic-flow scenario emits 32
     * Control Change messages — CC 120 + CC 123 across 16 channels) hit
     * the channel-message branch; the existing SSeriesClient SysEx flow
     * hits the 0xF0 branch.
     */
    const sendTyped = output as unknown as {
        send: (kind: 'sysex', bytes: number[]) => void;
    } & {
        send: (
            kind: 'cc',
            payload: { channel: number; controller: number; value: number },
        ) => void;
    };

    return {
        send(data: number[]): void {
            if (data.length === 0) {
                throw new Error('createEasymidiSSeriesAdapter.send: empty byte array');
            }
            const status = data[0];
            if (status === 0xf0) {
                sendTyped.send('sysex', data);
                return;
            }
            // Channel messages: status nibble in the high 4 bits, channel in
            // the low 4. 0xB0..0xBF == Control Change. The S-series adapter
            // contract only encounters CC today (panic-flow); other channel
            // messages would need their own branch when a scenario needs
            // them. Throwing rather than silently dropping enforces that
            // contract loudly.
            const statusNibble = status & 0xf0;
            const channel = status & 0x0f;
            if (statusNibble === 0xb0) {
                if (data.length !== 3) {
                    throw new Error(
                        `createEasymidiSSeriesAdapter.send: CC frame must be 3 bytes, got ${data.length}`,
                    );
                }
                sendTyped.send('cc', {
                    channel,
                    controller: data[1],
                    value: data[2],
                });
                return;
            }
            throw new Error(
                `createEasymidiSSeriesAdapter.send: unsupported status byte 0x${status
                    .toString(16)
                    .padStart(2, '0')}. Add a dispatch branch above when a scenario needs this message class.`,
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
