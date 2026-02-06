/**
 * Tone Zone Editor Component
 *
 * Provides a visual zone-based editor for editing S-330 patch tone-to-key mappings.
 * Displays key zones as horizontal bars, allowing users to visually define which
 * MIDI key ranges are assigned to which tones.
 */

import { useState, useMemo, useCallback } from 'react';
import type { S330KeyMode, S330Tone } from '@/core/midi/S330Client';
import { cn, midiNoteToName } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a contiguous zone of keys mapped to a single tone
 */
export interface ToneZone {
  /** Starting MIDI note (21-127) */
  startKey: number;
  /** Ending MIDI note (21-127) */
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
  keyMode: S330KeyMode;
  /** Loaded tones from the device (sparse array - undefined = not loaded) */
  tones?: (S330Tone | undefined)[];
  /** Callback when tone data is updated */
  onUpdate: (data: number[]) => void;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * First MIDI note in the S-330 tone mapping.
 * With 109 entries ending at MIDI 127, the first key is MIDI 19 (G0).
 */
const MIN_KEY = 19;
/** Last MIDI note in the S-330 tone mapping (G9) */
const MAX_KEY = 127;
/** Total number of keys in the mapping */
const TOTAL_KEYS = 109;

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
  const offValue = layer === 1 ? -1 : 0;
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
  const offValue = layer === 1 ? -1 : 0;
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
function usesDualLayers(keyMode: S330KeyMode): boolean {
  return keyMode !== 'normal';
}

// =============================================================================
// Component
// =============================================================================

export function ToneZoneEditor({ layer, toneData, keyMode, tones, onUpdate }: ToneZoneEditorProps) {
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [editingZone, setEditingZone] = useState<ToneZone | null>(null);

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

  // Convert internal index (0-31) to display number (T11-T42)
  const getDisplayNumber = (toneIndex: number): string => {
    return `T${toneIndex + 11}`;
  };

  // Get display name for a tone
  const getToneName = useCallback((toneIndex: number): string => {
    if (toneIndex < 0) return 'OFF';
    const name = toneNameMap.get(toneIndex);
    const displayNum = getDisplayNumber(toneIndex);
    return name ? `${displayNum}: ${name}` : displayNum;
  }, [toneNameMap]);

  // Get short display name for zone bars
  const getShortToneName = useCallback((toneIndex: number): string => {
    if (toneIndex < 0) return 'OFF';
    const name = toneNameMap.get(toneIndex);
    // Truncate name to fit in zone bar
    if (name) {
      return name.length > 8 ? name.substring(0, 7) + '…' : name;
    }
    return getDisplayNumber(toneIndex);
  }, [toneNameMap]);

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

  // Handle tone change for selected zone
  const handleToneChange = useCallback((newTone: number) => {
    if (editingZone === null || selectedZoneIndex === null) return;

    const updatedZone = { ...editingZone, tone: newTone };
    setEditingZone(updatedZone);

    // Update zones array and convert back to data
    const updatedZones = [...zones];
    updatedZones[selectedZoneIndex] = updatedZone;
    onUpdate(zonesToArray(updatedZones, layer));
  }, [editingZone, selectedZoneIndex, zones, layer, onUpdate]);

  // Handle start key change
  const handleStartKeyChange = useCallback((newStartKey: number) => {
    if (editingZone === null || selectedZoneIndex === null) return;

    // Clamp to valid range and ensure start <= end
    const clampedStart = Math.max(MIN_KEY, Math.min(newStartKey, editingZone.endKey));
    const updatedZone = { ...editingZone, startKey: clampedStart };
    setEditingZone(updatedZone);

    const updatedZones = [...zones];
    updatedZones[selectedZoneIndex] = updatedZone;
    onUpdate(zonesToArray(updatedZones, layer));
  }, [editingZone, selectedZoneIndex, zones, layer, onUpdate]);

  // Handle end key change
  const handleEndKeyChange = useCallback((newEndKey: number) => {
    if (editingZone === null || selectedZoneIndex === null) return;

    // Clamp to valid range and ensure end >= start
    const clampedEnd = Math.min(MAX_KEY, Math.max(newEndKey, editingZone.startKey));
    const updatedZone = { ...editingZone, endKey: clampedEnd };
    setEditingZone(updatedZone);

    const updatedZones = [...zones];
    updatedZones[selectedZoneIndex] = updatedZone;
    onUpdate(zonesToArray(updatedZones, layer));
  }, [editingZone, selectedZoneIndex, zones, layer, onUpdate]);

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
        <span className="text-sm text-s330-muted">
          Layer {layer}: {activeKeyCount} / {TOTAL_KEYS} keys active
        </span>
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
      </div>

      {/* Zone visualization */}
      <div className="relative h-12 bg-s330-panel rounded border border-s330-accent overflow-hidden">
        {zones.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-s330-muted text-sm">
            No zones defined - click &quot;Add Zone&quot; to create one
          </div>
        ) : (
          zones.map((zone, index) => {
            const startPercent = ((zone.startKey - MIN_KEY) / TOTAL_KEYS) * 100;
            const widthPercent = ((zone.endKey - zone.startKey + 1) / TOTAL_KEYS) * 100;
            const isSelected = selectedZoneIndex === index;

            return (
              <button
                key={`${zone.startKey}-${zone.endKey}-${zone.tone}`}
                onClick={() => handleZoneClick(index)}
                className={cn(
                  'absolute top-1 bottom-1 rounded cursor-pointer transition-all',
                  getToneColor(zone.tone),
                  isSelected
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-s330-panel z-10'
                    : 'hover:brightness-110'
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
          })
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Tone selector */}
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Tone</label>
              <select
                value={editingZone.tone}
                onChange={(e) => handleToneChange(Number(e.target.value))}
                className={cn(
                  'w-full px-2 py-1.5 text-sm font-mono',
                  'bg-s330-panel border border-s330-accent rounded',
                  'text-s330-text hover:bg-s330-accent/30',
                  'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                )}
              >
                {layer === 1 && <option value={-1}>OFF</option>}
                {Array.from({ length: 32 }, (_, i) => (
                  <option key={i} value={i}>
                    {getToneName(i)}
                  </option>
                ))}
              </select>
            </div>

            {/* Start key selector */}
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Start Key</label>
              <select
                value={editingZone.startKey}
                onChange={(e) => handleStartKeyChange(Number(e.target.value))}
                className={cn(
                  'w-full px-2 py-1.5 text-sm font-mono',
                  'bg-s330-panel border border-s330-accent rounded',
                  'text-s330-text hover:bg-s330-accent/30',
                  'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                )}
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
            </div>

            {/* End key selector */}
            <div>
              <label className="text-xs text-s330-muted mb-1 block">End Key</label>
              <select
                value={editingZone.endKey}
                onChange={(e) => handleEndKeyChange(Number(e.target.value))}
                className={cn(
                  'w-full px-2 py-1.5 text-sm font-mono',
                  'bg-s330-panel border border-s330-accent rounded',
                  'text-s330-text hover:bg-s330-accent/30',
                  'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                )}
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
            </div>
          </div>

          {/* Zone info */}
          <div className="text-xs text-s330-muted">
            Range: {midiNoteToName(editingZone.startKey)} - {midiNoteToName(editingZone.endKey)}
            {' '}({editingZone.endKey - editingZone.startKey + 1} keys)
          </div>
        </div>
      )}
    </div>
  );
}
