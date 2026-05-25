import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  pointerToCanvasPct,
  tryCapturePointer,
  tryReleasePointer,
} from './envelopeDragHelpers';

/**
 * `<AcFrequencyResponse>` — interactive filter frequency-response curve.
 *
 * Draws an approximate filter magnitude curve on a log-frequency × dB
 * canvas with a draggable cutoff+resonance point. Supports four classic
 * filter topologies (lowpass / highpass / bandpass / notch); the curve
 * shape derives from a simplified 2nd-order biquad magnitude expression
 * and is a visual approximation, not a DSP-accurate response.
 *
 * Extracted from akai's `FilterDisplay.tsx` (akai-harmonization Phase 2
 * task 2.2, this dispatch). The legacy `.s3k-envelope-display` /
 * `.s3k-adsr-*` chrome was replaced with the canonical `.ac-envelope-*`
 * chrome in the same dispatch; the legacy CSS was deleted in the
 * dispatch's Commit 6.
 *
 * The canvas chrome (VFD glow, scanline overlay, grid lines, accent
 * fill + line) is shared with `<AcEnvelope>` via the existing
 * `.ac-envelope-graph` family. A `.ac-frequency-response` root modifier
 * exists so future per-component tweaks have a stable hook, and so the
 * grid / axis / point chrome inherits from envelope-primitives.css
 * without duplicating the tokens.
 *
 * Drag interaction:
 *
 *   The single draggable point is the cutoff+resonance node. Horizontal
 *   drag changes the frequency (log-scale across `freqRange.min` ..
 *   `freqRange.max`); vertical drag changes the resonance (linear from
 *   0 at the passband line up to `resonance.max` at the canvas top).
 *
 *   `onChange?.({ frequency?, resonance? })` fires per drag-move with
 *   the parameter(s) that moved. `onCommit?.()` fires once on
 *   pointerup so the consumer can perform the device write at drag-end
 *   instead of per pixel.
 */
export type AcFrequencyResponseFilterType =
  | 'lowpass'
  | 'highpass'
  | 'bandpass'
  | 'notch';

export interface AcFrequencyResponseRange {
  /** Minimum value (inclusive) for the parameter. */
  min: number;
  /** Maximum value (inclusive) for the parameter. */
  max: number;
}

export interface AcFrequencyResponseProps {
  /** Filter cutoff frequency in Hz. */
  frequency: number;
  /** Filter resonance / Q in the resonance domain (consumer-defined units). */
  resonance: number;
  /** Filter topology. Defaults to 'lowpass'. */
  filterType?: AcFrequencyResponseFilterType;
  /** Frequency display range. Defaults to 20Hz..20kHz. */
  freqRange?: AcFrequencyResponseRange;
  /** Resonance display range. Defaults to 0..15 (akai S3K Q range). */
  resonanceRange?: AcFrequencyResponseRange;
  /** dB display range. Defaults to -24..+30. */
  dbRange?: AcFrequencyResponseRange;
  /** Eyebrow label shown top-left of the graphic. Defaults to "FILTER · LPF". */
  label?: string;
  /** Help text shown along the bottom of the graphic. */
  helpText?: string;
  /** Called per drag-move with the changed parameter(s). */
  onChange?: (changes: { frequency?: number; resonance?: number }) => void;
  /** Fired once at drag end (pointerup / pointercancel). */
  onCommit?: () => void;
  /** Optional className appended to the root. */
  className?: string;
  /** When true, the drag point is rendered inert. */
  disabled?: boolean;
}

const DEFAULT_FREQ_RANGE: AcFrequencyResponseRange = { min: 20, max: 20_000 };
const DEFAULT_RESONANCE_RANGE: AcFrequencyResponseRange = { min: 0, max: 15 };
const DEFAULT_DB_RANGE: AcFrequencyResponseRange = { min: -24, max: 30 };

