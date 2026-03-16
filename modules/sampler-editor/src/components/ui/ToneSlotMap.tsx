/**
 * ToneSlotMap
 *
 * Grid of tone cells for one ToneSlotGroup.
 * Renders 8 cells per row (one bank row) with color-coded status.
 */

import type { ToneSlotGroup } from '@/configs/types';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { computeSlotStatus } from '@/components/ui/memory-map-types';
import { isToneEmpty } from '@/lib/slot-allocation';
import type { SamplerTone } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';

const CELLS_PER_ROW = 8;

interface ToneSlotMapProps {
  group: ToneSlotGroup;
  deviceTones: (SamplerTone | undefined)[];
  formatToneSlot: (index: number) => string;
  proposal?: AllocationProposal;
}

const statusClasses: Record<string, string> = {
  empty: 'bg-s330-accent/20',
  occupied: 'bg-emerald-600/60',
  proposed: 'bg-s330-highlight/40 ring-1 ring-s330-highlight',
  conflict: 'bg-red-500/40 ring-1 ring-red-500',
};

export function ToneSlotMap({
  group,
  deviceTones,
  formatToneSlot,
  proposal,
}: ToneSlotMapProps): JSX.Element {
  const cells = Array.from({ length: group.count }, (_, i) => {
    const absIndex = group.firstIndex + i;
    const isEmpty = isToneEmpty(deviceTones[absIndex]);
    const status = computeSlotStatus(absIndex, isEmpty, proposal);
    const tone = deviceTones[absIndex];
    const label = formatToneSlot(absIndex);
    const title = isEmpty ? `${label} (empty)` : `${label}: ${tone?.name ?? ''}`;

    return (
      <div
        key={absIndex}
        className={cn(
          'w-5 h-5 rounded-sm text-[8px] flex items-center justify-center cursor-default',
          statusClasses[status]
        )}
        title={title}
      />
    );
  });

  const rows: JSX.Element[] = [];
  for (let i = 0; i < cells.length; i += CELLS_PER_ROW) {
    rows.push(
      <div key={i} className="flex gap-0.5">
        {cells.slice(i, i + CELLS_PER_ROW)}
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] text-s330-muted mb-1">{group.label}</div>
      <div className="flex flex-col gap-0.5">{rows}</div>
    </div>
  );
}
