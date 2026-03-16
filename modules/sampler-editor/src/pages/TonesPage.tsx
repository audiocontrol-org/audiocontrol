/**
 * Tones page - View and edit S-330 tones
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 tones) by default for faster startup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImportProgress } from '@/types/import-operation';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useBankLoader } from '@/hooks/useBankLoader';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ImportSampleDialog } from '@/components/library/ImportSampleDialog';
import { cn } from '@/lib/utils';
import { exportWaveAsWav, unpack12BitTo16Bit } from '@/lib/wave-export';
import {
  pickLibraryDirectory,
  exportToneToDirectory,
  exportToneAsDownload,
  hasFileSystemAccess,
  getCachedLibraryDirectory,
  setCachedLibraryDirectory,
} from '@/lib/library-service';
import { useLoopDetection } from '@/hooks/useLoopDetection';
import { createSmoothedCopy } from '@audiocontrol/sampler-library/browser';

export function TonesPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;
  const { adapter, deviceId, status } = useMidiStore();
  const {
    selectedToneIndex,
    isLoading,
    loadingMessage,
    loadingProgress,
    error,
    selectTone,
    setLoading,
    setError,
    setProgress,
    clearProgress,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    tones,
    loadedToneBanks: loadedBanks,
    setPatch,
    setTone,
    markPatchBankLoaded,
    markToneBankLoaded,
    ensurePatchArraySize,
    ensureToneArraySize,
    invalidateToneCache,
  } = useDeviceDataStore();

  // Keep a ref to the S330 client
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Export state (WAV download)
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | undefined>(undefined);

  // Export to Library state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportingToLibrary, setIsExportingToLibrary] = useState(false);
  const [libraryExportProgress, setLibraryExportProgress] = useState<number | undefined>(undefined);
  const [libraryExportError, setLibraryExportError] = useState<string | null>(null);
  const [libraryDirectoryHandle, setLibraryDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Import Sample state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Loop editor wave data state (keyed by tone index)
  const [loopEditorWaveData, setLoopEditorWaveData] = useState<Map<number, Int16Array>>(new Map());
  const [isLoadingLoopWaveData, setIsLoadingLoopWaveData] = useState(false);
  const [loopWaveDataProgress, setLoopWaveDataProgress] = useState<number | undefined>(undefined);

  // Loop detection state
  const [selectedLoopCandidateIndex, setSelectedLoopCandidateIndex] = useState<number | undefined>(undefined);
  const {
    isSearching: isSearchingLoopPoints,
    progress: loopSearchProgress,
    candidates: loopCandidates,
    searchLoopPoints,
    clearResults: clearLoopResults,
  } = useLoopDetection();

  // Loop smoothing state
  const [isSmoothingLoop, setIsSmoothingLoop] = useState(false);

  // Clear loop detection results when selected tone changes
  useEffect(() => {
    clearLoopResults();
    setSelectedLoopCandidateIndex(undefined);
  }, [selectedToneIndex, clearLoopResults]);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = config.createClient(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Load a specific range of tones (updates UI progressively)
  const { loadToneBank } = useBankLoader({
    clientRef,
    stores: {
      setLoading, setError, setProgress, clearProgress,
      setPatch, setTone, markPatchBankLoaded, markToneBankLoaded,
      ensurePatchArraySize, ensureToneArraySize,
    },
    config: { totalPatches, totalTones, patchesPerBank, tonesPerBank },
    onBeforeToneLoad: (startIndex, count, forceReload) => {
      if (forceReload) {
        setLoopEditorWaveData((prev) => {
          const newMap = new Map(prev);
          for (let i = startIndex; i < startIndex + count; i++) {
            newMap.delete(i);
          }
          return newMap;
        });
      }
    },
  });

  // Load initial data (first bank)
  const loadInitialData = useCallback(async () => {
    await loadToneBank(0);
  }, [loadToneBank]);

  // Load all tones
  const loadAll = useCallback(async () => {
    if (!clientRef.current) return;

    clientRef.current.invalidateToneCache();
    invalidateToneCache();

    // Load all tone banks (S-330: 4 banks of 8, S-550: 8 banks of 8)
    const bankCount = Math.ceil(totalTones / tonesPerBank);
    for (let bank = 0; bank < bankCount; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadToneBank, invalidateToneCache, totalTones, tonesPerBank]);

  // Handle tone updates from the editor
  const handleToneUpdate = useCallback((tone: SamplerTone) => {
    if (selectedToneIndex === null) return;
    setTone(selectedToneIndex, tone, totalTones);
  }, [selectedToneIndex, setTone, totalTones]);

  // Commit changes to device
  const handleToneCommit = useCallback(
    (tone?: SamplerTone) => {
      if (selectedToneIndex === null || !clientRef.current) return;

      const toneData = tone ?? tones[selectedToneIndex];
      if (!toneData) return;

      clientRef.current.sendToneData(selectedToneIndex, toneData).catch((err) => {
        console.error('[TonesPage] Failed to send tone data:', err);
        setError(err instanceof Error ? err.message : 'Failed to send tone data');
      });
    },
    [selectedToneIndex, tones, setError]
  );

  // Export sample as WAV file
  const handleExportSample = useCallback(async () => {
    if (selectedToneIndex === null || !clientRef.current) return;

    setIsExporting(true);
    setExportProgress(0);
    setError(null);

    try {
      // Fetch fresh tone data for the filename (don't use stale cached data)
      const tone = await clientRef.current.requestToneData(selectedToneIndex);
      const toneName = tone?.name || `tone_${selectedToneIndex}`;

      const waveData = await clientRef.current.requestWaveData(
        selectedToneIndex,
        (bytesReceived, totalBytes) => {
          const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
          setExportProgress(progress);
        }
      );

      // Export the wave data as a WAV file
      exportWaveAsWav(waveData, toneName);

      // Update cached tone data with fresh data
      if (tone) {
        setTone(selectedToneIndex, tone, totalTones);
      }

    } catch (err) {
      console.error('[TonesPage] Failed to export sample:', err);
      setError(err instanceof Error ? err.message : 'Failed to export sample');
    } finally {
      setIsExporting(false);
      setExportProgress(undefined);
    }
  }, [selectedToneIndex, setError, setTone, totalTones]);

  // Open export to library dialog
  // Must pick directory first (requires user gesture), then open dialog
  const handleOpenExportDialog = useCallback(async () => {
    setLibraryExportError(null);
    setLibraryExportProgress(undefined);

    // If File System Access API available, try to get cached directory or pick one
    if (hasFileSystemAccess()) {
      // First check if we have a cached directory with valid permissions
      let dirHandle = await getCachedLibraryDirectory();

      if (!dirHandle) {
        // No cached directory, ask user to pick one
        dirHandle = await pickLibraryDirectory();
        if (!dirHandle) {
          // User cancelled directory picker
          return;
        }
        // Cache for future use
        setCachedLibraryDirectory(dirHandle);
      }

      setLibraryDirectoryHandle(dirHandle);
    }

    setIsExportDialogOpen(true);
  }, []);

  // Export tone to library
  // toneIndex is passed from the dialog to ensure we export the correct tone
  const handleExportToLibrary = useCallback(async (toneName: string, toneIndex: number) => {
    if (!clientRef.current) return;

    setIsExportingToLibrary(true);
    setLibraryExportProgress(0);
    setLibraryExportError(null);

    try {
      // Fetch fresh tone data from device (don't use stale cached data)
      const tone = await clientRef.current.requestToneData(toneIndex);
      if (!tone) {
        throw new Error(`No tone data at slot ${toneIndex}`);
      }

      // Fetch wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (bytesReceived, totalBytes) => {
          const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 50 : 0;
          setLibraryExportProgress(progress);
        }
      );

      // Export to library (YAML + WAV files)
      if (libraryDirectoryHandle) {
        // Write directly to selected directory
        await exportToneToDirectory(libraryDirectoryHandle, tone, waveData, toneName, (progress) => {
          setLibraryExportProgress(50 + progress * 0.5);
        });
      } else {
        // Fallback to downloads
        await exportToneAsDownload(tone, waveData, toneName, (progress) => {
          setLibraryExportProgress(50 + progress * 0.5);
        });
      }

      // Update cached tone data with fresh data
      setTone(toneIndex, tone, totalTones);

      setLibraryExportProgress(100);
    } catch (err) {
      console.error('[TonesPage] Failed to export to library:', err);
      const message = err instanceof Error ? err.message : 'Failed to export to library';
      setLibraryExportError(message);
      throw err;
    } finally {
      setIsExportingToLibrary(false);
    }
  }, [libraryDirectoryHandle, setTone, totalTones]);

  // Open import sample dialog
  const handleOpenImportDialog = useCallback(() => {
    setImportError(null);
    setImportProgress(undefined);
    setIsImportDialogOpen(true);
  }, []);

  // Load wave data for loop editor
  const handleLoadLoopWaveData = useCallback(async () => {
    if (selectedToneIndex === null || !clientRef.current) return;

    // Check if already loaded
    if (loopEditorWaveData.has(selectedToneIndex)) return;

    setIsLoadingLoopWaveData(true);
    setLoopWaveDataProgress(0);
    setError(null);

    try {
      const waveResponse = await clientRef.current.requestWaveData(
        selectedToneIndex,
        (bytesReceived, totalBytes) => {
          const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
          setLoopWaveDataProgress(progress);
        }
      );

      // Convert from packed 12-bit samples to 16-bit for the loop editor
      const samples = unpack12BitTo16Bit(waveResponse.data);

      setLoopEditorWaveData((prev) => {
        const newMap = new Map(prev);
        newMap.set(selectedToneIndex, samples);
        return newMap;
      });

    } catch (err) {
      console.error('[TonesPage] Failed to load wave data for loop editor:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wave data');
    } finally {
      setIsLoadingLoopWaveData(false);
      setLoopWaveDataProgress(undefined);
    }
  }, [selectedToneIndex, loopEditorWaveData, setError]);

  // Auto-detect loop points
  const handleAutoDetectLoopPoints = useCallback(() => {
    if (selectedToneIndex === null) return;

    const waveData = loopEditorWaveData.get(selectedToneIndex);
    if (!waveData) return;

    const selectedTone = tones[selectedToneIndex];
    if (!selectedTone) return;

    const sampleRate = selectedTone.sampleRate === '30kHz' ? 30000 : 15000;

    // Clear previous results
    clearLoopResults();
    setSelectedLoopCandidateIndex(undefined);

    // Create a copy of the wave data since it will be transferred to the worker
    const samplesCopy = new Int16Array(waveData);

    // Start the search
    searchLoopPoints(samplesCopy, sampleRate, selectedTone.wave.endPoint);
  }, [selectedToneIndex, loopEditorWaveData, tones, clearLoopResults, searchLoopPoints]);

  // Smooth loop splice point with crossfade
  const handleSmoothLoop = useCallback((mode: 'linear' | 'equal-power') => {
    if (selectedToneIndex === null) return;

    const waveData = loopEditorWaveData.get(selectedToneIndex);
    if (!waveData) return;

    const selectedTone = tones[selectedToneIndex];
    if (!selectedTone) return;

    setIsSmoothingLoop(true);

    try {
      // Create a smoothed copy of the wave data
      const smoothedData = createSmoothedCopy(
        waveData,
        selectedTone.wave.loopPoint,
        selectedTone.wave.endPoint,
        { mode, crossfadeLength: 64 }
      );

      // Update the cached wave data with the smoothed version
      setLoopEditorWaveData(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedToneIndex, smoothedData);
        return newMap;
      });

    } catch (err) {
      console.error('[TonesPage] Failed to smooth loop:', err);
      setError(err instanceof Error ? err.message : 'Failed to smooth loop');
    } finally {
      setIsSmoothingLoop(false);
    }
  }, [selectedToneIndex, loopEditorWaveData, tones, setError]);

  // Import sample from local file to device
  const handleImportSample = useCallback(async (params: {
    toneIndex: number;
    name: string;
    waveData: Uint8Array;
    waveBank: 0 | 1;
    segmentTop: number;
    segmentLength: number;
    sampleRate: '15kHz' | '30kHz';
    loopMode: 'forward' | 'alternating' | 'one-shot' | 'reverse';
    loopPoint: number;
  }) => {
    if (!clientRef.current) return;

    const { toneIndex, name, waveData, waveBank, segmentTop, segmentLength, sampleRate, loopMode, loopPoint } = params;

    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);

    try {
      await clientRef.current.importTone(
        {
          toneIndex,
          name,
          waveData,
          waveBank,
          segmentTop,
          segmentLength,
          sampleRate,
          loopMode,
          loopPoint,
        },
        (bytesSent, totalBytes) => {
          setImportProgress({
            currentStep: 1, totalSteps: 1,
            stepLabel: `Uploading ${name}`,
            bytesSent, bytesTotal: totalBytes,
            bytesSentAllSteps: 0, bytesTotalAllSteps: totalBytes,
          });
        }
      );

      // Reload the tone bank to reflect changes
      const bankIndex = Math.floor(toneIndex / tonesPerBank);
      await loadToneBank(bankIndex, true);

    } catch (err) {
      console.error('[TonesPage] Failed to import sample:', err);
      const message = err instanceof Error ? err.message : 'Failed to import sample';
      setImportError(message);
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [loadToneBank]);

  // Auto-load initial data when connected
  useEffect(() => {
    if (!isConnected || hasInitiatedLoad.current) return;

    // Check if data already loaded from cache
    if (tones.length > 0) {
      hasInitiatedLoad.current = true;
      return;
    }

    if (!isLoading) {
      hasInitiatedLoad.current = true;
      loadInitialData();
    }
  }, [isConnected, tones.length, isLoading, loadInitialData]);


  // Filter to only show loaded tones
  const loadedTones = tones.filter((t): t is SamplerTone => t !== undefined);

  const selectedTone =
    selectedToneIndex !== null ? tones[selectedToneIndex] : null;

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your S-330 to view and edit tones.
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
      {/* Sticky Header */}
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-s330-text">Tones</h2>
            <span className="text-sm text-s330-muted">
              {loadedTones.length} of {totalTones} loaded
            </span>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Loading Progress (inline with buttons) */}
            {isLoading && loadingProgress !== null && (
              <div className="flex-1 max-w-xs">
                <div className="h-2 bg-s330-panel rounded-full overflow-hidden">
                  <div
                    className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-s330-muted text-xs mt-0.5 truncate">
                  {loadingMessage}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-s330-muted">(Re)load:</span>
              <button
                onClick={() => loadToneBank(0, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(0) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                T11-T18
              </button>
              <button
                onClick={() => loadToneBank(1, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(1) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                T21-T28
              </button>
              <button
                onClick={() => loadToneBank(2, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(2) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                T31-T38
              </button>
              <button
                onClick={() => loadToneBank(3, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(3) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                T41-T48
              </button>
              <button
                onClick={loadAll}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm ac-btn-secondary', isLoading && 'opacity-50')}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* Content - show while loading for progressive updates */}
      {tones.length > 0 && (
        <div className="ac-list-detail-grid">
          {/* Sticky list column */}
          <div>
            <div className="ac-list-column-sticky">
              <ToneList
                tones={tones}
                selectedIndex={selectedToneIndex}
                onSelect={selectTone}
              />
            </div>
          </div>
          <div>
            {selectedTone ? (
              <ToneEditor
                tone={selectedTone}
                index={selectedToneIndex!}
                onUpdate={handleToneUpdate}
                onCommit={handleToneCommit}
                onExportSample={handleExportSample}
                isExporting={isExporting}
                exportProgress={exportProgress}
                onExportToLibrary={handleOpenExportDialog}
                isExportingToLibrary={isExportingToLibrary}
                onImportSample={handleOpenImportDialog}
                isImporting={isImporting}
                waveData={loopEditorWaveData.get(selectedToneIndex!) ?? null}
                isLoadingWaveData={isLoadingLoopWaveData}
                waveDataLoadProgress={loopWaveDataProgress}
                onLoadWaveData={handleLoadLoopWaveData}
                loopCandidates={loopCandidates}
                selectedLoopCandidateIndex={selectedLoopCandidateIndex}
                onLoopCandidateSelect={setSelectedLoopCandidateIndex}
                onAutoDetectLoopPoints={handleAutoDetectLoopPoints}
                isSearchingLoopPoints={isSearchingLoopPoints}
                loopSearchProgress={loopSearchProgress}
                onSmoothLoop={handleSmoothLoop}
                isSmoothingLoop={isSmoothingLoop}
              />
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a tone to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - no tones loaded yet */}
      {!isLoading && loadedTones.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No tones loaded</p>
          <button onClick={loadInitialData} className="ac-btn ac-btn-primary">
            Load Tones
          </button>
        </div>
      )}

      {/* Export to Library Dialog */}
      {selectedTone && (
        <ExportToneDialog
          open={isExportDialogOpen}
          onOpenChange={setIsExportDialogOpen}
          tone={selectedTone}
          toneIndex={selectedToneIndex!}
          onExport={handleExportToLibrary}
          isExporting={isExportingToLibrary}
          exportProgress={libraryExportProgress}
          exportError={libraryExportError}
        />
      )}

      {/* Import Sample Dialog */}
      {selectedToneIndex !== null && (
        <ImportSampleDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          toneIndex={selectedToneIndex}
          toneName={selectedTone?.name}
          onImport={handleImportSample}
          isImporting={isImporting}
          importProgress={importProgress}
          importError={importError}
        />
      )}
    </div>
  );
}
