/**
 * S-330 Wave Data Benchmark Tool
 *
 * CLI tool to benchmark fetching tone and wave data from S-330.
 * Uses the actual s330-client for all device communication.
 *
 * Run with: npx tsx test/integration/s330-wave-benchmark.ts [toneIndex]
 *
 * Saves output files:
 *   - tone_N_NAME.raw  - Raw 7-bit encoded data from sampler
 *   - tone_N_NAME.wav  - Decoded 16-bit WAV file
 */

import * as easymidi from 'easymidi';
import * as fs from 'fs';
import * as path from 'path';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { S330MidiAdapter } from '@audiocontrol/sampler-devices/s330';

const MIDI_DEVICE = 'Volt 4';

/**
 * Create an easymidi adapter that implements S330MidiAdapter
 */
function createEasyMidiAdapter(
    input: easymidi.Input,
    output: easymidi.Output
): S330MidiAdapter {
    type SysExCallback = (message: number[]) => void;
    const listeners = new Map<SysExCallback, (data: { bytes: number[] }) => void>();

    return {
        send(message: number[]): void {
            output.send('sysex', message as Parameters<typeof output.send>[1]);
        },

        onSysEx(callback: SysExCallback): void {
            const listener = (data: { bytes: number[] }) => {
                if (data.bytes[0] === 0xf0) {
                    callback(data.bytes);
                }
            };
            listeners.set(callback, listener);
            input.on('sysex', listener);
        },

        removeSysExListener(callback: SysExCallback): void {
            const listener = listeners.get(callback);
            if (listener) {
                input.removeListener('sysex', listener);
                listeners.delete(callback);
            }
        },
    };
}

/**
 * Decode 12-bit samples from S-330 SysEx transmission format to 16-bit array
 */
function unpack12BitTo16Bit(transmittedData: Uint8Array): Int16Array {
    const numSamples = Math.floor(transmittedData.length / 2);
    const samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const byte0 = transmittedData[i * 2];     // 0aaa aaaa
        const byte1 = transmittedData[i * 2 + 1]; // 0bbb bb00

        // Decode 12-bit sample: upper 7 bits from byte0, lower 5 bits from byte1
        const sample12bit = (byte0 << 5) | (byte1 >> 2);

        // Sign extend from 12-bit 2's complement
        let signedSample: number;
        if (sample12bit & 0x800) {
            signedSample = sample12bit - 0x1000;
        } else {
            signedSample = sample12bit;
        }

        // Scale to 16-bit range (shift left 4 bits)
        samples[i] = signedSample << 4;
    }

    return samples;
}

/**
 * Create WAV file buffer from 16-bit samples
 */
