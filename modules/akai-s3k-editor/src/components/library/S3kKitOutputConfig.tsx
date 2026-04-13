/**
 * S3000XL Kit Output Configuration
 *
 * Device-specific output configuration for the sample chopper dialog.
 * Manages kit name, base note, transpose, and velocity sensitivity.
 * Rendered inside SampleChopperDialog via the renderOutputConfig prop.
 */

import { DEFAULT_BASE_NOTE } from '@audiocontrol/sample-chopper';
import type { BaseKitConfig, KitOutputConfigProps } from '@audiocontrol/editor-core';

// =========================================================================
// Types
// =========================================================================

/**
 * S3kKitConfig is identical to BaseKitConfig — the S3000XL does not
 * require any device-specific kit configuration fields.
 */
export type S3kKitConfig = BaseKitConfig;

export const DEFAULT_S3K_KIT_CONFIG: S3kKitConfig = {
  name: '',
  baseNote: DEFAULT_BASE_NOTE,
  transpose: 0,
  velocitySensitivity: 2,
};

const VELOCITY_LABELS = [
  'None',
  'Low',
  'Medium-Low',
  'Medium',
  'Medium-High',
  'Max',
] as const;

export type S3kKitOutputConfigProps = KitOutputConfigProps<S3kKitConfig>;

// =========================================================================
// Component
// =========================================================================

export function S3kKitOutputConfig({
  state,
  config,
  onConfigChange,
  editMode = false,
}: S3kKitOutputConfigProps): JSX.Element {
  const update = (partial: Partial<S3kKitConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  return (
    <div className="bg-gray-900 rounded p-3 space-y-3">
      <div className="text-xs text-gray-400 uppercase tracking-wide">
        Drum Kit Output
      </div>

      {!editMode && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Kit Name (max 12 chars)
            </label>
            <input
              type="text"
              maxLength={12}
              value={config.name}
              onChange={(e) => update({ name: e.target.value.toUpperCase() })}
              placeholder="DRUM-KIT"
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100 uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Base MIDI Note
            </label>
            <input
              type="number"
              min="0"
              max="127"
              value={config.baseNote}
              onChange={(e) =>
                update({ baseNote: parseInt(e.target.value) || DEFAULT_BASE_NOTE })
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              value={state.labels}
              onChange={(e) => state.onLabelsChange(e.target.value)}
              placeholder="kick,snare,hhc,hho"
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
            />
          </div>
        </div>
      )}

      {editMode && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Base MIDI Note
          </label>
          <input
            type="number"
            min="0"
            max="127"
            value={config.baseNote}
            onChange={(e) =>
              update({ baseNote: parseInt(e.target.value) || DEFAULT_BASE_NOTE })
            }
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
          />
        </div>
      )}

      {/* Transpose */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
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
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>-2 oct</span>
          <button
            onClick={() => update({ transpose: 0 })}
            className="text-blue-400 hover:underline"
          >
            Reset
          </button>
          <span>+2 oct</span>
        </div>
      </div>

      {/* Velocity Sensitivity */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Velocity Sensitivity: {VELOCITY_LABELS[config.velocitySensitivity]}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="1"
          value={config.velocitySensitivity}
          onChange={(e) =>
            update({ velocitySensitivity: parseInt(e.target.value) })
          }
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>None</span>
          <span>Max</span>
        </div>
      </div>
    </div>
  );
}
