/**
 * Standalone Drum Kit Editor Dialog
 *
 * Opens when clicking "Edit Kit" on a drum kit in the library.
 * Loads the sample YAML, allows editing kit metadata and per-pad
 * labels, then writes the updated YAML back to storage.
 */

import { useState, useEffect, useCallback } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  loadSampleMeta,
  getNestedDirectory,
  sanitizeForFilename,
} from '@audiocontrol/sampler-library/browser';
import { Dialog, DialogTitle, DialogActions } from '@/components/ui/Dialog';
import { DEFAULT_BASE_NOTE } from '@audiocontrol/sample-chopper';

// =========================================================================
// Types
// =========================================================================

interface KitSettings {
  baseNote: number;
  transpose: number;
  velocitySensitivity: number;
}

interface PadInfo {
  index: number;
  label: string;
  startSample: number;
  endSample: number;
}

export interface DrumKitEditorDialogProps {
  open: boolean;
  onClose: () => void;
  kitName: string;
  kitPath: string[];
  libraryRoot: StorageDirectoryHandle;
  onSave: () => void;
}

const VELOCITY_LABELS = [
  'None', 'Low', 'Medium-Low', 'Medium', 'Medium-High', 'Max',
] as const;

/** Coerce a MIDI note (string name or number) to a numeric value. */
function toMidiNumber(note: string | number | undefined, fallback: number): number {
  if (note === undefined) return fallback;
  if (typeof note === 'number') return note;
  // Note name — not parsed here, fall back to default
  return fallback;
}

// =========================================================================
// Component
// =========================================================================

export function DrumKitEditorDialog({
  open,
  onClose,
  kitName,
  kitPath,
  libraryRoot,
  onSave,
}: DrumKitEditorDialogProps): JSX.Element {
  const [settings, setSettings] = useState<KitSettings>({
    baseNote: DEFAULT_BASE_NOTE,
    transpose: 0,
    velocitySensitivity: 2,
  });
  const [pads, setPads] = useState<PadInfo[]>([]);
  const [sampleRate, setSampleRate] = useState(44100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load kit data when dialog opens
  useEffect(() => {
    if (!open) return;
    setError(null);

    void (async () => {
      try {
        const yaml = await loadSampleMeta(libraryRoot, kitName, kitPath);
        setSampleRate(yaml.sampleRate);

        const dk = yaml.drumKit;
        setSettings({
          baseNote: toMidiNumber(dk?.baseNote, DEFAULT_BASE_NOTE),
          transpose: dk?.transpose ?? 0,
          velocitySensitivity: dk?.velocitySensitivity ?? 2,
        });

        const slices = yaml.slices ?? [];
        setPads(
          slices.map((s, i) => ({
            index: i,
            label: s.label ?? `Pad ${i + 1}`,
            startSample: s.startSample,
            endSample: s.endSample,
          })),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load kit data';
        console.error('[DrumKitEditorDialog] Load error:', err);
        setError(msg);
      }
    })();
  }, [open, libraryRoot, kitName, kitPath]);

  const updateSetting = useCallback((partial: Partial<KitSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const updatePadLabel = useCallback((index: number, label: string) => {
    setPads((prev) =>
      prev.map((p) => (p.index === index ? { ...p, label } : p)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const yaml = await loadSampleMeta(libraryRoot, kitName, kitPath);

      // Update drumKit metadata
      yaml.drumKit = {
        baseNote: settings.baseNote,
        transpose: settings.transpose !== 0 ? settings.transpose : undefined,
        velocitySensitivity: settings.velocitySensitivity,
      };

      // Update slice labels
      if (yaml.slices) {
        yaml.slices = yaml.slices.map((s, i) => ({
          ...s,
          label: pads[i]?.label ?? s.label,
        }));
      }

      yaml.modifiedAt = new Date().toISOString();

      // Write YAML back to storage
      const fullPath = ['library', 'common', 'samples', ...kitPath];
      const safeName = sanitizeForFilename(kitName);
      const samplesDir = await getNestedDirectory(libraryRoot, fullPath);
      const sampleDir = await samplesDir.getDirectoryHandle(safeName);
      const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const writable = await yamlHandle.createWritable();
      await writable.write(stringifyYaml(yaml, { indent: 2, lineWidth: 120 }));
      await writable.close();

      onSave();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save kit';
      console.error('[DrumKitEditorDialog] Save error:', err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [libraryRoot, kitName, kitPath, settings, pads, onSave, onClose]);

  const formatDuration = (start: number, end: number): string => {
    const ms = ((end - start) / sampleRate) * 1000;
    return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <DialogTitle>Edit Drum Kit: {kitName}</DialogTitle>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/30 rounded p-2 mb-4">
          {error}
        </div>
      )}

      {/* Kit Settings */}
      <div className="space-y-3 mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide">
          Kit Settings
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Base MIDI Note
            </label>
            <input
              type="number"
              min="0"
              max="127"
              value={settings.baseNote}
              onChange={(e) =>
                updateSetting({ baseNote: parseInt(e.target.value) || DEFAULT_BASE_NOTE })
              }
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Velocity: {VELOCITY_LABELS[settings.velocitySensitivity]}
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={settings.velocitySensitivity}
              onChange={(e) =>
                updateSetting({ velocitySensitivity: parseInt(e.target.value) })
              }
              className="w-full accent-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Transpose: {settings.transpose > 0 ? '+' : ''}{settings.transpose} st
          </label>
          <input
            type="range"
            min="-24"
            max="24"
            step="1"
            value={settings.transpose}
            onChange={(e) => updateSetting({ transpose: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>-2 oct</span>
            <button
              onClick={() => updateSetting({ transpose: 0 })}
              className="text-blue-400 hover:underline"
            >
              Reset
            </button>
            <span>+2 oct</span>
          </div>
        </div>
      </div>

      {/* Pads */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          Pads ({pads.length})
        </div>
        <div className="max-h-60 overflow-y-auto border border-gray-700 rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1 text-gray-400 font-normal">#</th>
                <th className="text-left px-2 py-1 text-gray-400 font-normal">Label</th>
                <th className="text-left px-2 py-1 text-gray-400 font-normal">Note</th>
                <th className="text-left px-2 py-1 text-gray-400 font-normal">Duration</th>
              </tr>
            </thead>
            <tbody>
              {pads.map((pad) => (
                <tr key={pad.index} className="border-t border-gray-700/50">
                  <td className="px-2 py-1 text-gray-400">{pad.index + 1}</td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={pad.label}
                      onChange={(e) => updatePadLabel(pad.index, e.target.value)}
                      className="w-full bg-transparent border-b border-gray-600 text-gray-100 text-sm px-0 py-0 focus:border-blue-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1 text-gray-300 tabular-nums">
                    {settings.baseNote + pad.index + settings.transpose}
                  </td>
                  <td className="px-2 py-1 text-gray-400 tabular-nums">
                    {formatDuration(pad.startSample, pad.endSample)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DialogActions>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-300 hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </DialogActions>
    </Dialog>
  );
}
