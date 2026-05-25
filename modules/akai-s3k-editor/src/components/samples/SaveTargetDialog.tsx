/**
 * SaveTargetDialog — choose where to save edited sample audio.
 *
 * Options:
 * - Device (overwrite): replace the original sample in device memory
 * - Device (new slot): upload as a new sample with a name suffix
 * - Library: save to the common-area library (OPFS)
 *
 * Shown when a device-origin sample is saved from the sample editor or chopper.
 * Loop editor saves always go to device header (fast, no dialog needed).
 */

import { useState } from 'react';

export type SaveTarget = 'device-overwrite' | 'device-new' | 'library';

interface SaveTargetDialogProps {
  open: boolean;
  sampleName: string;
  /** Whether library save is available (requires connected library root) */
  hasLibrary: boolean;
  onConfirm: (target: SaveTarget) => void;
  onCancel: () => void;
}

export function SaveTargetDialog({
  open,
  sampleName,
  hasLibrary,
  onConfirm,
  onCancel,
}: SaveTargetDialogProps): JSX.Element | null {
  const [selected, setSelected] = useState<SaveTarget>('device-overwrite');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Save target"
      >
        <h3 className="text-lg font-semibold text-gray-100 mb-1">Save Sample</h3>
        <p className="text-sm text-gray-400 mb-4">
          Where should &ldquo;{sampleName.trim()}&rdquo; be saved?
        </p>

        <div className="space-y-2 mb-5">
          <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
            <input
              type="radio"
              name="save-target"
              value="device-overwrite"
              checked={selected === 'device-overwrite'}
              onChange={() => setSelected('device-overwrite')}
              className="accent-amber-500"
            />
            <div>
              <div className="text-sm text-gray-200">Overwrite on device</div>
              <div className="text-xs text-gray-500">Replace the original sample in device memory</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
            <input
              type="radio"
              name="save-target"
              value="device-new"
              checked={selected === 'device-new'}
              onChange={() => setSelected('device-new')}
              className="accent-amber-500"
            />
            <div>
              <div className="text-sm text-gray-200">New device slot</div>
              <div className="text-xs text-gray-500">Create a new sample on the device</div>
            </div>
          </label>

          {hasLibrary && (
            <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-700 cursor-pointer">
              <input
                type="radio"
                name="save-target"
                value="library"
                checked={selected === 'library'}
                onChange={() => setSelected('library')}
                className="accent-amber-500"
              />
              <div>
                <div className="text-sm text-gray-200">Save to library</div>
                <div className="text-xs text-gray-500">Save as a common-area sample in your library</div>
              </div>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="ac-btn"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="ac-btn ac-btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
