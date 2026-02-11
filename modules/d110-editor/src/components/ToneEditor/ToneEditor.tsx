/**
 * Main Tone Editor Component
 *
 * Container for tone editing UI including:
 * - Part selector
 * - Tone common parameters editor
 * - Actions (fetch, sync)
 */

import { useCallback, useState } from 'react';
import { useD110Store, selectCurrentTone } from '@/stores';
import { useMidiStore } from '@/stores';
import { PartSelector } from '@/components/ToneEditor/PartSelector';
import { ToneCommonEditor } from '@/components/ToneEditor/ToneCommonEditor';
import { TONE_GROUP_NAMES } from '@/core/midi/constants';

export function ToneEditor(): JSX.Element {
  const client = useMidiStore((state) => state.client);
  const isConnected = useMidiStore((state) => state.status === 'connected');

  const selectedPart = useD110Store((state) => state.selectedPart);
  const tone = useD110Store(selectCurrentTone);
  const partConfigs = useD110Store((state) => state.partConfigs);
  const setTone = useD110Store((state) => state.setTone);
  const setPartConfig = useD110Store((state) => state.setPartConfig);
  const setLoading = useD110Store((state) => state.setLoading);
  const setError = useD110Store((state) => state.setError);
  const clearDirty = useD110Store((state) => state.clearDirty);

  const [isFetching, setIsFetching] = useState(false);

  const partConfig = partConfigs[selectedPart];

  // Fetch tone data for selected part
  const handleFetchTone = useCallback(async () => {
    if (!client) return;

    setIsFetching(true);
    setLoading(true, `Fetching Part ${selectedPart + 1} tone...`);
    setError(null);

    try {
      // Fetch part config first if we don't have it
      if (!partConfig) {
        const config = await client.requestPartConfig(selectedPart);
        setPartConfig(selectedPart, config);
      }

      // Fetch tone data
      const toneData = await client.requestTone(selectedPart);
      setTone(selectedPart, toneData);
      clearDirty(selectedPart);

      console.log(`[ToneEditor] Fetched tone for Part ${selectedPart + 1}:`, toneData.common.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tone';
      setError(message);
      console.error('[ToneEditor] Fetch error:', err);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  }, [client, selectedPart, partConfig, setTone, setPartConfig, setLoading, setError, clearDirty]);

  // Fetch all tones
  const handleFetchAll = useCallback(async () => {
    if (!client) return;

    setIsFetching(true);
    setLoading(true, 'Fetching all tones...');
    setError(null);

    try {
      for (let i = 0; i < 8; i++) {
        setLoading(true, `Fetching Part ${i + 1}...`);

        const config = await client.requestPartConfig(i);
        setPartConfig(i, config);

        const toneData = await client.requestTone(i);
        setTone(i, toneData);
        clearDirty(i);
      }

      console.log('[ToneEditor] Fetched all 8 tones');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tones';
      setError(message);
      console.error('[ToneEditor] Fetch all error:', err);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  }, [client, setTone, setPartConfig, setLoading, setError, clearDirty]);

  return (
    <div className="space-y-4">
      {/* Part Selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Tone Editor</h2>
          <div className="flex gap-2">
            <button
              onClick={() => void handleFetchTone()}
              disabled={!isConnected || isFetching}
              className="btn btn-secondary text-sm"
            >
              {isFetching ? 'Fetching...' : 'Fetch Tone'}
            </button>
            <button
              onClick={() => void handleFetchAll()}
              disabled={!isConnected || isFetching}
              className="btn btn-secondary text-sm"
            >
              Fetch All
            </button>
          </div>
        </div>

        <PartSelector />

        {/* Part Info */}
        {partConfig && (
          <div className="mt-4 bg-d110-surface rounded-md p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-d110-muted">Tone Group:</span>{' '}
                <span className="text-d110-text">
                  {TONE_GROUP_NAMES[partConfig.toneGroup] || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-d110-muted">Tone Number:</span>{' '}
                <span className="text-d110-text">{partConfig.toneNumber + 1}</span>
              </div>
              <div>
                <span className="text-d110-muted">Key Range:</span>{' '}
                <span className="text-d110-text">
                  {partConfig.keyRangeLower} - {partConfig.keyRangeUpper}
                </span>
              </div>
              <div>
                <span className="text-d110-muted">Level:</span>{' '}
                <span className="text-d110-text">{partConfig.outputLevel}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tone Info Summary */}
      {tone && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-d110-highlight font-mono">
                {tone.common.name}
              </h3>
              <p className="text-sm text-d110-muted mt-1">
                Part {selectedPart + 1} • Structure: {tone.common.structure12 + 1}/{tone.common.structure34 + 1}
              </p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((p) => {
                const key = `partial${p}` as keyof typeof tone.common.partialMutes;
                const muted = tone.common.partialMutes[key];
                return (
                  <div
                    key={p}
                    className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                      muted
                        ? 'bg-d110-bg text-d110-muted border border-d110-border'
                        : 'bg-d110-accent text-white'
                    }`}
                    title={`Partial ${p}: ${muted ? 'Muted' : 'Active'}`}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tone Common Editor */}
      <ToneCommonEditor />
    </div>
  );
}
