/**
 * Roland S-550 Address Probe
 *
 * Probes different addresses to discover the S-550's actual memory map.
 * Sends RQD to candidate addresses and reports which ones respond with data.
 *
 * ## Running
 * ```bash
 * MIDI_DEVICE_NAME="828mk3" pnpm --filter @audiocontrol/sampler-devices test:hardware:s550:probe
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createEasymidiAdapter, findMidiPort } from '@audiocontrol/sampler-midi';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3';
const DEVICE_ID = 0;

const ROLAND_ID = 0x41;
const MODEL_ID = 0x1E;

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let adapter: ReturnType<typeof createEasymidiAdapter> | null = null;

function hexDump(bytes: number[]): string {
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function commandName(byte: number): string {
    const names: Record<number, string> = {
        0x40: 'WSD', 0x41: 'RQD', 0x42: 'DAT', 0x43: 'ACK',
        0x45: 'EOD', 0x4E: 'ERR', 0x4F: 'RJC',
    };
    return names[byte] ?? `0x${byte.toString(16)}`;
}

function checksum(address: number[], data: number[]): number {
    let sum = 0;
    for (const b of address) sum += b;
    for (const b of data) sum += b;
    return (128 - (sum % 128)) % 128;
}

function buildRQD(address: number[], sizeInNibbles: number): number[] {
    const size = [
        (sizeInNibbles >> 21) & 0x7f,
        (sizeInNibbles >> 14) & 0x7f,
        (sizeInNibbles >> 7) & 0x7f,
        sizeInNibbles & 0x7f,
    ];
    const cs = checksum(address, size);
    return [0xf0, ROLAND_ID, DEVICE_ID, MODEL_ID, 0x41, ...address, ...size, cs, 0xf7];
}

/**
 * Send RQD and collect first response (with ACK handshake for DAT packets)
 */
function probeAddress(address: number[], sizeInNibbles: number): Promise<{ command: number; dataLength: number; firstBytes: number[] }> {
    return new Promise((resolve) => {
        const rqd = buildRQD(address, sizeInNibbles);
        let totalNibbles = 0;
        let firstBytes: number[] = [];

        const timeout = setTimeout(() => {
            adapter!.removeSysExListener(listener);
            resolve({ command: -1, dataLength: 0, firstBytes: [] }); // timeout = no response
        }, 3000);

        function listener(response: number[]) {
            if (
                response.length >= 5 &&
                response[1] === ROLAND_ID &&
                response[2] === DEVICE_ID &&
                response[3] === MODEL_ID
            ) {
                const cmd = response[4];

                if (cmd === 0x42) { // DAT
                    const dataStart = 5;
                    const dataEnd = response.length - 2;
                    const nibbles = response.slice(dataStart, dataEnd);
                    totalNibbles += nibbles.length;

                    if (firstBytes.length === 0) {
                        firstBytes = nibbles.slice(0, 24);
                    }

                    // Send ACK
                    adapter!.send([0xf0, ROLAND_ID, DEVICE_ID, MODEL_ID, 0x43, 0xf7]);
                } else if (cmd === 0x45) { // EOD (real value)
                    clearTimeout(timeout);
                    adapter!.removeSysExListener(listener);
                    // Send ACK for EOD
                    adapter!.send([0xf0, ROLAND_ID, DEVICE_ID, MODEL_ID, 0x43, 0xf7]);
                    resolve({ command: 0x45, dataLength: totalNibbles, firstBytes });
                } else {
                    // RJC (0x4F) or ERR (0x4E)
                    clearTimeout(timeout);
                    adapter!.removeSysExListener(listener);
                    resolve({ command: cmd, dataLength: 0, firstBytes: [] });
                }
            }
        }

        adapter!.onSysEx(listener);
        adapter!.send(rqd);
    });
}

