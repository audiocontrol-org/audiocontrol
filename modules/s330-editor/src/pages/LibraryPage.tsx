/**
 * Library Page - View and manage S-330 library sets
 *
 * Three-column layout:
 * - Left: Device memory (tones and patches loaded on device)
 * - Center: Library browser (sets, global tones, patches)
 * - Right: Preview/details of selected item with import/export actions
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceDataStore, TONES_PER_BANK, PATCHES_PER_BANK } from '@/stores/deviceDataStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { LibraryTreePanel } from '@/components/library/LibraryTreePanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { DrumKitPreviewPanel } from '@/components/library/DrumKitPreviewPanel';
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import { ImportLibraryToneDialog } from '@/components/library/ImportLibraryToneDialog';
import { ImportLibraryPatchDialog } from '@/components/library/ImportLibraryPatchDialog';
import { ImportDrumKitDialog } from '@/components/library/ImportDrumKitDialog';
import { useImportDrumKit } from '@/hooks/useImportDrumKit';
import {
  hasFileSystemAccess,
  pickLibraryDirectory,
  getCachedLibraryDirectory,
  setCachedLibraryDirectory,
  listSets,
  listDrumKits,
  loadDrumKitBundle,
  saveDeviceToSetIncremental,
  loadSetToDevice,
  type DrumKitInfo,
} from '@/lib/library-service';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';

/**
 * Selection state for items in either panel
 */
export interface ItemSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set' | 'drumKit';
  index?: number;
  name?: string;
  setName?: string;
}

