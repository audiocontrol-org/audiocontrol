import { describe, it, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import { createEasymidiAdapter, findMidiPort } from '@audiocontrol/sampler-midi';
import { createS550Client, type S550ClientInterface } from '@audiocontrol/sampler-devices/s550';

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || '828mk3';

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S550ClientInterface | null = null;

describe('S-550 Tone Dump', () => {
    beforeAll(async () => {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();
        input = new easymidi.Input(findMidiPort(inputs, MIDI_DEVICE_NAME)!);
        output = new easymidi.Output(findMidiPort(outputs, MIDI_DEVICE_NAME)!);
        client = createS550Client(createEasymidiAdapter(input, output), { deviceId: 0, timeoutMs: 5000 });
        await client.connect();
    });

    afterAll(() => { input?.close(); output?.close(); });

    it('dump wave params for non-empty tones', { timeout: 60000 }, async () => {
        for (let i = 0; i < 15; i++) {
            try {
                const t = await client!.requestToneData(i);
                if (t && t.name.trim()) {
                    console.log(`  T${i + 11} [${i}]: "${t.name}" sub=${t.origSubTone} src=${t.sourceTone} bank=${t.wave.bank} segTop=${t.wave.segmentTop} segLen=${t.wave.segmentLength} end=${t.wave.endPoint}`);
                }
            } catch (e: any) {
                console.log(`  T${i + 11} [${i}]: ERROR ${e.message}`);
            }
        }
    });
});
