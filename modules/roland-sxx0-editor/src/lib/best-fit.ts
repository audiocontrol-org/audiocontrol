/**
 * Best-fit allocation algorithms for import dialogs.
 *
 * Generates ranked placement options for tone, drum kit, and patch imports.
 * Each option includes a visual proposal for the memory map and the form
 * values needed to apply the selection.
 */

import type { ToneSlotGroup } from '@/configs/types';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import {
  isToneEmpty,
  isPatchEmpty,
  getWaveMemoryUsage,
  findFirstEmptyPatchSlot,
  findAvailableWaveMemoryRegions,
  type WaveBankIndex,
} from '@/lib/slot-allocation';

// =============================================================================
// Types
// =============================================================================

export interface FitOption<T> {
  label: string;
  proposal: AllocationProposal;
  toneCollisions: number;
  waveCollisions: number;
  values: T;
}

export interface ToneFitValues {
  targetSlot: number;
  waveBank: WaveBankIndex;
  segmentTop: number;
}

export interface ContiguousFitValues {
  targetIndex: number;
  startingToneSlot: number;
  waveBank: WaveBankIndex;
  startingSegment: number;
}

export interface PatchFitValues {
  targetPatchSlot: number;
  toneAllocations: Array<{
    targetSlot: number;
    waveBank: WaveBankIndex;
    segmentTop: number;
  }>;
}

// =============================================================================
// Helpers
// =============================================================================

function countSegmentCollisions(
  bankUsed: Set<number>,
  start: number,
  length: number,
): number {
  let collisions = 0;
  for (let i = 0; i < length; i++) {
    if (bankUsed.has(start + i)) collisions++;
  }
  return collisions;
}

function collisionLabel(total: number): string {
  if (total === 0) return 'no conflicts';
  return `${total} conflict${total !== 1 ? 's' : ''}`;
}

// =============================================================================
// Tone Best Fits
// =============================================================================

/**
 * Find best placement options for a single tone import.
 * Generates one option per (group, bank) combo, each with the best
 * available slot and segment position.
 */
export function findToneBestFits(
  deviceTones: (SamplerTone | undefined)[],
  segmentsNeeded: number,
  toneGroups: ToneSlotGroup[],
  formatToneSlot: (index: number) => string,
): FitOption<ToneFitValues>[] {
  const waveUsage = getWaveMemoryUsage(deviceTones);
  const options: FitOption<ToneFitValues>[] = [];

  for (const group of toneGroups) {
    // Find first empty tone slot in this group
    let bestSlot = group.firstIndex;
    let slotCollision = isToneEmpty(deviceTones[bestSlot]) ? 0 : 1;
    for (let i = 0; i < group.count && slotCollision > 0; i++) {
      const abs = group.firstIndex + i;
      if (isToneEmpty(deviceTones[abs])) {
        bestSlot = abs;
        slotCollision = 0;
      }
    }

    for (let bi = 0; bi < group.waveBankIndices.length; bi++) {
      const bank = group.waveBankIndices[bi] as WaveBankIndex;
      const bankLabel = group.waveBankLabels[bi];
      const bankUsed = waveUsage.get(bank) ?? new Set();

      // Find segment position with fewest collisions
      let bestSeg = 0;
      let bestSegCol = Infinity;
      const maxSeg = 18 - segmentsNeeded;
      for (let seg = 0; seg <= maxSeg; seg++) {
        const col = countSegmentCollisions(bankUsed, seg, segmentsNeeded);
        if (col < bestSegCol) {
          bestSeg = seg;
          bestSegCol = col;
          if (col === 0) break;
        }
      }
      if (bestSegCol === Infinity) bestSegCol = 0;

      const total = slotCollision + bestSegCol;
      const segEnd = bestSeg + segmentsNeeded - 1;
      const segRange = segEnd !== bestSeg ? `${bestSeg}\u2013${segEnd}` : `${bestSeg}`;

      options.push({
        label: `${formatToneSlot(bestSlot)}, Bank ${bankLabel} seg ${segRange} \u2014 ${collisionLabel(total)}`,
        proposal: {
          toneSlots: [bestSlot],
          waveSegments: [{ bank, segmentTop: bestSeg, segmentLength: segmentsNeeded }],
        },
        toneCollisions: slotCollision,
        waveCollisions: bestSegCol,
        values: { targetSlot: bestSlot, waveBank: bank, segmentTop: bestSeg },
      });
    }
  }

  options.sort((a, b) => {
    const ta = a.toneCollisions + a.waveCollisions;
    const tb = b.toneCollisions + b.waveCollisions;
    return ta - tb;
  });

  return options;
}