describe('S-550 Address Probe', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(() => {
        if (shouldSkip) return;

        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

        if (!inputPort || !outputPort) {
            throw new Error(`MIDI device "${MIDI_DEVICE_NAME}" not found`);
        }

        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        adapter = createEasymidiAdapter(input, output);
    });

    afterAll(() => {
        input?.close();
        output?.close();
    });

    it('should probe for patch locations', { skip: shouldSkip, timeout: 120000 }, async () => {
        // Probe byte 1 values 0x00-0x07 with byte 2 = 0 to find where patches live
        // Patch size = 512 bytes = 1024 nibbles
        const patchNibbles = 1024;

        console.log('\n  === Probing for patch base address (1024 nibbles) ===\n');

        const candidates = [
            [0x00, 0x00, 0x00, 0x00],  // S-330 patch base
            [0x00, 0x01, 0x00, 0x00],  // Function params on S-330
            [0x00, 0x02, 0x00, 0x00],  // Possible patch area
            [0x00, 0x03, 0x00, 0x00],  // Tone base (should work - confirmed)
            [0x00, 0x04, 0x00, 0x00],
            [0x00, 0x05, 0x00, 0x00],
            [0x00, 0x06, 0x00, 0x00],
            [0x00, 0x07, 0x00, 0x00],
            [0x02, 0x00, 0x00, 0x00],  // Beyond standard range
            [0x03, 0x00, 0x00, 0x00],
        ];

        for (const addr of candidates) {
            const result = await probeAddress(addr, patchNibbles);
            const status = result.command === 0x45
                ? `DATA (${result.dataLength} nibbles)`
                : result.command === 0x4F
                    ? 'RJC (rejected)'
                    : result.command === 0x4E
                        ? 'ERR'
                        : result.command === -1
                            ? 'TIMEOUT'
                            : `cmd=0x${result.command.toString(16)}`;

            console.log(`  [${hexDump(addr)}] ${status}`);

            if (result.dataLength > 0) {
                console.log(`    First nibbles: ${hexDump(result.firstBytes)}`);
            }

            // Small delay between probes
            await new Promise(r => setTimeout(r, 200));
        }
    });

    it('should probe tone addresses at different indices', { skip: shouldSkip, timeout: 60000 }, async () => {
        // Confirm tone base and test boundary indices
        const toneNibbles = 512; // 256 bytes

        console.log('\n  === Probing tone addresses (512 nibbles) ===\n');

        const toneAddresses = [
            { label: 'Tone 0',  addr: [0x00, 0x03, 0x00, 0x00] },
            { label: 'Tone 1',  addr: [0x00, 0x03, 0x02, 0x00] },
            { label: 'Tone 31', addr: [0x00, 0x03, 0x3E, 0x00] },
            { label: 'Tone 32', addr: [0x00, 0x03, 0x40, 0x00] },
            { label: 'Tone 63', addr: [0x00, 0x03, 0x7E, 0x00] },
            { label: 'Tone 64 (OOB)', addr: [0x00, 0x04, 0x00, 0x00] },
        ];

        for (const { label, addr } of toneAddresses) {
            const result = await probeAddress(addr, toneNibbles);
            const status = result.command === 0x45
                ? `DATA (${result.dataLength} nibbles)`
                : result.command === 0x4F
                    ? 'RJC'
                    : result.command === -1
                        ? 'TIMEOUT'
                        : `cmd=${commandName(result.command)}`;

            console.log(`  ${label.padEnd(16)} [${hexDump(addr)}] ${status}`);
            await new Promise(r => setTimeout(r, 200));
        }
    });

    it('should sweep byte1 with small reads to map the full address space', { skip: shouldSkip, timeout: 120000 }, async () => {
        // Read 2 nibbles (1 byte) at each byte1 value to find valid regions
        const smallSize = 2;

        console.log('\n  === Sweeping byte1 values 0x00-0x0F (2 nibbles) ===\n');

        for (let byte1 = 0; byte1 <= 0x0f; byte1++) {
            const addr = [0x00, byte1, 0x00, 0x00];
            const result = await probeAddress(addr, smallSize);
            const status = result.command === 0x45
                ? 'DATA'
                : result.command === 0x4F
                    ? 'RJC'
                    : result.command === -1
                        ? 'TIMEOUT'
                        : `cmd=${commandName(result.command)}`;

            console.log(`  byte1=0x${byte1.toString(16).padStart(2, '0')} [${hexDump(addr)}] ${status}`);
            await new Promise(r => setTimeout(r, 200));
        }
    });
});
