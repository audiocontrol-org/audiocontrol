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

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useLibraryStore } from '@/stores/libraryStore';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { ItemSelection as PluginItemSelection } from '@audiocontrol/editor-core';
import { useLibraryConnection, LibraryConnectionUI } from '@audiocontrol/editor-core';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { PluginLibraryTreePanel } from '@/components/library/PluginLibraryTreePanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { s330LibraryPlugin } from '@/plugins/s330-library-plugin';
import { s550LibraryPlugin } from '@/plugins/s550-library-plugin';
import { SampleBundlePreviewPanel } from '@/components/library/SampleBundlePreviewPanel';
import { CommonSamplePreviewPanel } from '@/components/library/CommonSamplePreviewPanel';
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import { ImportLibraryToneDialog } from '@/components/library/ImportLibraryToneDialog';
import { ImportLibraryPatchDialog } from '@/components/library/ImportLibraryPatchDialog';
import { ImportSamplesDialog } from '@/components/library/ImportSamplesDialog';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';
import { LoopEditorDialog } from '@audiocontrol/loop-editor/ui';
import { SampleEditorDialog } from '@audiocontrol/sample-editor/ui';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ExportPatchDialog } from '@/components/library/ExportPatchDialog';
import {
  useImportSamples,
  drumKitBundleToImportBundle,
} from '@/hooks/useImportSamples';
import { useDirectoryOperations } from '@/hooks/useDirectoryOperations';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { useLibraryImportDialogs } from '@/hooks/useLibraryImportDialogs';
import {
  listSets, listDrumKits, listIndividualTones, listIndividualPatches,
  listIndividualTonesTree, listIndividualPatchesTree, listDrumKitsTree,
  listCommonSamplesTree,
  loadDrumKitBundle,
  type DrumKitInfo, type LibraryToneInfo, type LibraryPatchInfo, type LibraryTreeNode,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import { CreateDirectoryDialog } from '@/components/library/CreateDirectoryDialog';
import { RenameDirectoryDialog } from '@/components/library/RenameDirectoryDialog';
import { DeleteDirectoryDialog } from '@/components/library/DeleteDirectoryDialog';
import { MoveItemDialog } from '@/components/library/MoveItemDialog';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { useRolandEditorDialogs } from '@/hooks/useRolandEditorDialogs';
import { getOverallPercent } from '@/types/import-operation';
import { cn } from '@/lib/utils';

/** Selection state for items in either panel */
export interface ItemSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch' | 'sample' | 'program';
  index?: number;
  name?: string;
  setName?: string;
  path?: string[];
}

