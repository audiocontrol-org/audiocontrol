/**
 * Device Memory Panel
 *
 * Left panel showing tones and patches currently loaded on the S-330 device.
 * Displays slot numbers (T11-T48 for tones, P01-P16 for patches) with names.
 */

import { cn } from '@/lib/utils';
import type { S330Tone, S330Patch } from '@/core/midi/S330Client';

interface DeviceMemoryPanelProps {
  tones: (S330Tone | undefined)[];
  patches: (S330Patch | undefined)[];
  loadedToneBanks: number[];
  loadedPatchBanks: number[];
  selectedIndex?: number;
  selectedType?: 'tone' | 'patch';
  onSelectTone: (index: number) => void;
  onSelectPatch: (index: number) => void;
}

/**
 * Format tone slot number (0-31 -> T11-T48)
 */
function formatToneSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `T${bank}${slot}`;
}

/**
 * Format patch slot number (0-15 -> P01-P16)
 */
function formatPatchSlot(index: number): string {
  return `P${String(index + 1).padStart(2, '0')}`;
}

export function DeviceMemoryPanel({
  tones,
  patches,
  loadedToneBanks,
  loadedPatchBanks,
  selectedIndex,
  selectedType,
  onSelectTone,
  onSelectPatch,
}: DeviceMemoryPanelProps): JSX.Element {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Device Memory</h3>
        <p className="text-xs text-s330-muted mt-1">
          {tones.filter(Boolean).length} tones, {patches.filter(Boolean).length} patches
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Tones Section */}
        <div className="p-2">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Tones (32 slots)
          </div>
          <div className="space-y-0.5">
            {tones.map((tone, index) => {
              const isSelected = selectedType === 'tone' && selectedIndex === index;
              const bankIndex = Math.floor(index / 8);
              const isLoaded = loadedToneBanks.includes(bankIndex);

              return (
                <button
                  key={index}
                  onClick={() => onSelectTone(index)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                    'flex items-center gap-2',
                    isSelected
                      ? 'bg-s330-highlight/20 text-s330-highlight'
                      : tone
                        ? 'text-s330-text hover:bg-s330-accent/30'
                        : 'text-s330-muted/50 hover:bg-s330-accent/20'
                  )}
                >
                  <span className="w-8 text-xs font-mono text-s330-muted">
                    {formatToneSlot(index)}
                  </span>
                  <span className={cn('flex-1 truncate', !tone && 'italic')}>
                    {tone?.name || (isLoaded ? '(empty)' : '(not loaded)')}
                  </span>
                  {tone && (
                    <span className="text-xs text-s330-muted">
                      {tone.sampleRate}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Patches Section */}
        <div className="p-2 border-t border-s330-accent/50">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Patches (16 slots)
          </div>
          <div className="space-y-0.5">
            {patches.map((patch, index) => {
              const isSelected = selectedType === 'patch' && selectedIndex === index;
              const bankIndex = Math.floor(index / 8);
              const isLoaded = loadedPatchBanks.includes(bankIndex);

              return (
                <button
                  key={index}
                  onClick={() => onSelectPatch(index)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                    'flex items-center gap-2',
                    isSelected
                      ? 'bg-s330-highlight/20 text-s330-highlight'
                      : patch
                        ? 'text-s330-text hover:bg-s330-accent/30'
                        : 'text-s330-muted/50 hover:bg-s330-accent/20'
                  )}
                >
                  <span className="w-8 text-xs font-mono text-s330-muted">
                    {formatPatchSlot(index)}
                  </span>
                  <span className={cn('flex-1 truncate', !patch && 'italic')}>
                    {patch?.common.name || (isLoaded ? '(empty)' : '(not loaded)')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
