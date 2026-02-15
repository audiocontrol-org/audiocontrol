/**
 * System Parameters Editor
 *
 * Edits D-110 system-level parameters:
 * - Reverb mode, time, and level
 * - Partial reserve for 9 parts (8 + rhythm)
 */

import { useCallback } from 'react';
import { useD110Store } from '@/stores';
import { useMidiStore } from '@/stores';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import {
  REVERB_MODE_NAMES,
  SYSTEM_PARAM_OFFSETS,
  PARAM_RANGES,
} from '@/core/midi/constants';
import type { ReverbMode } from '@/core/midi/types';

const MAX_TOTAL_PARTIALS = 32;

export function SystemEditor(): JSX.Element {
  const systemParams = useD110Store((state) => state.systemParams);
  const updateSystemParams = useD110Store((state) => state.updateSystemParams);
  const client = useMidiStore((state) => state.client);

  const sendSystemParameter = useCallback(
    async (offset: number, value: number) => {
      if (!client) return;
      try {
        await client.sendSystemParameter(offset, value);
      } catch (err) {
        console.error('[SystemEditor] Failed to send parameter:', err);
      }
    },
    [client]
  );

  const handleReverbModeChange = useCallback(
    async (mode: number) => {
      updateSystemParams({ reverbMode: mode as ReverbMode });
      await sendSystemParameter(SYSTEM_PARAM_OFFSETS.REVERB_MODE, mode);
    },
    [updateSystemParams, sendSystemParameter]
  );

  const handleReverbTimeChange = useCallback(
    (value: number) => {
      updateSystemParams({ reverbTime: value });
    },
    [updateSystemParams]
  );

  const handleReverbTimeCommit = useCallback(async () => {
    if (!systemParams) return;
    await sendSystemParameter(
      SYSTEM_PARAM_OFFSETS.REVERB_TIME,
      systemParams.reverbTime
    );
  }, [systemParams, sendSystemParameter]);

  const handleReverbLevelChange = useCallback(
    (value: number) => {
      updateSystemParams({ reverbLevel: value });
    },
    [updateSystemParams]
  );

  const handleReverbLevelCommit = useCallback(async () => {
    if (!systemParams) return;
    await sendSystemParameter(
      SYSTEM_PARAM_OFFSETS.REVERB_LEVEL,
      systemParams.reverbLevel
    );
  }, [systemParams, sendSystemParameter]);

  const handlePartialReserveChange = useCallback(
    (partIndex: number, value: number) => {
      if (!systemParams) return;
      const newReserve = [...systemParams.partialReserve];
      newReserve[partIndex] = value;
      updateSystemParams({ partialReserve: newReserve });
    },
    [systemParams, updateSystemParams]
  );

  const handlePartialReserveCommit = useCallback(
    async (partIndex: number) => {
      if (!systemParams) return;
      const offset = SYSTEM_PARAM_OFFSETS.PARTIAL_RESERVE_1 + partIndex;
      await sendSystemParameter(offset, systemParams.partialReserve[partIndex]);
    },
    [systemParams, sendSystemParameter]
  );

  if (!systemParams) {
    return (
      <div className="card">
        <div className="text-center text-d110-muted py-8">
          <p>No system parameters loaded</p>
          <p className="text-sm mt-2">
            Click "Fetch Patch" to load data from the D-110
          </p>
        </div>
      </div>
    );
  }

  const totalPartials = systemParams.partialReserve.reduce((a, b) => a + b, 0);
  const partialsRemaining = MAX_TOTAL_PARTIALS - totalPartials;

  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-semibold text-d110-highlight">
        System Parameters
      </h3>

      {/* Reverb Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-d110-text">Reverb</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Mode</label>
            <select
              value={systemParams.reverbMode}
              onChange={(e) =>
                void handleReverbModeChange(parseInt(e.target.value, 10))
              }
              className="input w-full"
            >
              {REVERB_MODE_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <ParameterSlider
            label="Time"
            value={systemParams.reverbTime}
            onChange={handleReverbTimeChange}
            onCommit={() => void handleReverbTimeCommit()}
            min={PARAM_RANGES.REVERB_TIME.min}
            max={PARAM_RANGES.REVERB_TIME.max}
          />
          <ParameterSlider
            label="Level"
            value={systemParams.reverbLevel}
            onChange={handleReverbLevelChange}
            onCommit={() => void handleReverbLevelCommit()}
            min={PARAM_RANGES.REVERB_LEVEL.min}
            max={PARAM_RANGES.REVERB_LEVEL.max}
          />
        </div>
      </div>

      {/* Partial Reserve Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-d110-text">Partial Reserve</h4>
          <span
            className={`text-sm ${
              partialsRemaining < 0
                ? 'text-red-400'
                : partialsRemaining === 0
                  ? 'text-yellow-400'
                  : 'text-d110-muted'
            }`}
          >
            Total: {totalPartials}/{MAX_TOTAL_PARTIALS}
            {partialsRemaining < 0 && ' (Over limit!)'}
          </span>
        </div>
        <p className="text-xs text-d110-muted">
          Allocate partials to each part. Total must not exceed 32.
        </p>

        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
          {systemParams.partialReserve.map((reserve, i) => (
            <ParameterSlider
              key={i}
              label={i < 8 ? `Part ${i + 1}` : 'Rhythm'}
              value={reserve}
              onChange={(v) => handlePartialReserveChange(i, v)}
              onCommit={() => void handlePartialReserveCommit(i)}
              min={PARAM_RANGES.PARTIAL_RESERVE.min}
              max={PARAM_RANGES.PARTIAL_RESERVE.max}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
