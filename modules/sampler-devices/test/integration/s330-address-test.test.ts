/**
 * Test which specific addresses accept WSD writes
 */
import { describe, it, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@audiocontrol/sampler-midi';
import { PATCH_PARAMS, buildPatchParamAddress } from '@audiocontrol/sampler-devices/s330';

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
        }, 1000);

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

describe('S-330 Address WSD Test', () => {
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

    it('should test WSD at specific parameter addresses', async () => {
        await client!.connect();

        const params = [
            { name: 'name', param: PATCH_PARAMS.name },
            { name: 'benderRange', param: PATCH_PARAMS.benderRange },
            { name: 'aftertouchSens', param: PATCH_PARAMS.aftertouchSens },
            { name: 'keyMode', param: PATCH_PARAMS.keyMode },
            { name: 'velocityThreshold', param: PATCH_PARAMS.velocityThreshold },
            { name: 'level', param: PATCH_PARAMS.level },
            { name: 'outputAssign', param: PATCH_PARAMS.outputAssign },
            { name: 'octaveShift', param: PATCH_PARAMS.octaveShift },
            { name: 'detune', param: PATCH_PARAMS.detune },
        ];

        console.log('\nTesting WSD at parameter addresses (2 bytes each):');
        for (const p of params) {
            const addr = buildPatchParamAddress(0, p.param);
            const result = await testWsdWrite(midiAdapter, addr, 2, 0);
            console.log(`  ${p.name.padEnd(20)} addr=[${addr.map(b => b.toString(16).padStart(2,'0')).join(' ')}]: ${result}`);
        }

        console.log('\nTesting base patch address with different sizes:');
        const baseAddr = [0x00, 0x00, 0x00, 0x00];
        for (const size of [2, 8, 12, 32]) {
            const result = await testWsdWrite(midiAdapter, baseAddr, size, 0);
            console.log(`  base addr, ${size} bytes: ${result}`);
        }
    });
});
