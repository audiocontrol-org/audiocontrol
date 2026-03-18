/**
 * WaveSegmentMap
 *
 * Horizontal bar of 18 segments for one wave bank.
 * Color-coded by occupancy and proposal status.
 */

import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { computeSegmentStatus } from '@/components/ui/memory-map-types';
import { cn } from '@/lib/utils';

const SEGMENTS_PER_BANK = 18;

interface WaveSegmentMapProps {
  bankIndex: number;
  bankLabel: string;
  usedSegments: Set<number>;
  proposal?: AllocationProposal;
}

const statusClasses: Record<string, string> = {
  empty: 'bg-s330-accent/20',
  occupied: 'bg-emerald-600/60',
  proposed: 'bg-s330-highlight/40 ring-1 ring-s330-highlight',
  conflict: 'bg-red-500/40 ring-1 ring-red-500',
};

export function WaveSegmentMap({
  bankIndex,
  bankLabel,
  usedSegments,
  proposal,
}: WaveSegmentMapProps): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-s330-muted w-3 text-right">{bankLabel}:</span>
      <div className="flex gap-0.5">
        {Array.from({ length: SEGMENTS_PER_BANK }, (_, i) => {
          const status = computeSegmentStatus(bankIndex, i, usedSegments, proposal);
          return (
            <div
              key={i}
              className={cn(
                'w-3.5 h-4 rounded-sm cursor-default',
                statusClasses[status]
              )}
              title={`Segment ${i} (${status})`}
            />
          );
        })}
      </div>
    </div>
  );
}
