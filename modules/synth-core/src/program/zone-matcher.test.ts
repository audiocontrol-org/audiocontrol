import { describe, it, expect } from 'vitest';
import { findMatchingZones } from '@/program/zone-matcher';
import type { ZonePlayback } from '@/types/program-playback';
import { DEFAULT_AMP_ENVELOPE, DEFAULT_PITCH_PARAMS } from '@/types/program-playback';

function makeZone(overrides: Partial<ZonePlayback> = {}): ZonePlayback {
  return {
    samples: new Int16Array(100),
    sampleRate: 44100,
    keyRange: [0, 127],
    velocityRange: [1, 127],
    pitch: { ...DEFAULT_PITCH_PARAMS },
    ampEnvelope: { ...DEFAULT_AMP_ENVELOPE },
    muteGroup: 0,
    ...overrides,
  };
}

describe('findMatchingZones', () => {
  it('matches a zone that covers the full range', () => {
    const zone = makeZone();
    const result = findMatchingZones([zone], 60, 100);
    expect(result).toEqual([{ zone, index: 0 }]);
  });

  it('returns empty array when note is below key range', () => {
    const zone = makeZone({ keyRange: [48, 72] });
    expect(findMatchingZones([zone], 47, 100)).toEqual([]);
  });

  it('returns empty array when note is above key range', () => {
    const zone = makeZone({ keyRange: [48, 72] });
    expect(findMatchingZones([zone], 73, 100)).toEqual([]);
  });

  it('matches at key range boundaries (inclusive)', () => {
    const zone = makeZone({ keyRange: [48, 72] });
    expect(findMatchingZones([zone], 48, 100)).toEqual([{ zone, index: 0 }]);
    expect(findMatchingZones([zone], 72, 100)).toEqual([{ zone, index: 0 }]);
  });

  it('returns empty array when velocity is below range', () => {
    const zone = makeZone({ velocityRange: [64, 127] });
    expect(findMatchingZones([zone], 60, 63)).toEqual([]);
  });

  it('returns empty array when velocity is above range', () => {
    const zone = makeZone({ velocityRange: [1, 63] });
    expect(findMatchingZones([zone], 60, 64)).toEqual([]);
  });

  it('matches at velocity range boundaries (inclusive)', () => {
    const zone = makeZone({ velocityRange: [64, 127] });
    expect(findMatchingZones([zone], 60, 64)).toHaveLength(1);
    expect(findMatchingZones([zone], 60, 127)).toHaveLength(1);
  });

  it('matches multiple zones with overlapping ranges', () => {
    const zone1 = makeZone({ keyRange: [36, 72], label: 'low' });
    const zone2 = makeZone({ keyRange: [60, 96], label: 'high' });
    const result = findMatchingZones([zone1, zone2], 66, 100);
    expect(result).toEqual([{ zone: zone1, index: 0 }, { zone: zone2, index: 1 }]);
  });

  it('matches velocity layers — same key range, split velocity', () => {
    const soft = makeZone({ velocityRange: [1, 63], label: 'soft' });
    const loud = makeZone({ velocityRange: [64, 127], label: 'loud' });

    expect(findMatchingZones([soft, loud], 60, 50)).toEqual([{ zone: soft, index: 0 }]);
    expect(findMatchingZones([soft, loud], 60, 100)).toEqual([{ zone: loud, index: 1 }]);
  });

  it('returns empty array for empty zone list', () => {
    expect(findMatchingZones([], 60, 100)).toEqual([]);
  });

  it('handles single-note zone (keyRange low === high)', () => {
    const zone = makeZone({ keyRange: [60, 60] });
    expect(findMatchingZones([zone], 60, 100)).toEqual([{ zone, index: 0 }]);
    expect(findMatchingZones([zone], 59, 100)).toEqual([]);
    expect(findMatchingZones([zone], 61, 100)).toEqual([]);
  });

  it('preserves correct indices when only some zones match', () => {
    const zone0 = makeZone({ keyRange: [0, 30], label: 'low' });
    const zone1 = makeZone({ keyRange: [31, 60], label: 'mid' });
    const zone2 = makeZone({ keyRange: [61, 127], label: 'high' });
    const result = findMatchingZones([zone0, zone1, zone2], 65, 100);
    expect(result).toEqual([{ zone: zone2, index: 2 }]);
  });
});
