/**
 * Unit tests for device-specific memory layouts.
 *
 * These tests pin the wave-bank assignment per tone slot — the contract that
 * the import dialogs (`ImportSampleDialog`, `ImportLibraryToneDialog`) read
 * via `MemoryLayout.getWaveBanksForTone(toneIndex)`. The S-550 boundary at
 * tone index 32 (Block 1 → Block 2 / banks A/B → C/D) is the original cause
 * of #393, so it gets explicit coverage here.
 */

import { describe, it, expect } from 'vitest';
import { createS330MemoryLayout, createS550MemoryLayout } from '@/configs/memory-layout';

describe('createS330MemoryLayout', () => {
  describe('getWaveBanksForTone', () => {
    it('returns banks A and B for the first tone', () => {
      const layout = createS330MemoryLayout();
      expect(layout.getWaveBanksForTone(0)).toEqual({
        labels: ['A', 'B'],
        indices: [0, 1],
      });
    });

    it('returns banks A and B for any tone (S-330 has no block split)', () => {
      const layout = createS330MemoryLayout();
      for (const toneIndex of [0, 1, 15, 31]) {
        expect(layout.getWaveBanksForTone(toneIndex)).toEqual({
          labels: ['A', 'B'],
          indices: [0, 1],
        });
      }
    });
  });
});

describe('createS550MemoryLayout', () => {
  describe('getWaveBanksForTone', () => {
    it('returns banks A and B for tone index 0 (Block 1)', () => {
      const layout = createS550MemoryLayout();
      expect(layout.getWaveBanksForTone(0)).toEqual({
        labels: ['A', 'B'],
        indices: [0, 1],
      });
    });

    it('returns banks A and B for tone index 31 (last slot in Block 1)', () => {
      const layout = createS550MemoryLayout();
      expect(layout.getWaveBanksForTone(31)).toEqual({
        labels: ['A', 'B'],
        indices: [0, 1],
      });
    });

    it('returns banks C and D for tone index 32 (first slot in Block 2)', () => {
      // This is the boundary at the heart of #393. Before the fix,
      // ImportSampleDialog rendered only Bank A and Bank B regardless of
      // tone slot, blocking S-550 users from using banks C/D.
      const layout = createS550MemoryLayout();
      expect(layout.getWaveBanksForTone(32)).toEqual({
        labels: ['C', 'D'],
        indices: [2, 3],
      });
    });

    it('returns banks C and D for tone index 63 (last slot in Block 2)', () => {
      const layout = createS550MemoryLayout();
      expect(layout.getWaveBanksForTone(63)).toEqual({
        labels: ['C', 'D'],
        indices: [2, 3],
      });
    });

    it('uses indices 0..3 across the full 64-slot range', () => {
      // Sanity check: every tone index maps to a {0,1} or {2,3} pair, never
      // a mix or out-of-range value.
      const layout = createS550MemoryLayout();
      for (let toneIndex = 0; toneIndex < 64; toneIndex++) {
        const { indices } = layout.getWaveBanksForTone(toneIndex);
        expect(indices).toHaveLength(2);
        for (const bankIndex of indices) {
          expect(bankIndex).toBeGreaterThanOrEqual(0);
          expect(bankIndex).toBeLessThanOrEqual(3);
        }
      }
    });
  });
});
