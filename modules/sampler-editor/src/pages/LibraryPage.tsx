/**
 * Library Page - View and manage S-330 library sets
 *
 * Three-column layout:
 * - Left: Device memory (tones and patches loaded on device)
 * - Center: Library browser (sets, global tones, patches, drum kits, samples)
 * - Right: Preview/details of selected item with import/export actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useLibraryStore } from '@/stores/libraryStore';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { LibraryTreePanel } from '@/components/library/LibraryTreePanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { SampleBundlePreviewPanel } from '@/components/library/SampleBundlePreviewPanel';
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import { ImportLibraryToneDialog } from '@/components/library/ImportLibraryToneDialog';
import { ImportLibraryPatchDialog } from '@/components/library/ImportLibraryPatchDialog';
import { ImportSamplesDialog } from '@/components/library/ImportSamplesDialog';
import { SampleChopperDialog, type SliceDefinitionOutput, type InitialSliceDefinition } from '@audiocontrol/sample-chopper/ui';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ExportPatchDialog } from '@/components/library/ExportPatchDialog';
import {
  useImportSamples,
  drumKitBundleToImportBundle,
  choppedSampleToImportBundle,
} from '@/hooks/useImportSamples';
import { useDirectoryOperations } from '@/hooks/useDirectoryOperations';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { useLibraryImportDialogs } from '@/hooks/useLibraryImportDialogs';
import {
  hasFileSystemAccess, pickLibraryDirectory, getCachedLibraryDirectory, setCachedLibraryDirectory,
  listSets, listDrumKits, listIndividualTones, listIndividualPatches,
  listIndividualTonesTree, listIndividualPatchesTree, listDrumKitsTree, listChoppedSamplesTree,
  listCommonSamplesTree,
  loadDrumKitBundle, loadDrumKitSource, updateDrumKitSlices, loadChoppedSampleManifest,
  type DrumKitInfo, type LibraryToneInfo, type LibraryPatchInfo, type LibraryTreeNode,
} from '@/lib/library-service';
import { CreateDirectoryDialog } from '@/components/library/CreateDirectoryDialog';
import { RenameDirectoryDialog } from '@/components/library/RenameDirectoryDialog';
import { DeleteDirectoryDialog } from '@/components/library/DeleteDirectoryDialog';
import { MoveItemDialog } from '@/components/library/MoveItemDialog';
import type { ResolvedDrumKitBundle, ChoppedSample } from '@audiocontrol/sampler-library/browser';
import { parseNoteName } from '@audiocontrol/sampler-library/browser';
import { getOverallPercent } from '@/types/import-operation';
import { cn } from '@/lib/utils';

/** Selection state for items in either panel */
export interface ItemSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch' | 'choppedSample' | 'sample' | 'program';
  index?: number;
  name?: string;
  setName?: string;
  path?: string[];
}

/** Load all library data from a directory handle */
async function loadAllLibraryData(handle: FileSystemDirectoryHandle) {
  const [setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, choppedSamplesTreeData, commonSamplesTreeData] = await Promise.all([
    listSets(handle), listDrumKits(handle), listIndividualTones(handle), listIndividualPatches(handle),
    listIndividualTonesTree(handle), listIndividualPatchesTree(handle), listDrumKitsTree(handle),
    listChoppedSamplesTree(handle), listCommonSamplesTree(handle),
  ]);
  return { setList, kitList, toneList, patchList, tonesTreeData, patchesTreeData, drumKitsTreeData, choppedSamplesTreeData, commonSamplesTreeData };
}

