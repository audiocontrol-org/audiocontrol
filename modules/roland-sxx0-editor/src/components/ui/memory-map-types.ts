/**
 * Types and logic for the memory map visualization.
 */

export type SlotStatus = 'empty' | 'occupied' | 'proposed' | 'conflict';

export interface AllocationProposal {
  toneSlots: number[];
  waveSegments: Array<{ bank: number; segmentTop: number; segmentLength: number }>;
}

/**
 * Compute the display status of a tone slot given occupancy and proposal.
 */
export function computeSlotStatus(
  index: number,
  isEmpty: boolean,
  proposal?: AllocationProposal
): SlotStatus {
  const isProposed = proposal?.toneSlots.includes(index) ?? false;

  if (isProposed && !isEmpty) return 'conflict';
  if (isProposed) return 'proposed';
  if (!isEmpty) return 'occupied';
  return 'empty';
}

/**
 * Compute the display status of a wave segment given occupancy and proposal.
 */
export function computeSegmentStatus(
  bank: number,
  segmentIndex: number,
  usedSegments: Set<number>,
  proposal?: AllocationProposal
): SlotStatus {
  const isUsed = usedSegments.has(segmentIndex);
  const isProposed = proposal?.waveSegments.some(
    (s) => s.bank === bank && segmentIndex >= s.segmentTop && segmentIndex < s.segmentTop + s.segmentLength
  ) ?? false;

  if (isProposed && isUsed) return 'conflict';
  if (isProposed) return 'proposed';
  if (isUsed) return 'occupied';
  return 'empty';
}
