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

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import { PatchLabel } from '@/components/common/PatchLabel';
import { BankHeader } from '@/components/common/BankHeader';
import { isToneEmpty, isPatchEmpty } from '@/lib/slot-allocation';
import type { LibraryDragPayload } from '@/lib/library-drag-types';
import { LIBRARY_ITEM_MIME } from '@/lib/library-drag-types';
import { AcChevron } from '@audiocontrol/editor-core';

/** Data transfer payload for items dragged out of the device.
 *  When the operator multi-selects (Ctrl/Shift-click) on the device
 *  memory panel and drags any selected slot, `indices` is populated
 *  with the full selection and the consuming side opens a batch
 *  export drawer instead of the single-item dialog. For single-item
 *  drags `indices` is absent and `index` is the only slot. */
export interface DeviceDragData {
  source: 'device';
  type: 'tone' | 'patch';
  index: number;
  name: string;
  indices?: number[];
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
  // Multi-select sets for batch drag-export. Populated by the click
  // dispatchers below (ctrl/meta-click toggles membership, shift-click
  // extends from the anchor, plain click clears). The dragstart
  // handlers below consult these and emit a batch payload (DeviceDragData
  // with `indices`) when the dragged slot is part of a >1 selection.
  const [multiTones, setMultiTones] = useState<Set<number>>(() => new Set());
  const [multiPatches, setMultiPatches] = useState<Set<number>>(() => new Set());
  const lastToneAnchorRef = useRef<number | null>(null);
  const lastPatchAnchorRef = useRef<number | null>(null);
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

