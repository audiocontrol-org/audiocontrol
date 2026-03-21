import { describe, it, expect } from 'vitest';
import { clampWaveParams } from '@/devices/roland-s-series/s-series-wave-format';

function makeWave(overrides: Partial<{
  startPoint: number;
  endPoint: number;
  loopPoint: number;
  loopLength: number;
}> = {}) {
  return {
    bank: 0,
    segmentTop: 0,
    segmentLength: 0,
    startPoint: 0,
    endPoint: 0,
    loopPoint: 0,
    loopLength: 0,
    ...overrides,
  };
}

describe('clampWaveParams', () => {
  it('defaults endPoint to sampleCount - 1 when unset (0)', () => {
    const result = clampWaveParams(makeWave(), 1000);
    expect(result.endPoint).toBe(999);
  });

  it('preserves explicit endPoint smaller than sampleCount', () => {
    const result = clampWaveParams(makeWave({ endPoint: 500 }), 1000);
    expect(result.endPoint).toBe(500);
  });

  it('clamps endPoint to sampleCount - 1 when larger', () => {
    const result = clampWaveParams(makeWave({ endPoint: 2000 }), 1000);
    expect(result.endPoint).toBe(999);
  });

  it('preserves startPoint', () => {
    const result = clampWaveParams(makeWave({ startPoint: 100 }), 1000);
    expect(result.startPoint).toBe(100);
  });

  it('clamps startPoint to endPoint', () => {
    const result = clampWaveParams(makeWave({ startPoint: 600, endPoint: 500 }), 1000);
    expect(result.startPoint).toBe(500);
  });

  it('preserves loopPoint within bounds', () => {
    const result = clampWaveParams(makeWave({ loopPoint: 200, endPoint: 500 }), 1000);
    expect(result.loopPoint).toBe(200);
  });

  it('clamps loopPoint to endPoint', () => {
    const result = clampWaveParams(makeWave({ loopPoint: 800, endPoint: 500 }), 1000);
    expect(result.loopPoint).toBe(500);
  });

  it('recalculates loopLength from endPoint and loopPoint', () => {
    const result = clampWaveParams(makeWave({ loopPoint: 200, endPoint: 500 }), 1000);
    expect(result.loopLength).toBe(300);
  });

  it('preserves all three points in a typical loop scenario', () => {
    const result = clampWaveParams(
      makeWave({ startPoint: 0, loopPoint: 1024, endPoint: 4096 }),
      8000,
    );
    expect(result.startPoint).toBe(0);
    expect(result.loopPoint).toBe(1024);
    expect(result.endPoint).toBe(4096);
    expect(result.loopLength).toBe(3072);
  });
});
