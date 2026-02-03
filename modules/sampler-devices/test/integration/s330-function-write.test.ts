/**
 * Quick test to verify function parameter writes still work
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createS330Client, createEasymidiAdapter, findMidiPort, type S330Client } from '@audiocontrol/sampler-midi';

const MIDI_DEVICE_NAME = 'Volt 4';
let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

describe('Function Parameter Write Test', () => {
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

    it('should write and read back function parameters', async () => {
        await client!.connect();
        
        // Read current value
        const funcParams = await client!.requestFunctionParameters();
        const originalLevel = funcParams[0].level;
        console.log('Current Multi Level A:', originalLevel);
        
        // Write new value
        const newLevel = originalLevel > 64 ? 32 : 96;
        console.log('Writing Multi Level A:', newLevel);
        await client!.setMultiLevel(0, newLevel);
        
        // Read back
        const funcParams2 = await client!.requestFunctionParameters();
        console.log('Readback Multi Level A:', funcParams2[0].level);
        expect(funcParams2[0].level).toBe(newLevel);
        
        // Restore
        await client!.setMultiLevel(0, originalLevel);
        console.log('Restored to:', originalLevel);
    });
});