function createWavBuffer(samples: Int16Array, sampleRate: number): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const buffer = Buffer.alloc(fileSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize - 8, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Sub-chunk size
    buffer.writeUInt16LE(1, 20);  // Audio format (PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write sample data
    for (let i = 0; i < samples.length; i++) {
        buffer.writeInt16LE(samples[i], 44 + i * 2);
    }

    return buffer;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
    return name.trim().replace(/[<>:"/\\|?*\s]/g, '_') || 'sample';
}

/**
 * Hex dump of data with offset
 */
function hexDump(data: Uint8Array | number[], bytesPerLine: number = 16): void {
    const arr = data instanceof Uint8Array ? Array.from(data) : data;
    for (let offset = 0; offset < arr.length; offset += bytesPerLine) {
        const line = arr.slice(offset, offset + bytesPerLine);
        const hexPart = line.map((b) => b.toString(16).padStart(2, '0')).join(' ');
        const asciiPart = line
            .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
            .join('');
        const offsetStr = offset.toString(16).padStart(6, '0');
        console.log(`  ${offsetStr}  ${hexPart.padEnd(bytesPerLine * 3 - 1)}  ${asciiPart}`);
    }
}

// =============================================================================
// Main Benchmark
// =============================================================================

async function main() {
    console.log('=== S-330 Wave Data Benchmark ===\n');

    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    const inputName = inputs.find((n) => n.includes(MIDI_DEVICE));
    const outputName = outputs.find((n) => n.includes(MIDI_DEVICE));

    if (!inputName || !outputName) {
        console.error(`ERROR: ${MIDI_DEVICE} not found`);
        console.log('Available inputs:', inputs);
        console.log('Available outputs:', outputs);
        process.exit(1);
    }

    console.log(`Using: ${inputName} / ${outputName}\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);
    const midiAdapter = createEasyMidiAdapter(input, output);

    // Create S330 client using the actual client code
    const client = createS330Client(midiAdapter, { deviceId: 0 });
    await client.connect();

    // Parse command line arguments
    const args = process.argv.slice(2);
    const toneIndex = args.length > 0 ? parseInt(args[0], 10) : 0;

    console.log(`Testing with Tone ${toneIndex}\n`);

    // ==========================================================================
    // Test 1: Fetch Tone Data
    // ==========================================================================
    console.log('=== TEST 1: Fetch Tone Data ===');

    const toneStart = performance.now();
    const tone = await client.requestToneData(toneIndex);
    const toneEnd = performance.now();
    const toneDuration = toneEnd - toneStart;

    if (!tone) {
        console.log('  FAIL: Could not fetch tone data\n');
        input.close();
        output.close();
        process.exit(1);
    }

    console.log(`  Duration: ${toneDuration.toFixed(2)}ms`);
    console.log('\n  Tone Parameters:');
    console.log(`    Name: "${tone.name}"`);
    console.log(`    Sample Rate: ${tone.sampleRate}`);
    console.log(`    Original Key: ${tone.originalKey} (MIDI note)`);
    console.log(`    Bank: ${tone.wave.bank === 0 ? 'A' : 'B'}`);
    console.log(`    Segment Top: ${tone.wave.segmentTop}`);
    console.log(`    Segment Length: ${tone.wave.segmentLength}`);
    console.log(`    Start Point: 0x${tone.wave.startPoint.toString(16).padStart(6, '0')} (${tone.wave.startPoint})`);
    console.log(`    End Point: 0x${tone.wave.endPoint.toString(16).padStart(6, '0')} (${tone.wave.endPoint})`);
    console.log(`    Loop Point: 0x${tone.wave.loopPoint.toString(16).padStart(6, '0')} (${tone.wave.loopPoint})`);
    console.log(`    Loop Length: ${tone.wave.loopLength}`);
    console.log(`    Loop Mode: ${tone.loopMode}`);

    // Calculate sample count
    const sampleCount = tone.wave.endPoint - tone.wave.startPoint;
    console.log(`\n    Calculated sample count: ${sampleCount}`);
    console.log(`    Duration at ${tone.sampleRate}: ${(sampleCount / (tone.sampleRate === '15kHz' ? 15000 : 30000)).toFixed(2)}s`);

    console.log('  PASS\n');

    // Wait between tests
    await new Promise((r) => setTimeout(r, 200));

    // ==========================================================================
    // Test 2: Fetch Wave Data
    // ==========================================================================
    console.log('=== TEST 2: Fetch Wave Data ===');

    const waveStart = performance.now();
    let lastProgress = 0;

    try {
        const waveResponse = await client.requestWaveData(toneIndex, (received, total) => {
            const pct = Math.floor((received / total) * 100);
            if (pct >= lastProgress + 10) {
                console.log(`  Progress: ${pct}% (${received}/${total} bytes)`);
                lastProgress = pct;
            }
        });

        const waveEnd = performance.now();
        const waveDuration = waveEnd - waveStart;

        console.log(`\n  Duration: ${waveDuration.toFixed(2)}ms`);
        console.log(`  Data size: ${waveResponse.data.length} bytes`);
        console.log(`  Transfer rate: ${((waveResponse.data.length / waveDuration) * 1000).toFixed(0)} bytes/sec`);
        console.log(`  Sample rate: ${waveResponse.sampleRate} Hz`);
        console.log(`  Loop mode: ${waveResponse.loopMode}`);

        // Hex dump first 128 bytes
        console.log('\n  First 128 bytes (hex dump):');
        hexDump(waveResponse.data.slice(0, 128));

        // Analyze the data format
        console.log('\n  Data Analysis:');
        const data = waveResponse.data;

        // Check byte value distribution
        let min = 255, max = 0;
        for (let i = 0; i < Math.min(1000, data.length); i++) {
            if (data[i] < min) min = data[i];
            if (data[i] > max) max = data[i];
        }
        console.log(`    Byte range (first 1000): ${min} - ${max}`);
        console.log(`    All values < 128 (valid 7-bit): ${max < 128 ? 'YES' : 'NO'}`);

        // Try decoding as 7-bit encoded 12-bit samples
        // Format: 2 bytes per sample, sample = (b0 << 5) | (b1 >> 2)
        console.log('\n  Interpreting as 7-bit encoded 12-bit samples (2 bytes/sample):');
        const samples: number[] = [];
        for (let i = 0; i < Math.min(32, data.length - 1); i += 2) {
            const b0 = data[i];
            const b1 = data[i + 1];
            let sample = (b0 << 5) | (b1 >> 2);
            // Sign extend from 12-bit
            if (sample & 0x800) sample -= 0x1000;
            samples.push(sample);
        }
        console.log(`    First 16 samples: ${samples.join(', ')}`);

        // Save raw data file
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const safeName = sanitizeFilename(tone.name);
        const rawFilename = path.join(outputDir, `tone_${toneIndex}_${safeName}.raw`);
        const wavFilename = path.join(outputDir, `tone_${toneIndex}_${safeName}.wav`);

        // Write raw 7-bit encoded data
        fs.writeFileSync(rawFilename, Buffer.from(waveResponse.data));
        console.log(`\n  Saved raw data: ${rawFilename}`);
        console.log(`    Size: ${waveResponse.data.length} bytes`);

        // Decode and write WAV file
        const samples16bit = unpack12BitTo16Bit(waveResponse.data);
        const wavBuffer = createWavBuffer(samples16bit, waveResponse.sampleRate);
        fs.writeFileSync(wavFilename, wavBuffer);
        console.log(`  Saved WAV file: ${wavFilename}`);
        console.log(`    Samples: ${samples16bit.length}`);
        console.log(`    Duration: ${(samples16bit.length / waveResponse.sampleRate).toFixed(3)}s`);

        console.log('  PASS\n');
    } catch (err) {
        console.log(`  FAIL: ${err}\n`);
    }

    // ==========================================================================
    // Summary
    // ==========================================================================
    console.log('=== Summary ===');
    console.log(`Tone "${tone.name}":`);
    console.log(`  Sample Rate: ${tone.sampleRate}`);
    console.log(`  Sample Count: ${sampleCount}`);
    console.log(`  Loop Mode: ${tone.loopMode}`);

    console.log('\n=== Done ===');
    input.close();
    output.close();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
