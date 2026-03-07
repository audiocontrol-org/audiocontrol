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
import { SaveSetDialog } from '@/components/library/SaveSetDialog';
import { LoadSetDialog } from '@/components/library/LoadSetDialog';
import {
  hasFileSystemAccess,
  pickLibraryDirectory,
  getCachedLibraryDirectory,
  setCachedLibraryDirectory,
  listSets,
  saveDeviceToSetIncremental,
  loadSetToDevice,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';

/**
 * Selection state for items in either panel
 */
export interface ItemSelection {
  source: 'device' | 'library';
  type: 'tone' | 'patch' | 'set';
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

  // Local state
  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [libraryHandle, setLibraryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [operationProgress, setOperationProgress] = useState<number | undefined>(undefined);
  const [operationError, setOperationError] = useState<string | null>(null);

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

  // Initialize library directory
  useEffect(() => {
    async function initLibrary() {
      if (!hasFileSystemAccess()) return;

      const cached = await getCachedLibraryDirectory();
      if (cached) {
        setLibraryHandle(cached);
        // Load sets
        try {
          const setList = await listSets(cached);
          setSets(setList);
        } catch (err) {
          console.error('[LibraryPage] Failed to load sets:', err);
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
      // Load sets
      try {
        const setList = await listSets(handle);
        setSets(setList);
      } catch (err) {
        console.error('[LibraryPage] Failed to load sets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load library');
      }
    }
  }, [setSets, setError]);

  // Refresh library contents
  const handleRefreshLibrary = useCallback(async () => {
    if (!libraryHandle) return;

    setLoading(true, 'Refreshing library...');
    try {
      const setList = await listSets(libraryHandle);
      setSets(setList);
    } catch (err) {
      console.error('[LibraryPage] Failed to refresh sets:', err);
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

  // Save device state to set - incremental save that writes to disk as data is fetched
  const handleSaveSet = useCallback(async (setName: string, description?: string) => {
    if (!libraryHandle || !clientRef.current) return;

    setOperationProgress(0);
    setOperationError(null);
    setOperationStatus(null);

    const client = clientRef.current;

    try {
      // Use incremental save - fetches wave data and writes each tone to disk immediately
      await saveDeviceToSetIncremental(
        libraryHandle,
        setName,
        description,
        tones as (S330Tone | null)[],
        patches as (S330Patch | null)[],
        // Fetch wave data callback - called for each tone
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
  }, [libraryHandle, tones, patches, handleRefreshLibrary]);

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

    try {
      // Load and convert set
      const deviceState = await loadSetToDevice(
        libraryHandle,
        selection.name,
        (progress) => setOperationProgress(Math.floor(progress * 0.5))
      );

      // Upload to device
      let uploadCount = 0;
      const totalItems = deviceState.tones.size + deviceState.patches.size;

      for (const [slot, data] of deviceState.tones) {
        // Upload wave data and tone to device
        await clientRef.current.importTone(
          {
            toneIndex: slot,
            name: data.tone.name,
            waveData: data.wavData,
            waveBank: data.tone.wave.bank as 0 | 1,
            segmentTop: data.tone.wave.segmentTop,
            segmentLength: data.tone.wave.segmentLength,
            sampleRate: data.tone.sampleRate,
            loopMode: data.tone.loopMode,
            loopPoint: data.tone.wave.loopPoint,
          },
          () => {}
        );
        setTone(slot, data.tone);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process before next import
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      for (const [slot, patch] of deviceState.patches) {
        await clientRef.current.sendPatchData(slot, patch.common);
        uploadCount++;
        setOperationProgress(50 + Math.floor((uploadCount / totalItems) * 50));

        // Give the S-330 time to process
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setOperationProgress(100);
      setIsLoadDialogOpen(false);
    } catch (err) {
      console.error('[LibraryPage] Failed to load set:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to load set');
    }
  }, [libraryHandle, selection, setTone]);

  // Handle item selection from either panel
  const handleSelectDevice = useCallback((type: 'tone' | 'patch', index: number) => {
    setSelection({ source: 'device', type, index });
  }, []);

  const handleSelectLibrary = useCallback((type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
    setSelection({ source: 'library', type, name, setName });
  }, []);

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
            selectedType={selection?.source === 'device' && selection.type !== 'set' ? selection.type : undefined}
            onSelectTone={(index) => handleSelectDevice('tone', index)}
            onSelectPatch={(index) => handleSelectDevice('patch', index)}
          />
        </div>

        {/* Center: Library Tree */}
        <div className="card p-0 overflow-hidden">
          <LibraryTreePanel
            libraryHandle={libraryHandle}
            sets={sets}
            selectedName={selection?.source === 'library' ? selection.name : undefined}
            selectedType={selection?.source === 'library' ? selection.type : undefined}
            onSelectSet={(name) => handleSelectLibrary('set', name)}
            onSelectTone={(name, setName) => handleSelectLibrary('tone', name, setName)}
            onSelectPatch={(name, setName) => handleSelectLibrary('patch', name, setName)}
            onRefresh={handleRefreshLibrary}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Preview */}
        <div className="card p-0 overflow-hidden">
          <ItemPreviewPanel
            selection={selection}
            deviceTones={tones}
            devicePatches={patches}
            libraryHandle={libraryHandle}
          />
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
      />
    </div>
  );
}
