/**
 * Patches page - View and edit S-330 patches
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 patches) by default for faster startup.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface, S330Patch, S330Tone } from '@/core/midi/S330Client';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { cn } from '@/lib/utils';

export function PatchesPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;

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

    const startIndex = bankIndex * patchesPerBank;
    const count = patchesPerBank;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} patches ${startIndex + 1}-${startIndex + count}...`);
      setError(null);
      ensurePatchArraySize(totalPatches);

      await clientRef.current.connect();
      await clientRef.current.loadPatchRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        (index, patch) => setPatch(index, patch, totalPatches),
        forceReload
      );

      markPatchBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      console.error('[PatchesPage] Error loading patches:', err);
      const message = err instanceof Error ? err.message : 'Failed to load patches';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress, ensurePatchArraySize, setPatch, markPatchBankLoaded, patchesPerBank, totalPatches]);

  // Load a specific range of tones (updates UI progressively)
  const loadToneBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * tonesPerBank;
    const count = tonesPerBank;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} tones ${startIndex + 1}-${startIndex + count}...`);
      setError(null);

      // Ensure array is large enough before loading
      ensureToneArraySize(totalTones);

      await clientRef.current.connect();
      await clientRef.current.loadToneRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        // Update UI immediately when each tone is loaded
        (index, tone) => setTone(index, tone, totalTones),
        forceReload
      );

      markToneBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      console.error('[PatchesPage] Error loading tones:', err);
      const message = err instanceof Error ? err.message : 'Failed to load tones';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [setLoading, setError, setProgress, clearProgress, ensureToneArraySize, setTone, markToneBankLoaded, tonesPerBank, totalTones]);

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

    // Calculate number of banks from config
    const patchBankCount = Math.ceil(totalPatches / patchesPerBank);
    const toneBankCount = Math.ceil(totalTones / tonesPerBank);

    // Load all patch banks
    for (let bank = 0; bank < patchBankCount; bank++) {
      await loadPatchBank(bank, true);
    }

    // Load all tone banks
    for (let bank = 0; bank < toneBankCount; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadPatchBank, loadToneBank, invalidatePatchCache, invalidateToneCache, totalPatches, patchesPerBank, totalTones, tonesPerBank]);

  // Handle patch updates from the editor
  const handlePatchUpdate = useCallback((index: number, patch: S330Patch) => {
    setPatch(index, patch, totalPatches);
  }, [setPatch, totalPatches]);

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
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your S-330 to view and edit patches.
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
            <h2 className="text-xl font-bold text-s330-text">Patches</h2>
            <span className="text-sm text-s330-muted">
              {loadedPatches.length} of {totalPatches} loaded
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
                className={cn('ac-btn ac-btn-sm', loadedPatchBanks.includes(0) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
              >
                P11-P18
              </button>
              <button
                onClick={() => loadPatchBank(1, true)}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm', loadedPatchBanks.includes(1) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
              >
                P21-P28
              </button>
              <button
                onClick={() => loadToneBank(0, true)}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm', loadedToneBanks.includes(0) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
              >
                T11-T18
              </button>
              <button
                onClick={() => loadToneBank(1, true)}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm', loadedToneBanks.includes(1) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
              >
                T21-T28
              </button>
              <button
                onClick={() => loadToneBank(2, true)}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm', loadedToneBanks.includes(2) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
              >
                T31-T38
              </button>
              <button
                onClick={() => loadToneBank(3, true)}
                disabled={isLoading}
                className={cn('ac-btn ac-btn-sm', loadedToneBanks.includes(3) ? 'ac-btn-secondary' : 'ac-btn-primary', isLoading && 'opacity-50')}
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
      {patches.length > 0 && (
        <div className="ac-list-detail-grid">
          {/* Sticky list column */}
          <div>
            <div className="ac-list-column-sticky">
              <PatchList
                patches={patches}
                selectedIndex={selectedPatchIndex}
                onSelect={selectPatch}
              />
            </div>
          </div>
          <div>
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
          <button onClick={loadInitialData} className="ac-btn ac-btn-primary">
            Load Patches
          </button>
        </div>
      )}
    </div>
  );
}
