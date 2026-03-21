/**
 * Boundary condition tests for the loop point search algorithm.
 *
 * Tests searchLoopPoints with generated signals that exercise:
 * - Transient exclusion (leading silence, attack/decay)
 * - Silence detection (trailing silence)
 * - Decay detection (constant decay → error)
 * - Sustain region identification
 * - Candidate position validation
 */

import { describe, it, expect } from 'vitest';
import { searchLoopPoints, LoopDetectionError } from './loop-point-searcher';
import {
  generateLeadingSilence,
  generateTrailingSilence,
  generateConstantDecay,
  generateDecayIntoSustain,
  generateSustainWithTrailingDecay,
  generatePureSustain,
} from './testing/test-signals';

const SAMPLE_RATE = 30000;

describe('searchLoopPoints — boundary conditions', () => {
  describe('pure sustain (control case)', () => {
    it('finds candidates with high composite scores', () => {
      const samples = generatePureSustain(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBeGreaterThan(0);
      // Best candidate should have a high score for a pure sustained tone
      expect(candidates[0]!.compositeScore).toBeGreaterThan(0.7);
    });

    it('all candidates have valid loop regions', () => {
      const samples = generatePureSustain(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      for (const c of candidates) {
        expect(c.loopStart).toBeLessThan(c.loopEnd);
        expect(c.loopStart).toBeGreaterThanOrEqual(0);
        expect(c.loopEnd).toBeLessThanOrEqual(samples.length);
        // Word-aligned (even indices)
        expect(c.loopStart % 2).toBe(0);
        expect(c.loopEnd % 2).toBe(0);
      }
    });
  });

  describe('leading silence', () => {
    it('returns no candidates with default config (start window falls in silence)', () => {
      // The default startSearchWindowMs (200ms) searches from sustainStart
      // (50ms) to 250ms — entirely in the silent region (silence ends at 300ms).
      // This documents a known limitation: signals with leading silence
      // need wider search windows.
      const samples = generateLeadingSilence(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBe(0);
    });

    it('finds candidates in the tone region with wider search window', () => {
      const samples = generateLeadingSilence(SAMPLE_RATE);
      const silenceEnd = Math.round(SAMPLE_RATE * 0.3);

      const candidates = searchLoopPoints(samples, SAMPLE_RATE, undefined, {
        startSearchWindowMs: 1500,
      });

      expect(candidates.length).toBeGreaterThan(0);

      // All loop start points should be after the silence ends
      for (const c of candidates) {
        expect(c.loopStart).toBeGreaterThanOrEqual(silenceEnd);
      }
    });
  });

  describe('trailing silence', () => {
    it('finds candidates before the silence region', () => {
      const samples = generateTrailingSilence(SAMPLE_RATE);
      const toneEnd = Math.round(SAMPLE_RATE * 1.5);

      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBeGreaterThan(0);

      // All loop end points should be before or near where the tone ends
      for (const c of candidates) {
        expect(c.loopEnd).toBeLessThanOrEqual(toneEnd);
      }
    });
  });

  describe('constant decay', () => {
    it('throws decaying_sample error when no sustain region exists', () => {
      const samples = generateConstantDecay(SAMPLE_RATE);

      expect(() => searchLoopPoints(samples, SAMPLE_RATE))
        .toThrow(LoopDetectionError);

      try {
        searchLoopPoints(samples, SAMPLE_RATE);
      } catch (e) {
        expect(e).toBeInstanceOf(LoopDetectionError);
        expect((e as LoopDetectionError).reason).toBe('decaying_sample');
      }
    });
  });

  describe('decay into sustain', () => {
    it('finds candidates in the sustain region after the attack/decay', () => {
      const samples = generateDecayIntoSustain(SAMPLE_RATE);
      // Attack is 10ms, decay is 190ms → sustain starts around 200ms
      const sustainStart = Math.round(SAMPLE_RATE * 0.2);

      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBeGreaterThan(0);

      // Loop start should be in or after the sustain region
      for (const c of candidates) {
        // Allow some tolerance — the transient excluder may identify
        // sustain start slightly differently than our exact 200ms mark
        expect(c.loopStart).toBeGreaterThan(sustainStart * 0.5);
      }
    });

    it('produces candidates with good scores', () => {
      const samples = generateDecayIntoSustain(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBeGreaterThan(0);
      // Sustain region should produce reasonable matches
      expect(candidates[0]!.compositeScore).toBeGreaterThan(0.5);
    });
  });

  describe('sustain with trailing decay', () => {
    it('finds candidates in the sustain region before the decay', () => {
      const samples = generateSustainWithTrailingDecay(SAMPLE_RATE);
      const sustainEnd = Math.round(SAMPLE_RATE * 1.5);

      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      expect(candidates.length).toBeGreaterThan(0);

      // Loop end should be in the sustain region, not in the decay tail
      for (const c of candidates) {
        expect(c.loopEnd).toBeLessThanOrEqual(sustainEnd);
      }
    });
  });

  describe('candidate ordering', () => {
    it('returns candidates sorted by composite score descending', () => {
      const samples = generatePureSustain(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE);

      for (let i = 1; i < candidates.length; i++) {
        expect(candidates[i - 1]!.compositeScore)
          .toBeGreaterThanOrEqual(candidates[i]!.compositeScore);
      }
    });
  });

  describe('topK parameter', () => {
    it('respects the topK limit', () => {
      const samples = generatePureSustain(SAMPLE_RATE);
      const candidates = searchLoopPoints(samples, SAMPLE_RATE, undefined, { topK: 3 });

      expect(candidates.length).toBeLessThanOrEqual(3);
    });
  });
});
