/**
 * Test direct WSD writes with full DAT/EOD sequence
 *
 * This tests if the S-330 accepts WSD → ACK → DAT → EOD sequence
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@oletizi/sampler-midi';

const MIDI_DEVICE_NAME = 'Volt 4';
let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1E;
const DEVICE_ID = 0;

function calculateChecksum(address: number[], data: number[]): number {
    const sum = address.reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0);
    return (128 - (sum & 0x7f)) % 128;
}

function nibblize(bytes: number[]): number[] {
    const nibbles: number[] = [];
    for (const byte of bytes) {
        nibbles.push((byte >> 4) & 0x0f);
        nibbles.push(byte & 0x0f);
    }
    return nibbles;
}

async function fullWsdWrite(
    midiAdapter: any,
    address: number[],
    data: number[]
): Promise<string> {
    return new Promise((resolve) => {
        let phase: 'WSD' | 'DAT' | 'DONE' = 'WSD';

        const timeout = setTimeout(() => {
            midiAdapter.removeSysExListener(listener);
            resolve(`timeout in phase ${phase}`);
        }, 2000);

        function listener(response: number[]) {
            if (response.length < 5) return;
            if (response[1] !== ROLAND_ID) return;
            if (response[2] !== DEVICE_ID) return;
            if (response[3] !== S330_MODEL_ID) return;

            const command = response[4];
            console.log(`    Received: ${command.toString(16)} in phase ${phase}`);

            if (phase === 'WSD') {
                if (command === 0x43) { // ACK
                    phase = 'DAT';

                    // Send DAT with nibblized data
                    const nibblized = nibblize(data);
                    const datChecksum = calculateChecksum(address, nibblized);
                    const datMessage = [
                        0xf0, ROLAND_ID, DEVICE_ID, S330_MODEL_ID, 0x42, // DAT
                        ...address, ...nibblized, datChecksum, 0xf7
                    ];
                    console.log(`    Sending DAT: ${datMessage.map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
                    midiAdapter.send(datMessage);

                    // Send EOD after small delay
                    setTimeout(() => {
                        const eodMessage = [
                            0xf0, ROLAND_ID, DEVICE_ID, S330_MODEL_ID, 0x45, // EOD
                            0xf7
                        ];
                        console.log(`    Sending EOD`);
                        midiAdapter.send(eodMessage);
                        phase = 'DONE';

                        // Wait for final response or timeout
                        setTimeout(() => {
                            clearTimeout(timeout);
                            midiAdapter.removeSysExListener(listener);
                            resolve('completed');
                        }, 200);
                    }, 100);
                } else if (command === 0x4f) { // RJC
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    resolve('WSD-RJC');
                } else if (command === 0x4e) { // ERR
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    resolve('WSD-ERR');
                }
            } else if (phase === 'DONE') {
                if (command === 0x43) {
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    resolve('ACK-after-EOD');
                } else if (command === 0x4f) {
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    resolve('RJC-after-EOD');
                }
            }
        }

        midiAdapter.onSysEx(listener);

        // Build WSD message
        const sizeInNibbles = data.length * 2;
        const size = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];
        const wsdChecksum = calculateChecksum(address, size);
        const wsdMessage = [
            0xf0, ROLAND_ID, DEVICE_ID, S330_MODEL_ID, 0x40, // WSD
            ...address, ...size, wsdChecksum, 0xf7
        ];

        console.log(`  WSD: addr=[${address.map(b => b.toString(16).padStart(2,'0')).join(' ')}] size=${data.length}B`);
        console.log(`    Sending WSD: ${wsdMessage.map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
        midiAdapter.send(wsdMessage);
    });
}

describe('S-330 Direct Write Test', () => {
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

    it('should write 8 bytes directly to level address without prior read', async () => {
        await client!.connect();

        console.log('\nDirect 8-byte write to level address [00 00 03 5a]:');
        const address = [0x00, 0x00, 0x03, 0x5a];
        const data = [100, 0, 0, 0, 0, 0, 0, 0]; // 8 bytes, first byte = level

        const result = await fullWsdWrite(midiAdapter, address, data);
        console.log(`  Result: ${result}`);
    });

    it('should compare writes to function bank vs patch bank', async () => {
        console.log('\n8-byte write to function bank [00 01 00 56] (level):');
        const funcAddress = [0x00, 0x01, 0x00, 0x56];
        const funcData = [100, 100, 100, 100, 100, 100, 100, 100]; // All 8 part levels
        const funcResult = await fullWsdWrite(midiAdapter, funcAddress, funcData);
        console.log(`  Function bank result: ${funcResult}`);

        // Add delay between writes
        await new Promise(r => setTimeout(r, 500));

        console.log('\n8-byte write to patch bank [00 00 03 5a] (level):');
        const patchAddress = [0x00, 0x00, 0x03, 0x5a];
        const patchData = [100, 0, 0, 0, 0, 0, 0, 0];
        const patchResult = await fullWsdWrite(midiAdapter, patchAddress, patchData);
        console.log(`  Patch bank result: ${patchResult}`);
    });

    it('should try writing at patch base address [00 00 00 00]', async () => {
        console.log('\n8-byte write to patch base [00 00 00 00]:');
        const address = [0x00, 0x00, 0x00, 0x00];
        const data = [0x52, 0x4f, 0x4c, 0x41, 0x4e, 0x44, 0x20, 0x20]; // "ROLAND  "
        const result = await fullWsdWrite(midiAdapter, address, data);
        console.log(`  Result: ${result}`);
    });
});