export function LibraryPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const isConnected = status === 'connected' && adapter !== null;

  // Device data store
  const {
    tones,
    patches,
    loadedToneBanks,
    loadedPatchBanks,
    setTone,
    setPatch,
    ensureToneArraySize,
    ensurePatchArraySize,
    markToneBankLoaded,
    markPatchBankLoaded,
  } = useDeviceDataStore();

  // Library store
  const { sets, setSets, isLoading, setLoading, setError, error } = useLibraryStore();

  // Drum kit state
  const [drumKits, setDrumKits] = useState<DrumKitInfo[]>([]);
  const [selectedDrumKitBundle, setSelectedDrumKitBundle] = useState<ResolvedDrumKitBundle | null>(null);

  // Local state
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [operationProgress, setOperationProgress] = useState<number | undefined>(undefined);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Import dialog state
  const [importToneDialog, setImportToneDialog] = useState<{
    setName: string;
    toneFile: string;
  } | null>(null);
  const [importPatchDialog, setImportPatchDialog] = useState<{
    setName: string;
    patchFile: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // S330 client ref
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Drum kit import hook
  const {
    importDrumKitDialog,
    isImporting: isDrumKitImporting,
    importProgress: drumKitImportProgress,
    importError: drumKitImportError,
    importStatus: drumKitImportStatus,
    openImportDrumKitDialog,
    closeImportDrumKitDialog,
    handleImportDrumKit,
  } = useImportDrumKit({
    clientRef,
    libraryHandle,
    setTone,
    setPatch,
  });

  // Initialize library directory
  useEffect(() => {
    async function initLibrary() {
      if (!hasFileSystemAccess()) return;

      const cached = await getCachedLibraryDirectory();
      if (cached) {
        setLibraryHandle(cached);
        // Load sets and drum kits
        try {
          const [setList, kitList] = await Promise.all([
            listSets(cached),
            listDrumKits(cached),
          ]);
          setSets(setList);
          setDrumKits(kitList);
        } catch (err) {
          console.error('[LibraryPage] Failed to load library:', err);
        }
      }
    }
    initLibrary();
  }, [setSets]);

  // Pick library directory (requires user gesture)
  const handlePickDirectory = useCallback(async () => {
    const handle = await pickLibraryDirectory();
    if (handle) {
      setLibraryHandle(handle);
      setCachedLibraryDirectory(handle);
      // Load sets and drum kits
      try {
        const [setList, kitList] = await Promise.all([
          listSets(handle),
          listDrumKits(handle),
        ]);
        setSets(setList);
        setDrumKits(kitList);
      } catch (err) {
        console.error('[LibraryPage] Failed to load library:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    }
  }, [setSets, setError]);

  // Refresh library contents
  const handleRefreshLibrary = useCallback(async () => {
    if (!libraryHandle) return;

    setLoading(true, 'Refreshing library...');
    try {
      const [setList, kitList] = await Promise.all([
        listSets(libraryHandle),
        listDrumKits(libraryHandle),
      ]);
      setSets(setList);
      setDrumKits(kitList);
    } catch (err) {
      console.error('[LibraryPage] Failed to refresh library:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh library');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, setSets, setLoading, setError]);

  // Load all data from device (tones and patches)
  const handleLoadDeviceData = useCallback(async () => {
    if (!clientRef.current) return;

    setLoading(true, 'Loading data from device...');
    try {
      await clientRef.current.connect();

      // Ensure arrays are properly sized
      ensureToneArraySize();
      ensurePatchArraySize();

      // Load all tones
      for (let bank = 0; bank < 4; bank++) {
        setLoading(true, `Loading tones (bank ${bank + 1}/4)...`);
        await clientRef.current.loadToneRange(
          bank * TONES_PER_BANK,
          TONES_PER_BANK,
          () => {},
          (index: number, tone: S330Tone) => setTone(index, tone),
          false
        );
        markToneBankLoaded(bank);
      }

      // Load all patches
      for (let bank = 0; bank < 2; bank++) {
        setLoading(true, `Loading patches (bank ${bank + 1}/2)...`);
        await clientRef.current.loadPatchRange(
          bank * PATCHES_PER_BANK,
          PATCHES_PER_BANK,
          () => {},
          (index: number, patch: S330Patch) => setPatch(index, patch),
          false
        );
        markPatchBankLoaded(bank);
      }
    } catch (err) {
      console.error('[LibraryPage] Failed to load device data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load from device');
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setTone, setPatch, ensureToneArraySize, ensurePatchArraySize, markToneBankLoaded, markPatchBankLoaded]);

  // Open save set dialog
  const handleOpenSaveDialog = useCallback(() => {
    setOperationError(null);
    setOperationProgress(undefined);
    setIsSaveDialogOpen(true);
  }, []);

  // Status message for save operation
  const [operationStatus, setOperationStatus] = useState<string | null>(null);

  // Save device state to set - fetches ALL data fresh from device
  const handleSaveSet = useCallback(async (setName: string, description?: string) => {
    if (!libraryHandle || !clientRef.current) return;

    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus(null);

    const client = clientRef.current;

    try {
      // Use incremental save - fetches ALL data from device (ignores UI cache)
      await saveDeviceToSetIncremental(
        libraryHandle,
        setName,
        description,
        // Fetch tone data callback - fetches fresh from device
        async (toneIndex) => {
          return await client.requestToneData(toneIndex);
        },
        // Fetch patch data callback - fetches fresh from device
        async (patchIndex) => {
          return await client.requestPatchData(patchIndex);
        },
        // Fetch wave data callback - fetches fresh from device
        async (toneIndex, onWaveProgress) => {
          return await client.requestWaveData(toneIndex, onWaveProgress ?? (() => {}));
        },
        (progress) => setOperationProgress(progress),
        (status) => setOperationStatus(status)
      );

      setOperationProgress(100);

      // Refresh library
      await handleRefreshLibrary();
      setIsSaveDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to save set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to save set');
    }
  }, [libraryHandle, handleRefreshLibrary]);

  // Open load set dialog
  const handleOpenLoadDialog = useCallback(() => {
    if (!selection || selection.type !== 'set' || !selection.name) return;
    setOperationError(null);
    setOperationProgress(undefined);
    setIsLoadDialogOpen(true);
  }, [selection]);

  // Load set to device
  const handleLoadSet = useCallback(async () => {
    if (!libraryHandle || !clientRef.current || !selection?.name) return;

    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus('Reading set from library...');

    try {
      // Load and convert set
      setOperationStatus('Parsing tones and patches...');
      const deviceState = await loadSetToDevice(
        libraryHandle,
        selection.name,
        (progress) => {
          setOperationProgress(Math.floor(progress * 0.5));
          if (progress < 30) {
            setOperationStatus('Reading manifest...');
          } else if (progress < 60) {
            setOperationStatus('Loading tone data...');
          } else {
            setOperationStatus('Loading patch data...');
          }
        }
      );

      // Upload to device
      let uploadCount = 0;
      const totalTones = deviceState.tones.size;
      const totalPatches = deviceState.patches.size;
      const totalItems = totalTones + totalPatches;

      for (const [slot, data] of deviceState.tones) {
        const toneSlot = `T${Math.floor(slot / 8) + 1}${(slot % 8) + 1}`;
        const toneName = data.tone.name || toneSlot;
        const sampleCount = data.wavData.length / 2;

        setOperationStatus(`Uploading ${toneName} (${sampleCount.toLocaleString()} samples)...`);

        // Upload wave data and tone to device
        // Pass the full tone object to preserve all parameters (pitchFollow, envelopes, etc.)
        await clientRef.current.importTone(
          {
            toneIndex: slot,
            waveData: data.wavData,
            waveBank: data.tone.wave.bank as 0 | 1,
            segmentTop: data.tone.wave.segmentTop,
            segmentLength: data.tone.wave.segmentLength,
            tone: data.tone,
          },
          (bytesSent, totalBytes) => {
            const pct = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : 0;
            setOperationStatus(`Uploading ${toneName}: ${pct}% (${bytesSent.toLocaleString()}/${totalBytes.toLocaleString()} bytes)`);
          }
        );
        setTone(slot, data.tone);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process before next import
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (const [slot, patch] of deviceState.patches) {
        const patchSlot = `P${String(slot + 1).padStart(2, '0')}`;
        const patchName = patch.common.name || patchSlot;

        setOperationStatus(`Uploading patch ${patchName}...`);

        await clientRef.current.sendPatchData(slot, patch.common);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setOperationProgress(100);
      setOperationStatus(`Loaded ${totalTones} tones and ${totalPatches} patches`);

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsLoadDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to load set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to load set');
      setOperationStatus(null);
    }
  }, [libraryHandle, selection, setTone]);

  // Handle item selection from either panel
  const handleSelectDevice = useCallback((type: 'tone' | 'patch', index: number) => {
    setSelection({ source: 'device', type, index });
  }, []);

  const handleSelectLibrary = useCallback((type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
    setSelection({ source: 'library', type, name, setName });
    // Clear drum kit bundle when selecting non-drum-kit item
    setSelectedDrumKitBundle(null);
  }, []);

  // Handle drum kit selection
  const handleSelectDrumKit = useCallback(async (directoryName: string) => {
    setSelection({ source: 'library', type: 'drumKit', name: directoryName });
    setSelectedDrumKitBundle(null);

    // Load the full bundle
    if (libraryHandle) {
      try {
        const bundle = await loadDrumKitBundle(libraryHandle, directoryName);
        setSelectedDrumKitBundle(bundle);
      } catch (err) {
        console.error('[LibraryPage] Failed to load drum kit bundle:', err);
      }
    }
  }, [libraryHandle]);

  // Handle drum kit import button click
  const handleOpenDrumKitImport = useCallback(() => {
    if (!selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    openImportDrumKitDialog(selection.name!, selectedDrumKitBundle);
  }, [selection, selectedDrumKitBundle, openImportDrumKitDialog]);

  // Open import tone dialog
  const handleOpenImportToneDialog = useCallback((setName: string, toneFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);
    setImportToneDialog({ setName, toneFile });
  }, []);

  // Open import patch dialog
  const handleOpenImportPatchDialog = useCallback((setName: string, patchFile: string) => {
    setOperationError(null);
    setOperationProgress(undefined);
    setOperationStatus(null);
    setImportPatchDialog({ setName, patchFile });
  }, []);

  // Import single tone from library
  const handleImportLibraryTone = useCallback(async (params: {
    setName: string;
    toneFile: string;
    tone: S330Tone;
    wavData: Uint8Array;
    targetSlot: number;
    waveBank: 0 | 1;
    segmentTop: number;
    segmentLength: number;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus(`Uploading ${params.tone.name}...`);

    try {
      // Update tone wave parameters to match target allocation
      const toneWithNewWave: S330Tone = {
        ...params.tone,
        wave: {
          ...params.tone.wave,
          bank: params.waveBank,
          segmentTop: params.segmentTop,
          segmentLength: params.segmentLength,
        },
      };

      await clientRef.current.importTone(
        {
          toneIndex: params.targetSlot,
          waveData: params.wavData,
          waveBank: params.waveBank,
          segmentTop: params.segmentTop,
          segmentLength: params.segmentLength,
          tone: toneWithNewWave,
        },
        (bytesSent, totalBytes) => {
          const pct = totalBytes > 0 ? Math.floor((bytesSent / totalBytes) * 100) : 0;
          setOperationProgress(pct);
          setOperationStatus(`Uploading: ${pct}%`);
        }
      );

      // Update local state
      setTone(params.targetSlot, toneWithNewWave);

      setOperationProgress(100);
      setOperationStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import tone:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import tone');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone]);

  // Import patch with its tones from library
  const handleImportLibraryPatch = useCallback(async (params: {
    setName: string;
    patchFile: string;
    patch: S330Patch;
    targetPatchSlot: number;
    tones: Array<{
      tone: S330Tone;
      wavData: Uint8Array;
      targetSlot: number;
      waveBank: 0 | 1;
      segmentTop: number;
      segmentLength: number;
    }>;
  }) => {
    if (!clientRef.current) return;

    setIsImporting(true);
    setOperationProgress(0);
    setOperationError(null);

    try {
      const totalSteps = params.tones.length + 1;
      let completedSteps = 0;

      // Import each required tone
      for (const toneData of params.tones) {
        setOperationStatus(`Uploading tone ${toneData.tone.name}...`);

        // Update tone wave parameters to match target allocation
        const toneWithNewWave: S330Tone = {
          ...toneData.tone,
          wave: {
            ...toneData.tone.wave,
            bank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.segmentLength,
          },
        };

        await clientRef.current.importTone(
          {
            toneIndex: toneData.targetSlot,
            waveData: toneData.wavData,
            waveBank: toneData.waveBank,
            segmentTop: toneData.segmentTop,
            segmentLength: toneData.segmentLength,
            tone: toneWithNewWave,
          },
          (bytesSent, totalBytes) => {
            const tonePct = totalBytes > 0 ? (bytesSent / totalBytes) : 0;
            const overallPct = ((completedSteps + tonePct) / totalSteps) * 100;
            setOperationProgress(Math.floor(overallPct));
          }
        );

        // Update local state
        setTone(toneData.targetSlot, toneWithNewWave);
        completedSteps++;

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Import the patch
      setOperationStatus(`Uploading patch ${params.patch.common.name}...`);
      await clientRef.current.sendPatchData(params.targetPatchSlot, params.patch.common);
      setPatch(params.targetPatchSlot, params.patch);
      completedSteps++;

      setOperationProgress(100);
      setOperationStatus('Import complete!');

      // Brief delay to show completion message
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error('[LibraryPage] Failed to import patch:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to import patch');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [setTone, setPatch]);

  // Render not connected state
  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your S-330 to manage the library.
          </p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      {/* Header */}
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-s330-text">Library</h2>
            {!libraryHandle && hasFileSystemAccess() && (
              <button
                onClick={handlePickDirectory}
                className="ac-btn ac-btn-sm ac-btn-primary"
              >
                Select Library Folder
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadDeviceData}
              disabled={isLoading}
              className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}
            >
              Refresh Device
            </button>
            <button
              onClick={handleOpenSaveDialog}
              disabled={!libraryHandle || isLoading}
              className={cn('ac-btn ac-btn-sm ac-btn-primary', (!libraryHandle || isLoading) && 'opacity-50')}
            >
              Save to Library...
            </button>
            <button
              onClick={handleOpenLoadDialog}
              disabled={!libraryHandle || !selection || selection.type !== 'set'}
              className={cn(
                'ac-btn ac-btn-sm ac-btn-secondary',
                (!libraryHandle || !selection || selection.type !== 'set') && 'opacity-50'
              )}
            >
              Load Selected Set
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* Three-Column Layout */}
      <div className="grid grid-cols-3 gap-4 min-h-[600px]">
        {/* Left: Device Memory */}
        <div className="card p-0 overflow-hidden">
          <DeviceMemoryPanel
            tones={tones}
            patches={patches}
            loadedToneBanks={loadedToneBanks}
            loadedPatchBanks={loadedPatchBanks}
            selectedIndex={selection?.source === 'device' ? selection.index : undefined}
            selectedType={selection?.source === 'device' && (selection.type === 'tone' || selection.type === 'patch') ? selection.type : undefined}
            onSelectTone={(index) => handleSelectDevice('tone', index)}
            onSelectPatch={(index) => handleSelectDevice('patch', index)}
          />
        </div>

        {/* Center: Library Tree */}
        <div className="card p-0 overflow-hidden">
          <LibraryTreePanel
            libraryHandle={libraryHandle}
            sets={sets}
            drumKits={drumKits}
            selectedName={selection?.source === 'library' ? selection.name : undefined}
            selectedType={selection?.source === 'library' ? selection.type : undefined}
            selectedSetName={selection?.source === 'library' ? selection.setName : undefined}
            onSelectSet={(name) => handleSelectLibrary('set', name)}
            onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
            onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
            onSelectDrumKit={handleSelectDrumKit}
            onRefresh={handleRefreshLibrary}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Preview */}
        <div className="card p-0 overflow-hidden">
          {selection?.type === 'drumKit' ? (
            <DrumKitPreviewPanel
              kitInfo={drumKits.find((k) => k.directoryName === selection.name) ?? null}
              libraryHandle={libraryHandle}
              onImport={handleOpenDrumKitImport}
            />
          ) : (
            <ItemPreviewPanel
              selection={selection}
              deviceTones={tones}
              devicePatches={patches}
              libraryHandle={libraryHandle}
              onImportTone={handleOpenImportToneDialog}
              onImportPatch={handleOpenImportPatchDialog}
            />
          )}
        </div>
      </div>

      {/* Save Set Dialog */}
      <SaveSetDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSaveSet}
        isSaving={operationProgress !== undefined && operationProgress < 100}
        progress={operationProgress}
        error={operationError}
        statusMessage={operationStatus}
      />

      {/* Load Set Dialog */}
      <LoadSetDialog
        open={isLoadDialogOpen}
        onOpenChange={setIsLoadDialogOpen}
        setName={selection?.name ?? ''}
        onLoad={handleLoadSet}
        isLoading={operationProgress !== undefined && operationProgress < 100}
        progress={operationProgress}
        error={operationError}
        statusMessage={operationStatus}
      />

      {/* Import Library Tone Dialog */}
      {importToneDialog && libraryHandle && (
        <ImportLibraryToneDialog
          open={!!importToneDialog}
          onOpenChange={(open) => {
            if (!open) setImportToneDialog(null);
          }}
          libraryHandle={libraryHandle}
          setName={importToneDialog.setName}
          toneFile={importToneDialog.toneFile}
          deviceTones={tones}
          onImport={handleImportLibraryTone}
          isImporting={isImporting}
          importProgress={operationProgress}
          importError={operationError}
          statusMessage={operationStatus}
        />
      )}

      {/* Import Library Patch Dialog */}
      {importPatchDialog && libraryHandle && (
        <ImportLibraryPatchDialog
          open={!!importPatchDialog}
          onOpenChange={(open) => {
            if (!open) setImportPatchDialog(null);
          }}
          libraryHandle={libraryHandle}
          setName={importPatchDialog.setName}
          patchFile={importPatchDialog.patchFile}
          deviceTones={tones}
          devicePatches={patches}
          onImport={handleImportLibraryPatch}
          isImporting={isImporting}
          importProgress={operationProgress}
          importError={operationError}
          statusMessage={operationStatus}
        />
      )}

      {/* Import Drum Kit Dialog */}
      {importDrumKitDialog && (
        <ImportDrumKitDialog
          open={!!importDrumKitDialog}
          onOpenChange={(open) => {
            if (!open) closeImportDrumKitDialog();
          }}
          bundle={importDrumKitDialog.bundle}
          deviceTones={tones}
          devicePatches={patches}
          onImport={handleImportDrumKit}
          isImporting={isDrumKitImporting}
          importProgress={drumKitImportProgress}
          importError={drumKitImportError}
          statusMessage={drumKitImportStatus}
        />
      )}
    </div>
  );
}
