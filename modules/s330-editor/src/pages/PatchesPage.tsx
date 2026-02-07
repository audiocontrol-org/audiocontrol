/**
 * Patches page - View and edit S-330 patches
 *
 * Data is cached in the S330 client - this page only manages UI state.
 * Loads first bank (8 patches) by default for faster startup.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Patch, S330Tone } from '@/core/midi/S330Client';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { cn } from '@/lib/utils';

// Constants for bank loading (S-330 uses banks of 8)
const PATCHES_PER_BANK = 8;
const TONES_PER_BANK = 8;
const TOTAL_PATCHES = 16;  // 2 banks of 8
const TOTAL_TONES = 32;    // 4 banks of 8

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

  // Keep a ref to the S330 client
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Local state for patches and tones (sparse arrays - undefined = not loaded)
  const [patches, setPatches] = useState<(S330Patch | undefined)[]>([]);
  const [tones, setTones] = useState<(S330Tone | undefined)[]>([]);
  const [loadedPatchBanks, setLoadedPatchBanks] = useState<Set<number>>(new Set());
  const [loadedToneBanks, setLoadedToneBanks] = useState<Set<number>>(new Set());

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

    // Check patch banks
    const cachedPatches = clientRef.current.getLoadedPatches();
    const patchBanksWithData = new Set<number>();
    for (let bank = 0; bank < 2; bank++) {
      const startIndex = bank * PATCHES_PER_BANK;
      const hasData = cachedPatches.slice(startIndex, startIndex + PATCHES_PER_BANK).some(p => p !== undefined);
      if (hasData) {
        patchBanksWithData.add(bank);
      }
    }

    // Check tone banks
    const cachedTones = clientRef.current.getLoadedTones();
    const toneBanksWithData = new Set<number>();
    for (let bank = 0; bank < 4; bank++) {
      const startIndex = bank * TONES_PER_BANK;
      const hasData = cachedTones.slice(startIndex, startIndex + TONES_PER_BANK).some(t => t !== undefined);
      if (hasData) {
        toneBanksWithData.add(bank);
      }
    }

    if (patchBanksWithData.size > 0) {
      setLoadedPatchBanks(patchBanksWithData);
      setPatches(cachedPatches);
    }
    if (toneBanksWithData.size > 0) {
      setLoadedToneBanks(toneBanksWithData);
      setTones(cachedTones);
    }
  }, [adapter, deviceId]);

  // Load a specific range of patches (updates UI progressively)
  const loadPatchBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * PATCHES_PER_BANK;
    const count = PATCHES_PER_BANK;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} patches ${startIndex + 1}-${startIndex + count}...`);
      setError(null);

      // Ensure array is large enough before loading
      setPatches((prev) => {
        if (prev.length >= TOTAL_PATCHES) return prev;
        const updated = [...prev];
        while (updated.length < TOTAL_PATCHES) updated.push(undefined);
        return updated;
      });

      await clientRef.current.connect();
      await clientRef.current.loadPatchRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        // Update UI immediately when each patch is loaded
        (index, patch) => {
          setPatches((prev) => {
            const updated = [...prev];
            updated[index] = patch;
            return updated;
          });
        },
        forceReload
      );

      setLoadedPatchBanks((prev) => new Set([...prev, bankIndex]));
      clearProgress();
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load patches';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress]);

  // Load a specific range of tones (updates UI progressively)
  const loadToneBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * TONES_PER_BANK;
    const count = TONES_PER_BANK;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} tones ${startIndex + 1}-${startIndex + count}...`);
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
        (current, total) => setProgress(current, total),
        // Update UI immediately when each tone is loaded
        (index, tone) => {
          setTones((prev) => {
            const updated = [...prev];
            updated[index] = tone;
            return updated;
          });
        },
        forceReload
      );

      setLoadedToneBanks((prev) => new Set([...prev, bankIndex]));

      clearProgress();
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load tones';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress]);

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
    setPatches([]);
    setTones([]);
    setLoadedPatchBanks(new Set());
    setLoadedToneBanks(new Set());

    // Load all 2 patch banks
    for (let bank = 0; bank < 2; bank++) {
      await loadPatchBank(bank, true);
    }

    // Load all 4 tone banks
    for (let bank = 0; bank < 4; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadPatchBank, loadToneBank]);

  // Handle patch updates from the editor
  const handlePatchUpdate = useCallback((index: number, patch: S330Patch) => {
    setPatches((prev) => {
      const updated = [...prev];
      updated[index] = patch;
      return updated;
    });
  }, []);

  // Auto-load initial data when connected
  useEffect(() => {
    if (!isConnected || hasInitiatedLoad.current) return;

    // Check if data already loaded from cache
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
    <div className="space-y-6">
      {/* Header */}
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
              <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
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
              className={cn('btn', loadedPatchBanks.has(0) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
            >
              P11-P18
            </button>
            <button
              onClick={() => loadPatchBank(1, true)}
              disabled={isLoading}
              className={cn('btn', loadedPatchBanks.has(1) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
            >
              P21-P28
            </button>
            <button
              onClick={() => loadToneBank(0, true)}
              disabled={isLoading}
              className={cn('btn', loadedToneBanks.has(0) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
            >
              T11-T18
            </button>
            <button
              onClick={() => loadToneBank(1, true)}
              disabled={isLoading}
              className={cn('btn', loadedToneBanks.has(1) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
            >
              T21-T28
            </button>
            <button
              onClick={() => loadToneBank(2, true)}
              disabled={isLoading}
              className={cn('btn', loadedToneBanks.has(2) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
            >
              T31-T38
            </button>
            <button
              onClick={() => loadToneBank(3, true)}
              disabled={isLoading}
              className={cn('btn', loadedToneBanks.has(3) ? 'btn-secondary' : 'btn-primary', isLoading && 'opacity-50')}
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
      {patches.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PatchList
              patches={patches}
              selectedIndex={selectedPatchIndex}
              onSelect={selectPatch}
            />
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
