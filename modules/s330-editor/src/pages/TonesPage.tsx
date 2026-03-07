/**
 * Tones page - View and edit S-330 tones
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 tones) by default for faster startup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import {
  useDeviceDataStore,
  TONES_PER_BANK,
  TOTAL_TONES,
} from '@/stores/deviceDataStore';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Tone } from '@/core/midi/S330Client';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { ExportToneDialog } from '@/components/library/ExportToneDialog';
import { cn } from '@/lib/utils';
import { exportWaveAsWav } from '@/lib/wave-export';
import { exportToneToLibrary } from '@/lib/library-service';

export function TonesPage() {
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
    setTone,
    markToneBankLoaded,
    ensureToneArraySize,
    invalidateToneCache,
  } = useDeviceDataStore();

  // Keep a ref to the S330 client
  const clientRef = useRef<S330ClientInterface | null>(null);

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

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Load a specific range of tones (updates UI progressively)
  const loadToneBank = useCallback(
    async (bankIndex: number, forceReload = false) => {
      if (!clientRef.current) return;

      const startIndex = bankIndex * TONES_PER_BANK;
      const count = TONES_PER_BANK;

      try {
        setLoading(
          true,
          `${forceReload ? 'Reloading' : 'Loading'} tones ${startIndex + 1}-${startIndex + count}...`
        );
        setError(null);

        // Ensure array is large enough before loading
        ensureToneArraySize();

        await clientRef.current.connect();
        await clientRef.current.loadToneRange(
          startIndex,
          count,
          (current: number, total: number) => setProgress(current, total),
          // Update UI immediately when each tone is loaded
          (index: number, tone: S330Tone) => setTone(index, tone),
          forceReload
        );

        markToneBankLoaded(bankIndex);
        clearProgress();
        setLoading(false);
      } catch (err) {
        console.error('[TonesPage] Error loading tones:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to load tones';
        setError(message);
        clearProgress();
        setLoading(false);
      }
    },
    [setLoading, setError, setProgress, clearProgress, ensureToneArraySize, setTone, markToneBankLoaded]
  );

  // Load initial data (first bank)
  const loadInitialData = useCallback(async () => {
    await loadToneBank(0);
  }, [loadToneBank]);

  // Load all tones
  const loadAll = useCallback(async () => {
    if (!clientRef.current) return;

    clientRef.current.invalidateToneCache();
    invalidateToneCache();

    // Load all 4 tone banks
    for (let bank = 0; bank < 4; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadToneBank, invalidateToneCache]);

  // Handle tone updates from the editor
  const handleToneUpdate = useCallback((tone: S330Tone) => {
    if (selectedToneIndex === null) return;
    setTone(selectedToneIndex, tone);
  }, [selectedToneIndex, setTone]);

  // Commit changes to device
  const handleToneCommit = useCallback(
    (tone?: S330Tone) => {
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

    const tone = tones[selectedToneIndex];
    if (!tone) return;

    setIsExporting(true);
    setExportProgress(0);
    setError(null);

    try {
      const waveData = await clientRef.current.requestWaveData(
        selectedToneIndex,
        (bytesReceived, totalBytes) => {
          const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 100 : 0;
          setExportProgress(progress);
        }
      );

      // Export the wave data as a WAV file
      exportWaveAsWav(waveData, tone.name || `tone_${selectedToneIndex}`);

      console.log('[TonesPage] Sample exported successfully');
    } catch (err) {
      console.error('[TonesPage] Failed to export sample:', err);
      setError(err instanceof Error ? err.message : 'Failed to export sample');
    } finally {
      setIsExporting(false);
      setExportProgress(undefined);
    }
  }, [selectedToneIndex, tones, setError]);

  // Open export to library dialog
  const handleOpenExportDialog = useCallback(() => {
    setLibraryExportError(null);
    setLibraryExportProgress(undefined);
    setIsExportDialogOpen(true);
  }, []);

  // Export tone to library
  const handleExportToLibrary = useCallback(async (toneName: string) => {
    if (selectedToneIndex === null || !clientRef.current) return;

    const tone = tones[selectedToneIndex];
    if (!tone) return;

    setIsExportingToLibrary(true);
    setLibraryExportProgress(0);
    setLibraryExportError(null);

    try {
      // First, fetch wave data from device
      const waveData = await clientRef.current.requestWaveData(
        selectedToneIndex,
        (bytesReceived, totalBytes) => {
          const progress = totalBytes > 0 ? (bytesReceived / totalBytes) * 50 : 0;
          setLibraryExportProgress(progress);
        }
      );

      // Export to library (YAML + WAV files)
      await exportToneToLibrary(tone, waveData, toneName, (progress) => {
        // Scale progress to 50-100 range (since fetching was 0-50)
        setLibraryExportProgress(50 + progress * 0.5);
      });

      console.log('[TonesPage] Tone exported to library successfully');
      setLibraryExportProgress(100);
    } catch (err) {
      console.error('[TonesPage] Failed to export to library:', err);
      const message = err instanceof Error ? err.message : 'Failed to export to library';
      setLibraryExportError(message);
      throw err;
    } finally {
      setIsExportingToLibrary(false);
    }
  }, [selectedToneIndex, tones]);

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
  const loadedTones = tones.filter((t): t is S330Tone => t !== undefined);

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
              {loadedTones.length} of {TOTAL_TONES} loaded
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
    </div>
  );
}