export function AcFrequencyResponse(props: AcFrequencyResponseProps): JSX.Element {
  const filterType: AcFrequencyResponseFilterType = props.filterType ?? 'lowpass';
  const freqRange = props.freqRange ?? DEFAULT_FREQ_RANGE;
  const resonanceRange = props.resonanceRange ?? DEFAULT_RESONANCE_RANGE;
  const dbRange = props.dbRange ?? DEFAULT_DB_RANGE;
  const label = props.label ?? defaultLabel(filterType);
  const disabled = props.disabled === true;
  const dragEnabled = !disabled && props.onChange !== undefined;

  const logMin = Math.log10(freqRange.min);
  const logMax = Math.log10(freqRange.max);
  const logRange = logMax - logMin;
  const dbSpan = dbRange.max - dbRange.min;
  const resonanceSpan = resonanceRange.max - resonanceRange.min;

  const frequency = clampFrequency(props.frequency, freqRange);
  const resonance = clampResonance(props.resonance, resonanceRange);

  const nodeXPct = freqToXPct(frequency, logMin, logRange);
  const passbandYPct = dbToYPct(0, dbRange.max, dbSpan);
  const nodeYPct =
    passbandYPct -
    ((resonance - resonanceRange.min) / resonanceSpan) * passbandYPct;

  const pathD = buildPath(
    filterType,
    frequency,
    resonance,
    freqRange,
    resonanceRange,
    dbRange,
    logMin,
    logRange,
  );
  const fillD = `${pathD} L 100 100 L 0 100 Z`;

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const [dragging, setDragging] = useState<boolean>(false);

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!dragEnabled) {
      return;
    }
    e.preventDefault();
    tryCapturePointer(e);
    draggingRef.current = true;
    setDragging(true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!draggingRef.current || props.onChange === undefined) {
      return;
    }
    const pointer = pointerToCanvasPct(canvasRef.current, e);
    if (pointer === null) {
      return;
    }
    const xPct = clampPct(pointer.xPct);
    const yPct = clampPct(pointer.yPct);
    const dragHz = Math.pow(10, logMin + (xPct / 100) * logRange);
    const newFrequency = clampFrequency(dragHz, freqRange);
    const passbandYPctLocal = dbToYPct(0, dbRange.max, dbSpan);
    const qFraction = (passbandYPctLocal - yPct) / passbandYPctLocal;
    const newResonance =
      resonanceRange.min + clampUnitFraction(qFraction) * resonanceSpan;
    props.onChange({ frequency: newFrequency, resonance: newResonance });
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!draggingRef.current) {
      return;
    }
    tryReleasePointer(e);
    draggingRef.current = false;
    setDragging(false);
    props.onCommit?.();
  };

  const rootClass = props.className
    ? `ac-frequency-response ${props.className}`
    : 'ac-frequency-response';

  return (
    <div
      className={rootClass}
      data-disabled={disabled ? 'true' : undefined}
      data-filter-type={filterType}
    >
      <div
        className="ac-envelope-graph"
        role="region"
        aria-label={`${label} — Freq=${Math.round(frequency)}Hz Q=${roundDisplay(resonance)}`}
      >
        <span className="ac-envelope-graph__label">{label}</span>
        <div className="ac-envelope-canvas" ref={canvasRef}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="0" className="ac-envelope-grid-line" />
            <line
              x1="0"
              y1={String(passbandYPct)}
              x2="100"
              y2={String(passbandYPct)}
              className="ac-envelope-grid-line ac-envelope-grid-line--baseline"
            />
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="100"
              className="ac-envelope-grid-line ac-envelope-grid-line--baseline"
            />
            <line
              x1={String(nodeXPct)}
              y1="0"
              x2={String(nodeXPct)}
              y2="100"
              className="ac-envelope-segment-divider"
            />
            <path d={fillD} className="ac-envelope-fill" />
            <path d={pathD} className="ac-envelope-line" />
          </svg>
          <div className="ac-envelope-points">
            <button
              type="button"
              className={
                dragging
                  ? 'ac-envelope-point ac-envelope-point--active'
                  : 'ac-envelope-point'
              }
              style={{ left: `${nodeXPct}%`, top: `${nodeYPct}%` }}
              onPointerDown={disabled ? undefined : handlePointerDown}
              onPointerMove={dragEnabled ? handlePointerMove : undefined}
              onPointerUp={dragEnabled ? handlePointerUp : undefined}
              onPointerCancel={dragEnabled ? handlePointerUp : undefined}
              aria-label={`Cutoff ${Math.round(frequency)} Hz / Q ${roundDisplay(resonance)}`}
              aria-pressed={dragging}
              disabled={disabled}
            />
          </div>
        </div>
        {props.helpText !== undefined ? (
          <span className="ac-envelope-graph__help">{props.helpText}</span>
        ) : null}
      </div>
    </div>
  );
}

