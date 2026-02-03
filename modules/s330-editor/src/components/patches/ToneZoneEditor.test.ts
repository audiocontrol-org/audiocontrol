/**
 * Unit tests for ToneZoneEditor utility functions
 */

import { describe, it, expect } from 'vitest';
import { arrayToZones, zonesToArray, ToneZone } from './ToneZoneEditor';

// Constants matching ToneZoneEditor.tsx
const MIN_KEY = 19;
const MAX_KEY = 127;
const TOTAL_KEYS = 109;

describe('ToneZoneEditor utilities', () => {
  describe('arrayToZones', () => {
    it('should return empty array for all-OFF data (Layer 1)', () => {
      const data = new Array(TOTAL_KEYS).fill(-1);
      const zones = arrayToZones(data, 1);
      expect(zones).toEqual([]);
    });

    it('should return empty array for all-OFF data (Layer 2)', () => {
      const data = new Array(TOTAL_KEYS).fill(0);
      const zones = arrayToZones(data, 2);
      expect(zones).toEqual([]);
    });

    it('should parse a single zone spanning all keys', () => {
      const data = new Array(TOTAL_KEYS).fill(5);
      const zones = arrayToZones(data, 1);
      expect(zones).toHaveLength(1);
      expect(zones[0]).toEqual({
        startKey: MIN_KEY,
        endKey: MAX_KEY,
        tone: 5,
      });
    });

    it('should parse multiple contiguous zones', () => {
      // Layer 1: -1 means OFF
      const data = new Array(TOTAL_KEYS).fill(-1);
      // Keys 19-30 (indices 0-11): Tone 0
      for (let i = 0; i < 12; i++) data[i] = 0;
      // Keys 31-42 (indices 12-23): Tone 1
      for (let i = 12; i < 24; i++) data[i] = 1;
      // Keys 43-54 (indices 24-35): Tone 2
      for (let i = 24; i < 36; i++) data[i] = 2;

      const zones = arrayToZones(data, 1);
      expect(zones).toHaveLength(3);
      expect(zones[0]).toEqual({ startKey: MIN_KEY, endKey: 30, tone: 0 });
      expect(zones[1]).toEqual({ startKey: 31, endKey: 42, tone: 1 });
      expect(zones[2]).toEqual({ startKey: 43, endKey: 54, tone: 2 });
    });

    it('should skip OFF entries between zones', () => {
      const data = new Array(TOTAL_KEYS).fill(-1);
      // Keys 19-30 (indices 0-11): Tone 0
      for (let i = 0; i < 12; i++) data[i] = 0;
      // Keys 43-54 (indices 24-35): Tone 2 (gap at indices 12-23)
      for (let i = 24; i < 36; i++) data[i] = 2;

      const zones = arrayToZones(data, 1);
      expect(zones).toHaveLength(2);
      expect(zones[0]).toEqual({ startKey: MIN_KEY, endKey: 30, tone: 0 });
      expect(zones[1]).toEqual({ startKey: 43, endKey: 54, tone: 2 });
    });

    it('should handle Layer 2 with 0 as OFF value', () => {
      const data = new Array(TOTAL_KEYS).fill(0); // Layer 2: 0 means OFF
      // Keys 19-30 (indices 0-11): Tone 5
      for (let i = 0; i < 12; i++) data[i] = 5;

      const zones = arrayToZones(data, 2);
      expect(zones).toHaveLength(1);
      expect(zones[0]).toEqual({ startKey: MIN_KEY, endKey: 30, tone: 5 });
    });

    it('should handle non-contiguous same-tone zones as separate zones', () => {
      const data = new Array(TOTAL_KEYS).fill(-1);
      // Keys 19-30 (indices 0-11): Tone 5
      for (let i = 0; i < 12; i++) data[i] = 5;
      // Keys 43-54 (indices 24-35): Tone 5 (same tone, but not contiguous)
      for (let i = 24; i < 36; i++) data[i] = 5;

      const zones = arrayToZones(data, 1);
      expect(zones).toHaveLength(2);
      expect(zones[0]).toEqual({ startKey: MIN_KEY, endKey: 30, tone: 5 });
      expect(zones[1]).toEqual({ startKey: 43, endKey: 54, tone: 5 });
    });

    it('should handle single-key zones', () => {
      const data = new Array(TOTAL_KEYS).fill(-1);
      data[0] = 3; // Just the first key (MIDI 19)

      const zones = arrayToZones(data, 1);
      expect(zones).toHaveLength(1);
      expect(zones[0]).toEqual({ startKey: MIN_KEY, endKey: MIN_KEY, tone: 3 });
    });
  });

  describe('zonesToArray', () => {
    it('should return all-OFF array for empty zones (Layer 1)', () => {
      const zones: ToneZone[] = [];
      const data = zonesToArray(zones, 1);
      expect(data).toHaveLength(TOTAL_KEYS);
      expect(data.every(v => v === -1)).toBe(true);
    });

    it('should return all-OFF array for empty zones (Layer 2)', () => {
      const zones: ToneZone[] = [];
      const data = zonesToArray(zones, 2);
      expect(data).toHaveLength(TOTAL_KEYS);
      expect(data.every(v => v === 0)).toBe(true);
    });

    it('should fill entire array for full-range zone', () => {
      const zones: ToneZone[] = [{ startKey: MIN_KEY, endKey: MAX_KEY, tone: 7 }];
      const data = zonesToArray(zones, 1);
      expect(data).toHaveLength(TOTAL_KEYS);
      expect(data.every(v => v === 7)).toBe(true);
    });

    it('should correctly place multiple zones', () => {
      const zones: ToneZone[] = [
        { startKey: MIN_KEY, endKey: 30, tone: 0 },  // indices 0-11
        { startKey: 31, endKey: 42, tone: 1 },       // indices 12-23
        { startKey: 43, endKey: 54, tone: 2 },       // indices 24-35
      ];
      const data = zonesToArray(zones, 1);

      // Check zone 0 (indices 0-11)
      for (let i = 0; i < 12; i++) {
        expect(data[i]).toBe(0);
      }
      // Check zone 1 (indices 12-23)
      for (let i = 12; i < 24; i++) {
        expect(data[i]).toBe(1);
      }
      // Check zone 2 (indices 24-35)
      for (let i = 24; i < 36; i++) {
        expect(data[i]).toBe(2);
      }
      // Rest should be OFF
      for (let i = 36; i < TOTAL_KEYS; i++) {
        expect(data[i]).toBe(-1);
      }
    });

    it('should handle overlapping zones (last zone wins)', () => {
      const zones: ToneZone[] = [
        { startKey: MIN_KEY, endKey: 42, tone: 0 },  // indices 0-23
        { startKey: 31, endKey: 54, tone: 1 },       // indices 12-35, overlaps
      ];
      const data = zonesToArray(zones, 1);

      // Keys 19-30 (indices 0-11) should be tone 0
      for (let i = 0; i < 12; i++) {
        expect(data[i]).toBe(0);
      }
      // Keys 31-54 (indices 12-35) should be tone 1 (overwritten by second zone)
      for (let i = 12; i < 36; i++) {
        expect(data[i]).toBe(1);
      }
    });

    it('should handle Layer 2 with 0 as OFF value', () => {
      const zones: ToneZone[] = [{ startKey: MIN_KEY, endKey: 30, tone: 5 }];
      const data = zonesToArray(zones, 2);

      // Zone should have tone 5 (indices 0-11)
      for (let i = 0; i < 12; i++) {
        expect(data[i]).toBe(5);
      }
      // Rest should be 0 (Layer 2 OFF value)
      for (let i = 12; i < TOTAL_KEYS; i++) {
        expect(data[i]).toBe(0);
      }
    });

    it('should clamp keys to valid range', () => {
      const zones: ToneZone[] = [
        { startKey: 10, endKey: 28, tone: 5 },   // startKey below MIN_KEY
        { startKey: 120, endKey: 140, tone: 6 }, // endKey above MAX_KEY
      ];
      const data = zonesToArray(zones, 1);

      // Only valid keys should be filled
      // Keys 19-28 (indices 0-9) should be tone 5
      for (let i = 0; i <= 9; i++) {
        expect(data[i]).toBe(5);
      }
      // Keys 120-127 (indices 101-108) should be tone 6
      for (let i = 101; i <= 108; i++) {
        expect(data[i]).toBe(6);
      }
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through array → zones → array conversion', () => {
      const original = new Array(TOTAL_KEYS).fill(-1);
      // Create some zones
      for (let i = 0; i < 12; i++) original[i] = 0;
      for (let i = 24; i < 48; i++) original[i] = 5;
      for (let i = 60; i < 72; i++) original[i] = 31;

      const zones = arrayToZones(original, 1);
      const result = zonesToArray(zones, 1);

      expect(result).toEqual(original);
    });

    it('should preserve Layer 2 data through round-trip', () => {
      const original = new Array(TOTAL_KEYS).fill(0);
      for (let i = 0; i < 24; i++) original[i] = 10;
      for (let i = 48; i < 72; i++) original[i] = 20;

      const zones = arrayToZones(original, 2);
      const result = zonesToArray(zones, 2);

      expect(result).toEqual(original);
    });

    it('should preserve complex zone patterns', () => {
      const original = new Array(TOTAL_KEYS).fill(-1);
      // Alternating single keys and zones
      original[0] = 1;
      original[2] = 2;
      for (let i = 10; i < 20; i++) original[i] = 3;
      original[50] = 4;
      for (let i = 100; i < TOTAL_KEYS; i++) original[i] = 5;

      const zones = arrayToZones(original, 1);
      const result = zonesToArray(zones, 1);

      expect(result).toEqual(original);
    });
  });
});