// =============================================================================
// Contiguous Range Best Fits (Drum Kit)
// =============================================================================

/**
 * Find best placement options for a contiguous range of tone slots + wave segments.
 * Generates one option per (group, bank) combo.
 */
export function findContiguousBestFits(
  deviceTones: (SamplerTone | undefined)[],
  toneSlotsNeeded: number,
  waveSegmentsNeeded: number,
  toneGroups: ToneSlotGroup[],
  formatToneSlot: (index: number) => string,
): FitOption<ContiguousFitValues>[] {
  const waveUsage = getWaveMemoryUsage(deviceTones);
  const options: FitOption<ContiguousFitValues>[] = [];

  for (const [groupIdx, group] of toneGroups.entries()) {
    if (toneSlotsNeeded > group.count) continue;

    // Find starting position with fewest tone collisions
    let bestStart = 0;
    let bestToneCol = Infinity;
    const maxStart = group.count - toneSlotsNeeded;
    for (let start = 0; start <= maxStart; start++) {
      let col = 0;
      for (let i = 0; i < toneSlotsNeeded; i++) {
        if (!isToneEmpty(deviceTones[group.firstIndex + start + i])) col++;
      }
      if (col < bestToneCol) {
        bestStart = start;
        bestToneCol = col;
        if (col === 0) break;
      }
    }

    for (let bi = 0; bi < group.waveBankIndices.length; bi++) {
      const bank = group.waveBankIndices[bi] as WaveBankIndex;
      const bankLabel = group.waveBankLabels[bi];
      const bankUsed = waveUsage.get(bank) ?? new Set();

      // Find segment start with fewest collisions
      let bestSeg = 0;
      let bestSegCol = waveSegmentsNeeded; // worst case: all collide
      const maxSeg = 18 - waveSegmentsNeeded;
      if (maxSeg >= 0) {
        for (let seg = 0; seg <= maxSeg; seg++) {
          const col = countSegmentCollisions(bankUsed, seg, waveSegmentsNeeded);
          if (col < bestSegCol) {
            bestSeg = seg;
            bestSegCol = col;
            if (col === 0) break;
          }
        }
      }

      const total = bestToneCol + bestSegCol;
      const absStart = group.firstIndex + bestStart;
      const absEnd = absStart + toneSlotsNeeded - 1;

      options.push({
        label: `${formatToneSlot(absStart)}\u2013${formatToneSlot(absEnd)}, Bank ${bankLabel} seg ${bestSeg}+ \u2014 ${collisionLabel(total)}`,
        proposal: {
          toneSlots: Array.from({ length: toneSlotsNeeded }, (_, i) => absStart + i),
          waveSegments: [{ bank, segmentTop: bestSeg, segmentLength: waveSegmentsNeeded }],
        },
        toneCollisions: bestToneCol,
        waveCollisions: bestSegCol,
        values: {
          targetIndex: groupIdx,
          startingToneSlot: bestStart,
          waveBank: bank,
          startingSegment: bestSeg,
        },
      });
    }
  }

  options.sort((a, b) => {
    const ta = a.toneCollisions + a.waveCollisions;
    const tb = b.toneCollisions + b.waveCollisions;
    return ta - tb;
  });

  return options;
}

