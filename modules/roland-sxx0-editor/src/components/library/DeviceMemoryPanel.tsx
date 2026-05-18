/**
 * Device Memory Panel
 *
 * Left column of the Library page — shows the tones and patches
 * currently held in device RAM, grouped per-bank with the same
 * chevron-collapse + reload-icon + click-to-load chrome as
 * ToneList / PatchList. Drag-and-drop in both directions is
 * preserved:
 *   - Drag a device tone / patch OUT to the library middle column
 *     to export.
 *   - Drop a library tone / patch ON a device slot to import.
 *   - Drop a library sample bundle ANYWHERE on the panel to open
 *     ImportSamplesDialog.
 *
 * Uses .ac-preview-pane chrome + shared .ac-list-* primitives for
 * structural parity with the rest of the editor.
 */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import { PatchLabel } from '@/components/common/PatchLabel';
import { isToneEmpty, isPatchEmpty } from '@/lib/slot-allocation';
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
  loadingToneBank?: number | null;
  loadingPatchBank?: number | null;
  onLoadToneBank?: (bankIndex: number) => void;
  onLoadPatchBank?: (bankIndex: number) => void;
  onReloadToneBank?: (bankIndex: number) => void;
  onReloadPatchBank?: (bankIndex: number) => void;
}

function ReloadIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8a5 5 0 0 1 9-3" />
      <polyline points="12 2 12 5 9 5" />
      <path d="M13 8a5 5 0 0 1-9 3" />
      <polyline points="4 14 4 11 7 11" />
    </svg>
  );
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
  loadingToneBank,
  loadingPatchBank,
  onLoadToneBank,
  onLoadPatchBank,
  onReloadToneBank,
  onReloadPatchBank,
}: DeviceMemoryPanelProps): JSX.Element {
  const config = useDeviceConfig();
  const { memoryLayout, tonesPerBank, patchesPerBank, totalTones, totalPatches } = config;

  const [dragOverToneSlot, setDragOverToneSlot] = useState<number | null>(null);
  const [dragOverPatchSlot, setDragOverPatchSlot] = useState<number | null>(null);
  const [isSampleDragOver, setIsSampleDragOver] = useState(false);
  const [collapsedToneBanks, setCollapsedToneBanks] = useState<Set<number>>(() => new Set());
  const [collapsedPatchBanks, setCollapsedPatchBanks] = useState<Set<number>>(() => new Set());
  // Section-level expand/collapse — independent of per-bank collapse.
  // Default: both sections expanded so the layout is 50/50. Toggling a
  // section to collapsed gives the other section the full remaining
  // height; that way the patches header doesn't jump around as tone
  // banks expand or collapse inside the tones section.
  const [isTonesExpanded, setIsTonesExpanded] = useState(true);
  const [isPatchesExpanded, setIsPatchesExpanded] = useState(true);

  const toggleToneBank = (bank: number): void => {
    setCollapsedToneBanks((prev) => {
      const next = new Set(prev);
      next.has(bank) ? next.delete(bank) : next.add(bank);
      return next;
    });
  };

  const togglePatchBank = (bank: number): void => {
    setCollapsedPatchBanks((prev) => {
      const next = new Set(prev);
      next.has(bank) ? next.delete(bank) : next.add(bank);
      return next;
    });
  };

  // ---- Drag handlers --------------------------------------------
  const handleToneDragStart = useCallback(
    (e: React.DragEvent, index: number, tone: SamplerTone) => {
      const dragData: DeviceDragData = {
        source: 'device', type: 'tone', index,
        name: tone.name || `Tone ${index + 1}`,
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    }, [],
  );

  const handlePatchDragStart = useCallback(
    (e: React.DragEvent, index: number, patch: SamplerPatch) => {
      const dragData: DeviceDragData = {
        source: 'device', type: 'patch', index,
        name: patch.common.name || `Patch ${index + 1}`,
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    }, [],
  );

  const handleSlotDragOver = useCallback((e: React.DragEvent) => {
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

  const handlePatchSlotDragEnter = useCallback((e: React.DragEvent, index: number) => {
    if (e.dataTransfer.types.includes(LIBRARY_ITEM_MIME)) {
      e.preventDefault();
      setDragOverPatchSlot(index);
    }
  }, []);

  const handleSlotDragLeave = useCallback((e: React.DragEvent, kind: 'tone' | 'patch') => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (kind === 'tone') setDragOverToneSlot(null);
      else setDragOverPatchSlot(null);
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
      console.error('[DeviceMemoryPanel] tone drop parse failed:', err);
    }
  }, [onDropLibraryTone]);

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
      console.error('[DeviceMemoryPanel] patch drop parse failed:', err);
    }
  }, [onDropLibraryPatch]);

  // Panel-level sample-bundle drop.
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
      console.error('[DeviceMemoryPanel] panel drop parse failed:', err);
      return;
    }
    if (data.nodeType !== 'sample') return;
    e.preventDefault();
    e.stopPropagation();
    onDropLibrarySample(data);
  }, [onDropLibrarySample]);

  // ---- Renderers -------------------------------------------------
  type BankKind = 'tone' | 'patch';

  function renderBankHeader(
    kind: BankKind,
    bankIndex: number,
    firstSlotLabel: string,
    lastSlotLabel: string,
    isCollapsed: boolean,
    onToggle: () => void,
    isBankLoaded: boolean,
    isLoading: boolean,
    onReload?: () => void,
  ): JSX.Element {
    const reloadLabel = isBankLoaded
      ? `Reload bank ${bankIndex + 1}`
      : `Load bank ${bankIndex + 1}`;
    return (
      <div className="ac-list-bank-header">
        <button
          type="button"
          className="ac-list-bank-toggle"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          aria-label={`Toggle bank ${bankIndex + 1}`}
          data-testid={`device-${kind}-bank-toggle-${bankIndex}`}
        >
          <span className="ac-list-bank-chevron" aria-hidden="true">
            {isCollapsed ? '▸' : '▾'}
          </span>
          <span>Bank {bankIndex + 1}</span>
        </button>
        <span className="ac-list-bank-meta">
          <strong>{firstSlotLabel}–{lastSlotLabel}</strong>
          {onReload && (
            <button
              type="button"
              className={cn(
                'ac-list-bank-reload',
                isLoading && 'ac-list-bank-reload--spinning',
              )}
              onClick={onReload}
              disabled={isLoading}
              aria-label={reloadLabel}
              title={reloadLabel}
              data-testid={`device-${kind}-bank-reload-${bankIndex}`}
            >
              <ReloadIcon />
            </button>
          )}
        </span>
      </div>
    );
  }

  function renderToneSlot(index: number, bankIndex: number, isBankLoading: boolean): JSX.Element {
    const tone = tones[index];
    const isSelected = selectedType === 'tone' && selectedIndex === index;
    const isLoaded = loadedToneBanks.includes(bankIndex);
    const isDragOver = dragOverToneSlot === index;
    // Mirror ToneList's name-class logic exactly so the typography
    // is identical between the editor pages and the device-memory
    // pane. Loaded-with-data → regular .ac-list-name; loaded-but-empty
    // → italic --empty; not-loaded → italic --placeholder.
    const isEmpty = tone !== undefined && isToneEmpty(tone);

    const displayName = isBankLoading
      ? '(loading...)'
      : tone?.name || '';

    const handleClick = (): void => {
      if (tone) {
        onSelectTone(index);
      } else if (!isBankLoading && !isLoaded && onLoadToneBank) {
        onLoadToneBank(bankIndex);
      }
    };

    return (
      <div
        key={index}
        role="button"
        tabIndex={isBankLoading ? -1 : 0}
        aria-selected={isSelected}
        aria-disabled={isBankLoading}
        data-drag-over={isDragOver ? 'true' : undefined}
        data-testid={`device-tone-slot-${index}`}
        onClick={isBankLoading ? undefined : handleClick}
        onKeyDown={(e) => {
          if (isBankLoading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        draggable={!!tone}
        onDragStart={tone ? (e) => handleToneDragStart(e, index, tone) : undefined}
        onDragOver={handleSlotDragOver}
        onDragEnter={(e) => handleToneSlotDragEnter(e, index)}
        onDragLeave={(e) => handleSlotDragLeave(e, 'tone')}
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
              !tone && 'ac-list-name--placeholder',
              tone && isEmpty && 'ac-list-name--empty',
            )}
          >
            {isDragOver ? 'Drop to import' : displayName}
          </span>
          {!tone && !isLoaded && !isBankLoading && !isDragOver && (
            <span className="ac-list-eyebrow">click to load</span>
          )}
        </span>
        {tone && !isEmpty && !isDragOver && (
          <span className="ac-list-meta">{tone.sampleRate}</span>
        )}
      </div>
    );
  }

  function renderPatchSlot(index: number, bankIndex: number, isBankLoading: boolean): JSX.Element {
    const patch = patches[index];
    const isSelected = selectedType === 'patch' && selectedIndex === index;
    const isLoaded = loadedPatchBanks.includes(bankIndex);
    const isDragOver = dragOverPatchSlot === index;
    const isEmpty = patch !== undefined && isPatchEmpty(patch);

    const displayName = isBankLoading
      ? '(loading...)'
      : patch?.common.name || '';

    const handleClick = (): void => {
      if (patch) {
        onSelectPatch(index);
      } else if (!isBankLoading && !isLoaded && onLoadPatchBank) {
        onLoadPatchBank(bankIndex);
      }
    };

    return (
      <div
        key={index}
        role="button"
        tabIndex={isBankLoading ? -1 : 0}
        aria-selected={isSelected}
        aria-disabled={isBankLoading}
        data-drag-over={isDragOver ? 'true' : undefined}
        data-testid={`device-patch-slot-${index}`}
        onClick={isBankLoading ? undefined : handleClick}
        onKeyDown={(e) => {
          if (isBankLoading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        draggable={!!patch}
        onDragStart={patch ? (e) => handlePatchDragStart(e, index, patch) : undefined}
        onDragOver={handleSlotDragOver}
        onDragEnter={(e) => handlePatchSlotDragEnter(e, index)}
        onDragLeave={(e) => handleSlotDragLeave(e, 'patch')}
        onDrop={(e) => handlePatchSlotDrop(e, index)}
        className={cn(
          'ac-device-memory-row',
          'ac-device-memory-row--patch',
          patch && 'ac-device-memory-row--draggable',
        )}
      >
        <PatchLabel index={index} memoryLayout={memoryLayout} className="ac-list-slot" />
        <span className="ac-list-info">
          <span
            className={cn(
              'ac-list-name',
              !patch && 'ac-list-name--placeholder',
              patch && isEmpty && 'ac-list-name--empty',
            )}
          >
            {isDragOver ? 'Drop to import' : displayName}
          </span>
          {!patch && !isLoaded && !isBankLoading && !isDragOver && (
            <span className="ac-list-eyebrow">click to load</span>
          )}
        </span>
      </div>
    );
  }

  const toneBankCount = Math.ceil(totalTones / tonesPerBank);
  const patchBankCount = Math.ceil(totalPatches / patchesPerBank);

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
        {/* When a library sample bundle is being dragged over the panel
            the head subtitle becomes the drop-hint. Otherwise no
            subtitle — the per-section eyebrows already advertise the
            slot counts, and the loaded-row count was both incorrect
            (cache vs device drift) and inconsistent with the Library
            column header which carries no count. */}
        {isSampleDragOver && (
          <span className="ac-preview-pane-head-sub">
            Drop sample bundle to import…
          </span>
        )}
      </header>

      <div className="ac-preview-pane-body" style={{ padding: 0, gap: 0 }}>
        {/* Tones section — section-level expand/collapse so the patches
            header doesn't drift as tone banks toggle. */}
        <section
          className="ac-device-memory-section"
          data-expanded={isTonesExpanded}
          data-testid="device-memory-section-tones"
        >
          <button
            type="button"
            className="ac-device-memory-section-eyebrow"
            onClick={() => setIsTonesExpanded((prev) => !prev)}
            aria-expanded={isTonesExpanded}
            aria-controls="device-memory-tones-list"
            data-testid="device-memory-section-toggle-tones"
          >
            <span className="ac-device-memory-section-eyebrow-chevron" aria-hidden="true">
              {isTonesExpanded ? '▾' : '▸'}
            </span>
            <span>Tones ({totalTones} slots)</span>
          </button>
          <div className="ac-list" id="device-memory-tones-list" style={{ borderRadius: 0, border: 'none', flex: '1 1 0', minHeight: 0 }}>
              <div className="ac-list-scroll">
                {Array.from({ length: toneBankCount }, (_, bankIndex) => {
                  const bankStart = bankIndex * tonesPerBank;
                  const bankEnd = Math.min(bankStart + tonesPerBank, totalTones);
                  const firstLabel = memoryLayout.formatToneSlot(bankStart);
                  const lastLabel = memoryLayout.formatToneSlot(bankEnd - 1);
                  const isCollapsed = collapsedToneBanks.has(bankIndex);
                  const isBankLoaded = loadedToneBanks.includes(bankIndex);
                  const isThisBankLoading = loadingToneBank === bankIndex;
                  return (
                    <div key={`tone-bank-${bankIndex}`} data-bank-index={bankIndex}>
                      {renderBankHeader(
                        'tone', bankIndex, firstLabel, lastLabel,
                        isCollapsed, () => toggleToneBank(bankIndex),
                        isBankLoaded, isThisBankLoading,
                        onReloadToneBank ? () => onReloadToneBank(bankIndex) : undefined,
                      )}
                      <div className="ac-collapse" data-expanded={!isCollapsed}>
                        <div>
                          {Array.from({ length: bankEnd - bankStart }, (_, offset) =>
                            renderToneSlot(bankStart + offset, bankIndex, isThisBankLoading),
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </section>

        {/* Patches section — same shape as the tones section above. */}
        <section
          className="ac-device-memory-section"
          data-expanded={isPatchesExpanded}
          data-testid="device-memory-section-patches"
        >
          <button
            type="button"
            className="ac-device-memory-section-eyebrow"
            onClick={() => setIsPatchesExpanded((prev) => !prev)}
            aria-expanded={isPatchesExpanded}
            aria-controls="device-memory-patches-list"
            data-testid="device-memory-section-toggle-patches"
          >
            <span className="ac-device-memory-section-eyebrow-chevron" aria-hidden="true">
              {isPatchesExpanded ? '▾' : '▸'}
            </span>
            <span>Patches ({totalPatches} slots)</span>
          </button>
          <div className="ac-list" id="device-memory-patches-list" style={{ borderRadius: 0, border: 'none', flex: '1 1 0', minHeight: 0 }}>
              <div className="ac-list-scroll">
                {Array.from({ length: patchBankCount }, (_, bankIndex) => {
                  const bankStart = bankIndex * patchesPerBank;
                  const bankEnd = Math.min(bankStart + patchesPerBank, totalPatches);
                  const firstLabel = memoryLayout.formatPatchSlot(bankStart);
                  const lastLabel = memoryLayout.formatPatchSlot(bankEnd - 1);
                  const isCollapsed = collapsedPatchBanks.has(bankIndex);
                  const isBankLoaded = loadedPatchBanks.includes(bankIndex);
                  const isThisBankLoading = loadingPatchBank === bankIndex;
                  return (
                    <div key={`patch-bank-${bankIndex}`} data-bank-index={bankIndex}>
                      {renderBankHeader(
                        'patch', bankIndex, firstLabel, lastLabel,
                        isCollapsed, () => togglePatchBank(bankIndex),
                        isBankLoaded, isThisBankLoading,
                        onReloadPatchBank ? () => onReloadPatchBank(bankIndex) : undefined,
                      )}
                      <div className="ac-collapse" data-expanded={!isCollapsed}>
                        <div>
                          {Array.from({ length: bankEnd - bankStart }, (_, offset) =>
                            renderPatchSlot(bankStart + offset, bankIndex, isThisBankLoading),
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </section>
      </div>
    </div>
  );
}
