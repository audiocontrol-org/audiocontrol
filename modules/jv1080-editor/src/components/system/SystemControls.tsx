import { useState } from 'react';
import {
  applyClockSource,
  applyPanelMode,
  applyPatchGroup,
  applyPatchGroupId,
  applyPatchNumber,
  applyPerformanceNumber,
  clamp7Bit,
  DEFAULT_SYSTEM_STATE,
  type ClockSource,
  type Jv1080SystemClient,
  type Jv1080SystemState,
  type PanelMode,
  type PatchGroup,
} from '@/system/systemControls';

interface SystemControlsProps {
  client: Jv1080SystemClient | null;
  connected: boolean;
}

export function SystemControls({ client, connected }: SystemControlsProps): JSX.Element {
  const [state, setState] = useState<Jv1080SystemState>(DEFAULT_SYSTEM_STATE);

  const setAndSend = <K extends keyof Jv1080SystemState>(key: K, value: Jv1080SystemState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const disabled = !connected || !client;

  return (
    <section className="panel">
      <h2 className="text-lg font-semibold text-jv1080-text">System Parameters</h2>
      <p className="mt-2 text-sm text-jv1080-muted">Core JV-1080 system controls wired to DT1 writes.</p>
      {!connected ? <p className="error">Connect MIDI on Home page to enable writes.</p> : null}

      <div className="row mt-3">
        <div className="col">
          <label htmlFor="panel-mode" className="label">Panel Mode</label>
          <select
            id="panel-mode"
            value={state.panelMode}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value as PanelMode;
              setAndSend('panelMode', value);
              if (client) applyPanelMode(client, value);
            }}
          >
            <option value="performance">Performance</option>
            <option value="patch">Patch</option>
            <option value="gm">GM</option>
          </select>
        </div>

        <div className="col max-w-[220px]">
          <label htmlFor="performance-number" className="label">Performance Number</label>
          <input
            id="performance-number"
            type="number"
            min={0}
            max={127}
            value={state.performanceNumber}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = clamp7Bit(Number.parseInt(e.target.value, 10) || 0);
              setAndSend('performanceNumber', value);
              if (client) applyPerformanceNumber(client, value);
            }}
          />
        </div>
      </div>

      <div className="row">
        <div className="col">
          <label htmlFor="patch-group" className="label">Patch Group</label>
          <select
            id="patch-group"
            value={state.patchGroup}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value as PatchGroup;
              setAndSend('patchGroup', value);
              if (client) applyPatchGroup(client, value);
            }}
          >
            <option value="user">User</option>
            <option value="pcm">PCM</option>
          </select>
        </div>

        <div className="col max-w-[220px]">
          <label htmlFor="patch-group-id" className="label">Patch Group ID</label>
          <input
            id="patch-group-id"
            type="number"
            min={0}
            max={127}
            value={state.patchGroupId}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = clamp7Bit(Number.parseInt(e.target.value, 10) || 0);
              setAndSend('patchGroupId', value);
              if (client) applyPatchGroupId(client, value);
            }}
          />
        </div>

        <div className="col max-w-[220px]">
          <label htmlFor="patch-number" className="label">Patch Number</label>
          <input
            id="patch-number"
            type="number"
            min={0}
            max={127}
            value={state.patchNumber}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = clamp7Bit(Number.parseInt(e.target.value, 10) || 0);
              setAndSend('patchNumber', value);
              if (client) applyPatchNumber(client, value);
            }}
          />
        </div>
      </div>

      <div className="row mt-2">
        <Toggle
          label="Insert FX"
          checked={state.insertFx}
          disabled={disabled}
          onChange={(checked) => {
            setAndSend('insertFx', checked);
            client?.setInsertFx(checked);
          }}
        />
        <Toggle
          label="Chorus FX"
          checked={state.chorusFx}
          disabled={disabled}
          onChange={(checked) => {
            setAndSend('chorusFx', checked);
            client?.setChorusFx(checked);
          }}
        />
        <Toggle
          label="Reverb FX"
          checked={state.reverbFx}
          disabled={disabled}
          onChange={(checked) => {
            setAndSend('reverbFx', checked);
            client?.setReverbFx(checked);
          }}
        />
        <Toggle
          label="Patch Remain"
          checked={state.patchRemain}
          disabled={disabled}
          onChange={(checked) => {
            setAndSend('patchRemain', checked);
            client?.setPatchRemain(checked);
          }}
        />
      </div>

      <div className="row mt-2">
        <div className="col max-w-[220px]">
          <label htmlFor="clock-source" className="label">Clock Source</label>
          <select
            id="clock-source"
            value={state.clockSource}
            className="field"
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value as ClockSource;
              setAndSend('clockSource', value);
              if (client) applyClockSource(client, value);
            }}
          >
            <option value="internal">Internal</option>
            <option value="midi">MIDI</option>
          </select>
        </div>
      </div>
    </section>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, checked, disabled, onChange }: ToggleProps): JSX.Element {
  return (
    <label className="inline-flex items-center gap-2 min-w-[150px] text-sm text-jv1080-text">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
