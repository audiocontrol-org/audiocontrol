/**
 * FilterDisplay — interactive low-pass filter frequency/resonance visualization.
 *
 * Draws an approximate LPF response curve with a draggable node at the
 * cutoff frequency. Drag horizontally to change frequency, vertically
 * to change resonance.
 *
 * This is a visual approximation, not a DSP-accurate biquad response.
 * The S3K filter frequency is 0-99 and resonance/Q is 0-15.
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

// S3K parameter ranges
const FREQ_MAX = 99;
const Q_MAX = 15;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Generate an approximate LPF frequency response curve.
 *
 * The curve is flat (passband) up to the cutoff, has a resonance peak
 * at the cutoff, then rolls off. Higher Q = taller peak.
 */
/**
 * Sample a low-pass filter magnitude response as a smooth function.
 *
 * Uses a simplified 2nd-order resonant LPF transfer function:
 *   H(f) = 1 / sqrt((1 - (f/fc)²)² + (f/(fc*Q))²)
 *
 * This produces a physically-motivated curve: flat passband, resonance
 * peak at cutoff that grows with Q, smooth rolloff after cutoff.
 */
// Frequency range for the display (like Surge: log scale from low to high)
const MIN_FREQ = 20;    // Hz
const MAX_FREQ = 20000; // Hz
const LOG_MIN = Math.log10(MIN_FREQ);
const LOG_MAX = Math.log10(MAX_FREQ);
const LOG_RANGE = LOG_MAX - LOG_MIN;

// dB range for magnitude display (like Surge: -42 to +18 dB)
const DB_MIN = -24;
const DB_MAX = 30;
const DB_RANGE = DB_MAX - DB_MIN;

/** Map frequency in Hz to X pixel position (logarithmic scale) */
function freqToX(freqHz: number): number {
  const logNorm = (Math.log10(freqHz) - LOG_MIN) / LOG_RANGE;
  return LEFT + logNorm * DRAW_WIDTH;
}

/** Map dB magnitude to Y pixel position */
function dbToY(db: number): number {
  return TOP + ((DB_MAX - db) / DB_RANGE) * DRAW_HEIGHT;
}

function generateFilterPath(freq: number, q: number): string {
  const SAMPLES = 200;

  // Map S3K freq (0-99) to cutoff Hz (exponential: ~60 Hz to ~18 kHz)
  const fcHz = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, freq / FREQ_MAX);
  // Map S3K Q (0-15) to a resonance Q factor (0.5 = no resonance, up to ~8 = strong)
  const qFactor = 0.5 + (q / Q_MAX) * 7.5;

  const points: string[] = [];

  for (let i = 0; i <= SAMPLES; i++) {
    // Sample frequency on log scale across the display range
    const logFreq = LOG_MIN + (i / SAMPLES) * LOG_RANGE;
    const fHz = Math.pow(10, logFreq);
    const x = LEFT + (i / SAMPLES) * DRAW_WIDTH;

    // 2nd-order resonant LPF magnitude response
    const ratio = fHz / fcHz;
    const ratio2 = ratio * ratio;
    const denom = Math.sqrt((1 - ratio2) * (1 - ratio2) + (ratio / qFactor) * (ratio / qFactor));
    const magnitude = 1 / denom;

    // Convert to dB
    const db = 20 * Math.log10(Math.max(magnitude, 0.0001));
    const y = Math.max(TOP, dbToY(Math.min(DB_MAX, db)));

    // Stop drawing once the curve reaches the bottom of the canvas
    if (y >= BOTTOM) {
      if (points.length > 0) {
        points.push(`L ${x} ${BOTTOM}`);
      }
      break;
    }

    if (i === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  }

  return points.join(' ');
}

interface FilterDisplayProps {
  frequency: number;  // 0-99
  resonance: number;  // 0-15
  onChange?: (changes: Record<string, number>) => void;
  onCommit?: () => void;
}

export function FilterDisplay({ frequency, resonance, onChange, onCommit }: FilterDisplayProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  // Node position: X from cutoff frequency (log scale)
  const fcHz = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, frequency / FREQ_MAX);
  const nodeX = freqToX(fcHz);
  // Y: map Q (0-15) linearly to full vertical space above passband (0 dB line)
  // This gives maximum drag resolution for resonance adjustment
  const passbandY = dbToY(0);
  const nodeY = passbandY - (resonance / Q_MAX) * (passbandY - TOP);

  const getMousePos = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (HEIGHT / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !onChange) return;
    const pos = getMousePos(e);

    // X → frequency: invert the log frequency mapping
    const logNorm = (pos.x - LEFT) / DRAW_WIDTH;
    const dragHz = Math.pow(10, LOG_MIN + logNorm * LOG_RANGE);
    // Invert: fcHz = MIN_FREQ * (MAX_FREQ/MIN_FREQ)^(freq/99)
    const newFreq = clamp(Math.log(dragHz / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ) * FREQ_MAX, 0, FREQ_MAX);

    // Y → resonance: linear mapping from vertical space above passband
    const passbandYLocal = dbToY(0);
    const qFraction = (passbandYLocal - pos.y) / (passbandYLocal - TOP);
    const newQ = clamp(qFraction * Q_MAX, 0, Q_MAX);

    onChange({ FILFRQ: newFreq, FILQ: newQ });
  }, [dragging, onChange, getMousePos]);

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

  const pathD = generateFilterPath(frequency, resonance);

  // Fill path: close the curve to the bottom of the canvas
  const fillD = `${pathD} L ${RIGHT} ${BOTTOM} L ${LEFT} ${BOTTOM} Z`;

  return (
    <svg
      ref={svgRef}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="s3k-envelope-display"
      aria-label={`Filter: Freq=${frequency} Q=${resonance}`}
    >
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={4} className="s3k-adsr-bg" />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line key={pct} x1={LEFT} y1={TOP + pct * DRAW_HEIGHT} x2={RIGHT} y2={TOP + pct * DRAW_HEIGHT}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}

      {/* Cutoff vertical guide */}
      <line x1={nodeX} y1={TOP} x2={nodeX} y2={BOTTOM}
        stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="3 3" />

      {/* Filter response fill */}
      <path d={fillD} className="s3k-adsr-fill" />

      {/* Filter response curve */}
      <path d={pathD} className="s3k-adsr-line" />

      {/* Draggable node at cutoff point */}
      {onChange && (
        <circle cx={nodeX} cy={nodeY} r={HIT_RADIUS} fill="transparent"
          className={dragging ? 's3k-adsr-hit--dragging' : 's3k-adsr-hit'}
          onMouseDown={(e) => { e.preventDefault(); setDragging(true); }} />
      )}
      <circle cx={nodeX} cy={nodeY}
        r={dragging ? 7 : 5}
        className={onChange ? 's3k-adsr-dot s3k-adsr-dot--draggable' : 's3k-adsr-dot'}
        onMouseDown={onChange ? (e) => { e.preventDefault(); setDragging(true); } : undefined} />

    </svg>
  );
}
