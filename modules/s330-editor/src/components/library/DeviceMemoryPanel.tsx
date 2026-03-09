/**
 * Device Memory Panel
 *
 * Left panel showing tones and patches currently loaded on the S-330 device.
 * Displays slot numbers (T11-T48 for tones, P11-P28 for patches) with names.
 *
 * Supports drag and drop to export items to the library.
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { formatToneSlot, formatPatchSlot } from '@/lib/s330-format';
import type { S330Tone, S330Patch } from '@/core/midi/S330Client';

/**
 * Data transfer format for dragged device items.
 */
export interface DeviceDragData {
  source: 'device';
  type: 'tone' | 'patch';
  index: number;
  name: string;
}

/** MIME type for device drag data */
export const DEVICE_DRAG_MIME = 'application/x-s330-device-item';

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
  // Handle drag start for tones
  const handleToneDragStart = useCallback(
    (e: React.DragEvent, index: number, tone: S330Tone) => {
      const dragData: DeviceDragData = {
        source: 'device',
        type: 'tone',
        index,
        name: tone.name || `Tone ${index + 1}`,
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

  // Handle drag start for patches
  const handlePatchDragStart = useCallback(
    (e: React.DragEvent, index: number, patch: S330Patch) => {
      const dragData: DeviceDragData = {
        source: 'device',
        type: 'patch',
        index,
        name: patch.common.name || `Patch ${index + 1}`,
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    },
    []
  );

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
                  draggable={!!tone}
                  onDragStart={tone ? (e) => handleToneDragStart(e, index, tone) : undefined}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                    'flex items-center gap-2',
                    isSelected
                      ? 'bg-s330-highlight/20 text-s330-highlight'
                      : tone
                        ? 'text-s330-text hover:bg-s330-accent/30 cursor-grab active:cursor-grabbing'
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
                  draggable={!!patch}
                  onDragStart={patch ? (e) => handlePatchDragStart(e, index, patch) : undefined}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                    'flex items-center gap-2',
                    isSelected
                      ? 'bg-s330-highlight/20 text-s330-highlight'
                      : patch
                        ? 'text-s330-text hover:bg-s330-accent/30 cursor-grab active:cursor-grabbing'
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
