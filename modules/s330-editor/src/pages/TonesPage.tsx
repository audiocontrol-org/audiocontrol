/**
 * Tones page - View and edit S-330 tones
 *
 * Parameter changes are sent to the device in real-time.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface } from '@/core/midi/S330Client';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { cn } from '@/lib/utils';

export function TonesPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const {
    toneNames,
    tones,
    selectedToneIndex,
    isLoading,
    loadingMessage,
    error,
    setToneNames,
    setToneData,
    selectTone,
    setLoading,
    setError,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Keep a ref to the S330 client for sending parameter updates
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Initialize client when adapter changes
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    clientRef.current = createS330Client(adapter, { deviceId });
  }, [adapter, deviceId]);

  // Handle tone parameter updates - local state only (for responsive UI)
  const handleToneUpdate = useCallback((updatedTone: Parameters<typeof setToneData>[1]) => {
    if (selectedToneIndex === null) return;
    setToneData(selectedToneIndex, updatedTone);
  }, [selectedToneIndex, setToneData]);

  // Commit changes to device
  // For immediate commits (checkbox, dropdown), pass the updated tone directly
  // For drag-end commits, tone is read from the store (already updated during drag)
  const handleToneCommit = useCallback((updatedTone?: Parameters<typeof setToneData>[1]) => {
    if (selectedToneIndex === null || !clientRef.current) return;

    // Use provided tone or fall back to store (for drag-end scenarios)
    const toneData = updatedTone ?? tones.get(selectedToneIndex);
    if (!toneData) return;

    clientRef.current.sendToneData(selectedToneIndex, toneData).catch((err) => {
      console.error('[TonesPage] Failed to send tone data:', err);
      setError(err instanceof Error ? err.message : 'Failed to send tone data');
    });
  }, [selectedToneIndex, tones, setError]);

  // Fetch all tone names (lightweight scan)
  const fetchToneNames = useCallback(async () => {
    if (!adapter) {
      setError('Not connected to device');
      return;
    }

    try {
      setLoading(true, 'Scanning tones from S-330...');
      setError(null);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const names = await client.requestAllToneNames();
      setToneNames(names);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tones';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, setToneNames, setLoading, setError]);

  // Fetch full data for selected tone
  const fetchSelectedToneData = useCallback(async (index: number) => {
    if (!adapter) return;

    // Skip if we already have the data
    if (tones.has(index)) return;

    try {
      setLoading(true, `Loading tone ${index}...`);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const toneData = await client.requestToneData(index);
      if (toneData) {
        setToneData(index, toneData);
      }
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tone data';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, tones, setToneData, setLoading, setError]);

  // Auto-fetch tone names when connected
  useEffect(() => {
    if (isConnected && toneNames.length === 0 && !isLoading) {
      fetchToneNames();
    }
  }, [isConnected, toneNames.length, isLoading, fetchToneNames]);

  // Fetch full data when a tone is selected
  useEffect(() => {
    if (selectedToneIndex !== null && isConnected) {
      fetchSelectedToneData(selectedToneIndex);
    }
  }, [selectedToneIndex, isConnected, fetchSelectedToneData]);

  // Filter to only show non-empty tones
  const nonEmptyTones = toneNames.filter((t) => !t.isEmpty);
  const selectedTone = selectedToneIndex !== null ? tones.get(selectedToneIndex) : null;

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-s330-text">Tones</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchToneNames}
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
      {!isLoading && nonEmptyTones.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ToneList
              toneNames={nonEmptyTones}
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
            ) : selectedToneIndex !== null ? (
              <div className="card text-center py-12 text-s330-muted">
                <div className="animate-spin w-6 h-6 border-2 border-s330-highlight border-t-transparent rounded-full mx-auto mb-2" />
                Loading tone data...
              </div>
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a tone to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && toneNames.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No tones loaded</p>
          <button onClick={fetchToneNames} className="btn btn-primary">
            Scan Tones
          </button>
        </div>
      )}

      {/* No tones found */}
      {!isLoading && toneNames.length > 0 && nonEmptyTones.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-s330-muted">No tones found on device</p>
        </div>
      )}
    </div>
  );
}
