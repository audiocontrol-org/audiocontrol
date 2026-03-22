/**
 * OperationPanel — controls for each sample editing operation.
 *
 * Renders sections for Trim, Normalize, Gain, Fade, and Reverse.
 * Each button invokes onApply with a label and an operation function
 * from the @/operations modules.
 */

import { useState, useCallback } from 'react';
import { cn } from '@/ui/utils';
import { trimSamples, trimSilence } from '@/operations/trim';
import { normalize, applyGain } from '@/operations/normalize';
import { fadeIn, fadeOut } from '@/operations/fade';
import { reverseSamples } from '@/operations/reverse';
import type { FadeCurve } from '@/types';

export interface OperationPanelProps {
  samples: Int16Array | null;
  sampleRate: number;
  selection: { start: number; end: number } | null;
  onApply: (label: string, op: (s: Int16Array, sr: number) => Int16Array) => void;
}

const SECTION_CLASS = 'space-y-2 p-3 bg-ac-bg rounded';
const LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-ac-muted';
const BTN_CLASS = 'ac-btn ac-btn-sm';
const SLIDER_CLASS = 'w-full accent-ac-highlight';

export function OperationPanel({
  samples,
  sampleRate,
  selection,
  onApply,
}: OperationPanelProps): JSX.Element {
  const [silenceThresholdDb, setSilenceThresholdDb] = useState(-40);
  const [targetPeakDb, setTargetPeakDb] = useState(0);
  const [gainDb, setGainDb] = useState(0);
  const [fadeDurationMs, setFadeDurationMs] = useState(50);
  const [fadeCurve, setFadeCurve] = useState<FadeCurve>('linear');

  const disabled = !samples || samples.length === 0;

  const handleTrimToSelection = useCallback(() => {
    if (!selection) return;
    const { start, end } = selection;
    onApply('Trim to Selection', (s) => trimSamples(s, start, end));
  }, [selection, onApply]);

  const handleTrimSilence = useCallback(() => {
    const db = silenceThresholdDb;
    onApply(`Trim Silence (${db} dB)`, (s, sr) => trimSilence(s, sr, db));
  }, [silenceThresholdDb, onApply]);

  const handleNormalize = useCallback(() => {
    const peak = targetPeakDb;
    onApply(`Normalize (${peak} dB)`, (s) => normalize(s, peak));
  }, [targetPeakDb, onApply]);

  const handleApplyGain = useCallback(() => {
    const gain = gainDb;
    onApply(`Gain ${gain >= 0 ? '+' : ''}${gain} dB`, (s) => applyGain(s, gain));
  }, [gainDb, onApply]);

  const handleFadeIn = useCallback(() => {
    const ms = fadeDurationMs;
    const curve = fadeCurve;
    onApply(`Fade In (${ms}ms, ${curve})`, (s, sr) => fadeIn(s, sr, ms, curve));
  }, [fadeDurationMs, fadeCurve, onApply]);

  const handleFadeOut = useCallback(() => {
    const ms = fadeDurationMs;
    const curve = fadeCurve;
    onApply(`Fade Out (${ms}ms, ${curve})`, (s, sr) => fadeOut(s, sr, ms, curve));
  }, [fadeDurationMs, fadeCurve, onApply]);

  const handleReverse = useCallback(() => {
    onApply('Reverse', (s) => reverseSamples(s));
  }, [onApply]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Trim */}
      <div className={SECTION_CLASS}>
        <div className={LABEL_CLASS}>Trim</div>
        <button
          className={cn(BTN_CLASS, !selection && 'opacity-50 cursor-not-allowed')}
          disabled={disabled || !selection}
          onClick={handleTrimToSelection}
        >
          Trim to Selection
        </button>
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
            onChange={(e) => setSilenceThresholdDb(Number(e.target.value))}
          />
        </div>
        <button className={BTN_CLASS} disabled={disabled} onClick={handleTrimSilence}>
          Trim Silence
        </button>
      </div>

      {/* Normalize */}
      <div className={SECTION_CLASS}>
        <div className={LABEL_CLASS}>Normalize</div>
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
            onChange={(e) => setTargetPeakDb(Number(e.target.value))}
          />
        </div>
        <button className={BTN_CLASS} disabled={disabled} onClick={handleNormalize}>
          Normalize
        </button>
      </div>

      {/* Gain */}
      <div className={SECTION_CLASS}>
        <div className={LABEL_CLASS}>Gain</div>
        <div className="space-y-1">
          <label className="flex items-center justify-between text-xs text-ac-muted">
            <span>Gain</span>
            <span className="font-mono">{gainDb >= 0 ? '+' : ''}{gainDb} dB</span>
          </label>
          <input
            type="range"
            className={SLIDER_CLASS}
            min={-20}
            max={20}
            step={0.5}
            value={gainDb}
            onChange={(e) => setGainDb(Number(e.target.value))}
          />
        </div>
        <button className={BTN_CLASS} disabled={disabled} onClick={handleApplyGain}>
          Apply Gain
        </button>
      </div>

      {/* Fade */}
      <div className={SECTION_CLASS}>
        <div className={LABEL_CLASS}>Fade</div>
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
            onChange={(e) => setFadeDurationMs(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-ac-muted">Curve</label>
          <select
            className="w-full bg-ac-panel text-ac-text text-xs rounded px-2 py-1 border border-ac-accent"
            value={fadeCurve}
            onChange={(e) => setFadeCurve(e.target.value as FadeCurve)}
          >
            <option value="linear">Linear</option>
            <option value="equal-power">Equal Power</option>
            <option value="logarithmic">Logarithmic</option>
          </select>
        </div>
        <div className="flex gap-1">
          <button className={cn(BTN_CLASS, 'flex-1')} disabled={disabled} onClick={handleFadeIn}>
            Fade In
          </button>
          <button className={cn(BTN_CLASS, 'flex-1')} disabled={disabled} onClick={handleFadeOut}>
            Fade Out
          </button>
        </div>
      </div>

      {/* Reverse */}
      <div className={SECTION_CLASS}>
        <div className={LABEL_CLASS}>Reverse</div>
        <button className={BTN_CLASS} disabled={disabled} onClick={handleReverse}>
          Reverse
        </button>
      </div>
    </div>
  );
}
