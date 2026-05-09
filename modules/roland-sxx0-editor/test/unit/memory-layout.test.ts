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

  describe('formatToneSlot', () => {
    // Pins the bank.slot rollover that the obsolete `T${toneIndex + 11}`
    // arithmetic (removed by #397) silently broke for index >= 8.
    it('formats the first slot as T11', () => {
      expect(createS330MemoryLayout().formatToneSlot(0)).toBe('T11');
    });

    it('rolls over to T21 at the bank-2 boundary (index 8)', () => {
      // Arithmetic `T${8 + 11}` = "T19" — wrong. Correct: T21 (bank 2 slot 1).
      expect(createS330MemoryLayout().formatToneSlot(8)).toBe('T21');
    });

    it('formats T48 at the last slot (index 31)', () => {
      // Arithmetic `T${31 + 11}` = "T42" — wrong. Correct: T48 (bank 4 slot 8).
      expect(createS330MemoryLayout().formatToneSlot(31)).toBe('T48');
    });
  });

  describe('formatPatchSlot', () => {
    it('formats the first slot as P11', () => {
      expect(createS330MemoryLayout().formatPatchSlot(0)).toBe('P11');
    });

    it('rolls over to P21 at the bank-2 boundary (index 8)', () => {
      // Arithmetic `P${String(8 + 11).padStart(2,'0')}` = "P19" — wrong.
      // Correct: P21 (bank 2 slot 1).
      expect(createS330MemoryLayout().formatPatchSlot(8)).toBe('P21');
    });

    it('formats P28 at the last patch slot (index 15)', () => {
      expect(createS330MemoryLayout().formatPatchSlot(15)).toBe('P28');
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

  describe('formatToneSlot', () => {
    // Pins the boundaries that the obsolete arithmetic (`T${toneIndex + 11}`,
    // removed by #397) silently broke. The S-550 block-2 rollover at index 32
    // is the most visible regression: arithmetic produced "T43" where the
    // device labels read T51.
    it('formats T11 at index 0 (block 1, bank 1, slot 1)', () => {
      expect(createS550MemoryLayout().formatToneSlot(0)).toBe('T11');
    });

    it('formats T21 at index 8 (block 1, bank 2, slot 1)', () => {
      // Arithmetic produced "T19"; correct is "T21".
      expect(createS550MemoryLayout().formatToneSlot(8)).toBe('T21');
    });

    it('formats T48 at index 31 (last slot of block 1)', () => {
      expect(createS550MemoryLayout().formatToneSlot(31)).toBe('T48');
    });

    it('formats T51 at index 32 (block 2, bank 5, slot 1)', () => {
      // Arithmetic produced "T43"; correct is "T51". Highest-impact case
      // because S-550 block 2 was visibly mislabeled.
      expect(createS550MemoryLayout().formatToneSlot(32)).toBe('T51');
    });

    it('formats T88 at index 63 (last slot of block 2)', () => {
      // Arithmetic produced "T74"; correct is "T88".
      expect(createS550MemoryLayout().formatToneSlot(63)).toBe('T88');
    });
  });

  describe('formatPatchSlot', () => {
    // S-550 patch labels carry a Roman-numeral block prefix per
    // memory-layout.ts:147-158. Pin the four boundaries.
    it('formats I11 at index 0 (block I, bank 1, slot 1)', () => {
      expect(createS550MemoryLayout().formatPatchSlot(0)).toBe('I11');
    });

    it('formats I21 at index 8 (block I, bank 2, slot 1)', () => {
      expect(createS550MemoryLayout().formatPatchSlot(8)).toBe('I21');
    });

    it('formats I28 at index 15 (last slot of block I)', () => {
      expect(createS550MemoryLayout().formatPatchSlot(15)).toBe('I28');
    });

    it('formats II11 at index 16 (first slot of block II)', () => {
      expect(createS550MemoryLayout().formatPatchSlot(16)).toBe('II11');
    });

    it('formats II28 at index 31 (last patch slot)', () => {
      expect(createS550MemoryLayout().formatPatchSlot(31)).toBe('II28');
    });
  });
});
