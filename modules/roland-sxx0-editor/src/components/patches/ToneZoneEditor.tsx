/**
 * Tone Zone Editor — per-layer key→tone mapping.
 *
 * Renders a horizontal zone strip for one layer (1 or 2) plus an
 * inline editing form when a zone is selected. Follows the project's
 * live-edit pattern (`feedback_live_editing_no_save`): every change
 * to a zone's tone / startKey / endKey streams to the device
 * immediately via `onUpdate`. There is no Apply / Cancel / draft
 * state; the only explicit action is Delete (destructive).
 *
 * Chrome: composed from `.ac-zone-*` primitives defined in
 * `patches.css`. Each zone segment carries an inline
 * `--ac-zone-hue: N` custom property so its color derives from its
 * tone-index without a hard-coded class palette.
 */

import { type CSSProperties, useCallback, useMemo, useState } from 'react';
import type { SamplerKeyMode, SamplerTone } from '@/core/midi/SamplerClient';
import { cn, midiNoteToName } from '@/lib/utils';
import { useMidiLearn } from '@/hooks/useMidiLearn';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_MAPPING_TOOLTIPS } from '@/constants/tone-mapping-tooltips';
import {
  MIN_KEY,
  MAX_KEY,
  TOTAL_KEYS,
  type ToneZone,
  arrayToZones,
  findInsertionRange,
  offValueForLayer,
  usesDualLayers,
  zoneHueOffset,
  zonesToArray,
} from './tone-zone-utils';

// Re-export for legacy consumers (specs import `ToneZone` /
// `arrayToZones` / `zonesToArray` from this module).
export type { ToneZone } from './tone-zone-utils';
export { arrayToZones, zonesToArray } from './tone-zone-utils';

interface ToneZoneEditorProps {
  layer: 1 | 2;
  toneData: number[];
  keyMode: SamplerKeyMode;
  tones?: (SamplerTone | undefined)[];
  onUpdate: (data: number[]) => void;
}

