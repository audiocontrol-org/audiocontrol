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
import { useEditorStore } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useBankLoader } from '@/hooks/useBankLoader';
import { useLibraryExport } from '@/hooks/useLibraryExport';
import { useWaveDataCache } from '@/hooks/useWaveDataCache';
import { useLoopEditorSync } from '@/hooks/useLoopEditorSync';
import { useToneSampleExport } from '@/hooks/useToneSampleExport';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import { toneSampleRateHz } from '@/core/midi/SamplerClient';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { ImportSampleDialog } from '@/components/library/ImportSampleDialog';
import { cn } from '@/lib/utils';
import { useLibraryConnection } from '@audiocontrol/editor-core';
import { useLoopEditor } from '@audiocontrol/loop-editor/ui';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';
import { S330KitOutputConfig } from '@/components/library/S330KitOutputConfig';
import { useDeviceToneChopper } from '@/hooks/useDeviceToneChopper';

// Local type for the import-sample handler — mirrors the `importTone` payload
// expected by `SamplerClientInterface.importTone`. Hoisted out of the
// component body to keep the JSX-heavy section readable.
//
// `waveBank` is `number` to match `S330ImportToneInput.waveBank` (the editor's
// SamplerClientInterface erases the device distinction at the type level — see
// `core/midi/SamplerClient.ts`). Each device client validates the bank against
// its own range at runtime: S-330 = {0, 1}; S-550 = {0, 1, 2, 3}.
interface ImportSampleParams {
  toneIndex: number;
  name: string;
  waveData: Uint8Array;
  waveBank: number;
  segmentTop: number;
  segmentLength: number;
  sampleRate: '15kHz' | '30kHz';
  loopMode: 'forward' | 'alternating' | 'one-shot' | 'reverse';
  loopPoint: number;
}

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
  } = useEditorStore();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    tones,
    patches,
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

  // Bank loading state
  const [loadingBank, setLoadingBank] = useState<number | null>(null);

  // Library connection — drives export-dialog gating and the chopper save path.
  const library = useLibraryConnection({ pickerId: 'sampler-library' });
  const libraryHandle = library.isConnected ? library.root : null;

  // Library export hook. `allowDownloadFallback: true` preserves legacy behavior
  // where the dialog can open without a library connected and the user gets a
  // YAML+WAV download instead of a library write.
  const exportOps = useLibraryExport({
    clientRef, libraryHandle, tones, patches,
    setIndividualTones: () => {}, // TonesPage has no library-list UI to refresh
    setIndividualPatches: () => {},
    allowDownloadFallback: true,
  });

  // Import Sample state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Wave data cache — owns decoded Int16Array per tone (for the loop editor).
  const waveCache = useWaveDataCache({ clientRef, setError });

  // Sample chopper hook — chop device tones into drum kits.
  // Inject the wave cache so the chopper reuses already-fetched samples
  // (no redundant device read when the loop editor already loaded them).
  const chopper = useDeviceToneChopper({ clientRef, libraryDirectoryHandle: libraryHandle, waveCache });

  // Sample-export hook — WAV download for a single tone slot. Routes
  // wave-data fetches through the same `waveCache` as the chopper +
  // loop editor so a hit skips the device read; misses are coalesced.
  const { isExporting, exportProgress, handleExportSample } = useToneSampleExport({
    clientRef,
    waveCache,
    setTone,
    setError,
    totalTones,
  });

  // Loop editor hook — owns loop point state, detection, audio preview, and smoothing
  const selectedToneForLoop = selectedToneIndex !== null ? tones[selectedToneIndex] : null;
  const loopEditorSamples =
    selectedToneIndex !== null ? waveCache.getSamples(selectedToneIndex) : null;
  // When no tone is selected, `loopEditorSamples` is also null and every
  // consumer of `sampleRate` inside `useLoopEditor` short-circuits on
  // `!samples` (smoothedSamples / discontinuity / handleAutoDetect /
  // useSamplePlayer). The seed below is therefore inert in that state — `0`
  // makes the never-consulted nature unmistakable rather than implying a
  // 15 kHz default.
  const loopEditor = useLoopEditor({
    samples: loopEditorSamples,
    sampleRate: selectedToneForLoop ? toneSampleRateHz(selectedToneForLoop) : 0,
    initialLoopStart: selectedToneForLoop?.wave.loopPoint,
    initialLoopEnd: selectedToneForLoop?.wave.endPoint,
    rootKey: selectedToneForLoop?.originalKey,
  });

  // Sync loop-editor state with the device tone store (both directions).
  useLoopEditorSync({ loopEditor, selectedToneIndex, tones, setTone, totalTones });

  // Initialize client when adapter changes
  useEffect(() => {
    clientRef.current = adapter ? config.createClient(adapter, { deviceId }) : null;
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
        waveCache.invalidateRange(startIndex, count);
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

  // Load all tones (S-330: 4 banks of 8, S-550: 8 banks of 8)
  const loadAll = useCallback(async () => {
    if (!clientRef.current) return;
    clientRef.current.invalidateToneCache();
    invalidateToneCache();
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

      // Read from Zustand store directly (not the React closure `tones`)
      // to get the latest value after synchronous store updates.
      const toneData = tone ?? useDeviceDataStore.getState().tones[selectedToneIndex];
      if (!toneData) return;

      clientRef.current.sendToneData(selectedToneIndex, toneData).catch((err) => {
        console.error('[TonesPage] Failed to send tone data:', err);
        setError(err instanceof Error ? err.message : 'Failed to send tone data');
      });
    },
    [selectedToneIndex, setError]
  );

  // Open import sample dialog
  const handleOpenImportDialog = useCallback(() => {
    setImportError(null);
    setImportProgress(undefined);
    setIsImportDialogOpen(true);
  }, []);

  // Import sample from local file to device
  const handleImportSample = useCallback(async (params: ImportSampleParams) => {
    if (!clientRef.current) return;
    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);
    try {
      await clientRef.current.importTone(params, (bytesSent, totalBytes) => {
        setImportProgress({
          currentStep: 1, totalSteps: 1,
          stepLabel: `Uploading ${params.name}`,
          bytesSent, bytesTotal: totalBytes,
          bytesSentAllSteps: 0, bytesTotalAllSteps: totalBytes,
        });
      });
      // Reload the tone bank to reflect changes
      await loadToneBank(Math.floor(params.toneIndex / tonesPerBank), true);
    } catch (err) {
      console.error('[TonesPage] Failed to import sample:', err);
      const message = err instanceof Error ? err.message : 'Failed to import sample';
      setImportError(message);
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [loadToneBank, tonesPerBank]);

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
        <div data-testid="error-message" className="ac-alert ac-alert-error">
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
                onExportTone={exportOps.openExportToneDialog}
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
                onExportSample={() => {
                  if (selectedToneIndex !== null) void handleExportSample(selectedToneIndex);
                }}
                isExporting={isExporting}
                exportProgress={exportProgress}
                onExportToLibrary={() => {
                  if (selectedToneIndex !== null) exportOps.openExportToneDialog(selectedToneIndex);
                }}
                isExportingToLibrary={exportOps.isExporting}
                onImportSample={handleOpenImportDialog}
                isImporting={isImporting}
                onChopSample={() => {
                  if (selectedToneIndex !== null && selectedTone) {
                    chopper.openChopper(selectedToneIndex, selectedTone);
                  }
                }}
                isLoadingChopWaveData={chopper.isLoadingWav}
                waveData={loopEditorSamples}
                isLoadingWaveData={waveCache.isLoading}
                waveDataLoadProgress={waveCache.progress}
                onLoadWaveData={() => {
                  if (selectedToneIndex !== null) void waveCache.loadWaveData(selectedToneIndex);
                }}
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
      {exportOps.exportToneDialog && (
        <ExportToneDialog
          open={!!exportOps.exportToneDialog}
          onOpenChange={(open) => { if (!open) exportOps.closeExportToneDialog(); }}
          tone={exportOps.exportToneDialog.tone}
          toneIndex={exportOps.exportToneDialog.toneIndex}
          onExport={exportOps.handleExportTone}
          isOperating={exportOps.isExporting}
          progress={exportOps.exportProgress}
          error={exportOps.exportError}
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

      {/* Sample Chopper Dialog */}
      <SampleChopperDialog
        open={chopper.chopperOpen}
        onOpenChange={(open) => { if (!open) chopper.closeChopper(); }}
        samples={chopper.chopperSamples}
        sampleRate={chopper.chopperSampleRate}
        sourceName={selectedTone?.name ?? ''}
        onConfirm={chopper.handleConfirm}
        onSave={library.isConnected ? chopper.handleSave : undefined}
        renderOutputConfig={(state) => (
          <S330KitOutputConfig
            state={state}
            config={chopper.kitConfig}
            onConfigChange={chopper.setKitConfig}
          />
        )}
      />
    </div>
  );
}
