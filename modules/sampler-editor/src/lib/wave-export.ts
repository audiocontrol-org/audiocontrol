/**
 * Wave Export Utilities
 *
 * Converts S-330 wave data to standard audio formats.
 *
 * ## S-330 Wave Data Format
 *
 * The S-330 stores 12-bit linear PCM samples at 15kHz or 30kHz.
 * When transmitted via SysEx, each 12-bit sample is encoded as 2 MIDI-safe bytes:
 *
 * - Byte 0: `0aaa aaaa` - upper 7 bits of the 12-bit sample
 * - Byte 1: `0bbb bb00` - lower 5 bits, left-shifted by 2
 *
 * The combined 12 bits form a 2's complement signed value (-2048 to +2047).
 *
 * This encoding is different from parameter data which uses nibblization.
 * See docs/1.0/s330-sysex-protocol.md for full protocol details.
 */

import type { S330WaveDataResponse } from '@/core/midi/S330Client';

/**
 * Decode 12-bit samples from S-330 SysEx transmission format to 16-bit array
 *
 * S-330 transmits 12-bit samples as 2 MIDI-safe bytes per sample:
 * - Byte 0: 0aaa aaaa (upper 7 bits of 12-bit sample)
 * - Byte 1: 0bbb bb00 (lower 5 bits of 12-bit sample, left-shifted by 2)
 *
 * Combined: sample = (byte0 << 5) | (byte1 >> 2)
 *
 * The 12-bit 2's complement samples are converted to 16-bit by left-shifting 4 bits.
 */
export function unpack12BitTo16Bit(transmittedData: Uint8Array): Int16Array {
    // Each sample is 2 bytes in transmission format
    const numSamples = Math.floor(transmittedData.length / 2);
    const samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
        const byte0 = transmittedData[i * 2];     // 0aaa aaaa
        const byte1 = transmittedData[i * 2 + 1]; // 0bbb bb00

        // Decode 12-bit sample from 2 bytes
        // Upper 7 bits from byte0, lower 5 bits from byte1 (shifted right by 2)
        const sample12bit = (byte0 << 5) | (byte1 >> 2);

        // Sign extend from 12-bit 2's complement to signed integer
        // If bit 11 is set (value >= 2048), it's negative
        let signedSample: number;
        if (sample12bit & 0x800) {
            signedSample = sample12bit - 0x1000; // Convert to negative
        } else {
            signedSample = sample12bit;
        }

        // Scale to 16-bit range (shift left 4 bits)
        samples[i] = signedSample << 4;
    }

    return samples;
}

/**
 * Create a WAV file blob from S-330 wave data
 *
 * @param waveData - S-330 wave data response with packed 12-bit samples
 * @returns Blob containing a valid WAV file
 */
export function createWavBlob(waveData: S330WaveDataResponse): Blob {
    const samples = unpack12BitTo16Bit(waveData.data);
    return createWavBlobFromSamples(samples, waveData.sampleRate);
}

/**
 * Create a WAV file blob from 16-bit samples
 *
 * @param samples - Int16Array of samples
 * @param sampleRate - Sample rate in Hz (e.g., 15000 or 30000)
 * @param numChannels - Number of channels (default: 1 for mono)
 * @returns Blob containing a valid WAV file
 */
export function createWavBlobFromSamples(
    samples: Int16Array,
    sampleRate: number,
    numChannels: number = 1
): Blob {
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize - 8, true); // File size minus RIFF header
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write sample data
    const dataOffset = 44;
    for (let i = 0; i < samples.length; i++) {
        view.setInt16(dataOffset + i * 2, samples[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Helper to write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

/**
 * Trigger a file download in the browser
 *
 * @param blob - File blob to download
 * @param filename - Suggested filename for download
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export S-330 wave data as a WAV file download
 *
 * @param waveData - S-330 wave data response
 * @param toneName - Name of the tone (used for filename)
 */
export function exportWaveAsWav(waveData: S330WaveDataResponse, toneName: string): void {
    const blob = createWavBlob(waveData);

    // Sanitize filename - remove invalid characters
    const sanitizedName = toneName.trim().replace(/[<>:"/\\|?*]/g, '_') || 'sample';
    const filename = `${sanitizedName}.wav`;

    downloadBlob(blob, filename);
}

/**
 * Calculate duration of wave data in seconds
 */
export function getWaveDuration(waveData: S330WaveDataResponse): number {
    const sampleCount = waveData.endPoint - waveData.startPoint;
    return sampleCount / waveData.sampleRate;
}

/**
 * Format wave data info as human-readable string
 */
export function formatWaveInfo(waveData: S330WaveDataResponse): string {
    const sampleCount = waveData.endPoint - waveData.startPoint;
    const durationMs = (sampleCount / waveData.sampleRate) * 1000;
    const dataBytes = waveData.data.length;

    return [
        `Samples: ${sampleCount.toLocaleString()}`,
        `Duration: ${durationMs.toFixed(1)}ms`,
        `Sample Rate: ${waveData.sampleRate === 30000 ? '30kHz' : '15kHz'}`,
        `Loop Mode: ${waveData.loopMode}`,
        `Data Size: ${(dataBytes / 1024).toFixed(1)}KB`,
    ].join(' | ');
}
