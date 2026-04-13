/**
 * Device Memory Panel
 *
 * Left panel showing tones and patches currently loaded on the device.
 * Tone slots are grouped according to the device's MemoryLayout
 * (e.g., one flat list for S-330, two blocks for S-550).
 *
 * Supports drag and drop:
 * - Drag device items TO library to export
 * - Drop library items ON device slots to import
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { ToneSlotGroup } from '@/configs/types';
import { PatchLabel } from '@/components/common/PatchLabel';
import type { LibraryDragPayload } from '@/lib/library-drag-types';
import { LIBRARY_ITEM_MIME } from '@/lib/library-drag-types';

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
  tones: (SamplerTone | undefined)[];
  patches: (SamplerPatch | undefined)[];
  loadedToneBanks: number[];
  loadedPatchBanks: number[];
  selectedIndex?: number;
  selectedType?: 'tone' | 'patch';
  onSelectTone: (index: number) => void;
  onSelectPatch: (index: number) => void;
  /** Callback when a library tone is dropped on a device tone slot */
  onDropLibraryTone?: (data: LibraryDragPayload, targetSlot: number) => void;
  /** Callback when a library patch is dropped on a device patch slot */
  onDropLibraryPatch?: (data: LibraryDragPayload, targetSlot: number) => void;
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
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  const [dragOverToneSlot, setDragOverToneSlot] = useState<number | null>(null);
  const [dragOverPatchSlot, setDragOverPatchSlot] = useState<number | null>(null);

  const handleToneDragStart = useCallback(
    (e: React.DragEvent, index: number, tone: SamplerTone) => {
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

  const handlePatchDragStart = useCallback(
    (e: React.DragEvent, index: number, patch: SamplerPatch) => {
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

  const handleToneSlotDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleToneSlotDragEnter = useCallback((e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
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

    const jsonData = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as LibraryDragPayload;
      if (data.nodeType === 'tone') {
        onDropLibraryTone?.(data, index);
      }
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse drop data:', err);
    }
  }, [onDropLibraryTone]);

  const handlePatchSlotDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handlePatchSlotDragEnter = useCallback((e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
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

    const jsonData = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as LibraryDragPayload;
      if (data.nodeType === 'patch' || data.nodeType === 'drumKit') {
        onDropLibraryPatch?.(data, index);
      }
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse drop data:', err);
    }
  }, [onDropLibraryPatch]);

  // Render a single tone slot row
  const renderToneSlot = (index: number) => {
    const tone = tones[index];
    const isSelected = selectedType === 'tone' && selectedIndex === index;
    const bankIndex = Math.floor(index / config.tonesPerBank);
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
          {memoryLayout.formatToneSlot(index)}
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
  };

  // Render a tone group (one section with header + slots)
  const renderToneGroup = (group: ToneSlotGroup, groupIndex: number) => {
    const indices = Array.from({ length: group.count }, (_, i) => group.firstIndex + i);

    return (
      <div key={groupIndex} className={cn(groupIndex > 0 && 'border-t border-s330-accent/30')}>
        <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-4 py-2 border-b border-s330-accent/30">
          {group.label}
        </div>
        <div className="p-2">
          <div className="space-y-0.5">
            {indices.map(renderToneSlot)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Device Memory</h3>
        <p className="text-xs text-s330-muted mt-1">
          {tones.filter(Boolean).length} tones, {patches.filter(Boolean).length} patches
        </p>
      </div>

      {/* Tones + Patches in independent scroll panes */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tones Section */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {memoryLayout.toneGroups.map(renderToneGroup)}
          </div>
        </div>

        {/* Patches Section */}
        <div className="flex-1 min-h-0 flex flex-col border-t border-s330-accent">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-4 py-2 border-b border-s330-accent/30">
            {memoryLayout.patchSectionLabel}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {patches.map((patch, index) => {
                const isSelected = selectedType === 'patch' && selectedIndex === index;
                const bankIndex = Math.floor(index / config.patchesPerBank);
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
                    <PatchLabel
                      index={index}
                      memoryLayout={memoryLayout}
                      className="w-8 text-xs text-s330-muted"
                    />
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
