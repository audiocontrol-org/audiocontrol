/**
 * Part Configuration Editor
 *
 * Edits per-part settings in a D-110 patch:
 * - Tone group and number
 * - Key shift and fine tune
 * - Bender range
 * - Assign mode
 * - Output assign
 * - Output level and pan
 * - Key range
 */

import { useCallback } from 'react';
import { useD110Store } from '@/stores';
import { useMidiStore } from '@/stores';
import { ParameterSlider, formatPitch } from '@/components/ui/ParameterSlider';
import {
  TONE_GROUP_NAMES,
  ASSIGN_MODE_NAMES,
  OUTPUT_ASSIGN_NAMES,
  PART_TIMBRE_OFFSETS,
  PARAM_RANGES,
  getToneName,
} from '@/core/midi/constants';
import type { PartConfig, ToneGroup, AssignMode, OutputAssign } from '@/core/midi/types';
import { cn } from '@/lib/utils';

interface PartConfigEditorProps {
  partIndex: number;
  config: PartConfig;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function PartConfigEditor({
  partIndex,
  config,
  isExpanded = false,
  onToggleExpand,
}: PartConfigEditorProps): JSX.Element {
  const updatePartConfig = useD110Store((state) => state.updatePartConfig);
  const tone = useD110Store((state) => state.tones.get(partIndex));
  const client = useMidiStore((state) => state.client);

  const toneName = tone?.common.name.trim() || null;

  const sendPartParameter = useCallback(
    async (offset: number, value: number) => {
      if (!client) return;
      try {
        await client.sendPartParameter(partIndex, offset, value);
      } catch (err) {
        console.error(`[PartConfigEditor] Failed to send part ${partIndex} parameter:`, err);
      }
    },
    [client, partIndex]
  );

  // Tone Group
  const handleToneGroupChange = useCallback(
    async (value: number) => {
      updatePartConfig(partIndex, { toneGroup: value as ToneGroup });
      await sendPartParameter(PART_TIMBRE_OFFSETS.TONE_GROUP, value);
    },
    [partIndex, updatePartConfig, sendPartParameter]
  );

  // Tone Number (0-63)
  const handleToneNumberChange = useCallback(
    async (value: number) => {
      updatePartConfig(partIndex, { toneNumber: value });
      await sendPartParameter(PART_TIMBRE_OFFSETS.TONE_NUMBER, value);
    },
    [partIndex, updatePartConfig, sendPartParameter]
  );

  // Key Shift (-24 to +24 semitones, stored as 0-48 with 24 as center)
  const handleKeyShiftChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { keyShift: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleKeyShiftCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.KEY_SHIFT, config.keyShift);
  }, [config.keyShift, sendPartParameter]);

  // Fine Tune (-50 to +50 cents, stored as 0-100 with 50 as center)
  const handleFineTuneChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { fineTune: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleFineTuneCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.FINE_TUNE, config.fineTune);
  }, [config.fineTune, sendPartParameter]);

  // Bender Range (0-12)
  const handleBenderRangeChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { benderRange: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleBenderRangeCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.BENDER_RANGE, config.benderRange);
  }, [config.benderRange, sendPartParameter]);

  // Assign Mode
  const handleAssignModeChange = useCallback(
    async (value: number) => {
      updatePartConfig(partIndex, { assignMode: value as AssignMode });
      await sendPartParameter(PART_TIMBRE_OFFSETS.ASSIGN_MODE, value);
    },
    [partIndex, updatePartConfig, sendPartParameter]
  );

  // Output Assign
  const handleOutputAssignChange = useCallback(
    async (value: number) => {
      updatePartConfig(partIndex, { outputAssign: value as OutputAssign });
      await sendPartParameter(PART_TIMBRE_OFFSETS.OUTPUT_ASSIGN, value);
    },
    [partIndex, updatePartConfig, sendPartParameter]
  );

  // Output Level (0-100)
  const handleOutputLevelChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { outputLevel: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleOutputLevelCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.OUTPUT_LEVEL, config.outputLevel);
  }, [config.outputLevel, sendPartParameter]);

  // Pan (0-100, 50 = center)
  const handlePanChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { pan: value });
    },
    [partIndex, updatePartConfig]
  );

  const handlePanCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.PAN, config.pan);
  }, [config.pan, sendPartParameter]);

  // Key Range Lower
  const handleKeyRangeLowerChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { keyRangeLower: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleKeyRangeLowerCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.KEY_RANGE_LOWER, config.keyRangeLower);
  }, [config.keyRangeLower, sendPartParameter]);

  // Key Range Upper
  const handleKeyRangeUpperChange = useCallback(
    (value: number) => {
      updatePartConfig(partIndex, { keyRangeUpper: value });
    },
    [partIndex, updatePartConfig]
  );

  const handleKeyRangeUpperCommit = useCallback(async () => {
    await sendPartParameter(PART_TIMBRE_OFFSETS.KEY_RANGE_UPPER, config.keyRangeUpper);
  }, [config.keyRangeUpper, sendPartParameter]);

  const formatPan = (value: number): string => {
    if (value === 50) return 'C';
    if (value < 50) return `L${50 - value}`;
    return `R${value - 50}`;
  };

  const formatKeyShift = (value: number): string => {
    const shift = value - 24;
    if (shift === 0) return '0';
    return shift > 0 ? `+${shift}` : String(shift);
  };

  const formatFineTune = (value: number): string => {
    const cents = value - 50;
    if (cents === 0) return '0';
    return cents > 0 ? `+${cents}` : String(cents);
  };

  // Collapsed summary view
  if (!isExpanded) {
    return (
      <div
        className={cn(
          'card p-3 cursor-pointer hover:bg-d110-surface/50 transition-colors',
          'border border-d110-border'
        )}
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-d110-accent">
              {partIndex + 1}
            </span>
            <div>
              <span className="text-d110-text">
                {TONE_GROUP_NAMES[config.toneGroup]} #{config.toneNumber + 1}
              </span>
              {toneName && (
                <span className="text-d110-highlight ml-2 font-mono">
                  "{toneName}"
                </span>
              )}
              <span className="text-d110-muted ml-3 text-sm">
                {formatPitch(config.keyRangeLower)} - {formatPitch(config.keyRangeUpper)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-d110-muted">
            <span>Lvl: {config.outputLevel}</span>
            <span>Pan: {formatPan(config.pan)}</span>
            <span className="text-d110-highlight">Expand</span>
          </div>
        </div>
      </div>
    );
  }

  // Expanded editor view
  return (
    <div className="card space-y-4 border-2 border-d110-accent">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-bold text-d110-accent">
            Part {partIndex + 1}
          </h4>
          {toneName && (
            <span className="text-d110-highlight font-mono">"{toneName}"</span>
          )}
        </div>
        <span className="text-sm text-d110-highlight hover:text-d110-text">
          Collapse
        </span>
      </div>

      {/* Tone Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Tone Group</label>
          <select
            value={config.toneGroup}
            onChange={(e) => void handleToneGroupChange(parseInt(e.target.value, 10))}
            className="input w-full"
          >
            {TONE_GROUP_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tone</label>
          <select
            value={config.toneNumber}
            onChange={(e) => void handleToneNumberChange(parseInt(e.target.value, 10))}
            className="input w-full"
          >
            {Array.from({ length: 64 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}: {getToneName(config.toneGroup, i)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pitch Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ParameterSlider
          label="Key Shift"
          value={config.keyShift}
          onChange={handleKeyShiftChange}
          onCommit={() => void handleKeyShiftCommit()}
          min={0}
          max={48}
          formatValue={formatKeyShift}
        />
        <ParameterSlider
          label="Fine Tune"
          value={config.fineTune}
          onChange={handleFineTuneChange}
          onCommit={() => void handleFineTuneCommit()}
          min={0}
          max={100}
          formatValue={formatFineTune}
        />
        <ParameterSlider
          label="Bender Range"
          value={config.benderRange}
          onChange={handleBenderRangeChange}
          onCommit={() => void handleBenderRangeCommit()}
          min={PARAM_RANGES.BENDER_RANGE.min}
          max={PARAM_RANGES.BENDER_RANGE.max}
        />
      </div>

      {/* Mode Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Assign Mode</label>
          <select
            value={config.assignMode}
            onChange={(e) => void handleAssignModeChange(parseInt(e.target.value, 10))}
            className="input w-full"
          >
            {ASSIGN_MODE_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Output Assign</label>
          <select
            value={config.outputAssign}
            onChange={(e) => void handleOutputAssignChange(parseInt(e.target.value, 10))}
            className="input w-full"
          >
            {OUTPUT_ASSIGN_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Output Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParameterSlider
          label="Output Level"
          value={config.outputLevel}
          onChange={handleOutputLevelChange}
          onCommit={() => void handleOutputLevelCommit()}
          min={PARAM_RANGES.OUTPUT_LEVEL.min}
          max={PARAM_RANGES.OUTPUT_LEVEL.max}
        />
        <ParameterSlider
          label="Pan"
          value={config.pan}
          onChange={handlePanChange}
          onCommit={() => void handlePanCommit()}
          min={PARAM_RANGES.PAN.min}
          max={PARAM_RANGES.PAN.max}
          formatValue={formatPan}
        />
      </div>

      {/* Key Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ParameterSlider
          label="Key Range Lower"
          value={config.keyRangeLower}
          onChange={handleKeyRangeLowerChange}
          onCommit={() => void handleKeyRangeLowerCommit()}
          min={PARAM_RANGES.KEY_RANGE.min}
          max={PARAM_RANGES.KEY_RANGE.max}
          formatValue={formatPitch}
        />
        <ParameterSlider
          label="Key Range Upper"
          value={config.keyRangeUpper}
          onChange={handleKeyRangeUpperChange}
          onCommit={() => void handleKeyRangeUpperCommit()}
          min={PARAM_RANGES.KEY_RANGE.min}
          max={PARAM_RANGES.KEY_RANGE.max}
          formatValue={formatPitch}
        />
      </div>

      {/* Key Range Visual */}
      <div className="bg-d110-surface rounded p-2">
        <div className="flex items-center justify-between text-xs text-d110-muted mb-1">
          <span>C-1 (0)</span>
          <span>Key Range</span>
          <span>G9 (127)</span>
        </div>
        <div className="h-4 bg-d110-bg rounded relative">
          <div
            className="absolute h-full bg-d110-accent rounded"
            style={{
              left: `${(config.keyRangeLower / 127) * 100}%`,
              width: `${((config.keyRangeUpper - config.keyRangeLower) / 127) * 100}%`,
            }}
          />
        </div>
        <div className="text-center text-xs text-d110-muted mt-1">
          {formatPitch(config.keyRangeLower)} - {formatPitch(config.keyRangeUpper)}
        </div>
      </div>
    </div>
  );
}
