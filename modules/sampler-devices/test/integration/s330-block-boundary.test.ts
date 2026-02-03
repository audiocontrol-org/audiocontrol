/**
 * Test to find working 8-byte block boundaries for patch writes
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@audiocontrol/sampler-midi';

const MIDI_DEVICE_NAME = 'Volt 4';
let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

async function testWsdWrite(
    midiAdapter: any,
    address: number[],
    size: number,
    deviceId: number
): Promise<string> {
    const ROLAND_ID = 0x41;
    const S330_MODEL_ID = 0x1E;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            midiAdapter.removeSysExListener(listener);
            resolve('timeout');
        }, 500);

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
            else resolve(`0x${command.toString(16)}`);
        }

        midiAdapter.onSysEx(listener);

        const sizeInNibbles = size * 2;
        const sizeBytes = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];

        const sum = address.reduce((a, b) => a + b, 0) + sizeBytes.reduce((a, b) => a + b, 0);
        const checksum = (128 - (sum & 0x7f)) % 128;

        const wsdMessage = [
            0xf0, ROLAND_ID, deviceId, S330_MODEL_ID, 0x40,
            ...address, ...sizeBytes, checksum, 0xf7
        ];

        midiAdapter.send(wsdMessage);
    });
}

describe('S-330 Block Boundary Test', () => {
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

    it('should find 8-byte block boundaries near level parameter', async () => {
        await client!.connect();

        // Level is at address [0x03, 0x5a]
        // Let's test 8-byte writes at aligned boundaries around this area
        // 8 bytes = 16 nibbles, so boundaries are at multiples of 0x10 (16)

        console.log('\n8-byte writes at different offsets in high-byte 0x03 region:');
        const highByte = 0x03;

        // Test aligned boundaries (multiples of 0x10 = 16 nibbles = 8 bytes)
        for (let lowByte = 0x40; lowByte <= 0x70; lowByte += 0x10) {
            const addr = [0x00, 0x00, highByte, lowByte];
            const result = await testWsdWrite(midiAdapter, addr, 8, 0);
            console.log(`  addr=[${addr.map(b => b.toString(16).padStart(2,'0')).join(' ')}]: ${result}`);
        }

        // Test specific boundaries around level (0x5a)
        console.log('\n8-byte writes around level address (0x5a):');
        for (const lowByte of [0x50, 0x58, 0x5a, 0x60]) {
            const addr = [0x00, 0x00, highByte, lowByte];
            const result = await testWsdWrite(midiAdapter, addr, 8, 0);
            console.log(`  addr=[${addr.map(b => b.toString(16).padStart(2,'0')).join(' ')}]: ${result}`);
        }

        // Test in the low region (0x00-0x30)
        console.log('\n8-byte writes in early patch region:');
        for (let lowByte = 0x00; lowByte <= 0x30; lowByte += 0x10) {
            const addr = [0x00, 0x00, 0x00, lowByte];
            const result = await testWsdWrite(midiAdapter, addr, 8, 0);
            console.log(`  addr=[${addr.map(b => b.toString(16).padStart(2,'0')).join(' ')}]: ${result}`);
        }
    });

    it('should compare 2-byte vs 8-byte at same address', async () => {
        // Test if 8-byte writes work where 2-byte writes fail
        console.log('\n2-byte vs 8-byte comparison at addresses that rejected 2 bytes:');

        const failingAddresses = [
            { name: 'benderRange', addr: [0x00, 0x00, 0x00, 0x18] },
            { name: 'keyMode', addr: [0x00, 0x00, 0x00, 0x1e] },
            { name: 'octaveShift', addr: [0x00, 0x00, 0x03, 0x58] },
            { name: 'level', addr: [0x00, 0x00, 0x03, 0x5a] },
        ];

        for (const { name, addr } of failingAddresses) {
            const result2 = await testWsdWrite(midiAdapter, addr, 2, 0);
            const result8 = await testWsdWrite(midiAdapter, addr, 8, 0);
            console.log(`  ${name.padEnd(15)} addr=[${addr.map(b => b.toString(16).padStart(2,'0')).join(' ')}]: 2B=${result2}, 8B=${result8}`);
        }
    });
});
