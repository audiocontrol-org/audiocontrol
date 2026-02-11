/**
 * Tone Common Parameters Editor
 *
 * Edits tone-level settings that affect all partials:
 * - Tone name (10 characters)
 * - Structure 1-2 and 3-4 (partial routing)
 * - Partial mutes
 * - Envelope mode
 */

import { useCallback } from 'react';
import { useD110Store, selectCurrentTone } from '@/stores';
import { useMidiStore } from '@/stores';
import { STRUCTURE_NAMES } from '@/core/midi/constants';
import type { ToneCommon } from '@/core/midi/types';
import { cn } from '@/lib/utils';

interface StructureSelectorProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function StructureSelector({ label, value, onChange }: StructureSelectorProps): JSX.Element {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="input w-full"
      >
        {STRUCTURE_NAMES.map((name, i) => (
          <option key={i} value={i}>
            {i + 1}: {name}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PartialMuteToggleProps {
  label: string;
  muted: boolean;
  onChange: (muted: boolean) => void;
}

function PartialMuteToggle({ label, muted, onChange }: PartialMuteToggleProps): JSX.Element {
  return (
    <button
      onClick={() => onChange(!muted)}
      className={cn(
        'flex items-center justify-center w-12 h-12 rounded-md border transition-colors',
        muted
          ? 'bg-d110-bg border-d110-border text-d110-muted'
          : 'bg-d110-accent border-d110-highlight text-white'
      )}
      title={muted ? `${label} Muted` : `${label} Active`}
    >
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

export function ToneCommonEditor(): JSX.Element {
  const tone = useD110Store(selectCurrentTone);
  const selectedPart = useD110Store((state) => state.selectedPart);
  const updateToneCommon = useD110Store((state) => state.updateToneCommon);
  const client = useMidiStore((state) => state.client);
  const isConnected = useMidiStore((state) => state.status === 'connected');

  const common = tone?.common;

  // Send parameter to hardware
  const sendParameter = useCallback(
    async (offset: number, value: number) => {
      if (!client) return;
      try {
        // Tone common parameters start at offset 0 in the temp tone area
        await client.sendToneParameter(
          selectedPart,
          { aa: 0, bb: 0, cc: offset },
          value
        );
      } catch (err) {
        console.error('[ToneCommonEditor] Failed to send parameter:', err);
      }
    },
    [client, selectedPart]
  );

  // Handle name change
  const handleNameChange = useCallback(
    async (name: string) => {
      // Pad or truncate to 10 characters
      const paddedName = name.padEnd(10, ' ').slice(0, 10);
      updateToneCommon(selectedPart, { name: paddedName });

      // Send each character to hardware
      if (client) {
        for (let i = 0; i < 10; i++) {
          await sendParameter(i, paddedName.charCodeAt(i));
        }
      }
    },
    [client, selectedPart, sendParameter, updateToneCommon]
  );

  // Handle structure change
  const handleStructure12Change = useCallback(
    async (value: number) => {
      updateToneCommon(selectedPart, {
        structure12: value as ToneCommon['structure12'],
      });
      await sendParameter(10, value);
    },
    [selectedPart, sendParameter, updateToneCommon]
  );

  const handleStructure34Change = useCallback(
    async (value: number) => {
      updateToneCommon(selectedPart, {
        structure34: value as ToneCommon['structure34'],
      });
      await sendParameter(11, value);
    },
    [selectedPart, sendParameter, updateToneCommon]
  );

  // Handle partial mute change
  const handleMuteChange = useCallback(
    async (partial: 1 | 2 | 3 | 4, muted: boolean) => {
      if (!common) return;

      const newMutes = { ...common.partialMutes };
      newMutes[`partial${partial}` as keyof typeof newMutes] = muted;

      updateToneCommon(selectedPart, { partialMutes: newMutes });

      // Pack mutes into a single byte
      const mutesByte =
        (newMutes.partial1 ? 0x01 : 0) |
        (newMutes.partial2 ? 0x02 : 0) |
        (newMutes.partial3 ? 0x04 : 0) |
        (newMutes.partial4 ? 0x08 : 0);

      await sendParameter(12, mutesByte);
    },
    [common, selectedPart, sendParameter, updateToneCommon]
  );

  // Handle envelope mode change
  const handleEnvModeChange = useCallback(
    async (mode: number) => {
      updateToneCommon(selectedPart, { envMode: mode });
      await sendParameter(13, mode);
    },
    [selectedPart, sendParameter, updateToneCommon]
  );

  if (!tone || !common) {
    return (
      <div className="card">
        <div className="text-center text-d110-muted py-8">
          <p>No tone data loaded</p>
          <p className="text-sm mt-2">
            {isConnected
              ? 'Click "Fetch Tone" to load data from the D-110'
              : 'Connect to your D-110 to start editing'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-6">
      <h3 className="text-lg font-semibold text-d110-highlight">
        Tone Common Parameters
      </h3>

      {/* Tone Name */}
      <div>
        <label className="label">Tone Name</label>
        <input
          type="text"
          value={common.name}
          onChange={(e) => void handleNameChange(e.target.value)}
          maxLength={10}
          className="input w-full font-mono"
          placeholder="Tone name..."
        />
        <p className="text-xs text-d110-muted mt-1">
          Max 10 characters
        </p>
      </div>

      {/* Structure Selection */}
      <div className="grid grid-cols-2 gap-4">
        <StructureSelector
          label="Structure 1-2"
          value={common.structure12}
          onChange={(v) => void handleStructure12Change(v)}
        />
        <StructureSelector
          label="Structure 3-4"
          value={common.structure34}
          onChange={(v) => void handleStructure34Change(v)}
        />
      </div>

      {/* Structure Description */}
      <div className="bg-d110-surface rounded-md p-3">
        <p className="text-xs text-d110-muted">
          <strong>Structure 1-2:</strong> {STRUCTURE_NAMES[common.structure12]}
        </p>
        <p className="text-xs text-d110-muted mt-1">
          <strong>Structure 3-4:</strong> {STRUCTURE_NAMES[common.structure34]}
        </p>
      </div>

      {/* Partial Mutes */}
      <div>
        <label className="label">Partial Mutes</label>
        <div className="flex gap-2">
          <PartialMuteToggle
            label="P1"
            muted={common.partialMutes.partial1}
            onChange={(muted) => void handleMuteChange(1, muted)}
          />
          <PartialMuteToggle
            label="P2"
            muted={common.partialMutes.partial2}
            onChange={(muted) => void handleMuteChange(2, muted)}
          />
          <PartialMuteToggle
            label="P3"
            muted={common.partialMutes.partial3}
            onChange={(muted) => void handleMuteChange(3, muted)}
          />
          <PartialMuteToggle
            label="P4"
            muted={common.partialMutes.partial4}
            onChange={(muted) => void handleMuteChange(4, muted)}
          />
        </div>
        <p className="text-xs text-d110-muted mt-2">
          Click to toggle. Highlighted = active, dim = muted.
        </p>
      </div>

      {/* Envelope Mode */}
      <div>
        <label className="label">Envelope Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => void handleEnvModeChange(0)}
            className={cn(
              'btn',
              common.envMode === 0 ? 'btn-primary' : 'btn-secondary'
            )}
          >
            Normal
          </button>
          <button
            onClick={() => void handleEnvModeChange(1)}
            className={cn(
              'btn',
              common.envMode === 1 ? 'btn-primary' : 'btn-secondary'
            )}
          >
            No Sustain
          </button>
        </div>
        <p className="text-xs text-d110-muted mt-2">
          No Sustain mode ignores the sustain pedal.
        </p>
      </div>
    </div>
  );
}
