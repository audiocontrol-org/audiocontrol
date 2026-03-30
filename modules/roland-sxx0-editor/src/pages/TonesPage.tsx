/**
 * Tones page - View and edit sampler tones
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 tones) by default for faster startup.
 * The number of tone banks adapts to the device (S-330: 4 banks, S-550: 8 banks).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OperationProgress } from '@/types/import-operation';
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
  exportToneToDirectory,
  exportToneAsDownload,
  type StorageDirectoryHandle,
} from '@/lib/library-service';
import { useLibraryConnection } from '@audiocontrol/editor-core';
import { useLoopEditor } from '@audiocontrol/loop-editor/ui';

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

  // Bank loading state
  const [loadingBank, setLoadingBank] = useState<number | null>(null);

  // Export to Library state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isExportingToLibrary, setIsExportingToLibrary] = useState(false);
  const [libraryExportProgress, setLibraryExportProgress] = useState<OperationProgress | undefined>(undefined);
  const [libraryExportError, setLibraryExportError] = useState<string | null>(null);
  const library = useLibraryConnection({ pickerId: 'sampler-library' });
  const [libraryDirectoryHandle, setLibraryDirectoryHandle] = useState<StorageDirectoryHandle | null>(null);
  // Track which tone is being exported (can be different from selected tone when exporting from list)
  const [exportToneIndex, setExportToneIndex] = useState<number | null>(null);

  // Import Sample state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Loop editor wave data state (keyed by tone index)
  const [loopEditorWaveData, setLoopEditorWaveData] = useState<Map<number, Int16Array>>(new Map());
  const [isLoadingLoopWaveData, setIsLoadingLoopWaveData] = useState(false);
  const [loopWaveDataProgress, setLoopWaveDataProgress] = useState<number | undefined>(undefined);

  // Loop editor hook — owns loop point state, detection, audio preview, and smoothing
  const selectedToneForLoop = selectedToneIndex !== null ? tones[selectedToneIndex] : null;
  const loopEditorSamples = selectedToneIndex !== null ? loopEditorWaveData.get(selectedToneIndex) ?? null : null;
  const loopEditor = useLoopEditor({
    samples: loopEditorSamples,
    sampleRate: selectedToneForLoop?.sampleRate === '30kHz' ? 30000 : 15000,
    initialLoopStart: selectedToneForLoop?.wave.loopPoint,
    initialLoopEnd: selectedToneForLoop?.wave.endPoint,
    rootKey: selectedToneForLoop?.originalKey,
  });

  // Sync loop editor's state back to device tone when changed via the loop editor UI
  const prevLoopPointRef = useRef(loopEditor.loopPoint);
  const prevEndPointRef = useRef(loopEditor.endPoint);
  useEffect(() => {
    if (selectedToneIndex === null) return;
    const currentTone = tones[selectedToneIndex];
    if (!currentTone) return;

    const loopChanged = loopEditor.loopPoint !== prevLoopPointRef.current;
    const endChanged = loopEditor.endPoint !== prevEndPointRef.current;
    prevLoopPointRef.current = loopEditor.loopPoint;
    prevEndPointRef.current = loopEditor.endPoint;

    if (!loopChanged && !endChanged) return;

    // Only sync if the hook's values differ from the tone's values
    if (
      loopEditor.loopPoint !== currentTone.wave.loopPoint ||
      loopEditor.endPoint !== currentTone.wave.endPoint
    ) {
      const updatedTone = {
        ...currentTone,
        wave: {
          ...currentTone.wave,
          loopPoint: loopEditor.loopPoint,
          endPoint: loopEditor.endPoint,
        },
      };
      setTone(selectedToneIndex, updatedTone, totalTones);
    }
  }, [loopEditor.loopPoint, loopEditor.endPoint, selectedToneIndex, tones, setTone, totalTones]);

  // Reset loop editor when selected tone changes
  useEffect(() => {
    if (selectedToneIndex === null) return;
    const tone = tones[selectedToneIndex];
    if (tone) {
      loopEditor.resetForNewSamples(tone.wave.loopPoint, tone.wave.endPoint);
    }
  }, [selectedToneIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load a bank with loading indicator
  const loadBankWithIndicator = useCallback(async (bankIndex: number, forceReload = false) => {
    setLoadingBank(bankIndex);
    try {
      await loadToneBank(bankIndex, forceReload);
    } finally {
      setLoadingBank(null);
    }
  }, [loadToneBank]);

  // Load initial data (first bank)
  const loadInitialData = useCallback(async () => {
    await loadBankWithIndicator(0);
  }, [loadBankWithIndicator]);

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
  // If toneIndex is provided, export that tone; otherwise export the selected tone
  const handleOpenExportDialog = useCallback(async (toneIndex?: number) => {
    const indexToExport = toneIndex ?? selectedToneIndex;
    if (indexToExport === null) return;

    setLibraryExportError(null);
    setLibraryExportProgress(undefined);
    setExportToneIndex(indexToExport);

    // If already connected, set the directory handle
    if (library.isConnected) {
      setLibraryDirectoryHandle(library.root);
    }

    setIsExportDialogOpen(true);
  }, [library, selectedToneIndex]);

  // Export tone to library
  // toneIndex is passed from the dialog to ensure we export the correct tone
  const handleExportToLibrary = useCallback(async (toneName: string, toneIndex: number) => {
    if (!clientRef.current) return;

    setIsExportingToLibrary(true);
    setLibraryExportError(null);

    try {
      // Fetch fresh tone data from device (don't use stale cached data)
      const tone = await clientRef.current.requestToneData(toneIndex);
      if (!tone) {
        throw new Error(`No tone data at slot ${toneIndex}`);
      }

      // Step 1: Fetch wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (bytesReceived, totalBytes) => {
          setLibraryExportProgress({
            currentStep: 1,
            totalSteps: 2,
            stepLabel: 'Fetching wave data',
            bytesSent: bytesReceived,
            bytesTotal: totalBytes,
            bytesSentAllSteps: 0,
            bytesTotalAllSteps: totalBytes,
          });
        }
      );

      const waveBytes = waveData.data.length;

      // Step 2: Write to library
      setLibraryExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: 'Writing to library',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });

      if (libraryDirectoryHandle) {
        await exportToneToDirectory(libraryDirectoryHandle, tone, waveData, toneName, () => {});
      } else {
        await exportToneAsDownload(tone, waveData, toneName, () => {});
      }

      // Update cached tone data with fresh data
      setTone(toneIndex, tone, totalTones);

      // Final state: complete
      setLibraryExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });
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
              {Array.from({ length: Math.ceil(totalTones / tonesPerBank) }, (_, bankIndex) => (
                <button
                  key={bankIndex}
                  onClick={() => loadToneBank(bankIndex, true)}
                  disabled={isLoading}
                  className={cn(
                    'ac-btn ac-btn-sm',
                    loadedBanks.includes(bankIndex) ? 'ac-btn-secondary' : 'ac-btn-primary',
                    isLoading && 'opacity-50'
                  )}
                >
                  {config.memoryLayout.formatToneBankLabel(bankIndex, tonesPerBank)}
                </button>
              ))}
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
                loadedBanks={loadedBanks}
                tonesPerBank={tonesPerBank}
                loadingBank={loadingBank}
                onLoadBank={(bank) => loadBankWithIndicator(bank)}
                onExportTone={handleOpenExportDialog}
                canExportToLibrary={library.isConnected}
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
                onExportToLibrary={() => handleOpenExportDialog()}
                isExportingToLibrary={isExportingToLibrary}
                onImportSample={handleOpenImportDialog}
                isImporting={isImporting}
                waveData={loopEditorSamples}
                isLoadingWaveData={isLoadingLoopWaveData}
                waveDataLoadProgress={loopWaveDataProgress}
                onLoadWaveData={handleLoadLoopWaveData}
                loopEditorProps={loopEditor.editorProps}
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
      {exportToneIndex !== null && tones[exportToneIndex] && (
        <ExportToneDialog
          open={isExportDialogOpen}
          onOpenChange={(open) => {
            setIsExportDialogOpen(open);
            if (!open) setExportToneIndex(null);
          }}
          tone={tones[exportToneIndex]!}
          toneIndex={exportToneIndex}
          onExport={handleExportToLibrary}
          isOperating={isExportingToLibrary}
          progress={libraryExportProgress}
          error={libraryExportError}
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
          isOperating={isImporting}
          progress={importProgress}
          error={importError}
        />
      )}
    </div>
  );
}
