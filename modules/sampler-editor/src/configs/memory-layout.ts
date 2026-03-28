/**
 * Device-specific memory layout implementations.
 *
 * Each device provides a MemoryLayout that describes how to group slots,
 * label them, and handle import targeting. The UI renders whatever the
 * layout describes — no device conditionals in components.
 *
 * @packageDocumentation
 */

import type { MemoryLayout, ToneSlotGroup, ImportTarget } from './types.js';

// =============================================================================
// Shared Helpers
// =============================================================================

/** Format an index as bank.slot notation (e.g., 0 → "11", 9 → "22") */
function bankSlotLabel(index: number, slotsPerBank: number): string {
  const bank = Math.floor(index / slotsPerBank) + 1;
  const slot = (index % slotsPerBank) + 1;
  return `${bank}${slot}`;
}

// =============================================================================
// S-330 Memory Layout
// =============================================================================

/**
 * S-330 memory layout.
 *
 * Single flat list of 32 tones across 4 banks (T11-T48),
 * 16 patches across 2 banks (P11-P28),
 * 2 wave banks (A, B).
 */
export function createS330MemoryLayout(): MemoryLayout {
  const slotsPerBank = 8;

  const toneGroups: ToneSlotGroup[] = [
    {
      label: 'Tones (32 slots)',
      firstIndex: 0,
      count: 32,
      waveBankLabels: ['A', 'B'],
      waveBankIndices: [0, 1],
    },
  ];

  const importTargets: ImportTarget[] = [
    {
      label: 'Device memory',
      toneIndexOffset: 0,
      waveBankOffset: 0,
    },
  ];

  return {
    toneGroups,
    patchSectionLabel: 'Patches (16 slots)',
    importTargets,

    getWaveBanksForTone(_toneIndex: number) {
      return { labels: ['A', 'B'], indices: [0, 1] };
    },

    formatToneSlot(index: number): string {
      return `T${bankSlotLabel(index, slotsPerBank)}`;
    },

    formatPatchSlot(index: number): string {
      return `P${bankSlotLabel(index, slotsPerBank)}`;
    },

    formatPatchBankLabel(bankIndex: number, patchesPerBank: number): string {
      const firstIndex = bankIndex * patchesPerBank;
      const lastIndex = firstIndex + patchesPerBank - 1;
      return `P${bankSlotLabel(firstIndex, slotsPerBank)}-P${bankSlotLabel(lastIndex, slotsPerBank)}`;
    },

    patchLabelsUseSerif: false,
  };
}

// =============================================================================
// S-550 Memory Layout
// =============================================================================

/**
 * S-550 memory layout.
 *
 * Two independent blocks, each with 32 tones and 2 wave banks:
 * - Block 1: Tones 0-31 (T11-T48), Wave Banks A/B
 * - Block 2: Tones 32-63 (T51-T88), Wave Banks C/D
 *
 * 32 patches across 4 banks (P11-P48), shared across both blocks.
 */
export function createS550MemoryLayout(): MemoryLayout {
  const slotsPerBank = 8;

  const toneGroups: ToneSlotGroup[] = [
    {
      label: 'Block 1 — Tones T11-T48, Banks A/B',
      firstIndex: 0,
      count: 32,
      waveBankLabels: ['A', 'B'],
      waveBankIndices: [0, 1],
    },
    {
      label: 'Block 2 — Tones T51-T88, Banks C/D',
      firstIndex: 32,
      count: 32,
      waveBankLabels: ['C', 'D'],
      waveBankIndices: [2, 3],
    },
  ];

  const importTargets: ImportTarget[] = [
    {
      label: 'Block 1 — Tones 1-32, Banks A/B',
      toneIndexOffset: 0,
      waveBankOffset: 0,
    },
    {
      label: 'Block 2 — Tones 33-64, Banks C/D',
      toneIndexOffset: 32,
      waveBankOffset: 2,
    },
  ];

  return {
    toneGroups,
    patchSectionLabel: 'Patches (32 slots)',
    importTargets,

    getWaveBanksForTone(toneIndex: number) {
      if (toneIndex < 32) {
        return { labels: ['A', 'B'], indices: [0, 1] };
      }
      return { labels: ['C', 'D'], indices: [2, 3] };
    },

    formatToneSlot(index: number): string {
      return `T${bankSlotLabel(index, slotsPerBank)}`;
    },

    formatPatchSlot(index: number): string {
      // S-550 has two blocks of 16 patches each (I and II)
      // Each block has 2 banks of 8 patches: I11-I18, I21-I28, II11-II18, II21-II28
      const patchesPerBlock = 16;
      const block = index < patchesPerBlock ? 'I' : 'II';
      const blockLocalIndex = index % patchesPerBlock;
      return `${block}${bankSlotLabel(blockLocalIndex, slotsPerBank)}`;
    },

    formatPatchBankLabel(bankIndex: number, patchesPerBank: number): string {
      // S-550 has 4 patch banks: I11-I18, I21-I28, II11-II18, II21-II28
      const patchesPerBlock = 16;
      const firstIndex = bankIndex * patchesPerBank;
      const lastIndex = firstIndex + patchesPerBank - 1;
      const firstBlock = firstIndex < patchesPerBlock ? 'I' : 'II';
      const lastBlock = lastIndex < patchesPerBlock ? 'I' : 'II';
      const firstLocalIndex = firstIndex % patchesPerBlock;
      const lastLocalIndex = lastIndex % patchesPerBlock;
      return `${firstBlock}${bankSlotLabel(firstLocalIndex, slotsPerBank)}-${lastBlock}${bankSlotLabel(lastLocalIndex, slotsPerBank)}`;
    },

    patchLabelsUseSerif: true,
  };
}
