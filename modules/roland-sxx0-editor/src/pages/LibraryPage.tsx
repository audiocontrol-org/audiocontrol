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

import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useLibraryStore } from '@/stores/libraryStore';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import {
  useLibraryConnection, useLibraryOperations, LibraryConnectionUI, PluginLibraryBrowser,
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
import {
  useImportSamples,
} from '@/hooks/useImportSamples';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { useLibraryImportDialogs } from '@/hooks/useLibraryImportDialogs';
import { useRolandLibraryStrategy } from '@/hooks/useRolandLibraryStrategy';

import { useRolandEditorDialogs } from '@/hooks/useRolandEditorDialogs';
import { useRolandLibraryData } from '@/hooks/useRolandLibraryData';
import { useRolandSelectionMapping } from '@/hooks/useRolandSelectionMapping';
import { getOverallPercent } from '@/types/import-operation';
import { cn } from '@/lib/utils';

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
  } = useDeviceDataStore();

  const {
    sets, isLoading, setLoading, setError, error,
  } = useLibraryStore();

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
    if (!adapter) { clientRef.current = null; return; }
    clientRef.current = config.createClient(adapter, { deviceId });
  }, [adapter, deviceId]);

  const setToneForHook = useCallback((index: number, tone: SamplerTone) => setTone(index, tone, totalTones), [setTone, totalTones]);
  const setPatchForHook = useCallback((index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches), [setPatch, totalPatches]);

  const {
    importSamplesDialog, isOperating: isSamplesOperating,
    progress: samplesProgress, error: samplesError,
    closeImportSamplesDialog, handleImportSamples,
  } = useImportSamples({ clientRef, libraryHandle, setTone: setToneForHook, setPatch: setPatchForHook });

  const editorDialogs = useRolandEditorDialogs({
    libraryHandle,
    selection,
    setLoading: (loading: boolean, message?: string) => setLoading(loading, message),
    onError: (message: string) => setError(message),
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
    (msg) => setError(msg),
    editorDialogs.createEditorActionHandler(),
  );

  const exportOps = useLibraryExport({
    clientRef, libraryHandle, tones, patches, setIndividualTones, setIndividualPatches,
  });

  const importDialogs = useLibraryImportDialogs({
    clientRef, libraryHandle, setTone, setPatch, totalTones, totalPatches,
    selection, handleRefreshLibrary,
  });

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
  }), [tones, patches, loadedToneBanks, loadedPatchBanks, selection, handleSelectDevice, importDialogs.handleDropLibraryTone, importDialogs.handleDropLibraryPatch]);

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
  }), [selection, tones, patches, libraryHandle, importDialogs, editorDialogs]);

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
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLoadDeviceData} disabled={isLoading} className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}>Refresh Device</button>
            <button onClick={importDialogs.handleOpenSaveDialog} disabled={!libraryHandle || isLoading} data-testid="save-set-button" className={cn('ac-btn ac-btn-sm ac-btn-primary', (!libraryHandle || isLoading) && 'opacity-50')}>Save to Library...</button>
            <button onClick={importDialogs.handleOpenLoadDialog} disabled={!libraryHandle || !selection || selection.type !== 'set'} data-testid="load-set-button" className={cn('ac-btn ac-btn-sm ac-btn-secondary', (!libraryHandle || !selection || selection.type !== 'set') && 'opacity-50')}>Load Selected Set</button>
          </div>
        </div>
      </div>

      {error && (<div className="ac-alert ac-alert-error"><p className="ac-text-error text-sm">{error}</p></div>)}

      <div className="h-[calc(100vh-12rem)]">
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
