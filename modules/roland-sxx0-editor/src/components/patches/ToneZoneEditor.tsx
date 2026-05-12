/**
 * Tone Zone Editor Component
 *
 * Provides a visual zone-based editor for editing S-330 patch tone-to-key mappings.
 * Displays key zones as horizontal bars, allowing users to visually define which
 * MIDI key ranges are assigned to which tones.
 */

import { useState, useMemo, useCallback } from 'react';
import type { SamplerKeyMode, SamplerTone } from '@/core/midi/SamplerClient';
import {
  TONE_LAYER_MIN_MIDI_NOTE,
  TONE_LAYER_MAX_MIDI_NOTE,
  TONE_LAYER_SIZE,
  TONE_LAYER_OFF,
} from '@audiocontrol/sampler-devices/s330';
import { cn, midiNoteToName } from '@/lib/utils';
import { useMidiLearn } from '@/hooks/useMidiLearn';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_MAPPING_TOOLTIPS } from '@/constants/tone-mapping-tooltips';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a contiguous zone of keys mapped to a single tone.
 * Uses UI-friendly property names (startKey/endKey) that map to
 * the shared startMidiNote/endMidiNote from sampler-devices.
 */
export interface ToneZone {
  /** Starting MIDI note (12-120) */
  startKey: number;
  /** Ending MIDI note (12-120) */
  endKey: number;
  /** Tone number (-1 to 31 for Layer 1, 0 to 31 for Layer 2) */
  tone: number;
}

interface ToneZoneEditorProps {
  /** Which layer (1 or 2) */
  layer: 1 | 2;
  /** The 109-entry tone data array */
  toneData: number[];
  /** Current key mode (determines if Layer 2 should be shown) */
  keyMode: SamplerKeyMode;
  /** Loaded tones from the device (sparse array - undefined = not loaded) */
  tones?: (SamplerTone | undefined)[];
  /** Callback when tone data is updated */
  onUpdate: (data: number[]) => void;
}

// =============================================================================
// Constants
// =============================================================================

// Use shared constants from sampler-devices for the authoritative tone layer spec.
// Alias to shorter names for readability in this UI component.
const MIN_KEY = TONE_LAYER_MIN_MIDI_NOTE;
const MAX_KEY = TONE_LAYER_MAX_MIDI_NOTE;
const TOTAL_KEYS = TONE_LAYER_SIZE;

