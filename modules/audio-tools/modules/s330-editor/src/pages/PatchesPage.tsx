/**
 * Patches page - View and edit S-330 patches
 */

import { useCallback, useEffect } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { cn } from '@/lib/utils';

export function PatchesPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const {
    patchNames,
    patches,
    selectedPatchIndex,
    isLoading,
    loadingMessage,
    error,
    setPatchNames,
    setToneNames,
    setPatchData,
    selectPatch,
    setLoading,
    setError,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Fetch all patch names (lightweight scan)
  const fetchPatchNames = useCallback(async () => {
    if (!adapter) {
      setError('Not connected to device');
      return;
    }

    try {
      setLoading(true, 'Scanning patches from S-330...');
      setError(null);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const names = await client.requestAllPatchNames();
      setPatchNames(names);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patches';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, setPatchNames, setLoading, setError]);

  // Fetch all tone names (needed for tone mapping display)
  const fetchToneNames = useCallback(async () => {
    if (!adapter) return;

    try {
      console.log('[PatchesPage] Fetching tone names...');
      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const names = await client.requestAllToneNames();
      console.log('[PatchesPage] Received tone names:', names);
      const nonEmpty = names.filter(n => !n.isEmpty);
      console.log('[PatchesPage] Non-empty tones:', nonEmpty);
      setToneNames(names);
    } catch (err) {
      // Silent fail - tone names are optional for display
      console.warn('[PatchesPage] Failed to fetch tone names:', err);
    }
  }, [adapter, deviceId, setToneNames]);

  // Fetch full data for selected patch
  const fetchSelectedPatchData = useCallback(async (index: number) => {
    if (!adapter) return;

    // Skip if we already have the data
    if (patches.has(index)) return;

    try {
      setLoading(true, `Loading patch ${index}...`);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const patchData = await client.requestPatchData(index);
      if (patchData) {
        setPatchData(index, patchData);
      }
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patch data';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, patches, setPatchData, setLoading, setError]);

  // Auto-fetch patch names when connected
  useEffect(() => {
    if (isConnected && patchNames.length === 0 && !isLoading) {
      fetchPatchNames();
    }
  }, [isConnected, patchNames.length, isLoading, fetchPatchNames]);

  // Also fetch tone names for the tone mapping display
  useEffect(() => {
    if (isConnected && !isLoading && patchNames.length > 0) {
      fetchToneNames();
    }
  }, [isConnected, isLoading, patchNames.length, fetchToneNames]);

  // Fetch full data when a patch is selected
  useEffect(() => {
    if (selectedPatchIndex !== null && isConnected) {
      fetchSelectedPatchData(selectedPatchIndex);
    }
  }, [selectedPatchIndex, isConnected, fetchSelectedPatchData]);

  const selectedPatch = selectedPatchIndex !== null ? patches.get(selectedPatchIndex) : null;

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-s330-text">Patches</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchPatchNames}
            disabled={isLoading}
            className={cn('btn btn-secondary', isLoading && 'opacity-50')}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-md p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-s330-highlight border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-s330-muted">{loadingMessage ?? 'Loading...'}</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && patchNames.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PatchList
              patchNames={patchNames}
              selectedIndex={selectedPatchIndex}
              onSelect={selectPatch}
            />
          </div>
          <div className="lg:col-span-2">
            {selectedPatch ? (
              <PatchEditor patch={selectedPatch} index={selectedPatchIndex!} />
            ) : selectedPatchIndex !== null ? (
              <div className="card text-center py-12 text-s330-muted">
                <div className="animate-spin w-6 h-6 border-2 border-s330-highlight border-t-transparent rounded-full mx-auto mb-2" />
                Loading patch data...
              </div>
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a patch to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - no patches scanned yet */}
      {!isLoading && patchNames.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No patches loaded</p>
          <button onClick={fetchPatchNames} className="btn btn-primary">
            Scan Patches
          </button>
        </div>
      )}
    </div>
  );
}