/** Load all library data from a directory handle */
async function loadAllLibraryData(handle: StorageDirectoryHandle) {
  const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, commonSamplesTreeData] = await Promise.all([
    listSets(handle), listDrumKits(handle), listIndividualTones(handle), listIndividualPatches(handle),
    listIndividualTonesTree(handle), listIndividualPatchesTree(handle), listDrumKitsTree(handle),
    listCommonSamplesTree(handle),
  ]);
  return { setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, commonSamplesTreeData };
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
  } = useDeviceDataStore();

  const {
    sets, setSets, isLoading, setLoading, setError, error,
    expandedPaths, toggleDirectoryExpanded,
  } = useLibraryStore();

  const [drumKits, setDrumKits] = useState<DrumKitInfo[]>([]);
  const [selectedDrumKitBundle, setSelectedDrumKitBundle] = useState<ResolvedDrumKitBundle | null>(null);
  // Flat lists used for legacy hooks but not read directly (trees used for display)
  const [, setIndividualTones] = useState<LibraryToneInfo[]>([]);
  const [, setIndividualPatches] = useState<LibraryPatchInfo[]>([]);
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [drumKitsTree, setDrumKitsTree] = useState<LibraryTreeNode[]>([]);
  const [commonSamplesTree, setCommonSamplesTree] = useState<LibraryTreeNode[]>([]);
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const library = useLibraryConnection({
    pickerId: 'sampler-library',
    googleDrive: import.meta.env.VITE_GOOGLE_CLIENT_ID
      ? { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID, clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET }
      : undefined,
  });
  const libraryHandle = library.root;
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Map library data to plugin category format
  const categoryData = useMemo(() => ({
    tones: tonesTree,
    patches: patchesTree,
    drumKits: drumKitsTree,
    commonSamples: commonSamplesTree,
  }), [tonesTree, patchesTree, drumKitsTree, commonSamplesTree]);

  // Handle plugin selection change
  const handlePluginSelectionChange = useCallback((pluginSelection: PluginItemSelection | null) => {
    if (!pluginSelection) {
      setSelection(null);
      setSelectedDrumKitBundle(null);
      return;
    }

    const { categoryId, node, meta } = pluginSelection;
    const nodeMeta = meta as { fileName?: string; directoryName?: string; path?: string[] };

    // Map plugin selection to page selection
    let pageSelection: ItemSelection;

    if (categoryId === 'tones') {
      pageSelection = {
        source: 'library',
        type: 'individualTone',
        name: nodeMeta.fileName ?? node.name,
        path: nodeMeta.path,
      };
    } else if (categoryId === 'patches') {
      pageSelection = {
        source: 'library',
        type: 'individualPatch',
        name: nodeMeta.directoryName ?? node.name,
        path: nodeMeta.path,
      };
    } else if (categoryId === 'drumKits') {
      pageSelection = {
        source: 'library',
        type: 'drumKit',
        name: nodeMeta.directoryName ?? node.name,
        path: nodeMeta.path,
      };
      // Load drum kit bundle
      if (libraryHandle) {
        loadDrumKitBundle(libraryHandle, nodeMeta.directoryName ?? node.name, nodeMeta.path)
          .then(setSelectedDrumKitBundle)
          .catch((err) => console.error('[LibraryPage] Failed to load drum kit bundle:', err));
      }
    } else if (categoryId === 'commonSamples') {
      // Determine type from node type
      if (node.type === 'program') {
        pageSelection = {
          source: 'library',
          type: 'program',
          name: nodeMeta.directoryName ?? node.name,
          path: nodeMeta.path,
        };
      } else {
        // sample (including samples with slices, formerly "chopped samples")
        pageSelection = {
          source: 'library',
          type: 'sample',
          name: nodeMeta.directoryName ?? node.name,
          path: nodeMeta.path,
        };
      }
    } else {
      // Unknown category, default to tone
      pageSelection = {
        source: 'library',
        type: 'individualTone',
        name: node.name,
        path: nodeMeta.path,
      };
    }

    setSelection(pageSelection);
    // Clear other selection state when not relevant
    if (categoryId !== 'drumKits') setSelectedDrumKitBundle(null);
  }, [libraryHandle]);

  useEffect(() => {
    if (!adapter) { clientRef.current = null; return; }
    clientRef.current = config.createClient(adapter, { deviceId });
  }, [adapter, deviceId]);

  const setToneForHook = useCallback((index: number, tone: SamplerTone) => setTone(index, tone, totalTones), [setTone, totalTones]);
  const setPatchForHook = useCallback((index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches), [setPatch, totalPatches]);

  const {
    importSamplesDialog, isOperating: isSamplesOperating,
    progress: samplesProgress, error: samplesError,
    openImportSamplesDialog, closeImportSamplesDialog, handleImportSamples,
  } = useImportSamples({ clientRef, libraryHandle, setTone: setToneForHook, setPatch: setPatchForHook });

  const applyLibraryData = useCallback((data: Awaited<ReturnType<typeof loadAllLibraryData>>) => {
    setSets(data.setList); setDrumKits(data.kitList); setIndividualTones(data.toneList);
    setIndividualPatches(data.patchList); setTonesTree(data.tonesTreeData);
    setPatchesTree(data.patchesTreeData); setDrumKitsTree(data.drumKitsTreeData);
    setCommonSamplesTree(data.commonSamplesTreeData);
  }, [setSets]);

  const handleRefreshLibrary = useCallback(async () => {
    if (!libraryHandle) return;
    setLoading(true, 'Refreshing library...');
    try { applyLibraryData(await loadAllLibraryData(libraryHandle)); }
    catch (err) {
      console.error('[LibraryPage] Failed to refresh library:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh library');
    } finally { setLoading(false); }
  }, [libraryHandle, applyLibraryData, setLoading, setError]);

  const editorDialogs = useRolandEditorDialogs({
    libraryHandle,
    selection,
    selectedDrumKitBundle,
    setSelectedDrumKitBundle,
    setLoading: (loading: boolean, message?: string) => setLoading(loading, message),
    onError: (message: string) => setError(message),
    onRefresh: handleRefreshLibrary,
  });

  // Extracted hooks
  const directoryOps = useDirectoryOperations({
    libraryHandle, handleRefreshLibrary, setError, tonesTree, patchesTree, drumKitsTree,
    selection, setSelection, setIndividualTones, setIndividualPatches,
    setTonesTree, setPatchesTree, setDrumKits, setDrumKitsTree, setSelectedDrumKitBundle,
  });

  const exportOps = useLibraryExport({
    clientRef, libraryHandle, tones, patches, setIndividualTones, setIndividualPatches,
  });

  // Wrapper to provide openImportSamplesDialog with drum kit conversion
  const openImportDrumKitDialogCompat = useCallback((kitName: string, bundle: ResolvedDrumKitBundle, path?: string[]) => {
    const importBundle = drumKitBundleToImportBundle(bundle);
    openImportSamplesDialog(kitName, importBundle, 'drumKit', path);
  }, [openImportSamplesDialog]);

  const importDialogs = useLibraryImportDialogs({
    clientRef, libraryHandle, setTone, setPatch, totalTones, totalPatches,
    openImportDrumKitDialog: openImportDrumKitDialogCompat, selection, handleRefreshLibrary,
  });

  // Load library data when connection becomes available
  useEffect(() => {
    if (!libraryHandle) return;
    setLoading(true, 'Loading library...');
    loadAllLibraryData(libraryHandle)
      .then(applyLibraryData)
      .catch((err) => {
        console.error('[LibraryPage] Failed to load library:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      })
      .finally(() => setLoading(false));
  }, [libraryHandle, applyLibraryData, setLoading, setError]);

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

  // Selection handlers
  const handleSelectDevice = useCallback((type: 'tone' | 'patch', index: number) => setSelection({ source: 'device', type, index }), []);
  const handleSelectLibrary = useCallback((type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
    setSelection({ source: 'library', type, name, setName });
    setSelectedDrumKitBundle(null);
  }, []);

  // Import handlers
  const handleOpenSamplesImport = useCallback(() => {
    if (!selection) return;

    if (selection.type === 'drumKit' && selectedDrumKitBundle) {
      const importBundle = drumKitBundleToImportBundle(selectedDrumKitBundle);
      openImportSamplesDialog(selection.name!, importBundle, 'drumKit', selection.path);
    }
  }, [selection, selectedDrumKitBundle, openImportSamplesDialog]);

  // Kit editing and editor dialog handlers are in editorDialogs hook

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">Connect to your S-330 to manage the library.</p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">Go to Connection</a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-s330-text">Library</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 cursor-help" title="This feature is still being designed and not all the wrinkles have been smoothed out yet.">Experimental</span>
            <LibraryConnectionUI
              activeBackend={library.activeBackend}
              isConnected={library.isConnected}
              hasLocalFS={library.hasLocalFS}
              hasGoogleDrive={library.hasGoogleDrive}
              hasOPFS={library.hasOPFS}
              onConnect={library.connect}
              onDisconnect={library.disconnect}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLoadDeviceData} disabled={isLoading} className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}>Refresh Device</button>
            <button onClick={importDialogs.handleOpenSaveDialog} disabled={!libraryHandle || isLoading} data-testid="save-set-button" className={cn('ac-btn ac-btn-sm ac-btn-primary', (!libraryHandle || isLoading) && 'opacity-50')}>Save to Library...</button>
            <button onClick={importDialogs.handleOpenLoadDialog} disabled={!libraryHandle || !selection || selection.type !== 'set'} data-testid="load-set-button" className={cn('ac-btn ac-btn-sm ac-btn-secondary', (!libraryHandle || !selection || selection.type !== 'set') && 'opacity-50')}>Load Selected Set</button>
          </div>
        </div>
      </div>

      {error && (<div className="ac-alert ac-alert-error"><p className="ac-text-error text-sm">{error}</p></div>)}

      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
        <div className="card p-0 overflow-hidden h-full">
          <DeviceMemoryPanel
            tones={tones} patches={patches} loadedToneBanks={loadedToneBanks} loadedPatchBanks={loadedPatchBanks}
            selectedIndex={selection?.source === 'device' ? selection.index : undefined}
            selectedType={selection?.source === 'device' && (selection.type === 'tone' || selection.type === 'patch') ? selection.type : undefined}
            onSelectTone={(index) => handleSelectDevice('tone', index)}
            onSelectPatch={(index) => handleSelectDevice('patch', index)}
            onDropLibraryTone={importDialogs.handleDropLibraryTone}
            onDropLibraryPatch={importDialogs.handleDropLibraryPatch}
          />
        </div>
        <div className="card p-0 overflow-hidden h-full">
          <PluginLibraryTreePanel
            plugin={plugin}
            libraryHandle={libraryHandle}
            sets={sets}
            categoryData={categoryData}
            expandedPaths={expandedPaths as unknown as Record<string, Set<string>>}
            selection={selection?.source === 'library' ? {
              categoryId: selection.type === 'individualTone' ? 'tones'
                : selection.type === 'individualPatch' ? 'patches'
                : selection.type === 'drumKit' ? 'drumKits'
                : selection.type === 'sample' || selection.type === 'program' ? 'commonSamples'
                : 'tones',
              node: { id: selection.name ?? '', name: selection.name ?? '', type: selection.type },
              meta: { path: selection.path },
            } : null}
            onSelectionChange={handlePluginSelectionChange}
            onToggleExpand={(categoryId, nodeId) => {
              const expandKey = categoryId === 'tones' ? 'tones'
                : categoryId === 'patches' ? 'patches'
                : categoryId === 'drumKits' ? 'drumKits'
                : 'commonSamples';
              toggleDirectoryExpanded(expandKey, nodeId);
            }}
            onRefresh={handleRefreshLibrary}
            isLoading={isLoading || exportOps.isExporting}
            onSelectSet={(name) => handleSelectLibrary('set', name)}
            onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
            onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
            onDeleteSet={directoryOps.handleDeleteSet}
            onRenameSet={directoryOps.handleRenameSet}
            onDropDeviceTone={exportOps.handleDropDeviceTone}
            onDropDevicePatch={exportOps.handleDropDevicePatch}
            onCreateDirectory={directoryOps.handleOpenCreateDirectory}
            onDeleteDirectory={directoryOps.handleOpenDeleteDirectory}
            onMoveItem={directoryOps.handleOpenMoveItem}
            onDropMoveItem={directoryOps.handleDropMoveItem}
            onRenameItem={directoryOps.handleRenameItem}
            onDeleteIndividualTone={directoryOps.handleDeleteIndividualTone}
            onDeleteIndividualPatch={directoryOps.handleDeleteIndividualPatch}
            onDeleteDrumKit={directoryOps.handleDeleteDrumKit}
            onOpenInLoopEditor={editorDialogs.handleOpenInLoopEditor}
            onOpenInChopper={editorDialogs.handleOpenInChopper}
            onOpenInSampleEditor={editorDialogs.handleOpenInSampleEditor}
          />
        </div>
        <div className="card p-0 overflow-hidden h-full">
          {selection?.type === 'drumKit' ? (
            <SampleBundlePreviewPanel
              kitInfo={drumKits.find((k) => k.directoryName === selection.name) ?? null}
              libraryHandle={libraryHandle}
              preloadedBundle={selectedDrumKitBundle}
              onImport={handleOpenSamplesImport}
              onEditKit={editorDialogs.handleEditKit}
              onOpenSampleEditor={editorDialogs.handleOpenDrumKitInSampleEditor}
            />
          ) : selection?.type === 'sample' || selection?.type === 'program' ? (
            <CommonSamplePreviewPanel
              selection={selection ? { type: selection.type as 'sample' | 'program', name: selection.name!, path: selection.path } : null}
              libraryHandle={libraryHandle}
              onPromoteToDevice={() => handleRefreshLibrary()}
              onOpenInLoopEditor={(name, path) => editorDialogs.handleOpenInLoopEditor(name, 'sample', path)}
              onOpenInChopper={(name, path) => editorDialogs.handleOpenInChopper(name, 'sample', path)}
              onOpenInSampleEditor={(name, path) => editorDialogs.handleOpenInSampleEditor(name, 'sample', path)}
            />
          ) : (
            <ItemPreviewPanel
              selection={selection} deviceTones={tones} devicePatches={patches} libraryHandle={libraryHandle}
              onImportTone={importDialogs.handleOpenImportToneDialog} onImportPatch={importDialogs.handleOpenImportPatchDialog}
              onImportIndividualTone={importDialogs.handleOpenImportIndividualToneDialog}
              onImportIndividualPatch={importDialogs.handleOpenImportIndividualPatchDialog}
              onLoadSet={importDialogs.handleOpenLoadDialog}
              onOpenInLoopEditor={editorDialogs.handleOpenInLoopEditor}
              onOpenInSampleEditor={editorDialogs.handleOpenInSampleEditor}
            />
          )}
        </div>
      </div>

      <SaveSetDialog
        open={importDialogs.isSaveDialogOpen} onOpenChange={importDialogs.setIsSaveDialogOpen}
        onSave={importDialogs.handleSaveSet} isSaving={importDialogs.operationProgress !== undefined}
        progress={importDialogs.operationProgress ? getOverallPercent(importDialogs.operationProgress) : undefined}
        error={importDialogs.operationError} statusMessage={importDialogs.operationProgress?.stepLabel ?? null}
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
      {editorDialogs.sliceEditDialog && (
        <SampleChopperDialog
          open={editorDialogs.sliceEditDialog.open} onOpenChange={(open) => { if (!open) editorDialogs.closeSliceEditDialog(); }}
          samples={editorDialogs.sliceEditDialog.samples} sampleRate={editorDialogs.sliceEditDialog.sampleRate}
          sourceName={editorDialogs.sliceEditDialog.kitName} onConfirm={() => {}} editMode={true}
          initialSlices={editorDialogs.sliceEditDialog.slices}
          initialLabels={editorDialogs.sliceEditDialog.slices?.map((s) => s.label).join(',')}
          onSlicesUpdated={(slices) => editorDialogs.handleSlicesUpdated(slices, {})}
          onOpenSampleEditor={editorDialogs.handleOpenSliceEditorFromSampleEditor}
        />
      )}
      <ExportToneDialog
        open={!!exportOps.exportToneDialog} onOpenChange={(open) => { if (!open) exportOps.closeExportToneDialog(); }}
        tone={exportOps.exportToneDialog?.tone ?? null} toneIndex={exportOps.exportToneDialog?.toneIndex ?? 0}
        onExport={exportOps.handleExportTone} isOperating={exportOps.isExporting}
        progress={exportOps.exportProgress} error={exportOps.exportError}
      />
      <ExportPatchDialog
        open={!!exportOps.exportPatchDialog} onOpenChange={(open) => { if (!open) exportOps.closeExportPatchDialog(); }}
        patch={exportOps.exportPatchDialog?.patch ?? null} patchIndex={exportOps.exportPatchDialog?.patchIndex ?? 0}
        onExport={exportOps.handleExportPatch} isOperating={exportOps.isExporting}
        progress={exportOps.exportPatchProgress} error={exportOps.exportPatchError}
      />
      <CreateDirectoryDialog
        open={!!directoryOps.createDirectoryDialog}
        onOpenChange={(open) => { if (!open) directoryOps.closeCreateDirectoryDialog(); }}
        onConfirm={directoryOps.handleCreateDirectory}
        parentPath={directoryOps.createDirectoryDialog?.parentPath ?? []}
        category={directoryOps.createDirectoryDialog?.category ?? 'tones'}
      />
      <RenameDirectoryDialog
        open={!!directoryOps.renameDirectoryDialog}
        onOpenChange={(open) => { if (!open) directoryOps.closeRenameDirectoryDialog(); }}
        onConfirm={directoryOps.handleRenameDirectory}
        currentName={directoryOps.renameDirectoryDialog?.currentName ?? ''}
        path={directoryOps.renameDirectoryDialog?.path ?? []} category={directoryOps.renameDirectoryDialog?.category ?? 'tones'}
      />
      <DeleteDirectoryDialog
        open={!!directoryOps.deleteDirectoryDialog}
        onOpenChange={(open) => { if (!open) directoryOps.closeDeleteDirectoryDialog(); }}
        onConfirm={directoryOps.handleDeleteDirectory}
        directoryName={directoryOps.deleteDirectoryDialog?.directoryName ?? ''}
        path={directoryOps.deleteDirectoryDialog?.path ?? []} category={directoryOps.deleteDirectoryDialog?.category ?? 'tones'}
        libraryHandle={libraryHandle}
      />
      <MoveItemDialog
        open={!!directoryOps.moveItemDialog}
        onOpenChange={(open) => { if (!open) directoryOps.closeMoveItemDialog(); }}
        onConfirm={directoryOps.handleMoveItem}
        itemName={directoryOps.moveItemDialog?.itemName ?? ''} itemType={directoryOps.moveItemDialog?.itemType ?? 'tone'}
        currentPath={directoryOps.moveItemDialog?.sourcePath ?? []}
        category={directoryOps.moveItemDialog?.category ?? 'tones'} categoryTree={directoryOps.getMoveDialogTree()}
      />
      {editorDialogs.loopEditorDialog && (
        <LoopEditorDialog
          open={editorDialogs.loopEditorDialog.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeLoopEditor(); }}
          samples={editorDialogs.loopEditorDialog.samples}
          sampleRate={editorDialogs.loopEditorDialog.sampleRate}
          sampleName={editorDialogs.loopEditorDialog.sampleName}
          loopStart={editorDialogs.loopEditorDialog.loopStart}
          loopEnd={editorDialogs.loopEditorDialog.loopEnd}
          rootKey={editorDialogs.loopEditorDialog.rootKey}
          onSave={editorDialogs.handleLoopEditorSave}
        />
      )}
      {editorDialogs.chopperDialog && (
        <SampleChopperDialog
          open={editorDialogs.chopperDialog.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeChopper(); }}
          samples={editorDialogs.chopperDialog.samples}
          sampleRate={editorDialogs.chopperDialog.sampleRate}
          sourceName={editorDialogs.chopperDialog.sampleName}
          editMode={!!editorDialogs.chopperDialog.initialSlices}
          initialSlices={editorDialogs.chopperDialog.initialSlices}
          initialLabels={editorDialogs.chopperDialog.initialLabels}
          onConfirm={() => { editorDialogs.closeChopper(); }}
          onSave={libraryHandle ? editorDialogs.handleChopperSave : undefined}
        />
      )}
      {editorDialogs.sampleEditorDialog && (
        <SampleEditorDialog
          open={editorDialogs.sampleEditorDialog.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeSampleEditor(); }}
          samples={editorDialogs.sampleEditorDialog.samples}
          sampleRate={editorDialogs.sampleEditorDialog.sampleRate}
          sampleName={editorDialogs.sampleEditorDialog.sampleName}
          onSave={libraryHandle ? editorDialogs.handleSampleEditorSave : undefined}
        />
      )}
    </div>
  );
}