export function ToneZoneEditor({
  layer,
  toneData,
  keyMode,
  tones,
  onUpdate,
}: ToneZoneEditorProps) {
  const { memoryLayout } = useDeviceConfig();
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);

  const zones = useMemo(() => arrayToZones(toneData, layer), [toneData, layer]);
  const selectedZone =
    selectedZoneIndex !== null ? zones[selectedZoneIndex] ?? null : null;

  // Push a single zone-list mutation through to the device. All field
  // edits go through this helper so the live-edit invariant is
  // structural — there's no path that writes a partial change.
  const commitZones = useCallback(
    (next: ToneZone[]) => onUpdate(zonesToArray(next, layer)),
    [onUpdate, layer],
  );

  const updateSelected = useCallback(
    (mutator: (z: ToneZone) => ToneZone) => {
      if (selectedZoneIndex === null || !selectedZone) return;
      const next = [...zones];
      next[selectedZoneIndex] = mutator(selectedZone);
      commitZones(next);
    },
    [selectedZoneIndex, selectedZone, zones, commitZones],
  );

  const handleMidiLearn = useCallback(
    (target: 'startKey' | 'endKey', noteNumber: number) => {
      if (!selectedZone) return;
      if (target === 'startKey') {
        const clamped = Math.max(MIN_KEY, Math.min(noteNumber, selectedZone.endKey));
        updateSelected((z) => ({ ...z, startKey: clamped }));
      } else {
        const clamped = Math.min(MAX_KEY, Math.max(noteNumber, selectedZone.startKey));
        updateSelected((z) => ({ ...z, endKey: clamped }));
      }
    },
    [selectedZone, updateSelected],
  );

  const { learningTarget, startLearning, cancelLearning } = useMidiLearn(
    handleMidiLearn, MIN_KEY, MAX_KEY,
  );

  const toneNameMap = useMemo(() => {
    const map = new Map<number, string>();
    if (tones) {
      for (let i = 0; i < tones.length; i++) {
        const t = tones[i];
        if (t && t.name.trim()) map.set(i, t.name.trim());
      }
    }
    return map;
  }, [tones]);

  const getDisplayNumber = useCallback(
    (toneIndex: number): string => memoryLayout.formatToneSlot(toneIndex),
    [memoryLayout],
  );

  const getToneName = useCallback(
    (toneIndex: number): string => {
      if (toneIndex < 0) return 'OFF';
      const name = toneNameMap.get(toneIndex);
      const num = getDisplayNumber(toneIndex);
      return name ? `${num}: ${name}` : num;
    },
    [toneNameMap, getDisplayNumber],
  );

  const getShortToneName = useCallback(
    (toneIndex: number): string => {
      if (toneIndex < 0) return 'OFF';
      const name = toneNameMap.get(toneIndex);
      if (name) return name.length > 8 ? name.slice(0, 7) + '…' : name;
      return getDisplayNumber(toneIndex);
    },
    [toneNameMap, getDisplayNumber],
  );

  const activeKeyCount = useMemo(() => {
    const off = offValueForLayer(layer);
    return toneData.filter((t) => t !== off).length;
  }, [toneData, layer]);

  const handleZoneClick = useCallback((index: number) => {
    setSelectedZoneIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleToneChange = useCallback(
    (newTone: number) => updateSelected((z) => ({ ...z, tone: newTone })),
    [updateSelected],
  );

  const handleStartKeyChange = useCallback(
    (newStartKey: number) =>
      updateSelected((z) => ({
        ...z,
        startKey: Math.max(MIN_KEY, Math.min(newStartKey, z.endKey)),
      })),
    [updateSelected],
  );

  const handleEndKeyChange = useCallback(
    (newEndKey: number) =>
      updateSelected((z) => ({
        ...z,
        endKey: Math.min(MAX_KEY, Math.max(newEndKey, z.startKey)),
      })),
    [updateSelected],
  );

  const handleDeleteZone = useCallback(() => {
    if (selectedZoneIndex === null) return;
    commitZones(zones.filter((_, i) => i !== selectedZoneIndex));
    setSelectedZoneIndex(null);
  }, [selectedZoneIndex, zones, commitZones]);

  const handleAddZone = useCallback(() => {
    const { startKey, endKey } = findInsertionRange(toneData, layer);
    const newZone: ToneZone = { startKey, endKey, tone: 0 };
    const next = [...zones, newZone];
    commitZones(next);
    setSelectedZoneIndex(next.length - 1);
  }, [zones, toneData, layer, commitZones]);

  if (layer === 2 && !usesDualLayers(keyMode)) return null;

  return (
    <section className="ac-zone-section">
      <header className="ac-zone-section-head">
        <Tooltip content={layer === 1 ? TONE_MAPPING_TOOLTIPS.layer1 : TONE_MAPPING_TOOLTIPS.layer2}>
          <span>
            Layer {layer} · <strong>{activeKeyCount}</strong> of <strong>{TOTAL_KEYS}</strong> keys active
          </span>
        </Tooltip>
        <Tooltip content={TONE_MAPPING_TOOLTIPS.addZone}>
          <button type="button" className="ac-tonal-btn" onClick={handleAddZone}>
            + Add Zone
          </button>
        </Tooltip>
      </header>

      <div className="ac-zone-bar">
        {zones.length === 0 ? (
          <div className="ac-zone-bar-empty">
            No zones · click + Add Zone to create one
          </div>
        ) : (
          zones.map((zone, index) => {
            const startPercent = ((zone.startKey - MIN_KEY) / TOTAL_KEYS) * 100;
            const widthPercent = Math.max(
              ((zone.endKey - zone.startKey + 1) / TOTAL_KEYS) * 100,
              1,
            );
            const isSelected = selectedZoneIndex === index;
            const isOff = zone.tone < 0;
            const style: CSSProperties = {
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
              ['--ac-zone-hue' as string]: zoneHueOffset(zone.tone),
            };
            return (
              <Tooltip key={`${index}-${zone.startKey}-${zone.endKey}-${zone.tone}`} content={TONE_MAPPING_TOOLTIPS.zone}>
                <button
                  type="button"
                  onClick={() => handleZoneClick(index)}
                  aria-pressed={isSelected}
                  className={cn(
                    'ac-zone-segment',
                    isOff && 'ac-zone-segment--off',
                    isSelected && 'ac-zone-segment--editing',
                  )}
                  style={style}
                  title={`${getToneName(zone.tone)}: ${midiNoteToName(zone.startKey)} – ${midiNoteToName(zone.endKey)}`}
                >
                  {widthPercent > 8 ? getShortToneName(zone.tone) : ''}
                </button>
              </Tooltip>
            );
          })
        )}
      </div>

      <div className="ac-zone-axis" aria-hidden="true">
        <span>{midiNoteToName(MIN_KEY)}</span>
        <span>{midiNoteToName(Math.floor((MIN_KEY + MAX_KEY) / 2))}</span>
        <span>{midiNoteToName(MAX_KEY)}</span>
      </div>

      {selectedZone !== null && selectedZoneIndex !== null && (
        <div className="ac-zone-form">
          <header className="ac-zone-form-head">
            <span>Editing Zone <strong>{selectedZoneIndex + 1}</strong></span>
            <Tooltip content={TONE_MAPPING_TOOLTIPS.deleteZone}>
              <button
                type="button"
                onClick={handleDeleteZone}
                className="ac-tonal-btn ac-tonal-btn--danger"
              >
                Delete
              </button>
            </Tooltip>
          </header>

          <div className="ac-zone-form-grid">
            <Tooltip content={TONE_MAPPING_TOOLTIPS.toneSelector}>
              <div className="ac-zone-form-field">
                <label className="ac-zone-form-field-label">Tone</label>
                <select
                  value={selectedZone.tone}
                  onChange={(e) => handleToneChange(Number(e.target.value))}
                  className="ac-select"
                >
                  {layer === 1 && <option value={-1}>OFF</option>}
                  {Array.from({ length: 32 }, (_, i) => (
                    <option key={i} value={i}>{getToneName(i)}</option>
                  ))}
                </select>
              </div>
            </Tooltip>

            <Tooltip content={TONE_MAPPING_TOOLTIPS.startKey}>
              <div className="ac-zone-form-field">
                <label className="ac-zone-form-field-label">Start Key</label>
                <div className="ac-zone-form-field-row">
                  <select
                    value={selectedZone.startKey}
                    onChange={(e) => handleStartKeyChange(Number(e.target.value))}
                    className="ac-select"
                  >
                    {Array.from({ length: TOTAL_KEYS }, (_, i) => {
                      const key = MIN_KEY + i;
                      return (
                        <option key={key} value={key} disabled={key > selectedZone.endKey}>
                          {midiNoteToName(key)} ({key})
                        </option>
                      );
                    })}
                  </select>
                  <Tooltip content={TONE_MAPPING_TOOLTIPS.learnButton}>
                    <button
                      type="button"
                      onClick={() => (learningTarget === 'startKey' ? cancelLearning() : startLearning('startKey'))}
                      className={cn(
                        'ac-tonal-btn',
                        learningTarget === 'startKey' && 'ac-tonal-btn--listening',
                      )}
                    >
                      {learningTarget === 'startKey' ? '...' : 'Learn'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Tooltip>

            <Tooltip content={TONE_MAPPING_TOOLTIPS.endKey}>
              <div className="ac-zone-form-field">
                <label className="ac-zone-form-field-label">End Key</label>
                <div className="ac-zone-form-field-row">
                  <select
                    value={selectedZone.endKey}
                    onChange={(e) => handleEndKeyChange(Number(e.target.value))}
                    className="ac-select"
                  >
                    {Array.from({ length: TOTAL_KEYS }, (_, i) => {
                      const key = MIN_KEY + i;
                      return (
                        <option key={key} value={key} disabled={key < selectedZone.startKey}>
                          {midiNoteToName(key)} ({key})
                        </option>
                      );
                    })}
                  </select>
                  <Tooltip content={TONE_MAPPING_TOOLTIPS.learnButton}>
                    <button
                      type="button"
                      onClick={() => (learningTarget === 'endKey' ? cancelLearning() : startLearning('endKey'))}
                      className={cn(
                        'ac-tonal-btn',
                        learningTarget === 'endKey' && 'ac-tonal-btn--listening',
                      )}
                    >
                      {learningTarget === 'endKey' ? '...' : 'Learn'}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Tooltip>
          </div>

          <footer className="ac-zone-form-foot">
            <span>
              Range: {midiNoteToName(selectedZone.startKey)} – {midiNoteToName(selectedZone.endKey)}
              {' '}({selectedZone.endKey - selectedZone.startKey + 1} keys)
            </span>
            <span>Live · changes sent to device on edit</span>
          </footer>
        </div>
      )}
    </section>
  );
}
