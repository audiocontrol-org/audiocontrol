/**
 * Test to find working WSD write size for patch parameters
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@oletizi/sampler-midi';
import { PATCH_PARAMS, buildPatchParamAddress } from '@oletizi/sampler-devices/s330';

const MIDI_DEVICE_NAME = 'Volt 4';
let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

// Access the internal sendData via a workaround - we'll manually send WSD
async function testWsdWrite(
    midiAdapter: any,
    address: number[],
    data: number[],
    deviceId: number
): Promise<string> {
    const ROLAND_ID = 0x41;
    const S330_MODEL_ID = 0x1E;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            midiAdapter.removeSysExListener(listener);
            resolve('timeout');
        }, 2000);

        function listener(response: number[]) {
            if (response.length < 5) return;
            if (response[1] !== ROLAND_ID) return;
            if (response[2] !== deviceId) return;
            if (response[3] !== S330_MODEL_ID) return;

            const command = response[4];
            clearTimeout(timeout);
            midiAdapter.removeSysExListener(listener);

            if (command === 0x43) resolve('ACK');
            else if (command === 0x4F) resolve('RJC');
            else if (command === 0x4E) resolve('ERR');
            else resolve(`unknown:0x${command.toString(16)}`);
        }

        midiAdapter.onSysEx(listener);

        // Build WSD message with size in nibbles
        const sizeInNibbles = data.length * 2;
        const size = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];

        // Calculate checksum
        const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
        const checksum = (128 - (sum & 0x7f)) % 128;

        const wsdMessage = [
            0xf0, ROLAND_ID, deviceId, S330_MODEL_ID, 0x40,
            ...address, ...size, checksum, 0xf7
        ];

        console.log(`  WSD: addr=[${address.map(b => b.toString(16).padStart(2,'0')).join(' ')}] size=${data.length}B (${sizeInNibbles} nibbles)`);
        midiAdapter.send(wsdMessage);
    });
}

describe('WSD Write Size Test', () => {
    let midiAdapter: any;

    beforeAll(() => {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME)!;
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME)!;
        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        midiAdapter = createEasymidiAdapter(input, output);
        client = createS330Client(midiAdapter, { deviceId: 0, timeoutMs: 5000 });
    });

    afterAll(() => {
        client?.disconnect();
        input?.close();
        output?.close();
    });

    it('should test various WSD sizes for patch bank', async () => {
        await client!.connect();

        // Test different sizes at patch bank 00 00
        const testCases = [
            { size: 2, desc: '2 bytes' },
            { size: 4, desc: '4 bytes' },
            { size: 8, desc: '8 bytes (like function params)' },
            { size: 16, desc: '16 bytes' },
            { size: 32, desc: '32 bytes' },
            { size: 64, desc: '64 bytes' },
            { size: 128, desc: '128 bytes' },
            { size: 256, desc: '256 bytes (MAX_PACKET_SIZE)' },
        ];

        for (const tc of testCases) {
            const data = new Array(tc.size).fill(0);
            const result = await testWsdWrite(midiAdapter, [0x00, 0x00, 0x00, 0x00], data, 0);
            console.log(`  ${tc.desc}: ${result}`);
        }
    });

    it('should test WSD at function bank for comparison', async () => {
        // Test at function bank 00 01 (we know 8 bytes works)
        const testCases = [
            { size: 2, desc: '2 bytes' },
            { size: 8, desc: '8 bytes' },
        ];

        for (const tc of testCases) {
            const data = new Array(tc.size).fill(0);
            const result = await testWsdWrite(midiAdapter, [0x00, 0x01, 0x00, 0x22], data, 0);
            console.log(`  Function bank ${tc.desc}: ${result}`);
        }
    });
});
