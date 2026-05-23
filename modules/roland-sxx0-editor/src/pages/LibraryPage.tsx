/**
 * Library Page - View and manage sampler library sets
 *
 * Three-column layout:
 * - Left: Device memory (tones and patches loaded on device)
 * - Center: Library browser (sets, global tones, patches, drum kits, samples)
 * - Right: Preview/details of selected item with import/export actions
 *
 * Uses the plugin architecture for device-agnostic library browsing.
 */

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useLibraryStore } from '@/stores/libraryStore';
import { useEditorStore } from '@/stores/editorStore';
import { PageTitleRow } from '@/components/common/PageTitleRow';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import {
  useLibraryConnection, useErrorReporter, useLibraryOperations, LibraryConnectionUI, PluginLibraryBrowser,
} from '@audiocontrol/editor-core';
import { s330LibraryPlugin } from '@/plugins/s330-library-plugin';
import { s550LibraryPlugin } from '@/plugins/s550-library-plugin';
import type { DeviceMemoryCustomState, PreviewPanelCustomState } from '@/plugins/shared/plugin-state-types';
import { SetsSection } from '@/components/library/SetsSection';
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import { ImportLibraryToneDialog } from '@/components/library/ImportLibraryToneDialog';
import { ImportLibraryPatchDialog } from '@/components/library/ImportLibraryPatchDialog';
import { ImportSamplesDialog } from '@/components/library/ImportSamplesDialog';
import { LoopEditorDialog } from '@audiocontrol/loop-editor/ui';
import { SampleEditorDialog } from '@audiocontrol/sample-editor/ui';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ExportPatchDialog } from '@/components/library/ExportPatchDialog';
import { BatchExportDrawer } from '@/components/library/BatchExportDrawer';
import { DEVICE_DRAG_MIME, type DeviceDragData } from '@/components/library/DeviceMemoryPanel';
import {
  useImportSamples,
  sampleManifestToImportBundle,
} from '@/hooks/useImportSamples';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { useLibraryImportDialogs } from '@/hooks/useLibraryImportDialogs';
import { useRolandLibraryStrategy } from '@/hooks/useRolandLibraryStrategy';
import { loadChoppedSample } from '@audiocontrol/sampler-library/browser';
import type { LibraryDragPayload } from '@/lib/library-drag-types';

import { useRolandEditorDialogs } from '@/hooks/useRolandEditorDialogs';
import { useRolandLibraryData } from '@/hooks/useRolandLibraryData';
import { useRolandSelectionMapping } from '@/hooks/useRolandSelectionMapping';

/** Selection state for items in either panel */
export interface RolandPageSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set' | 'individualTone' | 'individualPatch' | 'sample' | 'program';
  index?: number;
  name?: string;
  setName?: string;
  path?: string[];
}

