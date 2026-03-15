/**
 * Roland S-550 Ping Test
 *
 * Minimal integration test to verify basic SysEx communication with the S-550.
 * Sends a raw RQD for a small data block and logs the exact bytes received.
 *
 * ## Running
 * ```bash
 * MIDI_DEVICE_NAME="828mk3" pnpm --filter @audiocontrol/sampler-devices test:hardware:s550:ping
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createEasymidiAdapter, findMidiPort } from '@audiocontrol/sampler-midi';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3';
const DEVICE_ID = 0;
const TIMEOUT_MS = 5000;

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
        0x11: 'RQ1', 0x12: 'DT1',
        0x40: 'WSD', 0x41: 'RQD', 0x42: 'DAT', 0x43: 'ACK',
        0x44: '???', 0x45: 'EOD', 0x46: '???',
        0x4E: 'ERR', 0x4F: 'RJC',
    };
    return names[byte] ?? `0x${byte.toString(16)}`;
}

/**
 * Calculate Roland checksum over address + data bytes
 */
function checksum(address: number[], data: number[]): number {
    let sum = 0;
    for (const b of address) sum += b;
    for (const b of data) sum += b;
    return (128 - (sum % 128)) % 128;
}

/**
 * Send a raw SysEx message and collect ALL responses until timeout
 */
function sendAndCollectResponses(message: number[], timeoutMs: number): Promise<number[][]> {
    return new Promise((resolve) => {
        const responses: number[][] = [];

        const timeout = setTimeout(() => {
            adapter!.removeSysExListener(listener);
            resolve(responses);
        }, timeoutMs);

        function listener(response: number[]) {
            // Only collect responses from our device
            if (
                response.length >= 5 &&
                response[1] === ROLAND_ID &&
                response[2] === DEVICE_ID &&
                response[3] === MODEL_ID
            ) {
                responses.push([...response]);
            }
        }

        adapter!.onSysEx(listener);
        adapter!.send(message);
    });
}

/**
 * Build an RQD message for the given address and size (in nibbles)
 */
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

describe('S-550 Ping', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(() => {
        if (shouldSkip) return;

        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();

        console.log('MIDI inputs:', inputs);
        console.log('MIDI outputs:', outputs);

        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

        if (!inputPort || !outputPort) {
            throw new Error(`MIDI device "${MIDI_DEVICE_NAME}" not found`);
        }

        console.log(`Using: ${inputPort} / ${outputPort}`);
        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        adapter = createEasymidiAdapter(input, output);
    });

    afterAll(() => {
        input?.close();
        output?.close();
    });

    it('should get a response to RQD for tone 0 (addr 00 03 00 00, 512 nibbles)', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
        // Request tone 0: address [00, 03, 00, 00], size = 256 bytes = 512 nibbles
        const address = [0x00, 0x03, 0x00, 0x00];
        const sizeNibbles = 512;
        const rqd = buildRQD(address, sizeNibbles);

        console.log(`\n  TX RQD: ${hexDump(rqd)}`);
        console.log(`    Address: ${hexDump(address)} Size: ${sizeNibbles} nibbles (${sizeNibbles / 2} bytes)`);

        const responses = await sendAndCollectResponses(rqd, 3000);

        console.log(`\n  Received ${responses.length} response(s):`);
        for (let i = 0; i < responses.length; i++) {
            const r = responses[i];
            const cmd = r[4];
            console.log(`  RX[${i}] cmd=${commandName(cmd)} len=${r.length}: ${hexDump(r.slice(0, 20))}${r.length > 20 ? '...' : ''}`);
        }

        expect(responses.length).toBeGreaterThan(0);

        // Log what command bytes we actually received
        const cmdBytes = responses.map(r => r[4]);
        console.log(`\n  Command byte sequence: ${cmdBytes.map(commandName).join(' -> ')}`);
        console.log(`  Raw command bytes: ${cmdBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}`);
    });

    it('should get a response to RQD for patch 0 (addr 00 00 00 00, 1024 nibbles)', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
        // Request patch 0: address [00, 00, 00, 00], size = 512 bytes = 1024 nibbles
        const address = [0x00, 0x00, 0x00, 0x00];
        const sizeNibbles = 1024;
        const rqd = buildRQD(address, sizeNibbles);

        console.log(`\n  TX RQD: ${hexDump(rqd)}`);
        console.log(`    Address: ${hexDump(address)} Size: ${sizeNibbles} nibbles (${sizeNibbles / 2} bytes)`);

        const responses = await sendAndCollectResponses(rqd, 3000);

        console.log(`\n  Received ${responses.length} response(s):`);
        for (let i = 0; i < responses.length; i++) {
            const r = responses[i];
            const cmd = r[4];
            console.log(`  RX[${i}] cmd=${commandName(cmd)} len=${r.length}: ${hexDump(r.slice(0, 20))}${r.length > 20 ? '...' : ''}`);
        }

        expect(responses.length).toBeGreaterThan(0);

        const cmdBytes = responses.map(r => r[4]);
        console.log(`\n  Command byte sequence: ${cmdBytes.map(commandName).join(' -> ')}`);
        console.log(`  Raw command bytes: ${cmdBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}`);
    });

    it('should observe actual EOD/RJC byte values', { skip: shouldSkip, timeout: TIMEOUT_MS + 2000 }, async () => {
        // Request an obviously invalid address to provoke a rejection
        const address = [0x7f, 0x7f, 0x7f, 0x00];
        const sizeNibbles = 2;
        const rqd = buildRQD(address, sizeNibbles);

        console.log(`\n  TX RQD (invalid address): ${hexDump(rqd)}`);

        const responses = await sendAndCollectResponses(rqd, 3000);

        console.log(`\n  Received ${responses.length} response(s):`);
        for (const r of responses) {
            const cmd = r[4];
            console.log(`  RX cmd=${commandName(cmd)} (0x${cmd.toString(16)}): ${hexDump(r)}`);
        }

        if (responses.length > 0) {
            const cmd = responses[0][4];
            console.log(`\n  Device rejection byte: 0x${cmd.toString(16)} (${commandName(cmd)})`);
            console.log('  Expected: RJC=0x4F per Roland spec');
        } else {
            console.log('\n  No response (device may ignore invalid addresses silently)');
        }
    });
});