export function LibraryPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;
  const { adapter, deviceId, status } = useMidiStore();
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
  const [selectedChoppedSampleManifest, setSelectedChoppedSampleManifest] = useState<ChoppedSample | null>(null);
  const [selectedChoppedSampleNode, setSelectedChoppedSampleNode] = useState<LibraryTreeNode | null>(null);
  const [individualTones, setIndividualTones] = useState<LibraryToneInfo[]>([]);
  const [individualPatches, setIndividualPatches] = useState<LibraryPatchInfo[]>([]);
  const [tonesTree, setTonesTree] = useState<LibraryTreeNode[]>([]);
  const [patchesTree, setPatchesTree] = useState<LibraryTreeNode[]>([]);
  const [drumKitsTree, setDrumKitsTree] = useState<LibraryTreeNode[]>([]);
  const [choppedSamplesTree, setChoppedSamplesTree] = useState<LibraryTreeNode[]>([]);
  const [commonSamplesTree, setCommonSamplesTree] = useState<LibraryTreeNode[]>([]);
  const [sliceEditDialog, setSliceEditDialog] = useState<{
    open: boolean; kitName: string; path?: string[];
    samples: Int16Array | null; sampleRate: number; slices: InitialSliceDefinition[];
    kitConfig: { name: string; sampleRate: 15000 | 30000; baseNote: number; transpose?: number; velocitySensitivity?: number };
  } | null>(null);
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const clientRef = useRef<SamplerClientInterface | null>(null);

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
    setChoppedSamplesTree(data.choppedSamplesTreeData);
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

  // Initialize library directory
  useEffect(() => {
    async function initLibrary() {
      if (!hasFileSystemAccess()) return;
      const cached = await getCachedLibraryDirectory();
      if (cached) {
        setLibraryHandle(cached);
        try { applyLibraryData(await loadAllLibraryData(cached)); }
        catch (err) { console.error('[LibraryPage] Failed to load library:', err); }
      }
    }
    initLibrary();
  }, [applyLibraryData]);

  const handlePickDirectory = useCallback(async () => {
    const handle = await pickLibraryDirectory();
    if (handle) {
      setLibraryHandle(handle);
      setCachedLibraryDirectory(handle);
      try { applyLibraryData(await loadAllLibraryData(handle)); }
      catch (err) {
        console.error('[LibraryPage] Failed to load library:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    }
  }, [applyLibraryData, setError]);

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
        await clientRef.current.loadToneRange(bank * tonesPerBank, tonesPerBank, () => {}, (index: number, tone: SamplerTone) => setTone(index, tone, totalTones), false);
        markToneBankLoaded(bank);
      }
      for (let bank = 0; bank < patchBankCount; bank++) {
        setLoading(true, `Loading patches (bank ${bank + 1}/${patchBankCount})...`);
        await clientRef.current.loadPatchRange(bank * patchesPerBank, patchesPerBank, () => {}, (index: number, patch: SamplerPatch) => setPatch(index, patch, totalPatches), false);
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
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
  }, []);
  const handleSelectDrumKit = useCallback(async (directoryName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'drumKit', name: directoryName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
    if (libraryHandle) {
      try { setSelectedDrumKitBundle(await loadDrumKitBundle(libraryHandle, directoryName, path)); }
      catch (err) { console.error('[LibraryPage] Failed to load drum kit bundle:', err); }
    }
  }, [libraryHandle]);
  const handleSelectChoppedSample = useCallback(async (directoryName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'choppedSample', name: directoryName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    // Find the node for preview panel
    const findNode = (nodes: LibraryTreeNode[], targetName: string, targetPath: string[]): LibraryTreeNode | null => {
      for (const node of nodes) {
        if (node.type === 'chopped-sample' && (node.directoryName === targetName || node.name === targetName)) {
          const pathMatch = JSON.stringify(node.path) === JSON.stringify(targetPath);
          if (pathMatch) return node;
        }
        if (node.children) {
          const found = findNode(node.children, targetName, targetPath);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(choppedSamplesTree, directoryName, path ?? []);
    setSelectedChoppedSampleNode(node);

    if (libraryHandle) {
      try {
        const manifest = await loadChoppedSampleManifest(libraryHandle, directoryName, path);
        setSelectedChoppedSampleManifest(manifest);
      } catch (err) { console.error('[LibraryPage] Failed to load chopped sample:', err); }
    }
  }, [libraryHandle, choppedSamplesTree]);
  const handleSelectIndividualTone = useCallback((toneName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'individualTone', name: toneName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
  }, []);
  const handleSelectIndividualPatch = useCallback((patchName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'individualPatch', name: patchName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
  }, []);
  const handleSelectSample = useCallback((sampleName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'sample', name: sampleName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
  }, []);
  const handleSelectProgram = useCallback((programName: string, path?: string[]) => {
    setSelection({ source: 'library', type: 'program', name: programName, path });
    setSelectedDrumKitBundle(null);
    setSelectedChoppedSampleManifest(null);
    setSelectedChoppedSampleNode(null);
  }, []);

  // Import handlers
  const handleOpenSamplesImport = useCallback(() => {
    if (!selection) return;

    if (selection.type === 'drumKit' && selectedDrumKitBundle) {
      const importBundle = drumKitBundleToImportBundle(selectedDrumKitBundle);
      openImportSamplesDialog(selection.name!, importBundle, 'drumKit', selection.path);
    } else if (selection.type === 'choppedSample' && selectedChoppedSampleManifest) {
      const manifest = selectedChoppedSampleManifest;
      const rawBaseNote = manifest.variant === 'drum-kit' ? manifest.drumKit.baseNote : 36;
      const baseNote = typeof rawBaseNote === 'string' ? parseNoteName(rawBaseNote) : rawBaseNote;
      const targetRate: 15000 | 30000 = 15000;
      const importBundle = choppedSampleToImportBundle(manifest, targetRate, baseNote);
      openImportSamplesDialog(selection.name!, importBundle, 'choppedSample', selection.path);
    }
  }, [selection, selectedDrumKitBundle, selectedChoppedSampleManifest, openImportSamplesDialog]);

  // Kit editing handlers
  const handleEditKit = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    const bundle = selectedDrumKitBundle;
    if (!bundle.source || !bundle.slices) { console.error('[LibraryPage] Cannot edit kit: not v2 format'); return; }
    setLoading(true, 'Loading source audio...');
    try {
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);
      setSliceEditDialog({
        open: true, kitName: selection.name!, path: selection.path,
        samples: sourceWav.samples, sampleRate: sourceWav.sampleRate,
        slices: bundle.slices.map((s) => ({ label: s.label, startSample: s.startSample, endSample: s.endSample })),
        kitConfig: { name: bundle.name, sampleRate: bundle.sampleRate, baseNote: bundle.baseNote, transpose: bundle.transpose, velocitySensitivity: bundle.velocitySensitivity },
      });
    } catch (err) {
      console.error('[LibraryPage] Failed to load source audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally { setLoading(false); }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, setError]);

  const handleSlicesUpdated = useCallback(async (slices: SliceDefinitionOutput[], kitConfig: { transpose?: number; velocitySensitivity?: number }) => {
    if (!libraryHandle || !sliceEditDialog) return;
    setLoading(true, 'Saving slice changes...');
    try {
      await updateDrumKitSlices(libraryHandle, sliceEditDialog.kitName, slices, kitConfig, sliceEditDialog.path);
      setSelectedDrumKitBundle(await loadDrumKitBundle(libraryHandle, sliceEditDialog.kitName, sliceEditDialog.path));
    } catch (err) {
      console.error('[LibraryPage] Failed to update slices:', err);
      setError(err instanceof Error ? err.message : 'Failed to save slices');
    } finally { setLoading(false); setSliceEditDialog(null); }
  }, [libraryHandle, sliceEditDialog, setLoading, setError]);

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
            {!libraryHandle && hasFileSystemAccess() && (
              <button onClick={handlePickDirectory} className="ac-btn ac-btn-sm ac-btn-primary">Select Library Folder</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleLoadDeviceData} disabled={isLoading} className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}>Refresh Device</button>
            <button onClick={importDialogs.handleOpenSaveDialog} disabled={!libraryHandle || isLoading} className={cn('ac-btn ac-btn-sm ac-btn-primary', (!libraryHandle || isLoading) && 'opacity-50')}>Save to Library...</button>
            <button onClick={importDialogs.handleOpenLoadDialog} disabled={!libraryHandle || !selection || selection.type !== 'set'} className={cn('ac-btn ac-btn-sm ac-btn-secondary', (!libraryHandle || !selection || selection.type !== 'set') && 'opacity-50')}>Load Selected Set</button>
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
          <LibraryTreePanel
            libraryHandle={libraryHandle} sets={sets} drumKits={drumKits}
            individualTones={individualTones} individualPatches={individualPatches}
            tonesTree={tonesTree} patchesTree={patchesTree} drumKitsTree={drumKitsTree}
            choppedSamplesTree={choppedSamplesTree}
            commonSamplesTree={commonSamplesTree}
            expandedPaths={expandedPaths}
            selectedName={selection?.source === 'library' ? selection.name : undefined}
            selectedType={selection?.source === 'library' ? selection.type : undefined}
            selectedSetName={selection?.source === 'library' ? selection.setName : undefined}
            selectedPath={selection?.source === 'library' ? selection.path : undefined}
            onSelectSet={(name) => handleSelectLibrary('set', name)}
            onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
            onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
            onSelectDrumKit={handleSelectDrumKit} onSelectIndividualTone={handleSelectIndividualTone}
            onSelectIndividualPatch={handleSelectIndividualPatch}
            onSelectChoppedSample={handleSelectChoppedSample}
            onSelectSample={handleSelectSample}
            onSelectProgram={handleSelectProgram}
            onRefresh={handleRefreshLibrary}
            isLoading={isLoading || exportOps.isExporting}
            onDropDeviceTone={exportOps.handleDropDeviceTone} onDropDevicePatch={exportOps.handleDropDevicePatch}
            onDeleteSet={directoryOps.handleDeleteSet} onDeleteIndividualTone={directoryOps.handleDeleteIndividualTone}
            onDeleteIndividualPatch={directoryOps.handleDeleteIndividualPatch} onDeleteDrumKit={directoryOps.handleDeleteDrumKit}
            onToggleDirectoryExpanded={toggleDirectoryExpanded}
            onCreateDirectory={directoryOps.handleOpenCreateDirectory} onRenameDirectory={directoryOps.handleOpenRenameDirectory}
            onDeleteDirectory={directoryOps.handleOpenDeleteDirectory} onMoveItem={directoryOps.handleOpenMoveItem}
            onDropMoveItem={directoryOps.handleDropMoveItem} onRenameItem={directoryOps.handleRenameItem}
            onRenameSet={directoryOps.handleRenameSet}
          />
        </div>
        <div className="card p-0 overflow-hidden h-full">
          {selection?.type === 'drumKit' || selection?.type === 'choppedSample' ? (
            <SampleBundlePreviewPanel
              kitInfo={selection.type === 'drumKit' ? (drumKits.find((k) => k.directoryName === selection.name) ?? null) : undefined}
              choppedSampleNode={selection.type === 'choppedSample' ? selectedChoppedSampleNode : undefined}
              libraryHandle={libraryHandle}
              preloadedBundle={selection.type === 'drumKit' ? selectedDrumKitBundle : undefined}
              preloadedManifest={selection.type === 'choppedSample' ? selectedChoppedSampleManifest : undefined}
              onImport={handleOpenSamplesImport}
              onEditKit={selection.type === 'drumKit' ? handleEditKit : undefined}
            />
          ) : (
            <ItemPreviewPanel
              selection={selection} deviceTones={tones} devicePatches={patches} libraryHandle={libraryHandle}
              onImportTone={importDialogs.handleOpenImportToneDialog} onImportPatch={importDialogs.handleOpenImportPatchDialog}
              onImportIndividualTone={importDialogs.handleOpenImportIndividualToneDialog}
              onImportIndividualPatch={importDialogs.handleOpenImportIndividualPatchDialog}
              onLoadSet={importDialogs.handleOpenLoadDialog}
            />
          )}
        </div>
      </div>

      <SaveSetDialog
        open={importDialogs.isSaveDialogOpen} onOpenChange={importDialogs.setIsSaveDialogOpen}
        onSave={importDialogs.handleSaveSet} isSaving={importDialogs.operationProgress !== undefined}
        progress={importDialogs.operationProgress ? getOverallPercent(importDialogs.operationProgress) : undefined}
        error={importDialogs.operationError} statusMessage={importDialogs.operationProgress?.stepLabel ?? null}
      />
      <LoadSetDialog
        open={importDialogs.isLoadDialogOpen} onOpenChange={importDialogs.setIsLoadDialogOpen}
        setName={selection?.name ?? ''} onLoad={importDialogs.handleLoadSet}
        isOperating={importDialogs.operationProgress !== undefined}
        progress={importDialogs.operationProgress} error={importDialogs.operationError}
        importTargets={config.memoryLayout.importTargets} deviceTones={tones}
        toneGroups={config.memoryLayout.toneGroups} formatToneSlot={config.memoryLayout.formatToneSlot}
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
      {sliceEditDialog && (
        <SampleChopperDialog
          open={sliceEditDialog.open} onOpenChange={(open) => { if (!open) setSliceEditDialog(null); }}
          samples={sliceEditDialog.samples} sampleRate={sliceEditDialog.sampleRate}
          sourceName={sliceEditDialog.kitName} onConfirm={() => {}} editMode={true}
          initialSlices={sliceEditDialog.slices}
          initialLabels={sliceEditDialog.slices?.map((s) => s.label).join(',')}
          onSlicesUpdated={(slices) => handleSlicesUpdated(slices, {})}
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
    </div>
  );
}
