/**
 * Patches page - View and edit S-330 patches
 */

import { useCallback, useEffect } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client, S330_DATA_TYPES } from '@/core/midi/S330Client';
import { PatchList } from '@/components/patches/PatchList';
import { PatchEditor } from '@/components/patches/PatchEditor';
import { cn } from '@/lib/utils';

export function PatchesPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const {
    patches,
    selectedPatchIndex,
    isLoading,
    loadingMessage,
    error,
    setPatches,
    selectPatch,
    setLoading,
    setError,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  const fetchPatches = useCallback(async () => {
    if (!adapter) {
      setError('Not connected to device');
      return;
    }

    try {
      setLoading(true, 'Fetching patches from S-330...');
      setError(null);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const packets = await client.requestBulkDump(S330_DATA_TYPES.PATCH_1_32);
      const parsedPatches = client.parsePatches(packets);

      setPatches(parsedPatches);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patches';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, setPatches, setLoading, setError]);

  // Auto-fetch when connected and no patches loaded
  useEffect(() => {
    if (isConnected && patches.length === 0 && !isLoading) {
      fetchPatches();
    }
  }, [isConnected, patches.length, isLoading, fetchPatches]);

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-s330-text">Patches</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchPatches}
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
      {!isLoading && patches.length > 0 && (
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
              <PatchEditor patch={selectedPatch} index={selectedPatchIndex!} />
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a patch to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && patches.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No patches loaded</p>
          <button onClick={fetchPatches} className="btn btn-primary">
            Fetch Patches
          </button>
        </div>
      )}
    </div>
  );
}