  // ---- Multi-select click dispatchers ---------------------------
  // Plain click  = page-level select (drives the preview pane) AND
  //                clear the multi-set.
  // Ctrl/Meta    = toggle THIS slot in the multi-set; keep the page-
  //                level anchor where it was; the prior anchor is
  //                seeded into the set on the first ctrl-toggle so it
  //                stays highlighted alongside the new selection.
  // Shift-click  = range select from the last anchor to this slot.
  // Empty slots never enter the set and never become an anchor.
  const handleToneClick = useCallback((index: number, e: React.MouseEvent) => {
    if (!tones[index]) return;
    if (e.shiftKey && lastToneAnchorRef.current !== null) {
      const a = Math.min(lastToneAnchorRef.current, index);
      const b = Math.max(lastToneAnchorRef.current, index);
      const next = new Set<number>();
      for (let i = a; i <= b; i += 1) if (tones[i]) next.add(i);
      setMultiTones(next);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/meta-click toggles membership in the multi-set but MUST
      // NOT move the anchor — otherwise a subsequent shift-click would
      // range from the most recent ctrl-click slot instead of the
      // original anchor, contradicting the documented behavior + the
      // OS-standard file-manager idiom (caught by AUDIT-20260521-01).
      // The "seed prior anchor on first toggle" logic still applies so
      // the anchor stays highlighted in the multi-set alongside the
      // new toggles.
      const priorAnchor = lastToneAnchorRef.current;
      setMultiTones((prev) => {
        const next = new Set(prev);
        if (next.size === 0 && priorAnchor !== null && priorAnchor !== index) {
          next.add(priorAnchor);
        }
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
      return;
    }
    setMultiTones(new Set());
    lastToneAnchorRef.current = index;
    onSelectTone(index);
  }, [tones, onSelectTone]);

  const handlePatchClick = useCallback((index: number, e: React.MouseEvent) => {
    if (!patches[index]) return;
    if (e.shiftKey && lastPatchAnchorRef.current !== null) {
      const a = Math.min(lastPatchAnchorRef.current, index);
      const b = Math.max(lastPatchAnchorRef.current, index);
      const next = new Set<number>();
      for (let i = a; i <= b; i += 1) if (patches[i]) next.add(i);
      setMultiPatches(next);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      // See handleToneClick — ctrl/meta does NOT move the anchor; the
      // anchor stays where the last plain or shift click set it so the
      // next shift-click ranges from there. The seed logic uses the
      // CURRENT anchor (not the clicked slot) to keep it highlighted
      // in the multi-set.
      const priorAnchor = lastPatchAnchorRef.current;
      setMultiPatches((prev) => {
        const next = new Set(prev);
        if (next.size === 0 && priorAnchor !== null && priorAnchor !== index) {
          next.add(priorAnchor);
        }
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
      return;
    }
    setMultiPatches(new Set());
    lastPatchAnchorRef.current = index;
    onSelectPatch(index);
  }, [patches, onSelectPatch]);

  // ---- Drag handlers --------------------------------------------
  const handleToneDragStart = useCallback(
    (e: React.DragEvent, index: number, tone: SamplerTone) => {
      // If the dragged slot is part of a multi-select, send the
      // whole set as a batch; otherwise single-item drag (unchanged).
      const batch = multiTones.has(index) && multiTones.size > 1
        ? Array.from(multiTones).sort((a, b) => a - b)
        : undefined;
      const dragData: DeviceDragData = {
        source: 'device', type: 'tone', index,
        name: tone.name || `Tone ${index + 1}`,
        ...(batch ? { indices: batch } : {}),
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      // Shadow MIME used by section dragover handlers to discriminate
      // tone vs patch drags WITHOUT having to parse the JSON payload
      // (which most browsers withhold during dragover for security).
      // Mirrors the LIBRARY_ITEM_MIME pattern in PluginLibraryBrowser.
      e.dataTransfer.setData(`${DEVICE_DRAG_MIME}/tone`, '');
      e.dataTransfer.effectAllowed = 'copy';
    }, [multiTones],
  );

  const handlePatchDragStart = useCallback(
    (e: React.DragEvent, index: number, patch: SamplerPatch) => {
      const batch = multiPatches.has(index) && multiPatches.size > 1
        ? Array.from(multiPatches).sort((a, b) => a - b)
        : undefined;
      const dragData: DeviceDragData = {
        source: 'device', type: 'patch', index,
        name: patch.common.name || `Patch ${index + 1}`,
        ...(batch ? { indices: batch } : {}),
      };
      e.dataTransfer.setData(DEVICE_DRAG_MIME, JSON.stringify(dragData));
      // Shadow MIME — see tone-side comment above.
      e.dataTransfer.setData(`${DEVICE_DRAG_MIME}/patch`, '');
      e.dataTransfer.effectAllowed = 'copy';
    }, [multiPatches],
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
  function renderToneSlot(index: number, bankIndex: number, isBankLoading: boolean): JSX.Element {
    const tone = tones[index];
    const isSelected = selectedType === 'tone' && selectedIndex === index;
    const isMultiSelected = multiTones.has(index);
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

    // Dispatch click through the multi-select handler when a tone is
    // present (plain/ctrl/shift each have distinct semantics). For
    // empty rows fall through to the bank loader as before.
    const handleClick = (e: React.MouseEvent): void => {
      if (tone) {
        handleToneClick(index, e);
      } else if (!isBankLoading && !isLoaded && onLoadToneBank) {
        onLoadToneBank(bankIndex);
      }
    };

    return (
      <div
        key={index}
        role="button"
        tabIndex={isBankLoading ? -1 : 0}
        aria-selected={isSelected || isMultiSelected}
        aria-disabled={isBankLoading}
        data-drag-over={isDragOver ? 'true' : undefined}
        data-multi-selected={isMultiSelected ? 'true' : undefined}
        data-testid={`device-tone-slot-${index}`}
        onClick={isBankLoading ? undefined : handleClick}
        onKeyDown={(e) => {
          if (isBankLoading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Keyboard activation = plain-click semantics (no modifier
            // key handling on Enter/Space). Bypass the multi dispatcher
            // and do a direct page-level select so keyboard users get
            // the same single-select behavior as a plain mouse click.
            if (tone) onSelectTone(index);
            else if (!isLoaded && onLoadToneBank) onLoadToneBank(bankIndex);
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
          isMultiSelected && 'ac-device-memory-row--multi-selected',
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
    const isMultiSelected = multiPatches.has(index);
    const isLoaded = loadedPatchBanks.includes(bankIndex);
    const isDragOver = dragOverPatchSlot === index;
    const isEmpty = patch !== undefined && isPatchEmpty(patch);

    const displayName = isBankLoading
      ? '(loading...)'
      : patch?.common.name || '';

    const handleClick = (e: React.MouseEvent): void => {
      if (patch) {
        handlePatchClick(index, e);
      } else if (!isBankLoading && !isLoaded && onLoadPatchBank) {
        onLoadPatchBank(bankIndex);
      }
    };

    return (
      <div
        key={index}
        role="button"
        tabIndex={isBankLoading ? -1 : 0}
        aria-selected={isSelected || isMultiSelected}
        aria-disabled={isBankLoading}
        data-drag-over={isDragOver ? 'true' : undefined}
        data-multi-selected={isMultiSelected ? 'true' : undefined}
        data-testid={`device-patch-slot-${index}`}
        onClick={isBankLoading ? undefined : handleClick}
        onKeyDown={(e) => {
          if (isBankLoading) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (patch) onSelectPatch(index);
            else if (!isLoaded && onLoadPatchBank) onLoadPatchBank(bankIndex);
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
          isMultiSelected && 'ac-device-memory-row--multi-selected',
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
            <AcChevron expanded={isTonesExpanded} />
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
                      <BankHeader
                        bankIndex={bankIndex}
                        firstSlotLabel={firstLabel}
                        lastSlotLabel={lastLabel}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleToneBank(bankIndex)}
                        isBankLoaded={isBankLoaded}
                        isThisBankLoading={isThisBankLoading}
                        onReload={onReloadToneBank}
                        testIdPrefix="device-tone-bank"
                      />
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
            <AcChevron expanded={isPatchesExpanded} />
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
                      <BankHeader
                        bankIndex={bankIndex}
                        firstSlotLabel={firstLabel}
                        lastSlotLabel={lastLabel}
                        isCollapsed={isCollapsed}
                        onToggle={() => togglePatchBank(bankIndex)}
                        isBankLoaded={isBankLoaded}
                        isThisBankLoading={isThisBankLoading}
                        onReload={onReloadPatchBank}
                        testIdPrefix="device-patch-bank"
                      />
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
