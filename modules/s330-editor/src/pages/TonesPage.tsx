/**
 * Tones page - View and edit S-330 tones
 *
 * Data is cached in the S330 client - this page only manages UI state.
 * Loads first bank (8 tones) by default for faster startup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Tone } from '@/core/midi/S330Client';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { cn } from '@/lib/utils';

// Constants for bank loading (S-330 uses banks of 8)
const TONES_PER_BANK = 8;
const TOTAL_TONES = 32; // 4 banks of 8

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

  // Keep a ref to the S330 client
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Local state for tones (sparse array - undefined = not loaded)
  const [tones, setTones] = useState<(S330Tone | undefined)[]>([]);
  const [loadedBanks, setLoadedBanks] = useState<Set<number>>(new Set());

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Sync loaded state from client cache on mount
  useEffect(() => {
    if (!clientRef.current) return;

    const cachedTones = clientRef.current.getLoadedTones();
    const banksWithData = new Set<number>();
    for (let bank = 0; bank < 4; bank++) {
      const startIndex = bank * TONES_PER_BANK;
      const hasData = cachedTones
        .slice(startIndex, startIndex + TONES_PER_BANK)
        .some((t) => t !== undefined);
      if (hasData) {
        banksWithData.add(bank);
      }
    }

    if (banksWithData.size > 0) {
      setLoadedBanks(banksWithData);
      setTones(cachedTones);
    }
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
        setTones((prev) => {
          if (prev.length >= TOTAL_TONES) return prev;
          const updated = [...prev];
          while (updated.length < TOTAL_TONES) updated.push(undefined);
          return updated;
        });

        await clientRef.current.connect();
        await clientRef.current.loadToneRange(
          startIndex,
          count,
          (current: number, total: number) => setProgress(current, total),
          // Update UI immediately when each tone is loaded
          (index: number, tone: S330Tone) => {
            setTones((prev) => {
              const updated = [...prev];
              updated[index] = tone;
              return updated;
            });
          },
          forceReload
        );

        setLoadedBanks((prev) => new Set([...prev, bankIndex]));
        clearProgress();
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load tones';
        setError(message);
        clearProgress();
        setLoading(false);
      }
    },
    [setLoading, setError, setProgress, clearProgress]
  );

  // Load initial data (first bank)
  const loadInitialData = useCallback(async () => {
    await loadToneBank(0);
  }, [loadToneBank]);

  // Load all tones
  const loadAll = useCallback(async () => {
    if (!clientRef.current) return;

    clientRef.current.invalidateToneCache();
    setTones([]);
    setLoadedBanks(new Set());

    // Load all 4 tone banks
    for (let bank = 0; bank < 4; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadToneBank]);

  // Handle tone updates from the editor
  const handleToneUpdate = useCallback((tone: S330Tone) => {
    if (selectedToneIndex === null) return;
    setTones((prev) => {
      const updated = [...prev];
      updated[selectedToneIndex] = tone;
      return updated;
    });
  }, [selectedToneIndex]);

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
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
        <p className="text-s330-muted mb-4">
          Connect to your S-330 to view and edit tones.
        </p>
        <a href="/" className="btn btn-primary inline-block">
          Go to Connection
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
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
              <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
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
                'btn',
                loadedBanks.has(0) ? 'btn-secondary' : 'btn-primary',
                isLoading && 'opacity-50'
              )}
            >
              T11-T18
            </button>
            <button
              onClick={() => loadToneBank(1, true)}
              disabled={isLoading}
              className={cn(
                'btn',
                loadedBanks.has(1) ? 'btn-secondary' : 'btn-primary',
                isLoading && 'opacity-50'
              )}
            >
              T21-T28
            </button>
            <button
              onClick={() => loadToneBank(2, true)}
              disabled={isLoading}
              className={cn(
                'btn',
                loadedBanks.has(2) ? 'btn-secondary' : 'btn-primary',
                isLoading && 'opacity-50'
              )}
            >
              T31-T38
            </button>
            <button
              onClick={() => loadToneBank(3, true)}
              disabled={isLoading}
              className={cn(
                'btn',
                loadedBanks.has(3) ? 'btn-secondary' : 'btn-primary',
                isLoading && 'opacity-50'
              )}
            >
              T41-T48
            </button>
            <button
              onClick={loadAll}
              disabled={isLoading}
              className={cn('btn btn-secondary', isLoading && 'opacity-50')}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-md p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Content - show while loading for progressive updates */}
      {tones.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ToneList
              tones={tones}
              selectedIndex={selectedToneIndex}
              onSelect={selectTone}
            />
          </div>
          <div className="lg:col-span-2">
            {selectedTone ? (
              <ToneEditor
                tone={selectedTone}
                index={selectedToneIndex!}
                onUpdate={handleToneUpdate}
                onCommit={handleToneCommit}
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
          <button onClick={loadInitialData} className="btn btn-primary">
            Load Tones
          </button>
        </div>
      )}
    </div>
  );
}