// =============================================================================
// Patch Best Fits
// =============================================================================

/**
 * Find best placement options for a patch import with dependent tones.
 * Tries each bank as the preferred allocation target and scores the result.
 */
export function findPatchBestFits(
  deviceTones: (SamplerTone | undefined)[],
  devicePatches: (SamplerPatch | undefined)[],
  dependentTones: Array<{ originalSlot: number; segmentsNeeded: number }>,
  toneGroups: ToneSlotGroup[],
  formatPatchSlot: (index: number) => string,
): FitOption<PatchFitValues>[] {
  const options: FitOption<PatchFitValues>[] = [];

  // Collect all unique banks
  const allBanks: Array<{ bank: WaveBankIndex; label: string }> = [];
  for (const g of toneGroups) {
    for (let i = 0; i < g.waveBankIndices.length; i++) {
      const b = g.waveBankIndices[i] as WaveBankIndex;
      if (!allBanks.some((x) => x.bank === b)) {
        allBanks.push({ bank: b, label: g.waveBankLabels[i] });
      }
    }
  }

  // Find best patch slot
  const emptyPatch = findFirstEmptyPatchSlot(devicePatches);
  const patchSlot = emptyPatch ?? 0;
  const patchCollision = emptyPatch !== undefined ? 0 : (isPatchEmpty(devicePatches[0]) ? 0 : 1);

  for (const { bank: preferredBank, label: bankLabel } of allBanks) {
    // Find empty tone slots for dependent tones
    const usedSlots = new Set<number>();
    const toneAllocations: PatchFitValues['toneAllocations'] = [];
    let toneCollisions = 0;

    for (const dep of dependentTones) {
      // Try original slot first, then find empty
      let slot = dep.originalSlot;
      if (!isToneEmpty(deviceTones[slot]) || usedSlots.has(slot)) {
        let found = false;
        for (let i = 0; i < deviceTones.length; i++) {
          if (isToneEmpty(deviceTones[i]) && !usedSlots.has(i)) {
            slot = i;
            found = true;
            break;
          }
        }
        if (!found) toneCollisions++;
      }
      usedSlots.add(slot);

      toneAllocations.push({
        targetSlot: slot,
        waveBank: preferredBank,
        segmentTop: 0, // filled below
      });
    }

    // Find wave memory for each tone
    const segRequests = dependentTones.map((d) => d.segmentsNeeded);
    const waveRegions = findAvailableWaveMemoryRegions(deviceTones, segRequests, preferredBank);

    let waveCollisions = 0;
    for (let i = 0; i < toneAllocations.length; i++) {
      if (waveRegions[i]) {
        toneAllocations[i].waveBank = waveRegions[i].bank;
        toneAllocations[i].segmentTop = waveRegions[i].segmentTop;
      } else {
        // No space — count as collision, use bank 0 seg 0 as fallback
        waveCollisions++;
        toneAllocations[i].waveBank = preferredBank;
        toneAllocations[i].segmentTop = 0;
      }
    }

    const total = patchCollision + toneCollisions + waveCollisions;
    const patchLabel = formatPatchSlot(patchSlot);

    options.push({
      label: `${patchLabel}, Bank ${bankLabel} preferred \u2014 ${collisionLabel(total)}`,
      proposal: {
        toneSlots: toneAllocations.map((a) => a.targetSlot),
        waveSegments: toneAllocations.map((a, i) => ({
          bank: a.waveBank,
          segmentTop: a.segmentTop,
          segmentLength: dependentTones[i].segmentsNeeded,
        })),
      },
      toneCollisions: patchCollision + toneCollisions,
      waveCollisions,
      values: { targetPatchSlot: patchSlot, toneAllocations },
    });
  }

  options.sort((a, b) => {
    const ta = a.toneCollisions + a.waveCollisions;
    const tb = b.toneCollisions + b.waveCollisions;
    return ta - tb;
  });

  return options;
}