/** Zone colors by tone number (cycling through a palette) */
const ZONE_COLORS = [
  'bg-blue-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-cyan-600',
  'bg-pink-600',
  'bg-yellow-600',
  'bg-red-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-lime-600',
  'bg-amber-600',
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert a 109-entry tone array to a list of zones
 */
export function arrayToZones(data: number[], layer: 1 | 2): ToneZone[] {
  const zones: ToneZone[] = [];
  const offValue = layer === 1 ? TONE_LAYER_OFF : 0;
  let i = 0;

  while (i < TOTAL_KEYS) {
    const currentTone = data[i];

    // Skip OFF entries
    if (currentTone === offValue) {
      i++;
      continue;
    }

    const startKey = MIN_KEY + i;

    // Find the end of this zone (contiguous same-tone entries)
    while (i < TOTAL_KEYS && data[i] === currentTone) {
      i++;
    }

    const endKey = MIN_KEY + i - 1;
    zones.push({ startKey, endKey, tone: currentTone });
  }

  return zones;
}

/**
 * Convert a list of zones back to a 109-entry array
 */
export function zonesToArray(zones: ToneZone[], layer: 1 | 2): number[] {
  const offValue = layer === 1 ? TONE_LAYER_OFF : 0;
  const result = new Array(TOTAL_KEYS).fill(offValue);

  for (const zone of zones) {
    for (let key = zone.startKey; key <= zone.endKey; key++) {
      const index = key - MIN_KEY;
      if (index >= 0 && index < TOTAL_KEYS) {
        result[index] = zone.tone;
      }
    }
  }

  return result;
}

/**
 * Get the color class for a tone number
 */
function getToneColor(tone: number): string {
  if (tone < 0) return 'bg-gray-600';
  return ZONE_COLORS[tone % ZONE_COLORS.length];
}

/**
 * Check if a key mode uses dual layers
 */
function usesDualLayers(keyMode: SamplerKeyMode): boolean {
  return keyMode !== 'normal';
}

// =============================================================================
// Component
// =============================================================================

export function ToneZoneEditor({ layer, toneData, keyMode, tones, onUpdate }: ToneZoneEditorProps) {
  const { memoryLayout } = useDeviceConfig();
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<ToneZone | null>(null);

  // MIDI learn for key assignment
  const handleMidiLearn = useCallback((target: 'startKey' | 'endKey', noteNumber: number) => {
    if (!editingZone) return;

    if (target === 'startKey') {
      // Clamp to valid range and ensure start <= end
      const clampedStart = Math.max(MIN_KEY, Math.min(noteNumber, editingZone.endKey));
      setEditingZone({ ...editingZone, startKey: clampedStart });
    } else {
      // Clamp to valid range and ensure end >= start
      const clampedEnd = Math.min(MAX_KEY, Math.max(noteNumber, editingZone.startKey));
      setEditingZone({ ...editingZone, endKey: clampedEnd });
    }
  }, [editingZone]);

  const { learningTarget, startLearning, cancelLearning } = useMidiLearn(
    handleMidiLearn,
    MIN_KEY,
    MAX_KEY
  );

  // Convert array to zones for display
  const zones = useMemo(() => arrayToZones(toneData, layer), [toneData, layer]);

  // Create a map of tone index to name for quick lookup
  const toneNameMap = useMemo(() => {
    const map = new Map<number, string>();
    if (tones) {
      for (let i = 0; i < tones.length; i++) {
        const tone = tones[i];
        if (tone && tone.name.trim()) {
          map.set(i, tone.name.trim());
        }
      }
    }
    return map;
  }, [tones]);

  // Convert internal index to device-specific display label via the layout
  // formatter (e.g., S-330: T11-T48; S-550 block 2: T51-T88).
  const getDisplayNumber = useCallback(
    (toneIndex: number): string => memoryLayout.formatToneSlot(toneIndex),
    [memoryLayout]
  );

  // Get display name for a tone
  const getToneName = useCallback((toneIndex: number): string => {
    if (toneIndex < 0) return 'OFF';
    const name = toneNameMap.get(toneIndex);
    const displayNum = getDisplayNumber(toneIndex);
    return name ? `${displayNum}: ${name}` : displayNum;
  }, [toneNameMap, getDisplayNumber]);

  // Get short display name for zone bars
  const getShortToneName = useCallback((toneIndex: number): string => {
    if (toneIndex < 0) return 'OFF';
    const name = toneNameMap.get(toneIndex);
    // Truncate name to fit in zone bar
    if (name) {
      return name.length > 8 ? name.substring(0, 7) + '…' : name;
    }
    return getDisplayNumber(toneIndex);
  }, [toneNameMap, getDisplayNumber]);

  // Count active keys
  const activeKeyCount = useMemo(() => {
    const offValue = layer === 1 ? -1 : 0;
    return toneData.filter(t => t !== offValue).length;
  }, [toneData, layer]);

  // Handle zone selection
  const handleZoneClick = useCallback((index: number) => {
    if (selectedZoneIndex === index) {
      setSelectedZoneIndex(null);
      setEditingZone(null);
    } else {
      setSelectedZoneIndex(index);
      setEditingZone({ ...zones[index] });
    }
  }, [selectedZoneIndex, zones]);

  // Handle tone change for selected zone (staged, not applied immediately)
  const handleToneChange = useCallback((newTone: number) => {
    if (editingZone === null) return;
    setEditingZone({ ...editingZone, tone: newTone });
  }, [editingZone]);

  // Handle start key change (staged, not applied immediately)
  const handleStartKeyChange = useCallback((newStartKey: number) => {
    if (editingZone === null) return;
    // Clamp to valid range and ensure start <= end
    const clampedStart = Math.max(MIN_KEY, Math.min(newStartKey, editingZone.endKey));
    setEditingZone({ ...editingZone, startKey: clampedStart });
  }, [editingZone]);

  // Handle end key change (staged, not applied immediately)
  const handleEndKeyChange = useCallback((newEndKey: number) => {
    if (editingZone === null) return;
    // Clamp to valid range and ensure end >= start
    const clampedEnd = Math.min(MAX_KEY, Math.max(newEndKey, editingZone.startKey));
    setEditingZone({ ...editingZone, endKey: clampedEnd });
  }, [editingZone]);

  // Apply staged changes to the zone
  const handleApplyZone = useCallback(() => {
    if (editingZone === null || selectedZoneIndex === null) return;

    const updatedZones = [...zones];
    updatedZones[selectedZoneIndex] = editingZone;
    onUpdate(zonesToArray(updatedZones, layer));
    setSelectedZoneIndex(null);
    setEditingZone(null);
  }, [editingZone, selectedZoneIndex, zones, layer, onUpdate]);

  // Cancel editing and discard changes
  const handleCancelEdit = useCallback(() => {
    setSelectedZoneIndex(null);
    setEditingZone(null);
  }, []);

  // Handle zone deletion
  const handleDeleteZone = useCallback(() => {
    if (selectedZoneIndex === null) return;

    const updatedZones = zones.filter((_, i) => i !== selectedZoneIndex);
    setSelectedZoneIndex(null);
    setEditingZone(null);
    onUpdate(zonesToArray(updatedZones, layer));
  }, [selectedZoneIndex, zones, layer, onUpdate]);

  // Handle adding a new zone
  const handleAddZone = useCallback(() => {
    // Find a gap in the existing zones to place the new zone
    const offValue = layer === 1 ? -1 : 0;
    let newStart = MIN_KEY;
    let newEnd = MIN_KEY;

    // Find first available key
    for (let i = 0; i < TOTAL_KEYS; i++) {
      if (toneData[i] === offValue) {
        newStart = MIN_KEY + i;
        newEnd = newStart;
        // Extend to find contiguous free keys (up to 12 keys for an octave)
        while (i < TOTAL_KEYS - 1 && toneData[i + 1] === offValue && newEnd - newStart < 11) {
          i++;
          newEnd = MIN_KEY + i;
        }
        break;
      }
    }

    // If all keys are assigned, place at the end
    if (newStart === MIN_KEY && toneData[0] !== offValue) {
      newStart = MAX_KEY - 11;
      newEnd = MAX_KEY;
    }

    const newZone: ToneZone = {
      startKey: newStart,
      endKey: newEnd,
      tone: layer === 1 ? 0 : 0, // Default to tone 0
    };

    const updatedZones = [...zones, newZone];
    const newIndex = updatedZones.length - 1;
    setSelectedZoneIndex(newIndex);
    setEditingZone(newZone);
    onUpdate(zonesToArray(updatedZones, layer));
  }, [zones, toneData, layer, onUpdate]);

  // Don't render Layer 2 if key mode doesn't use dual layers
  if (layer === 2 && !usesDualLayers(keyMode)) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Tooltip content={layer === 1 ? TONE_MAPPING_TOOLTIPS.layer1 : TONE_MAPPING_TOOLTIPS.layer2}>
          <span className="text-sm text-s330-muted cursor-help">
            Layer {layer}: {activeKeyCount} / {TOTAL_KEYS} keys active
          </span>
        </Tooltip>
        <Tooltip content={TONE_MAPPING_TOOLTIPS.addZone}>
          <button
            onClick={handleAddZone}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded',
              'bg-s330-accent text-s330-text hover:bg-s330-highlight',
              'transition-colors'
            )}
          >
            + Add Zone
          </button>
        </Tooltip>
      </div>

      {/* Zone visualization */}
      <div className="relative h-12 bg-s330-panel rounded border border-s330-accent overflow-hidden">
        {zones.length === 0 && editingZone === null ? (
          <div className="absolute inset-0 flex items-center justify-center text-s330-muted text-sm">
            No zones defined - click &quot;Add Zone&quot; to create one
          </div>
        ) : (
          <>
            {/* Render committed zones (dim the selected one since we show draft instead) */}
            {zones.map((zone, index) => {
              const isSelected = selectedZoneIndex === index;
              // Skip rendering the original zone if we're editing it (show draft instead)
              if (isSelected && editingZone) return null;

              const startPercent = ((zone.startKey - MIN_KEY) / TOTAL_KEYS) * 100;
              const widthPercent = ((zone.endKey - zone.startKey + 1) / TOTAL_KEYS) * 100;

              return (
                <button
                  key={`${index}-${zone.startKey}-${zone.endKey}-${zone.tone}`}
                  onClick={() => handleZoneClick(index)}
                  className={cn(
                    'absolute top-1 bottom-1 rounded cursor-pointer transition-all',
                    getToneColor(zone.tone),
                    'hover:brightness-110'
                  )}
                  style={{
                    left: `${startPercent}%`,
                    width: `${Math.max(widthPercent, 1)}%`,
                  }}
                  title={`${getToneName(zone.tone)}: ${midiNoteToName(zone.startKey)} - ${midiNoteToName(zone.endKey)}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white truncate px-1">
                    {widthPercent > 8 ? getShortToneName(zone.tone) : ''}
                  </span>
                </button>
              );
            })}
            {/* Render draft zone preview when editing */}
            {editingZone && (
              <div
                className={cn(
                  'absolute top-1 bottom-1 rounded transition-all z-20',
                  getToneColor(editingZone.tone),
                  'ring-2 ring-yellow-400 ring-offset-1 ring-offset-s330-panel',
                  'opacity-80'
                )}
                style={{
                  left: `${((editingZone.startKey - MIN_KEY) / TOTAL_KEYS) * 100}%`,
                  width: `${Math.max(((editingZone.endKey - editingZone.startKey + 1) / TOTAL_KEYS) * 100, 1)}%`,
                }}
                title={`Draft: ${getToneName(editingZone.tone)}: ${midiNoteToName(editingZone.startKey)} - ${midiNoteToName(editingZone.endKey)}`}
              >
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white truncate px-1">
                  {((editingZone.endKey - editingZone.startKey + 1) / TOTAL_KEYS) * 100 > 8
                    ? getShortToneName(editingZone.tone)
                    : ''}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Key range labels */}
      <div className="flex justify-between text-xs text-s330-muted">
        <span>{midiNoteToName(MIN_KEY)}</span>
        <span>{midiNoteToName(Math.floor((MIN_KEY + MAX_KEY) / 2))}</span>
        <span>{midiNoteToName(MAX_KEY)}</span>
      </div>

      {/* Edit controls for selected zone */}
      {editingZone !== null && selectedZoneIndex !== null && (
        <div className="p-3 bg-s330-accent/20 rounded border border-s330-accent space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-s330-text">
              Editing Zone {selectedZoneIndex + 1}
            </span>
            <Tooltip content={TONE_MAPPING_TOOLTIPS.deleteZone}>
              <button
                onClick={handleDeleteZone}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded',
                  'bg-red-600 text-white hover:bg-red-700',
                  'transition-colors'
                )}
              >
                Delete
              </button>
            </Tooltip>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Tone selector */}
            <Tooltip content={TONE_MAPPING_TOOLTIPS.toneSelector}>
              <div>
                <label className="ac-field-label mb-1 block">Tone</label>
                <select
                  value={editingZone.tone}
                  onChange={(e) => handleToneChange(Number(e.target.value))}
                  className="ac-select"
                >
                  {layer === 1 && <option value={-1}>OFF</option>}
                  {Array.from({ length: 32 }, (_, i) => (
                    <option key={i} value={i}>
                      {getToneName(i)}
                    </option>
                  ))}
                </select>
              </div>
            </Tooltip>

            {/* Start key selector */}
            <Tooltip content={TONE_MAPPING_TOOLTIPS.startKey}>
              <div>
                <label className="ac-field-label mb-1 block">Start Key</label>
                <div className="flex gap-1">
                  <select
                    value={editingZone.startKey}
                    onChange={(e) => handleStartKeyChange(Number(e.target.value))}
                    className="ac-select flex-1 min-w-0"
                  >
                    {Array.from({ length: TOTAL_KEYS }, (_, i) => {
                      const key = MIN_KEY + i;
                      return (
                        <option key={key} value={key} disabled={key > editingZone.endKey}>
                          {midiNoteToName(key)} ({key})
                        </option>
                      );
                    })}
                  </select>
                  <Tooltip content={TONE_MAPPING_TOOLTIPS.learnButton}>
                    <button
                      onClick={() => learningTarget === 'startKey' ? cancelLearning() : startLearning('startKey')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded whitespace-nowrap',
                        'transition-colors',
                        learningTarget === 'startKey'
                          ? 'bg-yellow-500 text-black animate-pulse'
                          : 'bg-s330-accent text-s330-text hover:bg-s330-highlight'
                      )}
                    >
                      {learningTarget === 'startKey' ? '...' : 'Learn'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Tooltip>

            {/* End key selector */}
            <Tooltip content={TONE_MAPPING_TOOLTIPS.endKey}>
              <div>
                <label className="ac-field-label mb-1 block">End Key</label>
                <div className="flex gap-1">
                  <select
                    value={editingZone.endKey}
                    onChange={(e) => handleEndKeyChange(Number(e.target.value))}
                    className="ac-select flex-1 min-w-0"
                  >
                    {Array.from({ length: TOTAL_KEYS }, (_, i) => {
                      const key = MIN_KEY + i;
                      return (
                        <option key={key} value={key} disabled={key < editingZone.startKey}>
                          {midiNoteToName(key)} ({key})
                        </option>
                      );
                    })}
                  </select>
                  <Tooltip content={TONE_MAPPING_TOOLTIPS.learnButton}>
                    <button
                      onClick={() => learningTarget === 'endKey' ? cancelLearning() : startLearning('endKey')}
                      className={cn(
                        'px-2 py-1 text-xs font-medium rounded whitespace-nowrap',
                        'transition-colors',
                        learningTarget === 'endKey'
                          ? 'bg-yellow-500 text-black animate-pulse'
                          : 'bg-s330-accent text-s330-text hover:bg-s330-highlight'
                      )}
                    >
                      {learningTarget === 'endKey' ? '...' : 'Learn'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Tooltip>
          </div>

          {/* Zone info and action buttons */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-s330-muted">
              Range: {midiNoteToName(editingZone.startKey)} - {midiNoteToName(editingZone.endKey)}
              {' '}({editingZone.endKey - editingZone.startKey + 1} keys)
            </div>
            <div className="flex gap-2">
              <Tooltip content={TONE_MAPPING_TOOLTIPS.cancelChanges}>
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded',
                    'bg-s330-panel border border-s330-accent text-s330-text',
                    'hover:bg-s330-accent/30 transition-colors'
                  )}
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip content={TONE_MAPPING_TOOLTIPS.applyChanges}>
                <button
                  onClick={handleApplyZone}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded',
                    'bg-green-600 text-white hover:bg-green-700',
                    'transition-colors'
                  )}
                >
                  Apply
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
