/**
 * Patches page — list-detail editor with the v3 mockup polish applied.
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 patches) by default for faster startup. Tone-bank-0
 * is loaded lazily on first patch selection (#405) — pre-fix this fired
 * eagerly on mount, which a) made `patches-bank-0` an impossible fixture
 * shape, and b) paid for 8 tone fetches before the user saw the detail
 * pane. The PatchEditor's tone-name lookup degrades gracefully (missing
 * tones render as `T<NN>` without the colon-suffix name) so the lazy
 * load is invisible to users — names appear as the fetch resolves.
 *
 * Visual treatment is the operator-approved v3 mockup direction
 * (Phase 9 Task 4):
 *   - Lean page header: h2 + red rule + status metric + icon-button.
 *     The per-bank reload toolbar from earlier phases is gone — refresh
 *     from device is a single icon-button on the title row, matching
 *     DESIGN-SYSTEM.md "List-Level Actions" + "CRUD Affordances on List
 *     Items" (per-row click-to-load remains for unloaded banks).
 *   - 2-column app shell (list + detail). The mockup also reserves a
 *     CRT/front-panel column on the right; that lands in a separate
 *     cross-page commit so this file stays focused on the patches surface.
 *   - Live-edit footer in the detail pane (no save/cancel/undo) — edits
 *     stream to the device in real time per project memory
 *     `feedback_live_editing_no_save`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useBankLoader } from '@/hooks/useBankLoader';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import type { SamplerClientInterface, SamplerPatch, SamplerTone } from '@/core/midi/SamplerClient';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { ExportPatchDialog } from '@/components/library/ExportPatchDialog';
import { useLibraryConnection } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';

export function PatchesPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank, deviceName } = config;

  const { adapter, deviceId, status } = useMidiStore();
  const {
    selectedPatchIndex,
    isLoading,
    loadingMessage,
    loadingProgress,
    error,
    selectPatch,
    setLoading,
    setError,
    setProgress,
    clearProgress,
  } = useEditorStore();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    patches,
    tones,
    loadedPatchBanks,
    setPatch,
    setTone,
    markPatchBankLoaded,
    markToneBankLoaded,
    ensurePatchArraySize,
    ensureToneArraySize,
    invalidatePatchCache,
    invalidateToneCache,
    isToneBankLoaded,
  } = useDeviceDataStore();

  // Keep a ref to the device client (S-330 / S-550 / etc.)
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Bank loading state
  const [loadingBank, setLoadingBank] = useState<number | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Library connection for export
  const library = useLibraryConnection({ pickerId: 'sampler-library' });

  // Library export hook — handles patch export with tone dependencies.
  // Phase 9 Task 4 carry-over (audit finding 5): use the imperative
  // `openExportPatchDialog` opener rather than synthesizing a fake
  // DeviceDragData and routing through `handleDropDevicePatch`. The
  // imperative API throws on cache miss / no library, which surfaces
  // the failure mode loudly per CLAUDE.md "no silent fallbacks".
  const exportOps = useLibraryExport({
    clientRef,
    libraryHandle: library.root,
    tones,
    patches,
    setIndividualTones: () => {}, // Not needed for this page
    setIndividualPatches: () => {}, // Not needed for this page
  });

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = config.createClient(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId, config]);

  // Load a specific range of patches (updates UI progressively)
  const { loadPatchBank, loadToneBank } = useBankLoader({
    clientRef,
    stores: {
      setLoading, setError, setProgress, clearProgress,
      setPatch, setTone, markPatchBankLoaded, markToneBankLoaded,
      ensurePatchArraySize, ensureToneArraySize,
    },
    config: { totalPatches, totalTones, patchesPerBank, tonesPerBank },
  });

  // Load a bank with loading indicator
  const loadPatchBankWithIndicator = useCallback(async (bankIndex: number, forceReload = false) => {
    setLoadingBank(bankIndex);
    try {
      await loadPatchBank(bankIndex, forceReload);
    } finally {
      setLoadingBank(null);
    }
  }, [loadPatchBank]);

  // Load initial data (first bank of patches only — tones load lazily on
  // first patch selection per #405).
  const loadInitialData = useCallback(async () => {
    await loadPatchBankWithIndicator(0);
  }, [loadPatchBankWithIndicator]);

  // Refresh-from-device — replaces the per-bank reload toolbar.
  // Invalidates caches and reloads every bank. The icon-button on the
  // title row binds to this; per-row click-to-load (in PatchList) still
  // handles single-bank loads for the unloaded banks.
  const refreshAll = useCallback(async () => {
    if (!clientRef.current) return;

    clientRef.current.invalidatePatchCache();
    clientRef.current.invalidateToneCache();
    invalidatePatchCache();
    invalidateToneCache();

    const patchBankCount = Math.ceil(totalPatches / patchesPerBank);
    const toneBankCount = Math.ceil(totalTones / tonesPerBank);

    for (let bank = 0; bank < patchBankCount; bank++) {
      await loadPatchBank(bank, true);
    }

    for (let bank = 0; bank < toneBankCount; bank++) {
      await loadToneBank(bank, true);
    }
  }, [
    loadPatchBank,
    loadToneBank,
    invalidatePatchCache,
    invalidateToneCache,
    totalPatches,
    patchesPerBank,
    totalTones,
    tonesPerBank,
  ]);

  // Handle patch updates from the editor
  const handlePatchUpdate = useCallback((index: number, patch: SamplerPatch) => {
    setPatch(index, patch, totalPatches);
  }, [setPatch, totalPatches]);

  // Open export-to-library dialog for a specific patch.
  // Connects the library on demand, then delegates to
  // useLibraryExport.openExportPatchDialog. Errors thrown by the opener
  // surface as state via setError; we don't swallow them.
  const handleOpenExportDialog = useCallback(async (patchIndex: number) => {
    try {
      if (!library.isConnected && library.hasLocalFS) {
        await library.connect('local');
      }
      exportOps.openExportPatchDialog(patchIndex);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open export dialog';
      setError(message);
    }
  }, [library, exportOps, setError]);

  // Auto-load initial data when connected
  useEffect(() => {
    if (!isConnected || hasInitiatedLoad.current) return;

    // Skip if data already in store
    if (patches.length > 0) {
      hasInitiatedLoad.current = true;
      return;
    }

    if (!isLoading) {
      hasInitiatedLoad.current = true;
      loadInitialData();
    }
  }, [isConnected, patches.length, isLoading, loadInitialData]);

  // Lazy tone-bank load on first patch selection (#405). Today this loads
  // bank 0 only — same as the pre-#405 eager mount-time behavior, but
  // deferred until the user actually opens the patch detail pane. Patches
  // in higher banks may reference tones in higher banks; those still
  // require navigating to TonesPage (or refresh-from-device) to load,
  // matching pre-#405 behavior. Smart per-patch bank derivation is a
  // future enhancement.
  //
  // Trigger synchronously inside `handleSelectPatch` rather than via a
  // useEffect on `selectedPatchIndex` — useEffect-based triggers race
  // with downstream user actions (e.g. typing into a parameter input
  // immediately after click), which against the simulated harness can
  // shift the tone-RQDs to fire AFTER a setter consumes the cursor,
  // producing an end-of-fixture error that doesn't match the
  // patch-writes spec's known-divergence filter. Synchronous trigger on
  // click keeps the RQD sequencing deterministic.
  const handleSelectPatch = useCallback((index: number | null) => {
    selectPatch(index);
    if (index === null) return;
    if (!isConnected) return;
    if (isToneBankLoaded(0)) return;
    if (isLoading) return;
    void loadToneBank(0);
  }, [selectPatch, isConnected, isToneBankLoaded, isLoading, loadToneBank]);

  // Loaded counters for the title-row metric.
  const loadedPatches = patches.filter((p): p is SamplerPatch => p !== undefined);
  const loadedTonesArray = tones.filter((t): t is SamplerTone => t !== undefined);
  const loadedPatchCount = loadedPatches.length;

  const selectedPatch = selectedPatchIndex !== null ? patches[selectedPatchIndex] : null;

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your {deviceName} to view and edit patches.
          </p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header — h2 + red rule + status + refresh icon.
          Composed from .ac-page-title-* shared primitives (see
          modules/roland-sxx0-editor/src/styles/_shared.css). The
          `--fixed-viewport` modifier opts this page into the height-
          bounded shell so the list + detail columns scroll internally
          and the document does not scroll as one tall page (see
          DESIGN-SYSTEM.md § "Page Shell Pattern"). */}
      <header className="ac-page-title-row">
        <div className="ac-page-title-block">
          <h2 id="patches-heading" className="ac-page-title-heading">Patches</h2>
          <div className="ac-page-title-rule" aria-hidden="true" />
        </div>
        <span className="ac-page-title-metric">
          <span className="ac-page-title-led" aria-hidden="true" />
          <span>
            <strong>{loadedPatchCount}</strong> of <strong>{totalPatches}</strong> loaded
          </span>
          <button
            type="button"
            onClick={refreshAll}
            disabled={isLoading}
            className={cn(
              'ac-icon-btn',
              isLoading && 'ac-icon-btn--spinning',
            )}
            aria-label="Refresh all patches from device"
            title="Refresh all patches from device"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8a5 5 0 0 1 9-3" />
              <polyline points="12 2 12 5 9 5" />
              <path d="M13 8a5 5 0 0 1-9 3" />
              <polyline points="4 14 4 11 7 11" />
            </svg>
          </button>
        </span>
      </header>

      {/* Inline loading progress — uses the same byte-percent shape we use
          elsewhere, just reframed for the title-row context. */}
      {isLoading && loadingProgress !== null && (
        <div className="patches__progress" role="status" aria-live="polite">
          <div className="patches__progress-track">
            <div
              className="patches__progress-fill"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          {loadingMessage && <span>{loadingMessage}</span>}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div data-testid="error-message" className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* List + detail — fills the remaining vertical space. */}
      {patches.length > 0 && (
        <div className="patches__app-shell" aria-labelledby="patches-heading">
          <PatchList
            patches={patches}
            selectedIndex={selectedPatchIndex}
            onSelect={handleSelectPatch}
            loadedBanks={loadedPatchBanks}
            patchesPerBank={patchesPerBank}
            loadingBank={loadingBank}
            onLoadBank={(bank) => loadPatchBankWithIndicator(bank)}
            onExportPatch={handleOpenExportDialog}
          />
          <article className="patches__detail" aria-labelledby="patch-detail-title">
            {selectedPatch ? (
              <PatchEditor
                patch={selectedPatch}
                index={selectedPatchIndex!}
                tones={loadedTonesArray}
                onUpdate={handlePatchUpdate}
              />
            ) : (
              <div className="ac-detail-empty">Select a patch to edit</div>
            )}
          </article>
        </div>
      )}

      {/* Empty state — only when nothing is loaded and no operation is in flight. */}
      {!isLoading && loadedPatches.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No patches loaded</p>
          <button onClick={loadInitialData} className="ac-btn ac-btn-primary">
            Load Patches
          </button>
        </div>
      )}

      {/* Export to library dialog */}
      {exportOps.exportPatchDialog && (
        <ExportPatchDialog
          open={!!exportOps.exportPatchDialog}
          onOpenChange={(open) => { if (!open) exportOps.closeExportPatchDialog(); }}
          patch={exportOps.exportPatchDialog.patch}
          patchIndex={exportOps.exportPatchDialog.patchIndex}
          onExport={exportOps.handleExportPatch}
          isOperating={exportOps.isExporting}
          progress={exportOps.exportPatchProgress}
          error={exportOps.exportPatchError}
        />
      )}
    </div>
  );
}
