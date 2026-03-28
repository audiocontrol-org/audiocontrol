/**
 * S-330/S-550 Kit Output Configuration
 *
 * Device-specific output configuration for the sample chopper dialog.
 * Manages kit name, sample rate (15/30kHz), base note, labels,
 * transpose, and velocity sensitivity.
 */

import { DEFAULT_BASE_NOTE } from '@audiocontrol/sample-chopper';
import type { ChopperOutputState } from '@audiocontrol/sample-chopper/ui';

export interface S330KitConfig {
  name: string;
  sampleRate: 15000 | 30000;
  baseNote: number;
  transpose: number;
  velocitySensitivity: number;
}

export interface S330KitOutputConfigProps {
  state: ChopperOutputState;
  config: S330KitConfig;
  onConfigChange: (config: S330KitConfig) => void;
  editMode?: boolean;
}

export function S330KitOutputConfig({
  state,
  config,
  onConfigChange,
  editMode = false,
}: S330KitOutputConfigProps): JSX.Element {
  const update = (partial: Partial<S330KitConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  // Create mode: full kit config
  if (!editMode) {
    return (
      <div className="bg-s330-bg rounded p-3 space-y-3">
        <div className="text-xs text-s330-muted uppercase tracking-wide">
          Drum Kit Output
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-s330-muted mb-1">
              Kit Name (max 12 chars)
            </label>
            <input
              type="text"
              maxLength={12}
              value={config.name}
              onChange={(e) => update({ name: e.target.value.toUpperCase() })}
              placeholder="DRUM-KIT"
              className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-s330-muted mb-1">
              Sample Rate
            </label>
            <select
              value={config.sampleRate}
              onChange={(e) =>
                update({ sampleRate: parseInt(e.target.value) as 15000 | 30000 })
              }
              className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
            >
              <option value={15000}>15 kHz</option>
              <option value={30000}>30 kHz</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-s330-muted mb-1">
              Base MIDI Note
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={config.baseNote}
              onChange={(e) => update({ baseNote: parseInt(e.target.value) || DEFAULT_BASE_NOTE })}
              className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
            />
          </div>
          <div>
            <label className="block text-xs text-s330-muted mb-1">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              value={state.labels}
              onChange={(e) => state.onLabelsChange(e.target.value)}
              placeholder="kick,snare,hhc,hho"
              className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
            />
          </div>
        </div>
        {/* Transpose control */}
        <div>
          <label className="block text-xs text-s330-muted mb-1">
            Pitch Adjust (semitones: {config.transpose > 0 ? '+' : ''}
            {config.transpose})
          </label>
          <input
            type="range"
            min="-24"
            max="24"
            step="1"
            value={config.transpose}
            onChange={(e) => update({ transpose: parseInt(e.target.value) })}
            className="w-full accent-s330-highlight"
          />
          <div className="flex justify-between text-xs text-s330-muted mt-1">
            <span>-2 oct</span>
            <button
              onClick={() => update({ transpose: 0 })}
              className="text-s330-highlight hover:underline"
            >
              Reset
            </button>
            <span>+2 oct</span>
          </div>
          <p className="text-xs text-s330-muted mt-1">
            Use to pitch down samples recorded at high speed.
          </p>
        </div>
        {/* Velocity Sensitivity */}
        <div>
          <label className="block text-xs text-s330-muted mb-1">
            Velocity Sensitivity: {config.velocitySensitivity}
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={config.velocitySensitivity}
            onChange={(e) => update({ velocitySensitivity: parseInt(e.target.value) })}
            className="w-full accent-s330-highlight"
          />
          <div className="flex justify-between text-xs text-s330-muted mt-1">
            <span>None</span>
            <span>Max</span>
          </div>
          <p className="text-xs text-s330-muted mt-1">
            How much MIDI velocity affects sample volume.
          </p>
        </div>
      </div>
    );
  }

  // Edit mode: just transpose + velocity
  return (
    <div className="bg-s330-bg rounded p-3 space-y-3">
      <div className="text-xs text-s330-muted uppercase tracking-wide">
        Playback Settings
      </div>
      <div>
        <label className="block text-xs text-s330-muted mb-1">
          Pitch Adjust (semitones: {config.transpose > 0 ? '+' : ''}
          {config.transpose})
        </label>
        <input
          type="range"
          min="-24"
          max="24"
          step="1"
          value={config.transpose}
          onChange={(e) => update({ transpose: parseInt(e.target.value) })}
          className="w-full accent-s330-highlight"
        />
        <div className="flex justify-between text-xs text-s330-muted mt-1">
          <span>-2 oct</span>
          <button
            onClick={() => update({ transpose: 0 })}
            className="text-s330-highlight hover:underline"
          >
            Reset
          </button>
          <span>+2 oct</span>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          Use to pitch down samples recorded at high speed.
        </p>
      </div>
      <div>
        <label className="block text-xs text-s330-muted mb-1">
          Velocity Sensitivity: {config.velocitySensitivity}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          value={config.velocitySensitivity}
          onChange={(e) => update({ velocitySensitivity: parseInt(e.target.value) })}
          className="w-full accent-s330-highlight"
        />
        <div className="flex justify-between text-xs text-s330-muted mt-1">
          <span>None</span>
          <span>Max</span>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          How much MIDI velocity affects sample volume.
        </p>
      </div>
    </div>
  );
}
