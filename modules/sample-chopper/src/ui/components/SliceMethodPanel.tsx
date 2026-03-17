/**
 * Slice Method Panel
 *
 * Tab-based interface for selecting and configuring slice detection methods.
 * The slice list is rendered separately by the dialog for all modes.
 */

import { useState, useCallback } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/ui/utils.js';
import type { SliceMethodTab, SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';
import { TriggerMethodContent, type TriggerMethodContentProps } from '@/ui/components/TriggerMethodContent.js';
import { midiNoteToName } from '@/ui/hooks/useMidiLearn.js';
import { midiTriggerId, type TriggerId } from '@/ui/hooks/useTriggerInput.js';

type ManualTool = 'record' | 'strip-silence' | 'auto-map' | null;

export type MappingPattern = 'chromatic' | 'white-keys' | 'black-keys';

const WHITE_KEY_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_KEY_OFFSETS = [1, 3, 6, 8, 10]; // C# D# F# G# A#

function generateMidiNotes(startNote: number, count: number, pattern: MappingPattern): number[] {
  const notes: number[] = [];
  if (pattern === 'chromatic') {
    for (let i = 0; i < count && startNote + i <= 127; i++) {
      notes.push(startNote + i);
    }
  } else {
    const offsets = pattern === 'white-keys' ? WHITE_KEY_OFFSETS : BLACK_KEY_OFFSETS;
    // Find the starting position within the pattern
    const startOctaveBase = Math.floor(startNote / 12) * 12;
    const startPc = startNote % 12;
    let offsetIdx = offsets.findIndex((o) => o >= startPc);
    if (offsetIdx === -1) { offsetIdx = 0; }
    let octaveBase = startOctaveBase;
    // If the first offset in this octave is before our start pitch class, adjust
    if (offsets[offsetIdx] < startPc) {
      octaveBase += 12;
      offsetIdx = 0;
    }
    while (notes.length < count) {
      const note = octaveBase + offsets[offsetIdx];
      if (note > 127) break;
      if (note >= startNote) notes.push(note);
      offsetIdx++;
      if (offsetIdx >= offsets.length) {
        offsetIdx = 0;
        octaveBase += 12;
      }
    }
  }
  return notes;
}

function AutoMapPanel({
  sliceCount,
  startNote,
  onStartNoteChange,
  pattern,
  onPatternChange,
  onApply,
  onCancel,
}: {
  sliceCount: number;
  startNote: number;
  onStartNoteChange: (note: number) => void;
  pattern: MappingPattern;
  onPatternChange: (pattern: MappingPattern) => void;
  onApply: (mappings: Array<{ sliceIndex: number; triggerId: TriggerId }>) => void;
  onCancel: () => void;
}): JSX.Element {
  const notes = generateMidiNotes(startNote, sliceCount, pattern);
  const allMapped = notes.length >= sliceCount;

  const handleApply = useCallback(() => {
    const mappings = notes.map((note, i) => ({
      sliceIndex: i,
      triggerId: midiTriggerId(note),
    }));
    onApply(mappings);
  }, [notes, onApply]);

  return (
    <div className="border border-ac-accent/30 rounded p-3 space-y-3">
      <p className="text-xs text-ac-muted">
        Assign MIDI notes to slices automatically.
      </p>

      <div className="flex gap-4">
        {/* Starting note */}
        <div className="space-y-1">
          <label className="block text-xs text-ac-muted">Start Note</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={127}
              value={startNote}
              onChange={(e) => onStartNoteChange(Math.max(0, Math.min(127, parseInt(e.target.value) || 0)))}
              className="w-16 bg-ac-bg border border-ac-accent/50 rounded px-2 py-1 text-sm text-ac-text"
            />
            <span className="text-xs text-ac-muted font-mono">{midiNoteToName(startNote)}</span>
          </div>
        </div>

        {/* Pattern */}
        <div className="space-y-1">
          <label className="block text-xs text-ac-muted">Pattern</label>
          <div className="flex rounded overflow-hidden border border-ac-accent/50">
            {([
              ['chromatic', 'Chromatic'],
              ['white-keys', 'White Keys'],
              ['black-keys', 'Black Keys'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => onPatternChange(value)}
                className={cn(
                  'px-2.5 py-1 text-xs transition-colors',
                  pattern === value
                    ? 'bg-ac-highlight text-white'
                    : 'bg-ac-bg text-ac-muted hover:text-ac-text'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="text-xs text-ac-muted bg-ac-bg rounded p-2">
        <div className="flex flex-wrap gap-1">
          {notes.map((note, i) => (
            <span key={i} className="font-mono text-[10px] bg-ac-accent/30 text-ac-text px-1.5 py-0.5 rounded">
              {midiNoteToName(note)}
            </span>
          ))}
        </div>
        {!allMapped && (
          <p className="mt-1 text-red-400">
            Not enough notes in range for {sliceCount} slices (only {notes.length} available)
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={notes.length === 0}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs rounded bg-ac-highlight hover:bg-ac-highlight/80 text-white font-medium transition-colors',
            notes.length === 0 && 'opacity-50 cursor-not-allowed'
          )}
        >
          Apply ({notes.length} mapping{notes.length !== 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

export interface SliceMethodPanelProps {
  selectedMethod: SliceMethodTab;
  onMethodChange: (method: SliceMethodTab) => void;
  // Transient params
  transientThreshold: number;
  onTransientThresholdChange: (value: number) => void;
  transientMinGap: number;
  onTransientMinGapChange: (value: number) => void;
  transientPrePad: number;
  onTransientPrePadChange: (value: number) => void;
  // Fixed params
  fixedCount: number;
  onFixedCountChange: (value: number) => void;
  // Silence/strip params
  stripSilenceThreshold: number;
  onStripSilenceThresholdChange: (value: number) => void;
  stripSilenceActive: boolean;
  strippedPreview: Array<{ startSample: number; endSample: number }> | null;
  originalSliceBoundaries: Array<{ startSample: number; endSample: number }>;
  onApplyStripSilence: () => void;
  onCancelStripSilence: () => void;
  onActivateStripSilence: () => void;
  // Needed for strip silence empty state
  manualSlices: SliceDefinitionOutput[];
  // Trigger tab props
  triggerProps?: TriggerMethodContentProps;
  // Auto-map callback: assigns triggers to slices
  onAutoMap?: (mappings: Array<{ sliceIndex: number; triggerId: TriggerId }>) => void;
}

export function SliceMethodPanel({
  selectedMethod,
  onMethodChange,
  transientThreshold,
  onTransientThresholdChange,
  transientMinGap,
  onTransientMinGapChange,
  transientPrePad,
  onTransientPrePadChange,
  fixedCount,
  onFixedCountChange,
  stripSilenceThreshold,
  onStripSilenceThresholdChange,
  stripSilenceActive,
  strippedPreview,
  originalSliceBoundaries,
  onApplyStripSilence,
  onCancelStripSilence,
  onActivateStripSilence,
  manualSlices,
  triggerProps,
  onAutoMap,
}: SliceMethodPanelProps): JSX.Element {
  const [activeTool, setActiveTool] = useState<ManualTool>(null);
  const [autoMapStartNote, setAutoMapStartNote] = useState(36); // C2
  const [autoMapPattern, setAutoMapPattern] = useState<MappingPattern>('chromatic');

  const toggleTool = useCallback((tool: ManualTool) => {
    const closing = activeTool === tool;
    // Cancel strip silence preview when closing it
    if (activeTool === 'strip-silence') {
      onCancelStripSilence();
    }
    if (closing) {
      setActiveTool(null);
    } else {
      setActiveTool(tool);
      if (tool === 'strip-silence') {
        onActivateStripSilence();
      }
    }
  }, [activeTool, onCancelStripSilence, onActivateStripSilence]);

  // Force-close strip silence when leaving manual mode
  const handleMethodChange = useCallback((method: SliceMethodTab) => {
    if (activeTool === 'strip-silence') {
      onCancelStripSilence();
    }
    setActiveTool(null);
    onMethodChange(method);
  }, [activeTool, onCancelStripSilence, onMethodChange]);

  return (
    <Tabs.Root
      value={selectedMethod}
      onValueChange={(v) => handleMethodChange(v as SliceMethodTab)}
    >
      <Tabs.List className="flex border-b border-ac-accent/30 mb-4">
        {(['manual', 'transient', 'fixed'] as const).map((method) => (
          <Tabs.Trigger
            key={method}
            value={method}
            className={cn(
              'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
              selectedMethod === method
                ? 'border-ac-highlight text-ac-text'
                : 'border-transparent text-ac-muted hover:text-ac-text'
            )}
          >
            {method.charAt(0).toUpperCase() + method.slice(1)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* Manual Mode Controls */}
      <Tabs.Content value="manual" className="space-y-3">
        <p className="text-xs text-ac-muted">
          Double-click on a slice to split it. Drag slice edges to adjust boundaries.
          Use +/- to zoom for fine adjustments.
        </p>

        {/* Tool buttons */}
        <div className="flex gap-2">
          {triggerProps && (
            <button
              onClick={() => toggleTool('record')}
              className={cn(
                'px-3 py-1.5 text-xs rounded font-medium transition-colors',
                activeTool === 'record'
                  ? 'bg-ac-highlight/20 text-ac-highlight border border-ac-highlight/30'
                  : 'bg-ac-bg text-ac-muted hover:text-ac-text border border-transparent'
              )}
            >
              Record Triggers
            </button>
          )}
          <button
            onClick={() => toggleTool('strip-silence')}
            disabled={manualSlices.length === 0}
            className={cn(
              'px-3 py-1.5 text-xs rounded font-medium transition-colors',
              activeTool === 'strip-silence'
                ? 'bg-ac-highlight/20 text-ac-highlight border border-ac-highlight/30'
                : 'bg-ac-bg text-ac-muted hover:text-ac-text border border-transparent',
              manualSlices.length === 0 && 'opacity-30 cursor-not-allowed'
            )}
          >
            Strip Silence
          </button>
          {onAutoMap && (
            <button
              onClick={() => toggleTool('auto-map')}
              disabled={manualSlices.length === 0}
              className={cn(
                'px-3 py-1.5 text-xs rounded font-medium transition-colors',
                activeTool === 'auto-map'
                  ? 'bg-ac-highlight/20 text-ac-highlight border border-ac-highlight/30'
                  : 'bg-ac-bg text-ac-muted hover:text-ac-text border border-transparent',
                manualSlices.length === 0 && 'opacity-30 cursor-not-allowed'
              )}
            >
              Auto-Map
            </button>
          )}
        </div>

        {/* Record Triggers tool */}
        {activeTool === 'record' && triggerProps && (
          <div className="border border-ac-accent/30 rounded p-3">
            <TriggerMethodContent {...triggerProps} />
          </div>
        )}

        {/* Strip Silence tool */}
        {activeTool === 'strip-silence' && manualSlices.length > 0 && (
          <div className="border border-ac-accent/30 rounded p-3 space-y-3">
            <p className="text-xs text-ac-muted">
              Remove silence from the beginning and end of each slice.
              Adjust threshold to preview changes live on the waveform.
            </p>

            <div>
              <label className="block text-xs text-ac-muted mb-1">
                Threshold: {stripSilenceThreshold} dB
              </label>
              <input
                type="range"
                min="-60"
                max="-10"
                step="1"
                value={stripSilenceThreshold}
                onChange={(e) => onStripSilenceThresholdChange(parseInt(e.target.value))}
                className="w-full accent-ac-highlight"
              />
              <div className="flex justify-between text-xs text-ac-muted mt-0.5">
                <span>-60 dB (quieter)</span>
                <span>-10 dB (louder)</span>
              </div>
            </div>

            {strippedPreview && (
              <div className="text-xs text-ac-muted bg-ac-bg rounded p-2">
                <span className="font-medium text-ac-text">
                  {strippedPreview.filter((p, i) =>
                    p.startSample !== originalSliceBoundaries[i]?.startSample ||
                    p.endSample !== originalSliceBoundaries[i]?.endSample
                  ).length}
                </span>
                {' '}of {manualSlices.length} slices will be trimmed
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onCancelStripSilence();
                  setActiveTool(null);
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onApplyStripSilence();
                  setActiveTool(null);
                }}
                className="flex-1 px-3 py-1.5 text-xs rounded bg-ac-highlight hover:bg-ac-highlight/80 text-white font-medium transition-colors"
              >
                Apply Strip
              </button>
            </div>
          </div>
        )}

        {/* Auto-Map tool */}
        {activeTool === 'auto-map' && onAutoMap && manualSlices.length > 0 && (
          <AutoMapPanel
            sliceCount={manualSlices.length}
            startNote={autoMapStartNote}
            onStartNoteChange={setAutoMapStartNote}
            pattern={autoMapPattern}
            onPatternChange={setAutoMapPattern}
            onApply={(mappings) => {
              onAutoMap(mappings);
              setActiveTool(null);
            }}
            onCancel={() => setActiveTool(null)}
          />
        )}
      </Tabs.Content>

      {/* Transient Detection Controls */}
      <Tabs.Content value="transient" className="space-y-3">
        <p className="text-xs text-ac-muted">
          Detect drum hits by amplitude spikes above a threshold.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-ac-muted mb-1">
              Threshold ({(transientThreshold * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.05"
              max="0.9"
              step="0.05"
              value={transientThreshold}
              onChange={(e) => onTransientThresholdChange(parseFloat(e.target.value))}
              className="w-full accent-ac-highlight"
            />
          </div>
          <div>
            <label className="block text-xs text-ac-muted mb-1">
              Min Gap (ms)
            </label>
            <input
              type="number"
              min="10"
              max="1000"
              step="10"
              value={transientMinGap}
              onChange={(e) => onTransientMinGapChange(parseInt(e.target.value) || 100)}
              className="w-full bg-ac-bg border border-ac-accent/50 rounded px-2 py-1 text-sm text-ac-text"
            />
          </div>
          <div>
            <label className="block text-xs text-ac-muted mb-1">
              Pre-pad (ms)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={transientPrePad}
              onChange={(e) => onTransientPrePadChange(parseInt(e.target.value) || 0)}
              className="w-full bg-ac-bg border border-ac-accent/50 rounded px-2 py-1 text-sm text-ac-text"
            />
          </div>
        </div>
      </Tabs.Content>

      {/* Fixed Count Controls */}
      <Tabs.Content value="fixed" className="space-y-3">
        <p className="text-xs text-ac-muted">
          Split into a fixed number of equal-length slices.
        </p>
        <div>
          <label className="block text-xs text-ac-muted mb-1">
            Number of slices
          </label>
          <input
            type="number"
            min="1"
            max="32"
            step="1"
            value={fixedCount}
            onChange={(e) => onFixedCountChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-ac-bg border border-ac-accent/50 rounded px-2 py-1 text-sm text-ac-text"
          />
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
