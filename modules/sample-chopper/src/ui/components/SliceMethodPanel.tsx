/**
 * Slice Method Panel
 *
 * Tab-based interface for selecting and configuring slice detection methods.
 * The slice list is rendered separately by the dialog for all modes.
 */

import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/ui/utils.js';
import type { SliceMethodTab, SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';
import { TriggerMethodContent, type TriggerMethodContentProps } from '@/ui/components/TriggerMethodContent.js';

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
  // Needed for silence tab empty state
  manualSlices: SliceDefinitionOutput[];
  // Trigger tab props
  triggerProps?: TriggerMethodContentProps;
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
  manualSlices,
  triggerProps,
}: SliceMethodPanelProps): JSX.Element {
  return (
    <Tabs.Root
      value={selectedMethod}
      onValueChange={(v) => onMethodChange(v as SliceMethodTab)}
    >
      <Tabs.List className="flex border-b border-ac-accent/30 mb-4">
        {(['manual', 'transient', 'silence', 'fixed'] as const).map((method) => (
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
            {method === 'silence' ? 'Strip Silence' : method.charAt(0).toUpperCase() + method.slice(1)}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* Manual Mode Controls */}
      <Tabs.Content value="manual" className="space-y-3">
        <p className="text-xs text-ac-muted">
          Double-click on a slice to split it. Drag slice edges to adjust boundaries.
          Use +/- to zoom for fine adjustments.
        </p>
        {triggerProps && <TriggerMethodContent {...triggerProps} />}
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

      {/* Strip Silence Controls */}
      <Tabs.Content value="silence" className="space-y-3">
        {manualSlices.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-ac-muted mb-2">
              No slices to strip silence from.
            </p>
            <p className="text-xs text-ac-muted">
              Use Manual, Transient, or Fixed tabs to create slices first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
                onClick={onCancelStripSilence}
                className="flex-1 px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
              >
                Reset
              </button>
              <button
                onClick={onApplyStripSilence}
                className="flex-1 px-3 py-1.5 text-xs rounded bg-ac-highlight hover:bg-ac-highlight/80 text-white font-medium transition-colors"
              >
                Apply Strip
              </button>
            </div>
          </div>
        )}
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
