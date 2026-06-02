/**
 * AcFilterCurveEditor — interactive low-pass filter frequency/resonance
 * visualization with a draggable cutoff node.
 *
 * Draws an approximate LPF response curve with a draggable node at the
 * cutoff frequency: drag horizontally to change frequency, vertically to
 * change resonance. This is a VISUAL approximation (a simplified 2nd-order
 * resonant LPF transfer function), not a DSP-accurate biquad response:
 *   H(f) = 1 / sqrt((1 - (f/fc)²)² + (f/(fc·Q))²)
 * — flat passband, a resonance peak at cutoff that grows with Q, smooth
 * rolloff after cutoff.
 *
 * Promoted from the Akai s3k-editor `FilterDisplay` to editor-core so Akai
 * and Roland share one implementation. The device's parameter domains are
 * props, not constants: `cutoffMax` / `qMax` are the max raw values for the
 * `frequency` / `resonance` inputs (Akai: 99 / 15; Roland S-330/S-550 TVF:
 * 127 / 127). The chrome (the `.ac-curve-*` classes) is shared with other
 * draggable curve/envelope displays via `curve-display-primitives.css`.
 *
 * `onChange(frequency, resonance)` streams new raw values during a drag (the
 * consumer maps them to its device fields); `onCommit` fires on mouseup.
 * `disabled` (or omitting `onChange`) renders the curve read-only.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const WIDTH = 400;
const HEIGHT = 120;
const PADDING = 16;
const DRAW_WIDTH = WIDTH - PADDING * 2;
const DRAW_HEIGHT = HEIGHT - PADDING * 2;
const TOP = PADDING;
const BOTTOM = PADDING + DRAW_HEIGHT;
const LEFT = PADDING;
const RIGHT = PADDING + DRAW_WIDTH;
const HIT_RADIUS = 16;

// Frequency range for the display (log scale, low to high).
const MIN_FREQ = 20; // Hz
const MAX_FREQ = 20000; // Hz
const LOG_MIN = Math.log10(MIN_FREQ);
const LOG_MAX = Math.log10(MAX_FREQ);
const LOG_RANGE = LOG_MAX - LOG_MIN;

// dB range for magnitude display.
const DB_MIN = -24;
const DB_MAX = 30;
const DB_RANGE = DB_MAX - DB_MIN;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/** Map frequency in Hz to X pixel position (logarithmic scale). */
function freqToX(freqHz: number): number {
  const logNorm = (Math.log10(freqHz) - LOG_MIN) / LOG_RANGE;
  return LEFT + logNorm * DRAW_WIDTH;
}

/** Map dB magnitude to Y pixel position. */
function dbToY(db: number): number {
  return TOP + ((DB_MAX - db) / DB_RANGE) * DRAW_HEIGHT;
}

/**
 * Generate an approximate LPF response path. `freq`/`q` are raw device
 * values in `[0, cutoffMax]` / `[0, qMax]`.
 */
function generateFilterPath(freq: number, q: number, cutoffMax: number, qMax: number): string {
  const SAMPLES = 200;

  // Map raw freq to cutoff Hz (exponential across the display range).
  const fcHz = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, freq / cutoffMax);
  // Map raw Q to a resonance Q factor (0.5 = none, up to ~8 = strong).
  const qFactor = 0.5 + (q / qMax) * 7.5;

  const points: string[] = [];

  for (let i = 0; i <= SAMPLES; i++) {
    const logFreq = LOG_MIN + (i / SAMPLES) * LOG_RANGE;
    const fHz = Math.pow(10, logFreq);
    const x = LEFT + (i / SAMPLES) * DRAW_WIDTH;

    const ratio = fHz / fcHz;
    const ratio2 = ratio * ratio;
    const denom = Math.sqrt((1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor));
    const magnitude = 1 / denom;

    const db = 20 * Math.log10(Math.max(magnitude, 0.0001));
    const y = Math.max(TOP, dbToY(Math.min(DB_MAX, db)));

    if (y >= BOTTOM) {
      if (points.length > 0) {
        points.push(`L ${x} ${BOTTOM}`);
      }
      break;
    }

    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }

  return points.join(' ');
}