export function LibraryPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;
  const { adapter, deviceId, status } = useMidiStore();

  // Select plugin based on device configuration
  const plugin = useMemo(() => {
    return config.deviceType === 's550' ? s550LibraryPlugin : s330LibraryPlugin;
  }, [config.deviceType]);
  const isConnected = status === 'connected' && adapter !== null;

  const {
    tones, patches, loadedToneBanks, loadedPatchBanks,
    setTone, setPatch, ensureToneArraySize, ensurePatchArraySize,
    markToneBankLoaded, markPatchBankLoaded,
    invalidateToneCache, invalidatePatchCache,
  } = useDeviceDataStore();

  // Per-bank loading indicator for the device-memory chevron + reload
  // icon (matching ToneList / PatchList affordances).
  const [loadingToneBank, setLoadingToneBank] = useState<number | null>(null);
  const [loadingPatchBank, setLoadingPatchBank] = useState<number | null>(null);

  const {
    sets, isLoading, setLoading, setError, error,
  } = useLibraryStore();

  const errorReporter = useErrorReporter(setError);

  const library = useLibraryConnection({
    pickerId: 'sampler-library',
    googleDrive: import.meta.env.VITE_GOOGLE_CLIENT_ID
      ? { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID, clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET }
      : undefined,
  });
  const libraryHandle = library.root;
  const clientRef = useRef<SamplerClientInterface | null>(null);

  const libraryData = useRolandLibraryData(libraryHandle);
  const {
    categoryData,
    setIndividualTones, setIndividualPatches,
    handleRefreshLibrary,
  } = libraryData;

  const {
    selection, setSelection,
    handlePluginSelectionChange, handleSelectDevice, handleSelectLibrary,
  } = useRolandSelectionMapping(libraryHandle);

  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      if (import.meta.env.DEV) {
        (window as unknown as { __samplerClient?: SamplerClientInterface | null }).__samplerClient = null;
      }
      return;
    }
    clientRef.current = config.createClient(adapter, { deviceId });
    // Dev-only test seam — wiring tests monkeypatch `requestWaveData`
    // here to selectively succeed or throw per slot index so the
    // batch-export continue-on-error path (D-LIB-31) can be exercised
    // without a fixture that selectively fails. Mirrors the existing
    // `__deviceDataStore` seam used by `seedDeviceTone`. Production
    // builds skip the assignment via the import.meta.env.DEV gate so
    // the surface is never present in shipped bundles.
    if (import.meta.env.DEV) {
      (window as unknown as { __samplerClient?: SamplerClientInterface | null }).__samplerClient = clientRef.current;
    }
  }, [adapter, deviceId]);

  const setToneForHook = useCallback((index: number, tone: SamplerTone) => setTone(index, tone, totalTones), [setTone, totalTones]);
  const setPatchForHook = useCallback((index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches), [setPatch, totalPatches]);

  const {
    importSamplesDialog, isOperating: isSamplesOperating,
    progress: samplesProgress, error: samplesError,
    openImportSamplesDialog,
    closeImportSamplesDialog, handleImportSamples,
  } = useImportSamples({ clientRef, libraryHandle, setTone: setToneForHook, setPatch: setPatchForHook });

  const editorDialogs = useRolandEditorDialogs({
    libraryHandle,
    selection,
    setLoading: (loading: boolean, message?: string) => setLoading(loading, message),
    errorReporter,
    onRefresh: handleRefreshLibrary,
  });

  // Roland-specific library strategy for delete/rename
  const { strategy: rolandStrategy, handleDeleteSet, handleRenameSet } = useRolandLibraryStrategy({
    libraryHandle,
    selection,
    setSelection,
  });

  // Shared library operations hook
  const libraryOps = useLibraryOperations(
    libraryHandle,
    rolandStrategy,
    handleRefreshLibrary,
    errorReporter,
    editorDialogs.createEditorActionHandler(),
  );

  const exportOps = useLibraryExport({
    clientRef, libraryHandle, tones, patches, setIndividualTones, setIndividualPatches,
    handleRefreshLibrary,
  });

  const importDialogs = useLibraryImportDialogs({
    clientRef, libraryHandle, setTone, setPatch, totalTones, totalPatches,
    selection, handleRefreshLibrary,
  });

  /**
   * Sample bundles span multiple tone slots + a wave-bank segment region,
   * so the device-side drop is panel-level (see `DeviceMemoryPanel`
   * `handlePanelSampleDrop`). This callback loads the dropped sample's
   * manifest from OPFS and opens the `ImportSamplesDialog` — that dialog
   * is where the user picks the starting tone slot, wave bank, and
   * segment range.
   *
   * Errors propagate via `setError` so the page-level alert banner
   * surfaces them — per project convention there is no silent fallback;
   * an unloadable sample fails loudly.
   */
  const handleDropLibrarySample = useCallback(async (data: LibraryDragPayload) => {
    if (!libraryHandle) {
      setError('Library not connected.');
      return;
    }
    if (data.nodeType !== 'sample') return;
    try {
      // `data.nodeName` is the YAML's `name` field; `data.sourcePath` is the
      // tree path. For root-level seeds these line up with `loadChoppedSample`'s
      // (name, path) signature. We always target the device's native sample
      // rate (the first allowed rate of the device — both S-330 and S-550
      // accept 30000 Hz; the dialog re-resamples as needed at import time).
      const { manifest } = await loadChoppedSample(libraryHandle, data.nodeName, data.sourcePath);
      const bundle = sampleManifestToImportBundle(manifest, 30000, 60);
      openImportSamplesDialog(data.nodeName, bundle, 'sample', data.sourcePath);
    } catch (err) {
      console.error('[LibraryPage] Failed to load sample for import:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sample bundle');
    }
  }, [libraryHandle, openImportSamplesDialog, setError]);

  // ----------------------------------------------------------------------
  // Dev-only test affordance: open ImportSamplesDialog from a stub bundle
  // ----------------------------------------------------------------------
  //
  // The Tier 3 in-context spec for ImportSamplesDialog
  // (`test/ui/in-context/import-samples-dialog.in-context.spec.ts`) needs
  // the dialog mounted against the production LibraryPage so the
  // BrokenContextWrapper (mounted at App-level) can occlude the page when
  // `?context=<variant>` is set — that's what makes the spec credible
  // against context-level defects.
  //
  // Tier 3's contract (test/ui/in-context/README.md) forbids the
  // `dispatchEvent` ceremony the Tier 1 wiring DnD helper uses, and
  // Playwright's native `page.dragAndDrop` is flaky against HTML5 DnD
  // (documented in `library-flows-dnd.spec.ts:44-48`). Approaches (a)
  // and (b) from the implementer brief are therefore not viable; this
  // is approach (c): expose `window.__libraryPageTestHooks.openImportSamplesDialog`
  // in dev mode only, so the spec can mount the dialog via
  // `page.evaluate(...)` without running the full DnD round-trip.
  //
  // The hook is a thin pass-through to `openImportSamplesDialog` — the
  // exact same production callback the DnD path eventually invokes
  // (see `handleDropLibrarySample` above). Production builds bypass
  // this `useEffect` entirely because `import.meta.env.DEV` evaluates
  // to a literal `false` at build time and Vite tree-shakes the body.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__libraryPageTestHooks = {
      ...(window.__libraryPageTestHooks ?? {}),
      openImportSamplesDialog: (
        name: string,
        bundle: Parameters<typeof openImportSamplesDialog>[1],
      ) => {
        openImportSamplesDialog(name, bundle, 'sample', []);
      },
    };
    return () => {
      // Remove only our hook on unmount; preserve other entries that
      // sibling modules may have installed alongside this one. Without
      // this cleanup, route-switching back-and-forth in dev would leave
      // a closure over a stale openImportSamplesDialog from a prior
      // mount.
      if (window.__libraryPageTestHooks !== undefined) {
        delete window.__libraryPageTestHooks.openImportSamplesDialog;
      }
    };
  }, [openImportSamplesDialog]);

  /**
   * External drops onto the library tree. Currently we only consume device
   * memory items (DEVICE_DRAG_MIME) dragged out of `DeviceMemoryPanel` and
   * route them to the export dialogs. Library items dropped within the
   * library tree are handled inside `PluginLibraryBrowser` and don't reach
   * this callback. This mirrors the Akai editor's `handleExternalDrop` in
   * `akai-s3k-editor/src/pages/LibraryPage.tsx:151-167`.
   */
  const handleExternalDrop = useCallback((
    categoryId: string,
    dataTransfer: DataTransfer,
    targetPath: string[],
  ): boolean => {
    const raw = dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!raw) return false;
    let data: DeviceDragData;
    try {
      data = JSON.parse(raw) as DeviceDragData;
    } catch (err) {
      console.error('[LibraryPage] Failed to parse device drag payload:', err);
      return false;
    }
    // The category gates the direction: tones-section accepts tone drags,
    // patches-section accepts patch drags. Mismatched drops fail loudly
    // (no silent fallback) because the user's intent isn't ambiguous —
    // dropping a tone on the patch section is most likely a mis-aim.
    // targetPath threads through to the export dialog so a drop on a
    // folder row writes into that folder instead of the section root.
    if (data.type === 'tone' && categoryId === 'tones') {
      try {
        exportOps.handleDropDeviceTone(data, targetPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start tone export');
      }
      return true;
    }
    if (data.type === 'patch' && categoryId === 'patches') {
      try {
        exportOps.handleDropDevicePatch(data, targetPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start patch export');
      }
      return true;
    }
    return false;
  }, [exportOps, setError]);

  // Single-bank loaders bound to a bank index. forceReload=true
  // invalidates the cache for that bank before requesting it again
  // (the reload icon in the bank header uses this; click-to-load on
  // an unloaded row uses forceReload=false).
  const loadToneBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;
    setLoadingToneBank(bankIndex);
    try {
      ensureToneArraySize(totalTones);
      if (forceReload) invalidateToneCache();
      await clientRef.current.loadToneRange(
        bankIndex * tonesPerBank,
        tonesPerBank,
        () => {},
        (index: number, tone: SamplerTone) => setTone(index, tone, totalTones),
        forceReload,
      );
      markToneBankLoaded(bankIndex);
    } catch (err) {
      console.error('[LibraryPage] Failed to load tone bank:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tone bank');
    } finally {
      setLoadingToneBank(null);
    }
  }, [setTone, ensureToneArraySize, invalidateToneCache, markToneBankLoaded, totalTones, tonesPerBank, setError]);

  const loadPatchBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;
    setLoadingPatchBank(bankIndex);
    try {
      ensurePatchArraySize(totalPatches);
      if (forceReload) invalidatePatchCache();
      await clientRef.current.loadPatchRange(
        bankIndex * patchesPerBank,
        patchesPerBank,
        () => {},
        (index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches),
        forceReload,
      );
      markPatchBankLoaded(bankIndex);
    } catch (err) {
      console.error('[LibraryPage] Failed to load patch bank:', err);
      setError(err instanceof Error ? err.message : 'Failed to load patch bank');
    } finally {
      setLoadingPatchBank(null);
    }
  }, [setPatch, ensurePatchArraySize, invalidatePatchCache, markPatchBankLoaded, totalPatches, patchesPerBank, setError]);

  const handleLoadDeviceData = useCallback(async () => {
    if (!clientRef.current) return;
    const toneBankCount = Math.ceil(totalTones / tonesPerBank);
    const patchBankCount = Math.ceil(totalPatches / patchesPerBank);
    setLoading(true, 'Loading data from device...');
    try {
      await clientRef.current.connect();
      ensureToneArraySize(totalTones);
      ensurePatchArraySize(totalPatches);
      for (let bank = 0; bank < toneBankCount; bank++) {
        setLoading(true, `Loading tones (bank ${bank + 1}/${toneBankCount})...`);
        await clientRef.current.loadToneRange(bank * tonesPerBank, tonesPerBank, () => {}, (index: number, tone: SamplerTone) => setTone(index, tone, totalTones), true);
        markToneBankLoaded(bank);
      }
      for (let bank = 0; bank < patchBankCount; bank++) {
        setLoading(true, `Loading patches (bank ${bank + 1}/${patchBankCount})...`);
        await clientRef.current.loadPatchRange(bank * patchesPerBank, patchesPerBank, () => {}, (index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches), true);
        markPatchBankLoaded(bank);
      }
    } catch (err) {
      console.error('[LibraryPage] Failed to load device data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load from device');
    } finally { setLoading(false); }
  }, [setLoading, setError, setTone, setPatch, ensureToneArraySize, ensurePatchArraySize, markToneBankLoaded, markPatchBankLoaded, totalTones, tonesPerBank, totalPatches, patchesPerBank]);

  // -----------------------------------------------------------------------
  // Computed state for PluginLibraryBrowser
  // -----------------------------------------------------------------------

  const pluginSelection = useMemo(() => {
    if (!selection || selection.source !== 'library') return null;
    return {
      categoryId: selection.type === 'individualTone' ? 'tones'
        : selection.type === 'individualPatch' ? 'patches'
        : selection.type === 'sample' || selection.type === 'program' ? 'samples'
        : selection.type === 'set' ? 'sets'
        : 'tones',
      node: { id: selection.name ?? '', name: selection.name ?? '', type: selection.type },
      meta: { path: selection.path },
    };
  }, [selection]);

  const deviceMemoryState = useMemo<DeviceMemoryCustomState>(() => ({
    tones, patches, loadedToneBanks, loadedPatchBanks,
    selectedIndex: selection?.source === 'device' ? selection.index : undefined,
    selectedType: selection?.source === 'device' && (selection.type === 'tone' || selection.type === 'patch') ? selection.type : undefined,
    onSelectTone: (index: number) => handleSelectDevice('tone', index),
    onSelectPatch: (index: number) => handleSelectDevice('patch', index),
    onDropLibraryTone: importDialogs.handleDropLibraryTone,
    onDropLibraryPatch: importDialogs.handleDropLibraryPatch,
    onDropLibrarySample: (data) => { void handleDropLibrarySample(data); },
    loadingToneBank, loadingPatchBank,
    onLoadToneBank: (bank: number) => { void loadToneBank(bank); },
    onLoadPatchBank: (bank: number) => { void loadPatchBank(bank); },
    onReloadToneBank: (bank: number) => { void loadToneBank(bank, true); },
    onReloadPatchBank: (bank: number) => { void loadPatchBank(bank, true); },
  }), [
    tones, patches, loadedToneBanks, loadedPatchBanks, selection,
    handleSelectDevice, importDialogs.handleDropLibraryTone,
    importDialogs.handleDropLibraryPatch, handleDropLibrarySample,
    loadingToneBank, loadingPatchBank, loadToneBank, loadPatchBank,
  ]);

  const navigate = useNavigate();
  // Device-memory preview affordances: Export-to-Library reuses the
  // imperative `openExport*Dialog` so the same v3 SteppedProgressDrawer
  // the drag-drop path opens is what the operator sees here. Edit-in-Editor
  // pre-selects the slot in `editorStore` (so TonesPage / PatchesPage
  // open on that slot) and routes via React Router under the active
  // device segment (`/roland/<device>/editor/<page>`).
  const editorBase = `/roland/${config.deviceType}/editor`;
  const handleEditDeviceTone = useCallback((toneIndex: number) => {
    useEditorStore.getState().selectTone(toneIndex);
    navigate(`${editorBase}/tones`);
  }, [editorBase, navigate]);
  const handleEditDevicePatch = useCallback((patchIndex: number) => {
    useEditorStore.getState().selectPatch(patchIndex);
    navigate(`${editorBase}/patches`);
  }, [editorBase, navigate]);

  const previewState = useMemo<PreviewPanelCustomState>(() => ({
    pageSelection: selection,
    deviceTones: tones,
    devicePatches: patches,
    libraryHandle,
    onImportTone: importDialogs.handleOpenImportToneDialog,
    onImportPatch: importDialogs.handleOpenImportPatchDialog,
    onImportIndividualTone: importDialogs.handleOpenImportIndividualToneDialog,
    onImportIndividualPatch: importDialogs.handleOpenImportIndividualPatchDialog,
    onLoadSet: importDialogs.handleOpenLoadDialog,
    onOpenInLoopEditor: (name: string, path?: string[]) => editorDialogs.handleOpenInLoopEditor(name, 'sample', path),
    onOpenInChopper: (name: string, path?: string[]) => editorDialogs.handleOpenInChopper(name, 'sample', path),
    onOpenInSampleEditor: (name: string, path?: string[]) => editorDialogs.handleOpenInSampleEditor(name, 'sample', path),
    onExportDeviceTone: exportOps.openExportToneDialog,
    onExportDevicePatch: exportOps.openExportPatchDialog,
    onEditDeviceTone: handleEditDeviceTone,
    onEditDevicePatch: handleEditDevicePatch,
  }), [
    selection, tones, patches, libraryHandle, importDialogs, editorDialogs,
    exportOps.openExportToneDialog, exportOps.openExportPatchDialog,
    handleEditDeviceTone, handleEditDevicePatch,
  ]);

  const connectionSlot = (
    <LibraryConnectionUI
      activeBackend={library.activeBackend}
      isConnected={library.isConnected}
      hasLocalFS={library.hasLocalFS}
      hasGoogleDrive={library.hasGoogleDrive}
      hasOPFS={library.hasOPFS}
      onConnect={library.connect}
      onDisconnect={library.disconnect}
    />
  );

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">Connect to your {config.deviceName} to manage the library.</p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">Go to Connection</a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header — h2 + experimental badge + red rule, with
          page-level actions on the right. Same .ac-page-title-row
          primitive PatchesPage / TonesPage / PlayPage use. Replaces the
          legacy .ac-page-sticky-header chrome whose negative inline
          margins overlap the VideoCapture drawer + the library browser
          column headers. */}
      {/* Render the Experimental tag INSIDE the <h2> as inline content
          (passed via headingNode) so the heading's intrinsic line-
          height is the row's height — identical to TonesPage /
          PatchesPage where the <h2> is a direct child of
          .ac-page-title-block with no wrapper. Using a flex wrapper
          around the h2 shifts vertical baselines by 1–2px on macOS
          Safari, which the operator perceives as a header inconsistency. */}
      <PageTitleRow
        headingId="library-heading"
        headingNode={
          <>
            Library
            <span
              className="ac-page-title-tag ac-page-title-tag--warn"
              title="This feature is still being designed and not all the wrinkles have been smoothed out yet."
              style={{ marginLeft: 'var(--ac-space-3)', verticalAlign: 'middle' }}
            >
              Experimental
            </span>
          </>
        }
        onRefresh={handleLoadDeviceData}
        isLoading={isLoading}
        refreshLabel="Refresh device data"
      />
      {/* Save to Library / Load Selected Set were removed — the library
          now offers per-object load + save affordances attached to the
          relevant object (set / tone / patch / sample) where the
          operator expects them. Handlers still live on `importDialogs`
          and are wired through the per-object UI. */}

      {error && (<div className="ac-alert ac-alert-error"><p className="ac-text-error text-sm">{error}</p></div>)}

      <div className="ac-page-shell-body" data-capability="C-LIB-01">
        <PluginLibraryBrowser
          plugin={plugin}
          libraryHandle={libraryHandle}
          categoryData={categoryData}
          expandedPaths={libraryOps.expandedPaths}
          selection={pluginSelection}
          onSelectionChange={handlePluginSelectionChange}
          onToggleExpand={libraryOps.onToggleExpand}
          onRefresh={handleRefreshLibrary}
          onCreateFolder={libraryOps.onCreateFolder}
          onDelete={libraryOps.onDelete}
          onMove={libraryOps.onMove}
          onRename={libraryOps.onRename}
          onContextMenuAction={libraryOps.onContextMenuAction}
          onFileDrop={libraryOps.onFileDrop}
          onBatchDelete={libraryOps.onBatchDelete}
          onBatchMove={libraryOps.onBatchMove}
          onExternalDrop={handleExternalDrop}
          deviceMemoryState={deviceMemoryState}
          previewState={previewState}
          loading={isLoading || exportOps.isExporting}
          error={error ?? undefined}
          connectionSlot={connectionSlot}
          headerSections={
            <SetsSection
              sets={sets}
              libraryHandle={libraryHandle}
              selection={pluginSelection}
              onSelectSet={(name) => handleSelectLibrary('set', name)}
              onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
              onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
              onDeleteSet={handleDeleteSet}
              onRenameSet={handleRenameSet}
            />
          }
        />
      </div>

      <SaveSetDialog
        open={importDialogs.isSaveDialogOpen} onOpenChange={importDialogs.setIsSaveDialogOpen}
        onSave={importDialogs.handleSaveSet} isSaving={importDialogs.operationProgress !== undefined}
        progress={importDialogs.operationProgress}
        error={importDialogs.operationError}
        success={importDialogs.saveSuccess}
      />
      <LoadSetDialog
        open={importDialogs.isLoadDialogOpen} onOpenChange={importDialogs.setIsLoadDialogOpen}
        setName={selection?.name ?? ''} onLoad={importDialogs.handleLoadSet}
        isOperating={importDialogs.operationProgress !== undefined}
        progress={importDialogs.operationProgress} error={importDialogs.operationError}
        importTargets={config.memoryLayout.importTargets} deviceTones={tones}
        toneGroups={config.memoryLayout.toneGroups} formatToneSlot={config.memoryLayout.formatToneSlot}
        success={importDialogs.loadSuccess}
      />
      {importDialogs.importToneDialog && libraryHandle && (
        <ImportLibraryToneDialog
          open={!!importDialogs.importToneDialog}
          onOpenChange={(open) => { if (!open) importDialogs.setImportToneDialog(null); }}
          libraryHandle={libraryHandle} setName={importDialogs.importToneDialog.setName}
          toneFile={importDialogs.importToneDialog.toneFile} deviceTones={tones}
          initialTargetSlot={importDialogs.importToneDialog.initialTargetSlot}
          onImport={importDialogs.handleImportLibraryTone} isOperating={importDialogs.isImporting}
          progress={importDialogs.operationProgress} error={importDialogs.operationError}
        />
      )}
      {importDialogs.importPatchDialog && libraryHandle && (
        <ImportLibraryPatchDialog
          open={!!importDialogs.importPatchDialog}
          onOpenChange={(open) => { if (!open) importDialogs.setImportPatchDialog(null); }}
          libraryHandle={libraryHandle} setName={importDialogs.importPatchDialog.setName}
          patchFile={importDialogs.importPatchDialog.patchFile} patchPath={importDialogs.importPatchDialog.patchPath}
          deviceTones={tones} devicePatches={patches}
          initialTargetSlot={importDialogs.importPatchDialog.initialTargetSlot}
          onImport={importDialogs.handleImportLibraryPatch} isOperating={importDialogs.isImporting}
          progress={importDialogs.operationProgress} error={importDialogs.operationError}
        />
      )}
      {importSamplesDialog && (
        <ImportSamplesDialog
          open={!!importSamplesDialog} onOpenChange={(open) => { if (!open) closeImportSamplesDialog(); }}
          bundle={importSamplesDialog.bundle} deviceTones={tones} devicePatches={patches}
          onImport={handleImportSamples} isOperating={isSamplesOperating}
          progress={samplesProgress} error={samplesError}
        />
      )}
      <ExportToneDialog
        open={!!exportOps.exportToneDialog} onOpenChange={(open) => { if (!open) exportOps.closeExportToneDialog(); }}
        tone={exportOps.exportToneDialog?.tone ?? null} toneIndex={exportOps.exportToneDialog?.toneIndex ?? 0}
        targetPath={exportOps.exportToneDialog?.targetPath}
        onExport={exportOps.handleExportTone} isOperating={exportOps.isExporting}
        progress={exportOps.exportProgress} error={exportOps.exportError}
      />
      <ExportPatchDialog
        open={!!exportOps.exportPatchDialog} onOpenChange={(open) => { if (!open) exportOps.closeExportPatchDialog(); }}
        patch={exportOps.exportPatchDialog?.patch ?? null} patchIndex={exportOps.exportPatchDialog?.patchIndex ?? 0}
        targetPath={exportOps.exportPatchDialog?.targetPath}
        onExport={exportOps.handleExportPatch} isOperating={exportOps.isExporting}
        progress={exportOps.exportPatchProgress} error={exportOps.exportPatchError}
      />
      <BatchExportDrawer
        open={!!exportOps.batchExportDialog}
        onOpenChange={(open) => { if (!open) exportOps.closeBatchExportDialog(); }}
        kind={exportOps.batchExportDialog?.kind ?? 'tone'}
        items={exportOps.batchExportDialog?.items ?? []}
        targetPath={exportOps.batchExportDialog?.targetPath ?? []}
        failures={exportOps.batchExportFailures}
        onExport={exportOps.handleBatchExport}
        isOperating={exportOps.isExporting}
        progress={exportOps.batchExportProgress}
        error={exportOps.batchExportError}
      />
      {editorDialogs.loopEditor && (
        <LoopEditorDialog
          open={editorDialogs.loopEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeLoopEditor(); }}
          samples={editorDialogs.loopEditor.samples}
          sampleRate={editorDialogs.loopEditor.sampleRate}
          sampleName={editorDialogs.loopEditor.sampleName}
          loopStart={editorDialogs.loopEditor.loopStart}
          loopEnd={editorDialogs.loopEditor.loopEnd}
          rootKey={editorDialogs.loopEditor.rootKey}
          onSave={editorDialogs.handleLoopEditorSave}
        />
      )}
      {editorDialogs.chopper && (
        <SampleChopperDialog
          open={editorDialogs.chopper.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeChopper(); }}
          samples={editorDialogs.chopper.samples}
          sampleRate={editorDialogs.chopper.sampleRate}
          sourceName={editorDialogs.chopper.sampleName}
          editMode={!!editorDialogs.chopper.initialSlices}
          initialSlices={editorDialogs.chopper.initialSlices}
          initialLabels={editorDialogs.chopper.initialLabels}
          onConfirm={() => { editorDialogs.closeChopper(); }}
          onSave={libraryHandle ? editorDialogs.handleChopperSave : undefined}
        />
      )}
      {editorDialogs.sampleEditor && (
        <SampleEditorDialog
          open={editorDialogs.sampleEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeSampleEditor(); }}
          samples={editorDialogs.sampleEditor.samples}
          sampleRate={editorDialogs.sampleEditor.sampleRate}
          sampleName={editorDialogs.sampleEditor.sampleName}
          onSave={libraryHandle ? editorDialogs.handleSampleEditorSave : undefined}
        />
      )}
    </div>
  );
}
