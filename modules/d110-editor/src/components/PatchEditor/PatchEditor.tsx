/**
 * Main Patch Editor Component
 *
 * Container for multi/patch editing UI including:
 * - Patch name editor
 * - System parameters (reverb, partial reserve)
 * - 8 part configurations
 * - Actions (fetch, sync)
 */

import { useCallback, useState } from 'react';
import { useD110Store } from '@/stores';
import { useMidiStore } from '@/stores';
import { SystemEditor } from '@/components/PatchEditor/SystemEditor';
import { PartConfigEditor } from '@/components/PatchEditor/PartConfigEditor';
import { SYSTEM_PARAM_OFFSETS, PATCH_NAME_LENGTH } from '@/core/midi/constants';

export function PatchEditor(): JSX.Element {
  const client = useMidiStore((state) => state.client);
  const isConnected = useMidiStore((state) => state.status === 'connected');

  const patch = useD110Store((state) => state.patch);
  const partConfigs = useD110Store((state) => state.partConfigs);
  const setPatch = useD110Store((state) => state.setPatch);
  const setTone = useD110Store((state) => state.setTone);
  const setLoading = useD110Store((state) => state.setLoading);
  const setError = useD110Store((state) => state.setError);

  const [isFetching, setIsFetching] = useState(false);
  const [patchName, setPatchName] = useState(patch?.name ?? '');
  const [expandedPart, setExpandedPart] = useState<number | null>(null);

  // Fetch full patch data from D-110
  const handleFetchPatch = useCallback(async () => {
    if (!client) return;

    setIsFetching(true);
    setLoading(true, 'Fetching patch data...');
    setError(null);

    try {
      // Fetch patch (system params + part configs)
      const patchData = await client.requestPatch();
      setPatch(patchData);
      setPatchName(patchData.name);

      console.log('[PatchEditor] Fetched patch:', patchData.name);

      // Also fetch tone data for all 8 parts to get tone names
      for (let i = 0; i < 8; i++) {
        setLoading(true, `Fetching tone ${i + 1} of 8...`);
        const toneData = await client.requestTone(i);
        setTone(i, toneData);
      }

      console.log('[PatchEditor] Fetched all tone data');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patch';
      setError(message);
      console.error('[PatchEditor] Fetch error:', err);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  }, [client, setPatch, setTone, setLoading, setError]);

  // Handle patch name change
  const handleNameChange = useCallback(
    async (name: string) => {
      // Pad or truncate to 10 characters
      const paddedName = name.padEnd(PATCH_NAME_LENGTH, ' ').slice(0, PATCH_NAME_LENGTH);
      setPatchName(paddedName);

      if (!client) return;

      // Send each character to hardware
      try {
        for (let i = 0; i < PATCH_NAME_LENGTH; i++) {
          await client.sendSystemParameter(
            SYSTEM_PARAM_OFFSETS.PATCH_NAME + i,
            paddedName.charCodeAt(i)
          );
        }
      } catch (err) {
        console.error('[PatchEditor] Failed to send patch name:', err);
      }
    },
    [client]
  );

  const handleTogglePart = useCallback((partIndex: number) => {
    setExpandedPart((current) => (current === partIndex ? null : partIndex));
  }, []);

  const handleExpandAll = useCallback(() => {
    // Expand first part if none are expanded
    if (expandedPart === null) {
      setExpandedPart(0);
    }
  }, [expandedPart]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPart(null);
  }, []);

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-d110-text mb-2">Not Connected</h2>
        <p className="text-d110-muted mb-4">
          Connect to your D-110 to view and edit patches.
        </p>
        <a href="/roland/d110/editor/" className="btn btn-primary inline-block">
          Go to Connection
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Fetch Button */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Patch Editor</h2>
          <button
            onClick={() => void handleFetchPatch()}
            disabled={isFetching}
            className="btn btn-primary"
          >
            {isFetching ? 'Fetching...' : 'Fetch Patch'}
          </button>
        </div>

        {/* Patch Name */}
        {patch && (
          <div>
            <label className="label">Patch Name</label>
            <input
              type="text"
              value={patchName}
              onChange={(e) => void handleNameChange(e.target.value)}
              maxLength={PATCH_NAME_LENGTH}
              className="input w-full font-mono text-lg"
              placeholder="Patch name..."
            />
            <p className="text-xs text-d110-muted mt-1">
              Max {PATCH_NAME_LENGTH} characters
            </p>
          </div>
        )}

        {!patch && (
          <div className="text-center text-d110-muted py-4">
            <p>No patch data loaded</p>
            <p className="text-sm mt-1">
              Click "Fetch Patch" to load the current patch from the D-110
            </p>
          </div>
        )}
      </div>

      {/* System Parameters */}
      <SystemEditor />

      {/* Part Configurations */}
      {partConfigs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold text-d110-text">
              Part Configurations
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExpandAll}
                className="btn btn-secondary text-sm"
              >
                Expand First
              </button>
              <button
                onClick={handleCollapseAll}
                className="btn btn-secondary text-sm"
              >
                Collapse All
              </button>
            </div>
          </div>
          <p className="text-xs text-d110-muted px-1 mb-2">
            Click a part to expand/collapse its editor. Edit settings to sync with hardware.
          </p>

          <div className="space-y-2">
            {partConfigs.map((config, i) => (
              <PartConfigEditor
                key={i}
                partIndex={i}
                config={config}
                isExpanded={expandedPart === i}
                onToggleExpand={() => handleTogglePart(i)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
