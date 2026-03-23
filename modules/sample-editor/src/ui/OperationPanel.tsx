/**
 * OperationPanel — tabbed interface for sample editing operations.
 *
 * Each tab provides controls for a single operation type. Tabs that support
 * preview (Normalize, Gain, Fade, Trim Silence) update the waveform preview
 * on parameter change; an "Apply" button commits the result. Tabs without
 * preview (Trim to Selection, Reverse) apply immediately.
 *
 * Follows the same Radix Tabs pattern as the chopper's SliceMethodPanel.
 */

import { useState, useCallback, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/ui/utils';
import { trimSamples, findTrimPoints } from '@/operations/trim';
import { normalize, applyGain } from '@/operations/normalize';
import { fadeIn, fadeOut } from '@/operations/fade';
import { reverseSamples } from '@/operations/reverse';
import type { FadeCurve } from '@/types';

type OperationTab = 'trim' | 'normalize' | 'gain' | 'fade' | 'reverse';

export interface OperationPanelProps {
  samples: Int16Array | null;
  sampleRate: number;
  selection: { start: number; end: number } | null;
  /** Trim region (what will be kept). Null when trim tab is not active. */
  trimRegion: { start: number; end: number } | null;
  onTrimRegionChange: (region: { start: number; end: number } | null) => void;
  /** Set a preview operation (called on parameter change). Null to clear. */
  onPreview: (operation: ((s: Int16Array, sr: number) => Int16Array) | null) => void;
  /** Commit the current preview to history. */
  onCommit: (label: string) => void;
  /** Immediate apply (for operations without preview, like trim-to-selection and reverse). */
  onApply: (label: string, op: (s: Int16Array, sr: number) => Int16Array) => void;
  /** Whether a preview is currently active. */
  hasPreview: boolean;
}

const TAB_LABELS: Record<OperationTab, string> = {
  trim: 'Trim',
  normalize: 'Normalize',
  gain: 'Gain',
  fade: 'Fade',
  reverse: 'Reverse',
};

const TABS: OperationTab[] = ['trim', 'normalize', 'gain', 'fade', 'reverse'];

const SLIDER_CLASS = 'w-full accent-ac-highlight';
const APPLY_BTN = 'ac-btn ac-btn-sm ac-btn-primary font-medium';
const APPLY_BTN_INACTIVE = 'ac-btn ac-btn-sm opacity-50 cursor-not-allowed';

export function OperationPanel({
  samples,
  sampleRate,
  selection,
  trimRegion,
  onTrimRegionChange,
  onPreview,
  onCommit,
  onApply,
  hasPreview,
}: OperationPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<OperationTab>('trim');
  const [silenceThresholdDb, setSilenceThresholdDb] = useState(-40);
  const [targetPeakDb, setTargetPeakDb] = useState(0);
  const [gainDb, setGainDb] = useState(0);
  const [fadeDurationMs, setFadeDurationMs] = useState(50);
  const [fadeCurve, setFadeCurve] = useState<FadeCurve>('linear');
  const [fadeDirection, setFadeDirection] = useState<'in' | 'out'>('in');

  const disabled = !samples || samples.length === 0;

  // Clear preview and trim region when switching tabs
  const handleTabChange = useCallback(
    (value: string) => {
      onPreview(null);
      onTrimRegionChange(null);
      const tab = value as OperationTab;
      setActiveTab(tab);
      // Initialize trim region when entering trim tab
      if (tab === 'trim' && samples && samples.length > 0) {
        onTrimRegionChange({ start: 0, end: samples.length });
      }
    },
    [onPreview, onTrimRegionChange, samples],
  );

  // Initialize trim region on mount if starting on trim tab
  useEffect(() => {
    if (activeTab === 'trim' && samples && samples.length > 0 && !trimRegion) {
      onTrimRegionChange({ start: 0, end: samples.length });
    }
  }, [activeTab, samples, trimRegion, onTrimRegionChange]);

  // --- Preview triggers: update preview when parameters change ---

  useEffect(() => {
    if (disabled || activeTab !== 'normalize') return;
    const peak = targetPeakDb;
    onPreview((s) => normalize(s, peak));
  }, [activeTab, targetPeakDb, disabled, onPreview]);

  useEffect(() => {
    if (disabled || activeTab !== 'gain') return;
    const g = gainDb;
    onPreview((s) => applyGain(s, g));
  }, [activeTab, gainDb, disabled, onPreview]);

  useEffect(() => {
    if (disabled || activeTab !== 'fade') return;
    const ms = fadeDurationMs;
    const curve = fadeCurve;
    const dir = fadeDirection;
    onPreview((s, sr) =>
      dir === 'in' ? fadeIn(s, sr, ms, curve) : fadeOut(s, sr, ms, curve),
    );
  }, [activeTab, fadeDurationMs, fadeCurve, fadeDirection, disabled, onPreview]);

  // When silence threshold changes, auto-detect trim points and update handles
  useEffect(() => {
    if (disabled || activeTab !== 'trim' || !samples) return;
    const points = findTrimPoints(samples, sampleRate, silenceThresholdDb);
    if (points.start >= points.end) {
      // Entire sample is below threshold — keep everything
      onTrimRegionChange({ start: 0, end: samples.length });
    } else {
      onTrimRegionChange(points);
    }
  }, [activeTab, silenceThresholdDb, disabled, samples, sampleRate, onTrimRegionChange]);

  // Update preview when trim region changes
  useEffect(() => {
    if (disabled || activeTab !== 'trim' || !trimRegion || !samples) return;
    const { start, end } = trimRegion;
    // Only show preview if region differs from full sample
    if (start === 0 && end === samples.length) {
      onPreview(null);
    } else {
      onPreview((s) => trimSamples(s, start, end));
    }
  }, [activeTab, trimRegion, disabled, samples, onPreview]);

  return (
    <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
      <Tabs.List className="flex border-b border-ac-accent/30 mb-4">
        {TABS.map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className={cn(
              'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-ac-highlight text-ac-text'
                : 'border-transparent text-ac-muted hover:text-ac-text',
            )}
          >
            {TAB_LABELS[tab]}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <TrimTab
        disabled={disabled}
        samples={samples}
        sampleRate={sampleRate}
        trimRegion={trimRegion}
        hasPreview={hasPreview}
        silenceThresholdDb={silenceThresholdDb}
        onSilenceThresholdChange={setSilenceThresholdDb}
        onApplyTrim={() => {
          if (!trimRegion) return;
          const { start, end } = trimRegion;
          onApply('Trim', (s) => trimSamples(s, start, end));
          // Reset trim region after apply (new sample will be full)
          onTrimRegionChange(null);
        }}
        onResetTrim={() => {
          if (samples) {
            onTrimRegionChange({ start: 0, end: samples.length });
          }
        }}
      />

      <NormalizeTab
        disabled={disabled}
        hasPreview={hasPreview}
        targetPeakDb={targetPeakDb}
        onTargetPeakChange={setTargetPeakDb}
        onCommit={() => onCommit(`Normalize (${targetPeakDb} dB)`)}
      />

      <GainTab
        disabled={disabled}
        hasPreview={hasPreview}
        gainDb={gainDb}
        onGainChange={setGainDb}
        onCommit={() =>
          onCommit(`Gain ${gainDb >= 0 ? '+' : ''}${gainDb} dB`)
        }
      />

      <FadeTab
        disabled={disabled}
        hasPreview={hasPreview}
        fadeDurationMs={fadeDurationMs}
        onFadeDurationChange={setFadeDurationMs}
        fadeCurve={fadeCurve}
        onFadeCurveChange={setFadeCurve}
        fadeDirection={fadeDirection}
        onFadeDirectionChange={setFadeDirection}
        onCommit={() => {
          const dir = fadeDirection === 'in' ? 'In' : 'Out';
          onCommit(`Fade ${dir} (${fadeDurationMs}ms, ${fadeCurve})`);
        }}
      />

      <Tabs.Content value="reverse" className="space-y-3">
        <p className="text-xs text-ac-muted">
          Reverse the entire sample.
        </p>
        <button
          className="ac-btn ac-btn-sm"
          disabled={disabled}
          onClick={() => onApply('Reverse', (s) => reverseSamples(s))}
        >
          Reverse
        </button>
      </Tabs.Content>
    </Tabs.Root>
  );
}

// --- Tab content components ---

function TrimTab({
  disabled,
  samples,
  sampleRate,
  trimRegion,
  hasPreview,
  silenceThresholdDb,
  onSilenceThresholdChange,
  onApplyTrim,
  onResetTrim,
}: {
  disabled: boolean;
  samples: Int16Array | null;
  sampleRate: number;
  trimRegion: { start: number; end: number } | null;
  hasPreview: boolean;
  silenceThresholdDb: number;
  onSilenceThresholdChange: (v: number) => void;
  onApplyTrim: () => void;
  onResetTrim: () => void;
}): JSX.Element {
  const totalSamples = samples?.length ?? 0;
  const keepStart = trimRegion?.start ?? 0;
  const keepEnd = trimRegion?.end ?? totalSamples;
  const keepCount = keepEnd - keepStart;
  const removedCount = totalSamples - keepCount;
  const keepMs = sampleRate > 0 ? ((keepCount / sampleRate) * 1000).toFixed(1) : '0.0';
  const removedMs = sampleRate > 0 ? ((removedCount / sampleRate) * 1000).toFixed(1) : '0.0';

  return (
    <Tabs.Content value="trim" className="space-y-3">
      <p className="text-xs text-ac-muted">
        Drag the handles on the waveform to adjust the trim region, or use the
        silence threshold to auto-detect.
      </p>
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-ac-muted">
          <span>Silence Threshold</span>
          <span className="font-mono">{silenceThresholdDb} dB</span>
        </label>
        <input
          type="range"
          className={SLIDER_CLASS}
          min={-60}
          max={-10}
          step={1}
          value={silenceThresholdDb}
          onChange={(e) => onSilenceThresholdChange(Number(e.target.value))}
        />
      </div>
      {trimRegion && totalSamples > 0 && (
        <div className="text-xs text-ac-muted font-mono">
          Keep {keepStart} &rarr; {keepEnd} ({keepMs}ms, removing {removedMs}ms)
        </div>
      )}
      <div className="flex gap-2">
        <button
          className={hasPreview ? APPLY_BTN : APPLY_BTN_INACTIVE}
          disabled={disabled || !hasPreview}
          onClick={onApplyTrim}
        >
          Apply Trim
        </button>
        <button
          className="ac-btn ac-btn-sm"
          disabled={disabled}
          onClick={onResetTrim}
        >
          Reset
        </button>
      </div>
    </Tabs.Content>
  );
}

function NormalizeTab({
  disabled,
  hasPreview,
  targetPeakDb,
  onTargetPeakChange,
  onCommit,
}: {
  disabled: boolean;
  hasPreview: boolean;
  targetPeakDb: number;
  onTargetPeakChange: (v: number) => void;
  onCommit: () => void;
}): JSX.Element {
  return (
    <Tabs.Content value="normalize" className="space-y-3">
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-ac-muted">
          <span>Target Peak</span>
          <span className="font-mono">{targetPeakDb} dB</span>
        </label>
        <input
          type="range"
          className={SLIDER_CLASS}
          min={-12}
          max={0}
          step={0.5}
          value={targetPeakDb}
          onChange={(e) => onTargetPeakChange(Number(e.target.value))}
        />
      </div>
      <button
        className={hasPreview ? APPLY_BTN : APPLY_BTN_INACTIVE}
        disabled={disabled || !hasPreview}
        onClick={onCommit}
      >
        Apply
      </button>
    </Tabs.Content>
  );
}

function GainTab({
  disabled,
  hasPreview,
  gainDb,
  onGainChange,
  onCommit,
}: {
  disabled: boolean;
  hasPreview: boolean;
  gainDb: number;
  onGainChange: (v: number) => void;
  onCommit: () => void;
}): JSX.Element {
  return (
    <Tabs.Content value="gain" className="space-y-3">
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-ac-muted">
          <span>Gain</span>
          <span className="font-mono">
            {gainDb >= 0 ? '+' : ''}{gainDb} dB
          </span>
        </label>
        <input
          type="range"
          className={SLIDER_CLASS}
          min={-20}
          max={20}
          step={0.5}
          value={gainDb}
          onChange={(e) => onGainChange(Number(e.target.value))}
        />
      </div>
      <button
        className={hasPreview ? APPLY_BTN : APPLY_BTN_INACTIVE}
        disabled={disabled || !hasPreview}
        onClick={onCommit}
      >
        Apply
      </button>
    </Tabs.Content>
  );
}

function FadeTab({
  disabled,
  hasPreview,
  fadeDurationMs,
  onFadeDurationChange,
  fadeCurve,
  onFadeCurveChange,
  fadeDirection,
  onFadeDirectionChange,
  onCommit,
}: {
  disabled: boolean;
  hasPreview: boolean;
  fadeDurationMs: number;
  onFadeDurationChange: (v: number) => void;
  fadeCurve: FadeCurve;
  onFadeCurveChange: (v: FadeCurve) => void;
  fadeDirection: 'in' | 'out';
  onFadeDirectionChange: (v: 'in' | 'out') => void;
  onCommit: () => void;
}): JSX.Element {
  return (
    <Tabs.Content value="fade" className="space-y-3">
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-ac-muted">
          <span>Duration</span>
          <span className="font-mono">{fadeDurationMs} ms</span>
        </label>
        <input
          type="range"
          className={SLIDER_CLASS}
          min={5}
          max={2000}
          step={5}
          value={fadeDurationMs}
          onChange={(e) => onFadeDurationChange(Number(e.target.value))}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-ac-muted">Curve</label>
        <select
          className="w-full bg-ac-panel text-ac-text text-xs rounded px-2 py-1 border border-ac-accent"
          value={fadeCurve}
          onChange={(e) => onFadeCurveChange(e.target.value as FadeCurve)}
        >
          <option value="linear">Linear</option>
          <option value="equal-power">Equal Power</option>
          <option value="logarithmic">Logarithmic</option>
        </select>
      </div>
      <div className="flex rounded overflow-hidden border border-ac-accent/50">
        {(['in', 'out'] as const).map((dir) => (
          <button
            key={dir}
            onClick={() => onFadeDirectionChange(dir)}
            className={cn(
              'flex-1 px-3 py-1.5 text-xs transition-colors',
              fadeDirection === dir
                ? 'bg-ac-highlight text-white'
                : 'bg-ac-bg text-ac-muted hover:text-ac-text',
            )}
          >
            Fade {dir === 'in' ? 'In' : 'Out'}
          </button>
        ))}
      </div>
      <button
        className={hasPreview ? APPLY_BTN : APPLY_BTN_INACTIVE}
        disabled={disabled || !hasPreview}
        onClick={onCommit}
      >
        Apply
      </button>
    </Tabs.Content>
  );
}