export interface AcFilterCurveEditorProps {
  /** Raw cutoff value in `[0, cutoffMax]`. */
  frequency: number;
  /** Raw resonance value in `[0, qMax]`. */
  resonance: number;
  /** Max raw cutoff value (Akai: 99; Roland TVF: 127). */
  cutoffMax: number;
  /** Max raw resonance value (Akai: 15; Roland TVF: 127). */
  qMax: number;
  /** Streams new raw `(frequency, resonance)` during a drag. */
  onChange?: (frequency: number, resonance: number) => void;
  /** Fires on mouseup (drag end) so the consumer can commit. */
  onCommit?: () => void;
  /** When true the curve is read-only (no drag node). */
  disabled?: boolean;
}

export function AcFilterCurveEditor({
  frequency,
  resonance,
  cutoffMax,
  qMax,
  onChange,
  onCommit,
  disabled,
}: AcFilterCurveEditorProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const interactive = !!onChange && !disabled;

  // Node position: X from cutoff frequency (log scale).
  const fcHz = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, frequency / cutoffMax);
  const nodeX = freqToX(fcHz);
  // Y: map resonance linearly to the vertical space above the passband line.
  const passbandY = dbToY(0);
  const nodeY = passbandY - (resonance / qMax) * (passbandY - TOP);

  const getMousePos = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !onChange) return;
      const pos = getMousePos(e);

      // X → frequency: invert the log frequency mapping.
      const logNorm = (pos.x - LEFT) / DRAW_WIDTH;
      const dragHz = Math.pow(10, LOG_MIN + logNorm * LOG_RANGE);
      const newFreq = clamp(
        (Math.log(dragHz / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * cutoffMax,
        0,
        cutoffMax,
      );

      // Y → resonance: linear mapping from the vertical space above passband.
      const passbandYLocal = dbToY(0);
      const qFraction = (passbandYLocal - pos.y) / (passbandYLocal - TOP);
      const newQ = clamp(qFraction * qMax, 0, qMax);

      onChange(newFreq, newQ);
    },
    [dragging, onChange, getMousePos, cutoffMax, qMax],
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) onCommit?.();
    setDragging(false);
  }, [dragging, onCommit]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const pathD = generateFilterPath(frequency, resonance, cutoffMax, qMax);
  // Fill path: close the curve to the bottom of the canvas.
  const fillD = `${pathD} L ${RIGHT} ${BOTTOM} L ${LEFT} ${BOTTOM} Z`;

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  return (
    <svg
      ref={svgRef}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="ac-curve-display"
      aria-label={`Filter: Freq=${frequency} Q=${resonance}`}
    >
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={4} className="ac-curve-bg" />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={LEFT}
          y1={TOP + pct * DRAW_HEIGHT}
          x2={RIGHT}
          y2={TOP + pct * DRAW_HEIGHT}
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={1}
        />
      ))}

      {/* Cutoff vertical guide */}
      <line
        x1={nodeX}
        y1={TOP}
        x2={nodeX}
        y2={BOTTOM}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Filter response fill + curve */}
      <path d={fillD} className="ac-curve-fill" />
      <path d={pathD} className="ac-curve-line" />

      {/* Draggable node at the cutoff point */}
      {interactive && (
        <circle
          cx={nodeX}
          cy={nodeY}
          r={HIT_RADIUS}
          fill="transparent"
          className={dragging ? 'ac-curve-hit--dragging' : 'ac-curve-hit'}
          onMouseDown={startDrag}
        />
      )}
      <circle
        cx={nodeX}
        cy={nodeY}
        r={dragging ? 7 : 5}
        className={interactive ? 'ac-curve-dot ac-curve-dot--draggable' : 'ac-curve-dot'}
        onMouseDown={interactive ? startDrag : undefined}
      />
    </svg>
  );
}
