/**
 * Verify that writes actually persist to the S-330
 */
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@oletizi/sampler-midi';

const MIDI_DEVICE_NAME = 'Volt 4';
let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

describe('S-330 Write Verification', () => {
    beforeAll(() => {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME)!;
        const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME)!;
        input = new easymidi.Input(inputPort);
        output = new easymidi.Output(outputPort);
        const midiIO = createEasymidiAdapter(input, output);
        client = createS330Client(midiIO, { deviceId: 0, timeoutMs: 5000 });
    });

    afterAll(() => {
        client?.disconnect();
        input?.close();
        output?.close();
    });

    it('should verify function parameter write persists', async () => {
        await client!.connect();

        // Read current Multi Level A
        const funcParams = await client!.requestFunctionParameters();
        const originalLevel = funcParams[0].level;
        console.log(`Original Multi Level A: ${originalLevel}`);

        // Write a different value
        const newLevel = originalLevel > 64 ? 32 : 96;
        console.log(`Writing Multi Level A: ${newLevel}`);
        await client!.setMultiLevel(0, newLevel);

        // Read back
        const funcParams2 = await client!.requestFunctionParameters();
        const readbackLevel = funcParams2[0].level;
        console.log(`Readback Multi Level A: ${readbackLevel}`);

        // Verify
        expect(readbackLevel).toBe(newLevel);

        // Restore
        await client!.setMultiLevel(0, originalLevel);
        console.log(`Restored to: ${originalLevel}`);
    });

    it('should verify patch level write persists', async () => {
        await client!.connect();

        // Read current patch data
        const patch = await client!.requestPatchData(0);
        if (!patch) throw new Error('Failed to read patch');

        const originalLevel = patch.common.level;
        console.log(`Original Patch 0 Level: ${originalLevel}`);

        // Write a different value
        const newLevel = originalLevel > 64 ? 32 : 96;
        console.log(`Writing Patch 0 Level: ${newLevel}`);
        await client!.setPatchLevel(0, newLevel);

        // Read back
        const patch2 = await client!.requestPatchData(0);
        if (!patch2) throw new Error('Failed to read patch after write');

        const readbackLevel = patch2.common.level;
        console.log(`Readback Patch 0 Level: ${readbackLevel}`);

        // Verify
        expect(readbackLevel).toBe(newLevel);

        // Restore
        await client!.setPatchLevel(0, originalLevel);
        console.log(`Restored to: ${originalLevel}`);
    });

    it('should test direct read at level address', async () => {
        await client!.connect();

        // Read 8 bytes directly from level address [00 00 03 5a]
        // This tests if the address mapping is correct

        const midiAdapter = (client as any).midiAdapter || (input && output ? createEasymidiAdapter(input, output) : null);
        if (!midiAdapter) throw new Error('No MIDI adapter');

        // Read using RQD directly
        const ROLAND_ID = 0x41;
        const S330_MODEL_ID = 0x1E;
        const address = [0x00, 0x00, 0x03, 0x5a];
        const sizeInNibbles = 16; // 8 bytes
        const size = [0x00, 0x00, 0x00, 0x10];

        const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
        const checksum = (128 - (sum & 0x7f)) % 128;

        const rqdMessage = [
            0xf0, ROLAND_ID, 0, S330_MODEL_ID, 0x41,
            ...address, ...size, checksum, 0xf7
        ];

        const result = await new Promise<number[]>((resolve, reject) => {
            const timeout = setTimeout(() => {
                midiAdapter.removeSysExListener(listener);
                reject(new Error('RQD timeout'));
            }, 3000);

            const allNibbles: number[] = [];

            function listener(response: number[]) {
                if (response.length < 5) return;
                if (response[1] !== ROLAND_ID) return;
                if (response[4] === 0x42) { // DAT
                    const nibbles = response.slice(9, -2);
                    allNibbles.push(...nibbles);
                    // Send ACK
                    midiAdapter.send([0xf0, ROLAND_ID, 0, S330_MODEL_ID, 0x43, 0xf7]);
                } else if (response[4] === 0x45) { // EOD
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    midiAdapter.send([0xf0, ROLAND_ID, 0, S330_MODEL_ID, 0x43, 0xf7]);
                    // Denibblize
                    const bytes: number[] = [];
                    for (let i = 0; i < allNibbles.length - 1; i += 2) {
                        bytes.push(((allNibbles[i] & 0x0f) << 4) | (allNibbles[i + 1] & 0x0f));
                    }
                    resolve(bytes);
                } else if (response[4] === 0x4f) { // RJC
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error('RQD rejected'));
                }
            }

            midiAdapter.onSysEx(listener);
            console.log(`Sending RQD to address [${address.map(b => b.toString(16).padStart(2,'0')).join(' ')}]`);
            midiAdapter.send(rqdMessage);
        });

        console.log(`Direct read at [00 00 03 5a]: [${result.map(b => b.toString(16).padStart(2,'0')).join(' ')}]`);
        console.log(`First byte (should be level): ${result[0]}`);
    });
});
