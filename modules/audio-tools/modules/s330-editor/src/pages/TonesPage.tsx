/**
 * Tones page - View and edit S-330 tones
 */

import { useCallback, useEffect } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client, S330_DATA_TYPES } from '@/core/midi/S330Client';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { cn } from '@/lib/utils';

export function TonesPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const {
    tones,
    selectedToneIndex,
    isLoading,
    loadingMessage,
    error,
    setTones,
    selectTone,
    setLoading,
    setError,
  } = useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  const fetchTones = useCallback(async () => {
    if (!adapter) {
      setError('Not connected to device');
      return;
    }

    try {
      setLoading(true, 'Fetching tones from S-330...');
      setError(null);

      const client = createS330Client(adapter, { deviceId });
      await client.connect();

      const packets = await client.requestBulkDump(S330_DATA_TYPES.TONE_1_32);
      const parsedTones = client.parseTones(packets);

      setTones(parsedTones);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tones';
      setError(message);
      setLoading(false);
    }
  }, [adapter, deviceId, setTones, setLoading, setError]);

  // Auto-fetch when connected and no tones loaded
  useEffect(() => {
    if (isConnected && tones.length === 0 && !isLoading) {
      fetchTones();
    }
  }, [isConnected, tones.length, isLoading, fetchTones]);

  const selectedTone = selectedToneIndex !== null ? tones[selectedToneIndex] : null;

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
            onClick={fetchTones}
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
      {!isLoading && tones.length > 0 && (
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
              <ToneEditor tone={selectedTone} index={selectedToneIndex!} />
            ) : (
              <div className="card text-center py-12 text-s330-muted">
                Select a tone to edit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tones.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No tones loaded</p>
          <button onClick={fetchTones} className="btn btn-primary">
            Fetch Tones
          </button>
        </div>
      )}
    </div>
  );
}
