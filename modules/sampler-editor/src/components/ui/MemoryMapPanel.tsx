/**
 * MemoryMapPanel
 *
 * Composes tone slot grid + wave segment bars + legend into a single
 * visual memory map. Driven entirely by MemoryLayout — no device conditionals.
 */

import { useMemo } from 'react';
import type { ToneSlotGroup } from '@/configs/types';
import type { AllocationProposal } from '@/components/ui/memory-map-types';
import { ToneSlotMap } from '@/components/ui/ToneSlotMap';
import { WaveSegmentMap } from '@/components/ui/WaveSegmentMap';
import { getWaveMemoryUsage } from '@/lib/slot-allocation';
import type { S330Tone } from '@/core/midi/S330Client';

interface MemoryMapPanelProps {
  deviceTones: (S330Tone | undefined)[];
  toneGroups: ToneSlotGroup[];
  formatToneSlot: (index: number) => string;
  proposal?: AllocationProposal;
  onFindBestFit?: () => void;
  findBestFitDisabled?: boolean;
}

const legendItems = [
  { label: 'Empty', className: 'bg-s330-accent/20' },
  { label: 'Occupied', className: 'bg-emerald-600/60' },
  { label: 'Proposed', className: 'bg-s330-highlight/40 ring-1 ring-s330-highlight' },
  { label: 'Conflict', className: 'bg-red-500/40 ring-1 ring-red-500' },
];

export function MemoryMapPanel({
  deviceTones,
  toneGroups,
  formatToneSlot,
  proposal,
  onFindBestFit,
  findBestFitDisabled,
}: MemoryMapPanelProps): JSX.Element {
  const waveUsage = useMemo(() => getWaveMemoryUsage(deviceTones), [deviceTones]);

  // Collect all unique wave banks across all groups
  const waveBanks = useMemo(() => {
    const banks: Array<{ index: number; label: string }> = [];
    const seen = new Set<number>();
    for (const group of toneGroups) {
      for (let i = 0; i < group.waveBankIndices.length; i++) {
        const idx = group.waveBankIndices[i];
        if (!seen.has(idx)) {
          seen.add(idx);
          banks.push({ index: idx, label: group.waveBankLabels[i] });
        }
      }
    }
    return banks;
  }, [toneGroups]);

  return (
    <div className="bg-s330-bg rounded p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-s330-muted text-xs uppercase tracking-wide">Memory Map</div>
        {onFindBestFit && (
          <button
            onClick={onFindBestFit}
            disabled={findBestFitDisabled}
            className="text-xs text-s330-highlight hover:text-s330-text transition-colors disabled:opacity-50"
          >
            Find Best Fit
          </button>
        )}
      </div>

      {/* Tone slot grids */}
      <div className="space-y-2">
        <div className="text-[10px] text-s330-muted">Tone Slots</div>
        {toneGroups.map((group) => (
          <ToneSlotMap
            key={group.firstIndex}
            group={group}
            deviceTones={deviceTones}
            formatToneSlot={formatToneSlot}
            proposal={proposal}
          />
        ))}
      </div>

      {/* Wave segment bars */}
      <div className="space-y-1">
        <div className="text-[10px] text-s330-muted">Wave Memory</div>
        {waveBanks.map(({ index, label }) => (
          <WaveSegmentMap
            key={index}
            bankIndex={index}
            bankLabel={label}
            usedSegments={waveUsage.get(index as 0 | 1 | 2 | 3) ?? new Set()}
            proposal={proposal}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-3 pt-1">
        {legendItems.map(({ label, className }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${className}`} />
            <span className="text-[9px] text-s330-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
