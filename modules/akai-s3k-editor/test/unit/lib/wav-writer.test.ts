import { describe, it, expect } from 'vitest';
import { buildWavFile } from '@/lib/wav-writer';

describe('buildWavFile', () => {
  it('produces a valid 44-byte header for empty samples', () => {
    const samples = new Int16Array(0);
    const buffer = buildWavFile(samples, 44100);

    expect(buffer.byteLength).toBe(44);

    const view = new DataView(buffer);
    // RIFF header
    expect(getString(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36); // fileSize - 8
    expect(getString(view, 8, 4)).toBe('WAVE');

    // fmt chunk
    expect(getString(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16); // subchunk size
    expect(view.getUint16(20, true)).toBe(1); // PCM format
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint32(28, true)).toBe(88200); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample

    // data chunk
    expect(getString(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(0); // data size
  });

  it('writes sample data in little-endian Int16 format', () => {
    const samples = new Int16Array([0, 32767, -32768, -1, 1234]);
    const buffer = buildWavFile(samples, 22050);

    expect(buffer.byteLength).toBe(44 + 10);

    const view = new DataView(buffer);
    // Verify data size in header
    expect(view.getUint32(40, true)).toBe(10);

    // Verify sample rate in header
    expect(view.getUint32(24, true)).toBe(22050);

    // Verify each sample value
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
    expect(view.getInt16(50, true)).toBe(-1);
    expect(view.getInt16(52, true)).toBe(1234);
  });

  it('computes correct file size for non-trivial data', () => {
    const samples = new Int16Array(1000);
    const buffer = buildWavFile(samples, 48000);

    expect(buffer.byteLength).toBe(44 + 2000);

    const view = new DataView(buffer);
    expect(view.getUint32(4, true)).toBe(44 + 2000 - 8); // RIFF chunk size
    expect(view.getUint32(40, true)).toBe(2000); // data chunk size
  });

  it('computes correct byte rate for given sample rate', () => {
    const buffer = buildWavFile(new Int16Array(0), 96000);
    const view = new DataView(buffer);

    expect(view.getUint32(24, true)).toBe(96000); // sample rate
    expect(view.getUint32(28, true)).toBe(192000); // byte rate = 96000 * 1 * 2
  });
});

function getString(view: DataView, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(view.getUint8(offset + i));
  }
  return str;
}
