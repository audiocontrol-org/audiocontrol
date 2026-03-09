/**
 * Manual slicer unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  sliceByManualRegions,
  createRegionsFromBoundaries,
  createRegionsFromTempo,
} from '@/sample-chopper/manual-slicer.js';

describe('sliceByManualRegions', () => {
  it('should extract specified regions', () => {
    const samples = new Int16Array(1000);
    for (let i = 0; i < 1000; i++) {
      samples[i] = i;
    }

    const result = sliceByManualRegions(samples, 1000, {
      method: 'manual',
      regions: [
        { start: 0, end: 250 },
        { start: 250, end: 500 },
        { start: 500, end: 750 },
        { start: 750, end: 1000 },
      ],
    });

    expect(result.slices).toHaveLength(4);
    expect(result.sampleRate).toBe(1000);
    expect(result.totalDurationMs).toBe(1000);

    // Each slice should have 250 samples
    for (const slice of result.slices) {
      expect(slice.durationMs).toBe(250);
      expect(slice.samples.length).toBe(250);
    }
  });

  it('should preserve region names', () => {
    const samples = new Int16Array(1000);

    const result = sliceByManualRegions(samples, 1000, {
      method: 'manual',
      regions: [
        { start: 0, end: 250, name: 'kick' },
        { start: 250, end: 500, name: 'snare' },
        { start: 500, end: 750, name: 'hhc' },
        { start: 750, end: 1000, name: 'hho' },
      ],
    });

    expect(result.slices[0]?.name).toBe('kick');
    expect(result.slices[1]?.name).toBe('snare');
    expect(result.slices[2]?.name).toBe('hhc');
    expect(result.slices[3]?.name).toBe('hho');
  });

  it('should sort regions by start time', () => {
    const samples = new Int16Array(1000);

    const result = sliceByManualRegions(samples, 1000, {
      method: 'manual',
      regions: [
        { start: 500, end: 750, name: 'third' },
        { start: 0, end: 250, name: 'first' },
        { start: 250, end: 500, name: 'second' },
      ],
    });

    expect(result.slices[0]?.name).toBe('first');
    expect(result.slices[1]?.name).toBe('second');
    expect(result.slices[2]?.name).toBe('third');
  });

  it('should throw for empty regions array', () => {
    const samples = new Int16Array(1000);

    expect(() =>
      sliceByManualRegions(samples, 1000, {
        method: 'manual',
        regions: [],
      })
    ).toThrow(/at least one region/);
  });

  it('should throw for invalid region bounds', () => {
    const samples = new Int16Array(1000);

    // Negative start
    expect(() =>
      sliceByManualRegions(samples, 1000, {
        method: 'manual',
        regions: [{ start: -10, end: 100 }],
      })
    ).toThrow(/cannot be negative/);

    // End before start
    expect(() =>
      sliceByManualRegions(samples, 1000, {
        method: 'manual',
        regions: [{ start: 100, end: 50 }],
      })
    ).toThrow(/must be greater than start/);

    // Start beyond audio duration
    expect(() =>
      sliceByManualRegions(samples, 1000, {
        method: 'manual',
        regions: [{ start: 2000, end: 3000 }],
      })
    ).toThrow(/exceeds audio duration/);
  });

  it('should clamp end to audio duration', () => {
    const samples = new Int16Array(1000);

    const result = sliceByManualRegions(samples, 1000, {
      method: 'manual',
      regions: [{ start: 500, end: 2000 }], // End beyond audio
    });

    // Should clamp to 1000ms (audio end)
    expect(result.slices[0]?.endSample).toBe(1000);
    expect(result.slices[0]?.durationMs).toBe(500);
  });

  it('should preserve sample values', () => {
    const samples = new Int16Array([100, 200, 300, 400, 500, 600]);

    const result = sliceByManualRegions(samples, 1000, {
      method: 'manual',
      regions: [
        { start: 0, end: 3 },
        { start: 3, end: 6 },
      ],
    });

    expect(result.slices[0]?.samples).toEqual(new Int16Array([100, 200, 300]));
    expect(result.slices[1]?.samples).toEqual(new Int16Array([400, 500, 600]));
  });
});

describe('createRegionsFromBoundaries', () => {
  it('should create regions from time boundaries', () => {
    const config = createRegionsFromBoundaries([0, 100, 200, 300]);

    expect(config.method).toBe('manual');
    expect(config.regions).toHaveLength(3);
    expect(config.regions[0]).toEqual({ start: 0, end: 100, name: undefined });
    expect(config.regions[1]).toEqual({ start: 100, end: 200, name: undefined });
    expect(config.regions[2]).toEqual({ start: 200, end: 300, name: undefined });
  });

  it('should apply names to regions', () => {
    const config = createRegionsFromBoundaries(
      [0, 100, 200, 300],
      ['kick', 'snare', 'hat']
    );

    expect(config.regions[0]?.name).toBe('kick');
    expect(config.regions[1]?.name).toBe('snare');
    expect(config.regions[2]?.name).toBe('hat');
  });

  it('should sort unsorted boundaries', () => {
    const config = createRegionsFromBoundaries([300, 0, 200, 100]);

    expect(config.regions[0]).toEqual({ start: 0, end: 100, name: undefined });
    expect(config.regions[1]).toEqual({ start: 100, end: 200, name: undefined });
    expect(config.regions[2]).toEqual({ start: 200, end: 300, name: undefined });
  });

  it('should throw for insufficient boundaries', () => {
    expect(() => createRegionsFromBoundaries([100])).toThrow(
      /at least 2 boundaries/
    );

    expect(() => createRegionsFromBoundaries([])).toThrow(
      /at least 2 boundaries/
    );
  });
});

describe('createRegionsFromTempo', () => {
  it('should create regions at 120 BPM', () => {
    // 120 BPM = 500ms per beat
    const config = createRegionsFromTempo(4, 120);

    expect(config.method).toBe('manual');
    expect(config.regions).toHaveLength(4);
    expect(config.regions[0]).toEqual({ start: 0, end: 500, name: undefined });
    expect(config.regions[1]).toEqual({ start: 500, end: 1000, name: undefined });
    expect(config.regions[2]).toEqual({ start: 1000, end: 1500, name: undefined });
    expect(config.regions[3]).toEqual({ start: 1500, end: 2000, name: undefined });
  });

  it('should respect start offset', () => {
    const config = createRegionsFromTempo(2, 120, 100);

    expect(config.regions[0]).toEqual({ start: 100, end: 600, name: undefined });
    expect(config.regions[1]).toEqual({ start: 600, end: 1100, name: undefined });
  });

  it('should apply names to regions', () => {
    const config = createRegionsFromTempo(4, 120, 0, ['kick', 'snare', 'hhc', 'hho']);

    expect(config.regions[0]?.name).toBe('kick');
    expect(config.regions[1]?.name).toBe('snare');
    expect(config.regions[2]?.name).toBe('hhc');
    expect(config.regions[3]?.name).toBe('hho');
  });

  it('should handle different tempos', () => {
    // 60 BPM = 1000ms per beat
    const slow = createRegionsFromTempo(2, 60);
    expect(slow.regions[0]?.end).toBe(1000);
    expect(slow.regions[1]?.end).toBe(2000);

    // 240 BPM = 250ms per beat
    const fast = createRegionsFromTempo(2, 240);
    expect(fast.regions[0]?.end).toBe(250);
    expect(fast.regions[1]?.end).toBe(500);
  });
});
