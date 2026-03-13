/**
 * Device Memory Panel
 *
 * Left panel showing tones and patches currently loaded on the S-330 device.
 * Displays slot numbers (T11-T48 for tones, P11-P28 for patches) with names.
 *
 * Supports drag and drop:
 * - Drag device items TO library to export
 * - Drop library items ON device slots to import
 */

import { useState, useCallback } from 'react';
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

/**
 * Data transfer format for dragged library items.
 */
export interface LibraryDragData {
  source: 'library';
  type: 'tone' | 'patch' | 'drumKit';
  /** For individual tones/patches: the file/directory name */
  name: string;
  /** For tones/patches in sets: the set name */
  setName?: string;
  /** For tones: the file name within the set */
  toneFile?: string;
  /** For patches: the file name within the set */
  patchFile?: string;
  /** Path segments from category root (for hierarchical library) */
  path?: string[];
}

/** MIME type for library drag data */
export const LIBRARY_DRAG_MIME = 'application/x-s330-library-item';

interface DeviceMemoryPanelProps {
  tones: (S330Tone | undefined)[];
  patches: (S330Patch | undefined)[];
  loadedToneBanks: number[];
  loadedPatchBanks: number[];
  selectedIndex?: number;
  selectedType?: 'tone' | 'patch';
  onSelectTone: (index: number) => void;
  onSelectPatch: (index: number) => void;
  /** Callback when a library tone is dropped on a device tone slot */
  onDropLibraryTone?: (data: LibraryDragData, targetSlot: number) => void;
  /** Callback when a library patch is dropped on a device patch slot */
  onDropLibraryPatch?: (data: LibraryDragData, targetSlot: number) => void;
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
  onDropLibraryTone,
  onDropLibraryPatch,
}: DeviceMemoryPanelProps): JSX.Element {
  // Track which slot has drag over state
  const [dragOverToneSlot, setDragOverToneSlot] = useState<number | null>(null);
  const [dragOverPatchSlot, setDragOverPatchSlot] = useState<number | null>(null);

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

  // Handle drag over for tone slots (accept library tones)
  const handleToneSlotDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleToneSlotDragEnter = useCallback((e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) {
      e.preventDefault();
      setDragOverToneSlot(index);
    }
  }, []);

  const handleToneSlotDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverToneSlot(null);
    }
  }, []);

  const handleToneSlotDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverToneSlot(null);

    const jsonData = e.dataTransfer.getData(LIBRARY_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as LibraryDragData;
      if (data.type === 'tone') {
        onDropLibraryTone?.(data, index);
      }
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse drop data:', err);
    }
  }, [onDropLibraryTone]);

  // Handle drag over for patch slots (accept library patches)
  const handlePatchSlotDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handlePatchSlotDragEnter = useCallback((e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes(LIBRARY_DRAG_MIME)) {
      e.preventDefault();
      setDragOverPatchSlot(index);
    }
  }, []);

  const handlePatchSlotDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverPatchSlot(null);
    }
  }, []);

  const handlePatchSlotDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverPatchSlot(null);

    const jsonData = e.dataTransfer.getData(LIBRARY_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as LibraryDragData;
      if (data.type === 'patch') {
        onDropLibraryPatch?.(data, index);
      }
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse drop data:', err);
    }
  }, [onDropLibraryPatch]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Device Memory</h3>
        <p className="text-xs text-s330-muted mt-1">
          {tones.filter(Boolean).length} tones, {patches.filter(Boolean).length} patches
        </p>
      </div>

      {/* Two independent scroll panes */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tones Section - independent scroll */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-4 py-2 border-b border-s330-accent/30">
            Tones (32 slots)
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {tones.map((tone, index) => {
                const isSelected = selectedType === 'tone' && selectedIndex === index;
                const bankIndex = Math.floor(index / 8);
                const isLoaded = loadedToneBanks.includes(bankIndex);
                const isDragOver = dragOverToneSlot === index;

                return (
                  <div
                    key={index}
                    onClick={() => onSelectTone(index)}
                    draggable={!!tone}
                    onDragStart={tone ? (e) => handleToneDragStart(e, index, tone) : undefined}
                    onDragOver={handleToneSlotDragOver}
                    onDragEnter={(e) => handleToneSlotDragEnter(e, index)}
                    onDragLeave={handleToneSlotDragLeave}
                    onDrop={(e) => handleToneSlotDrop(e, index)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectTone(index)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2',
                      isDragOver
                        ? 'bg-s330-highlight/30 ring-2 ring-s330-highlight ring-inset'
                        : isSelected
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
                      {isDragOver ? 'Drop to import here' : tone?.name || (isLoaded ? '(empty)' : '(not loaded)')}
                    </span>
                    {tone && !isDragOver && (
                      <span className="text-xs text-s330-muted">
                        {tone.sampleRate}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Patches Section - independent scroll */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-s330-accent">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-4 py-2 border-b border-s330-accent/30">
            Patches (16 slots)
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {patches.map((patch, index) => {
                const isSelected = selectedType === 'patch' && selectedIndex === index;
                const bankIndex = Math.floor(index / 8);
                const isLoaded = loadedPatchBanks.includes(bankIndex);
                const isDragOver = dragOverPatchSlot === index;

                return (
                  <div
                    key={index}
                    onClick={() => onSelectPatch(index)}
                    draggable={!!patch}
                    onDragStart={patch ? (e) => handlePatchDragStart(e, index, patch) : undefined}
                    onDragOver={handlePatchSlotDragOver}
                    onDragEnter={(e) => handlePatchSlotDragEnter(e, index)}
                    onDragLeave={handlePatchSlotDragLeave}
                    onDrop={(e) => handlePatchSlotDrop(e, index)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectPatch(index)}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2',
                      isDragOver
                        ? 'bg-s330-highlight/30 ring-2 ring-s330-highlight ring-inset'
                        : isSelected
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
                      {isDragOver ? 'Drop to import here' : patch?.common.name || (isLoaded ? '(empty)' : '(not loaded)')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
