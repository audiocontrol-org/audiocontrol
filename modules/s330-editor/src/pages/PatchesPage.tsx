/**
 * Patches page - View and edit S-330 patches
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 patches) by default for faster startup.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import {
  useDeviceDataStore,
  PATCHES_PER_BANK,
  TONES_PER_BANK,
  TOTAL_PATCHES,
} from '@/stores/deviceDataStore';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Patch, S330Tone } from '@/core/midi/S330Client';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { cn } from '@/lib/utils';

export function PatchesPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const {
    selectedPatchIndex,
    isLoading,
    loadingMessage,
    loadingProgress,
    error,
    selectPatch,
    setLoading,
    setError,
    setProgress,
    clearProgress,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    patches,
    tones,
    loadedPatchBanks,
    loadedToneBanks,
    setPatch,
    setTone,
    markPatchBankLoaded,
    markToneBankLoaded,
    ensurePatchArraySize,
    ensureToneArraySize,
    invalidatePatchCache,
    invalidateToneCache,
  } = useDeviceDataStore();

  // Keep a ref to the S330 client
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;
  }, [adapter, deviceId]);

  // Load a specific range of patches (updates UI progressively)
  const loadPatchBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * PATCHES_PER_BANK;
    const count = PATCHES_PER_BANK;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} patches ${startIndex + 1}-${startIndex + count}...`);
      setError(null);
      ensurePatchArraySize();

      await clientRef.current.connect();
      await clientRef.current.loadPatchRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        (index, patch) => setPatch(index, patch),
        forceReload
      );

      markPatchBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load patches';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress, ensurePatchArraySize, setPatch, markPatchBankLoaded]);

  // Load a specific range of tones (updates UI progressively)
  const loadToneBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * TONES_PER_BANK;
    const count = TONES_PER_BANK;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} tones ${startIndex + 1}-${startIndex + count}...`);
      setError(null);

      // Ensure array is large enough before loading
      ensureToneArraySize();

      await clientRef.current.connect();
      await clientRef.current.loadToneRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        // Update UI immediately when each tone is loaded
        (index, tone) => setTone(index, tone),
        forceReload
      );

      markToneBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tones';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress, ensureToneArraySize, setTone, markToneBankLoaded]);

  // Load initial data (first bank of patches and tones)
  const loadInitialData = useCallback(async () => {
    await loadPatchBank(0);
    await loadToneBank(0);
  }, [loadPatchBank, loadToneBank]);

  // Load all patches and tones
  const loadAll = useCallback(async () => {
    if (!clientRef.current) return;

    clientRef.current.invalidatePatchCache();
    clientRef.current.invalidateToneCache();
    invalidatePatchCache();
    invalidateToneCache();

    // Load all 2 patch banks
    for (let bank = 0; bank < 2; bank++) {
      await loadPatchBank(bank, true);
    }

    // Load all 4 tone banks
    for (let bank = 0; bank < 4; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadPatchBank, loadToneBank, invalidatePatchCache, invalidateToneCache]);

  // Handle patch updates from the editor
  const handlePatchUpdate = useCallback((index: number, patch: S330Patch) => {
    setPatch(index, patch);
  }, [setPatch]);

  // Auto-load initial data when connected
  useEffect(() => {
    if (!isConnected || hasInitiatedLoad.current) return;

    // Skip if data already in store
    if (patches.length > 0) {
      hasInitiatedLoad.current = true;
      return;
    }

    if (!isLoading) {
      hasInitiatedLoad.current = true;
      loadInitialData();
    }
  }, [isConnected, patches.length, isLoading, loadInitialData]);


  // Filter to only show loaded patches
  const loadedPatches = patches.filter((p): p is S330Patch => p !== undefined);
  const loadedTonesArray = tones.filter((t): t is S330Tone => t !== undefined);

  const selectedPatch = selectedPatchIndex !== null ? patches[selectedPatchIndex] : null;

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
        <p className="text-s330-muted mb-4">
          Connect to your S-330 to view and edit patches.
        </p>
        <a href="/" className="btn btn-primary inline-block">
          Go to Connection
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky Header */}
      <div className="sticky top-[88px] z-30 bg-s330-bg py-4 -mx-12 px-12 border-b border-s330-accent/30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-s330-text">Patches</h2>
            <span className="text-sm text-s330-muted">
              {loadedPatches.length} of {TOTAL_PATCHES} loaded
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
                <p className="text-s330-muted text-xs mt-0.5 truncate">{loadingMessage}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-s330-muted">(Re)load:</span>
              <button
                onClick={() => loadPatchBank(0, true)}
                disabled={isLoading}
                className={cn('btn', loadedPatchBanks.includes(0) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
              >
                P11-P18
              </button>
              <button
                onClick={() => loadPatchBank(1, true)}
                disabled={isLoading}
                className={cn('btn', loadedPatchBanks.includes(1) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
              >
                P21-P28
              </button>
              <button
                onClick={() => loadToneBank(0, true)}
                disabled={isLoading}
                className={cn('btn', loadedToneBanks.includes(0) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
              >
                T11-T18
              </button>
              <button
                onClick={() => loadToneBank(1, true)}
                disabled={isLoading}
                className={cn('btn', loadedToneBanks.includes(1) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
              >
                T21-T28
              </button>
              <button
                onClick={() => loadToneBank(2, true)}
                disabled={isLoading}
                className={cn('btn', loadedToneBanks.includes(2) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
              >
                T31-T38
              </button>
              <button
                onClick={() => loadToneBank(3, true)}
                disabled={isLoading}
                className={cn('btn', loadedToneBanks.includes(3) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
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
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-md p-3 mt-6">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Content - show while loading for progressive updates */}
      {patches.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3 mt-6">
          {/* Sticky list column */}
          <div className="lg:col-span-1">
            <div className="sticky top-[160px]">
              <PatchList
                patches={patches}
                selectedIndex={selectedPatchIndex}
                onSelect={selectPatch}
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            {selectedPatch ? (
              <PatchEditor
                patch={selectedPatch}
                index={selectedPatchIndex!}
                tones={loadedTonesArray}
                onUpdate={handlePatchUpdate}
              />
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a patch to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - no patches loaded yet */}
      {!isLoading && loadedPatches.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No patches loaded</p>
          <button onClick={loadInitialData} className="btn btn-primary">
            Load Patches
          </button>
        </div>
      )}
    </div>
  );
}
