/**
 * Device Memory Panel
 *
 * Left column of the Library page — shows the tones and patches
 * currently held in device RAM, grouped per the device's MemoryLayout.
 *
 * Supports drag-and-drop in both directions:
 *   - Drag a device tone / patch OUT to the library middle column to
 *     export.
 *   - Drop a library tone / patch ON a device slot to import to that
 *     slot.
 *   - Drop a library sample bundle ANYWHERE on the panel to open the
 *     import-samples dialog.
 *
 * Uses the lean .ac-preview-pane chrome + .ac-list-* row primitives
 * so the column visually matches PatchList / ToneList / the preview
 * pane. Drag-state lives in `data-drag-over` on the row (and on the
 * panel for the sample-bundle case).
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { ToneSlotGroup } from '@/configs/types';
import { PatchLabel } from '@/components/common/PatchLabel';
import type { LibraryDragPayload } from '@/lib/library-drag-types';
import { LIBRARY_ITEM_MIME } from '@/lib/library-drag-types';

/** Data transfer payload for items dragged out of the device. */
export interface DeviceDragData {
  source: 'device';
  type: 'tone' | 'patch';
  index: number;
  name: string;
}

/** MIME type for device drag data. */
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
  onDropLibraryTone?: (data: LibraryDragPayload, targetSlot: number) => void;
  onDropLibraryPatch?: (data: LibraryDragPayload, targetSlot: number) => void;
  onDropLibrarySample?: (data: LibraryDragPayload) => void;
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
  onDropLibrarySample,
}: DeviceMemoryPanelProps): JSX.Element {
  const config = useDeviceConfig();
  const { memoryLayout } = config;

  const [dragOverToneSlot, setDragOverToneSlot] = useState<number | null>(null);
  const [dragOverPatchSlot, setDragOverPatchSlot] = useState<number | null>(null);
  const [isSampleDragOver, setIsSampleDragOver] = useState(false);

  // ---- Tone drag handlers ----------------------------------------
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
    [],
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
      if (data.nodeType === 'tone') onDropLibraryTone?.(data, index);
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse tone drop:', err);
    }
  }, [onDropLibraryTone]);

  // ---- Patch drag handlers ---------------------------------------
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
    [],
  );

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
      console.error('[DeviceMemoryPanel] Failed to parse patch drop:', err);
    }
  }, [onDropLibraryPatch]);

  // ---- Panel-level sample-bundle drop ----------------------------
  // A sample bundle occupies a range of tone slots + a wave-bank
  // segment region; dropping on a single slot would be semantically
  // misleading. The user picks the starting tone slot, wave bank, and
  // segment inside `ImportSamplesDialog` after the bundle is loaded.
  const handlePanelSampleDragOver = useCallback((e: React.DragEvent) => {
    if (!onDropLibrarySample) return;
    if (!e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsSampleDragOver(true);
  }, [onDropLibrarySample]);

  const handlePanelSampleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsSampleDragOver(false);
    }
  }, []);

  const handlePanelSampleDrop = useCallback((e: React.DragEvent) => {
    if (!onDropLibrarySample) return;
    setIsSampleDragOver(false);
    const jsonData = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
    if (!jsonData) return;
    let data: LibraryDragPayload;
    try {
      data = JSON.parse(jsonData) as LibraryDragPayload;
    } catch (err) {
      console.error('[DeviceMemoryPanel] Failed to parse panel-level drop:', err);
      return;
    }
    // Only consume sample drops here; tone/patch drops reach the
    // panel via bubbling but the slot-level handlers already consumed
    // them. Filter on nodeType to be explicit.
    if (data.nodeType !== 'sample') return;
    e.preventDefault();
    e.stopPropagation();
    onDropLibrarySample(data);
  }, [onDropLibrarySample]);

  // ---- Renderers --------------------------------------------------

  const renderToneSlot = (index: number): JSX.Element => {
    const tone = tones[index];
    const isSelected = selectedType === 'tone' && selectedIndex === index;
    const bankIndex = Math.floor(index / config.tonesPerBank);
    const isLoaded = loadedToneBanks.includes(bankIndex);
    const isDragOver = dragOverToneSlot === index;

    return (
      <div
        key={index}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        data-drag-over={isDragOver ? 'true' : undefined}
        onClick={() => onSelectTone(index)}
        onKeyDown={(e) => e.key === 'Enter' && onSelectTone(index)}
        draggable={!!tone}
        onDragStart={tone ? (e) => handleToneDragStart(e, index, tone) : undefined}
        onDragOver={handleToneSlotDragOver}
        onDragEnter={(e) => handleToneSlotDragEnter(e, index)}
        onDragLeave={handleToneSlotDragLeave}
        onDrop={(e) => handleToneSlotDrop(e, index)}
        className={cn(
          'ac-device-memory-row',
          tone && 'ac-device-memory-row--draggable',
        )}
      >
        <span className="ac-list-slot">{memoryLayout.formatToneSlot(index)}</span>
        <span className="ac-list-info">
          <span
            className={cn(
              'ac-list-name',
              !tone && !isLoaded && 'ac-list-name--placeholder',
              !tone && isLoaded && 'ac-list-name--empty',
            )}
          >
            {isDragOver
              ? 'Drop to import'
              : tone?.name || (isLoaded ? '' : '')}
          </span>
          {!tone && !isLoaded && !isDragOver && (
            <span className="ac-list-eyebrow">click to load</span>
          )}
        </span>
        {tone && !isDragOver && (
          <span className="ac-list-meta">{tone.sampleRate}</span>
        )}
      </div>
    );
  };

  const renderToneGroup = (group: ToneSlotGroup, groupIndex: number): JSX.Element => {
    const indices = Array.from({ length: group.count }, (_, i) => group.firstIndex + i);
    return (
      <div key={groupIndex}>
        <div className="ac-list-bank-header">
          <span>{group.label}</span>
        </div>
        {indices.map(renderToneSlot)}
      </div>
    );
  };

  const renderPatchSlot = (index: number): JSX.Element => {
    const patch = patches[index];
    const isSelected = selectedType === 'patch' && selectedIndex === index;
    const bankIndex = Math.floor(index / config.patchesPerBank);
    const isLoaded = loadedPatchBanks.includes(bankIndex);
    const isDragOver = dragOverPatchSlot === index;

    return (
      <div
        key={index}
        role="button"
        tabIndex={0}
        aria-selected={isSelected}
        data-drag-over={isDragOver ? 'true' : undefined}
        onClick={() => onSelectPatch(index)}
        onKeyDown={(e) => e.key === 'Enter' && onSelectPatch(index)}
        draggable={!!patch}
        onDragStart={patch ? (e) => handlePatchDragStart(e, index, patch) : undefined}
        onDragOver={handlePatchSlotDragOver}
        onDragEnter={(e) => handlePatchSlotDragEnter(e, index)}
        onDragLeave={handlePatchSlotDragLeave}
        onDrop={(e) => handlePatchSlotDrop(e, index)}
        className={cn(
          'ac-device-memory-row',
          'ac-device-memory-row--patch',
          patch && 'ac-device-memory-row--draggable',
        )}
      >
        <PatchLabel
          index={index}
          memoryLayout={memoryLayout}
          className="ac-list-slot"
        />
        <span className="ac-list-info">
          <span
            className={cn(
              'ac-list-name',
              !patch && !isLoaded && 'ac-list-name--placeholder',
              !patch && isLoaded && 'ac-list-name--empty',
            )}
          >
            {isDragOver
              ? 'Drop to import'
              : patch?.common.name || (isLoaded ? '' : '')}
          </span>
          {!patch && !isLoaded && !isDragOver && (
            <span className="ac-list-eyebrow">click to load</span>
          )}
        </span>
      </div>
    );
  };

  const loadedToneCount = tones.filter(Boolean).length;
  const loadedPatchCount = patches.filter(Boolean).length;

  return (
    <div
      className={cn('ac-preview-pane', 'ac-device-memory-panel')}
      role="region"
      aria-label="Device memory panel — drop library samples to import"
      data-capability="C-LIB-02"
      data-sample-drag-over={isSampleDragOver ? 'true' : undefined}
      onDragOver={handlePanelSampleDragOver}
      onDragLeave={handlePanelSampleDragLeave}
      onDrop={handlePanelSampleDrop}
    >
      <header className="ac-preview-pane-head">
        <h3 className="ac-preview-pane-head-title">Device Memory</h3>
        <span className="ac-preview-pane-head-sub">
          {isSampleDragOver
            ? 'Drop sample bundle to import…'
            : `${loadedToneCount} tones, ${loadedPatchCount} patches`}
        </span>
      </header>

      <div className="ac-preview-pane-body" style={{ padding: 0, gap: 0 }}>
        {/* Tones — one or more groups (S-330: 1 group, S-550: multiple). */}
        <div className="ac-list" style={{ borderRadius: 0, border: 'none', flex: '1 1 auto' }}>
          <div className="ac-list-scroll">
            {memoryLayout.toneGroups.map(renderToneGroup)}
          </div>
        </div>

        {/* Patches — single section. */}
        <div
          className="ac-list"
          style={{
            borderRadius: 0,
            border: 'none',
            borderTop: 'var(--ac-rule-hairline) solid var(--ac-color-border-subtle)',
            flex: '1 1 auto',
          }}
        >
          <div className="ac-list-scroll">
            <div>
              <div className="ac-list-bank-header">
                <span>{memoryLayout.patchSectionLabel}</span>
              </div>
              {Array.from({ length: config.totalPatches }, (_, i) => renderPatchSlot(i))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
