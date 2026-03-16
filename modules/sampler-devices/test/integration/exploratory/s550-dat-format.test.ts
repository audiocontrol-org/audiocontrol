/**
 * S-550 DAT Packet Format Analysis
 *
 * Analyzes the exact byte layout of DAT responses to determine
 * if there's an address header and what its structure is.
 *
 * ## Running
 * ```bash
 * MIDI_DEVICE_NAME="828mk3" pnpm --filter @audiocontrol/sampler-devices test:hardware:s550:dat
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

function hexDump(bytes: number[], perLine = 32): string {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += perLine) {
        const hex = bytes.slice(i, i + perLine).map(b => b.toString(16).padStart(2, '0')).join(' ');
        lines.push(`    ${i.toString().padStart(4)}: ${hex}`);
    }
    return lines.join('\n');
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

interface DATPacket {
    /** Raw payload between command byte and checksum (bytes 5 to len-2) */
    payload: number[];
    /** Full raw message */
    raw: number[];
}

/**
 * Send RQD, collect all DAT packets with proper ACK handshake, return packet payloads
 */
function requestData(address: number[], sizeInNibbles: number): Promise<DATPacket[]> {
    return new Promise((resolve, reject) => {
        const rqd = buildRQD(address, sizeInNibbles);
        const packets: DATPacket[] = [];

        const timeout = setTimeout(() => {
            adapter!.removeSysExListener(listener);
            if (packets.length > 0) resolve(packets);
            else reject(new Error('Timeout'));
        }, 5000);

        function listener(response: number[]) {
            if (
                response.length >= 5 &&
                response[1] === ROLAND_ID &&
                response[2] === DEVICE_ID &&
                response[3] === MODEL_ID
            ) {
                const cmd = response[4];

                if (cmd === 0x42) { // DAT
                    const payload = response.slice(5, response.length - 2);
                    packets.push({ payload, raw: [...response] });
                    // Send ACK
                    adapter!.send([0xf0, ROLAND_ID, DEVICE_ID, MODEL_ID, 0x43, 0xf7]);
                } else if (cmd === 0x45) { // EOD
                    clearTimeout(timeout);
                    adapter!.removeSysExListener(listener);
                    adapter!.send([0xf0, ROLAND_ID, DEVICE_ID, MODEL_ID, 0x43, 0xf7]);
                    resolve(packets);
                } else if (cmd === 0x4F) { // RJC
                    clearTimeout(timeout);
                    adapter!.removeSysExListener(listener);
                    reject(new Error('RJC'));
                }
            }
        }

        adapter!.onSysEx(listener);
        adapter!.send(rqd);
    });
}

describe('S-550 DAT Format', () => {
    const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

    beforeAll(() => {
        if (shouldSkip) return;
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);
        if (!inputPort || !outputPort) throw new Error(`MIDI device not found`);
        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        adapter = createEasymidiAdapter(input, output);
    });

    afterAll(() => {
        input?.close();
        output?.close();
    });

    it('should analyze DAT packets for tone 0 request', { skip: shouldSkip, timeout: 10000 }, async () => {
        const address = [0x00, 0x03, 0x00, 0x00];
        const sizeNibbles = 512; // 256 bytes

        console.log(`\n  Requesting tone 0 at [${address.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}], size=${sizeNibbles} nibbles`);

        const packets = await requestData(address, sizeNibbles);

        console.log(`\n  Received ${packets.length} DAT packet(s):`);

        let totalPayload = 0;
        for (let i = 0; i < packets.length; i++) {
            const p = packets[i];
            console.log(`\n  Packet ${i}: ${p.payload.length} payload bytes (raw msg: ${p.raw.length} bytes)`);
            console.log(`  First 64 payload bytes:`);
            console.log(hexDump(p.payload.slice(0, 64)));
            totalPayload += p.payload.length;
        }

        console.log(`\n  Total payload: ${totalPayload} bytes`);
        console.log(`  Expected: ${sizeNibbles} nibbles`);
        console.log(`  Difference: ${totalPayload - sizeNibbles} bytes`);

        // Check if first 4 bytes of first packet match the requested address
        if (packets.length > 0) {
            const first4 = packets[0].payload.slice(0, 4);
            console.log(`\n  First 4 payload bytes: [${first4.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
            console.log(`  Requested address:     [${address.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
            console.log(`  Match: ${JSON.stringify(first4) === JSON.stringify(address)}`);
        }
    });

    it('should analyze DAT packets for patch 0 request', { skip: shouldSkip, timeout: 10000 }, async () => {
        const address = [0x00, 0x00, 0x00, 0x00];
        const sizeNibbles = 1024; // 512 bytes

        console.log(`\n  Requesting patch 0 at [${address.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}], size=${sizeNibbles} nibbles`);

        const packets = await requestData(address, sizeNibbles);

        console.log(`\n  Received ${packets.length} DAT packet(s):`);

        let totalPayload = 0;
        for (let i = 0; i < packets.length; i++) {
            const p = packets[i];
            console.log(`\n  Packet ${i}: ${p.payload.length} payload bytes (raw msg: ${p.raw.length} bytes)`);
            console.log(`  First 64 payload bytes:`);
            console.log(hexDump(p.payload.slice(0, 64)));
            totalPayload += p.payload.length;
        }

        console.log(`\n  Total payload: ${totalPayload} bytes`);
        console.log(`  Expected: ${sizeNibbles} nibbles`);
        console.log(`  Difference: ${totalPayload - sizeNibbles} bytes`);

        if (packets.length > 0) {
            const first4 = packets[0].payload.slice(0, 4);
            console.log(`\n  First 4 payload bytes: [${first4.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
            console.log(`  Requested address:     [${address.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`);
            console.log(`  Match: ${JSON.stringify(first4) === JSON.stringify(address)}`);
        }

        // Try to find the patch name in the data
        // If no address header: name at nibble offset 0 -> bytes 0-11 after denibblize
        // If 4-byte address header: name at nibble offset 8 -> bytes 4-15 after denibblize
        if (packets.length > 0) {
            const allPayload = packets.flatMap(p => p.payload);

            // De-nibblize starting at offset 0
            console.log('\n  De-nibblized from offset 0 (first 16 bytes):');
            const bytes0: number[] = [];
            for (let i = 0; i < 32 && i < allPayload.length - 1; i += 2) {
                bytes0.push(((allPayload[i] & 0x0f) << 4) | (allPayload[i + 1] & 0x0f));
            }
            const chars0 = bytes0.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
            console.log(`    Hex: ${bytes0.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`    Str: "${chars0}"`);

            // De-nibblize starting at offset 8 (skip 4-byte address header)
            console.log('\n  De-nibblized from offset 8 (first 16 bytes):');
            const bytes8: number[] = [];
            for (let i = 8; i < 40 && i < allPayload.length - 1; i += 2) {
                bytes8.push(((allPayload[i] & 0x0f) << 4) | (allPayload[i + 1] & 0x0f));
            }
            const chars8 = bytes8.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('');
            console.log(`    Hex: ${bytes8.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`    Str: "${chars8}"`);
        }
    });
});