function defaultLabel(filterType: AcFrequencyResponseFilterType): string {
  switch (filterType) {
    case 'highpass':
      return 'FILTER · HPF';
    case 'bandpass':
      return 'FILTER · BPF';
    case 'notch':
      return 'FILTER · NOTCH';
    case 'lowpass':
      return 'FILTER · LPF';
  }
}

function clampFrequency(value: number, range: AcFrequencyResponseRange): number {
  if (!Number.isFinite(value)) {
    throw new Error(`AcFrequencyResponse received non-finite frequency: ${value}`);
  }
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

function clampResonance(value: number, range: AcFrequencyResponseRange): number {
  if (!Number.isFinite(value)) {
    throw new Error(`AcFrequencyResponse received non-finite resonance: ${value}`);
  }
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}

function clampPct(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function clampUnitFraction(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function freqToXPct(freq: number, logMin: number, logRange: number): number {
  const logNorm = (Math.log10(freq) - logMin) / logRange;
  return clampPct(logNorm * 100);
}

function dbToYPct(db: number, dbMax: number, dbSpan: number): number {
  return ((dbMax - db) / dbSpan) * 100;
}

function roundDisplay(value: number): string {
  return value.toFixed(value < 10 ? 1 : 0);
}

/**
 * Build the SVG path for the chosen filter topology. All four use the
 * same simplified biquad magnitude expression evaluated at sample points
 * across the log-frequency axis. The visual contract: passband flat
 * before/after the cutoff per filter shape; resonance peak near the
 * cutoff; smooth rolloff into the stopband.
 */
function buildPath(
  filterType: AcFrequencyResponseFilterType,
  frequency: number,
  resonance: number,
  freqRange: AcFrequencyResponseRange,
  resonanceRange: AcFrequencyResponseRange,
  dbRange: AcFrequencyResponseRange,
  logMin: number,
  logRange: number,
): string {
  const SAMPLES = 200;
  const dbSpan = dbRange.max - dbRange.min;
  const resonanceSpan = resonanceRange.max - resonanceRange.min;
  const qFactor =
    0.5 + ((resonance - resonanceRange.min) / resonanceSpan) * 7.5;
  const fcHz = frequency;

  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const logFreq = logMin + (i / SAMPLES) * logRange;
    const fHz = Math.pow(10, logFreq);
    const xPct = (i / SAMPLES) * 100;
    const magnitude = filterMagnitude(filterType, fHz, fcHz, qFactor);
    const db = 20 * Math.log10(Math.max(magnitude, 0.0001));
    const clampedDb = Math.min(dbRange.max, db);
    const yPct = Math.max(0, dbToYPct(clampedDb, dbRange.max, dbSpan));
    // Stop drawing if the curve dives off the bottom of the canvas.
    if (yPct >= 100) {
      if (points.length > 0) {
        points.push(`L ${xPct.toFixed(2)} 100`);
      }
      break;
    }
    points.push(`${i === 0 ? 'M' : 'L'} ${xPct.toFixed(2)} ${yPct.toFixed(2)}`);
  }
  return points.join(' ');
}

function filterMagnitude(
  filterType: AcFrequencyResponseFilterType,
  fHz: number,
  fcHz: number,
  qFactor: number,
): number {
  const ratio = fHz / fcHz;
  const ratio2 = ratio * ratio;
  switch (filterType) {
    case 'lowpass': {
      const denom = Math.sqrt(
        (1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor),
      );
      return 1 / denom;
    }
    case 'highpass': {
      const denom = Math.sqrt(
        (1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor),
      );
      return ratio2 / denom;
    }
    case 'bandpass': {
      const denom = Math.sqrt(
        (1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor),
      );
      return (ratio / qFactor) / denom;
    }
    case 'notch': {
      const denom = Math.sqrt(
        (1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor),
      );
      return Math.abs(1 - ratio2) / denom;
    }
  }
}
