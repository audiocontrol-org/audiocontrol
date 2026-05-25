import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampEnvelopeParam,
  pointerToCanvasPct,
  tryCapturePointer,
  tryReleasePointer,
} from './envelopeDragHelpers';
import {
  EnvelopeAnchorPoint,
  EnvelopeDragPoint,
  EnvelopeGridLines,
} from './envelopeChromeHelpers';

/**
 * `<AcEnvelopeAdsr>` — classic 4-parameter ADSR envelope variant of
 * `<AcEnvelope>` (selected via `kind: 'adsr'`).
 *
 * Distinct from the multi-segment variant in two ways:
 *
 *   1. Layout: 4 parameters (attack time, decay time, sustain LEVEL,
 *      release time) with a FIXED 75/25 horizontal split — the
 *      attack-peak / decay-end / sustain-hold points share the left
 *      75% of the canvas, the release-end point lives in the right 25%.
 *      Sustain is held visually from the decay-end point straight across
 *      to x = 75% (the "sustain hold" segment). The sustain HANDLE moves
 *      vertically only (it sets the held level, not a time).
 *
 *   2. Sustain semantics: in the multi-segment variant, sustain is a
 *      segment INDEX (which segment to hold at). Here, sustain is a
 *      LEVEL value the held line sits at.
 *
 * Renders inside the same `.ac-envelope-graph` chrome (VFD glow, scanline
 * overlay, accent-tinted fill + line) the multi-segment variant uses, so
 * both kinds share the canonical envelope visual language. The
 * `data-variant="adsr"` attribute on the root lets CSS distinguish the
 * two if any future per-variant tweak is needed.
 *
 * Extracted from akai's `AdsrDisplay.tsx` (akai-harmonization Phase 2
 * task 2.2, this dispatch). The legacy `.s3k-envelope-display` /
 * `.s3k-adsr-*` chrome was replaced with the canonical
 * `.ac-envelope-*` chrome in the same dispatch; the legacy CSS was
 * deleted in the dispatch's Commit 6.
 *
 * Drag interaction:
 *
 *   - Attack peak (point 1): horizontal drag → attack time.
 *   - Decay end / sustain start (point 2): horizontal drag → decay time;
 *     vertical drag → sustain level (the only sustain-altering control).
 *   - Sustain end (point 3): NOT draggable. Fixed at x = 75%; height
 *     mirrors point 2's sustain level. Renders the "sustain hold" line.
 *   - Release end (point 4): horizontal drag → release time. (Drops the
 *     line back to y = baseline.)
 *
 *   Per-move calls `onChange({ ... })` with the names of the parameters
 *   that moved. `onCommit?.()` fires once on pointerup so the consumer
 *   can perform the device write at drag-end instead of per pixel.
 */
export interface AcEnvelopeAdsrProps {
  /** Variant discriminator — required for this shape. */
  kind: 'adsr';
  /** Eyebrow label shown top-left of the graphic, e.g. "AMP · ADSR". */
  label: string;
  /** Attack time, 0..maxValue. */
  attack: number;
  /** Decay time, 0..maxValue. */
  decay: number;
  /** Sustain LEVEL (held, not a time), 0..maxValue. */
  sustain: number;
  /** Release time, 0..maxValue. */
  release: number;
  /** Max value for all four params. Defaults to 127 (roland convention);
   *  akai consumers should pass 99 (S3K range). */
  maxValue?: number;
  /** Called per drag-move with the changed parameter(s). */
  onChange?: (changes: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  }) => void;
  /** Fired once at drag end (pointerup / pointercancel). */
  onCommit?: () => void;
  /** Help text shown along the bottom of the graphic. */
  helpText?: string;
  /** Optional className appended to the envelope root. */
  className?: string;
  /** When true, the four point buttons are rendered inert (HTML disabled). */
  disabled?: boolean;
}

interface PointXY {
  x: number;
  y: number;
}

type DragKey = 'attack' | 'decay' | 'release';

interface DragState {
  key: DragKey;
}

/** Horizontal split: attack + decay + sustain-hold share left 75%; release the right 25%. */
const SPLIT = 0.75;

export function AcEnvelopeAdsr(props: AcEnvelopeAdsrProps): JSX.Element {
  const maxValue = props.maxValue ?? 127;
  const disabled = props.disabled === true;
  const dragEnabled = !disabled && props.onChange !== undefined;
  const dragStateRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // Re-render trigger so the "active point" outline tracks the drag. We
  // can't read from the ref alone because React doesn't observe refs;
  // the dragKey state is the source of truth for the render path.
  const [dragKey, setDragKey] = useState<DragKey | null>(null);

  const a = clampParam(props.attack, maxValue);
  const d = clampParam(props.decay, maxValue);
  const s = clampParam(props.sustain, maxValue);
  const r = clampParam(props.release, maxValue);

  // Map (attack, decay) to x positions inside the left 75% via a shared
  // pair-budget (each parameter contributes up to half the left zone).
  // This mirrors the legacy AdsrDisplay layout so the visual reading is
  // preserved across the migration.
  const leftWidthPct = 100 * SPLIT;
  const rightWidthPct = 100 * (1 - SPLIT);
  const pairBudget = 2 * (maxValue + 1);
  const atkPct = ((a + 1) / pairBudget) * leftWidthPct;
  const decPct = ((d + 1) / pairBudget) * leftWidthPct;
  const relPct = ((r + 1) / (maxValue + 1)) * rightWidthPct;

  const x0 = 0;
  const x1 = x0 + atkPct;
  const x2 = x1 + decPct;
  const x3 = 100 * SPLIT; // fixed
  const x4 = x3 + relPct;

  const susY = 100 - (s / maxValue) * 100;

  const points: Array<{ x: number; y: number; key: DragKey | 'origin' | 'sustain-end' }> = [
    { x: x0, y: 100, key: 'origin' },
    { x: x1, y: 0, key: 'attack' },
    { x: x2, y: susY, key: 'decay' },
    { x: x3, y: susY, key: 'sustain-end' },
    { x: x4, y: 100, key: 'release' },
  ];

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const fillD = `${pathD} L ${points[points.length - 1].x.toFixed(2)} 100 L ${x0} 100 Z`;

  const rootClass = props.className
    ? `ac-envelope ac-envelope--adsr ${props.className}`
    : 'ac-envelope ac-envelope--adsr';

  const handlePointerDown = (
    key: DragKey,
    e: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (!dragEnabled) {
      return;
    }
    e.preventDefault();
    tryCapturePointer(e);
    dragStateRef.current = { key };
    setDragKey(key);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const state = dragStateRef.current;
    if (state === null || props.onChange === undefined) {
      return;
    }
    const pointer = pointerToCanvasPct(canvasRef.current, e);
    if (pointer === null) {
      return;
    }
    const pairPxPerUnit = leftWidthPct / pairBudget;

    if (state.key === 'attack') {
      const segPx = Math.max(0, pointer.xPct - x0);
      const newAttack = clampParam(segPx / pairPxPerUnit - 1, maxValue);
      props.onChange({ attack: newAttack });
      return;
    }
    if (state.key === 'decay') {
      const segPx = Math.max(0, pointer.xPct - x1);
      const newDecay = clampParam(segPx / pairPxPerUnit - 1, maxValue);
      const newSustain = clampParam(
        ((100 - pointer.yPct) / 100) * maxValue,
        maxValue,
      );
      props.onChange({ decay: newDecay, sustain: newSustain });
      return;
    }
    if (state.key === 'release') {
      const relPxPerUnit = rightWidthPct / (maxValue + 1);
      const segPx = Math.max(0, pointer.xPct - x3);
      const newRelease = clampParam(segPx / relPxPerUnit - 1, maxValue);
      props.onChange({ release: newRelease });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (dragStateRef.current === null) {
      return;
    }
    tryReleasePointer(e);
    dragStateRef.current = null;
    setDragKey(null);
    props.onCommit?.();
  };

  return (
    <div
      className={rootClass}
      data-disabled={disabled ? 'true' : undefined}
      data-variant="adsr"
    >
      <div
        className="ac-envelope-graph"
        role="region"
        aria-label={`${props.label} — ADSR: A=${a} D=${d} S=${s} R=${r}`}
      >
        <span className="ac-envelope-graph__label">{props.label}</span>
        <div className="ac-envelope-y-axis" aria-hidden="true">
          <span>L{maxValue}</span>
          <span>L0</span>
        </div>
        <div className="ac-envelope-canvas" ref={canvasRef}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <EnvelopeGridLines />
            {/* Vertical guide marking the fixed 75% sustain-end split. */}
            <line
              x1={String(x3)}
              y1="0"
              x2={String(x3)}
              y2="100"
              className="ac-envelope-segment-divider"
            />
            <path d={fillD} className="ac-envelope-fill" />
            <path d={pathD} className="ac-envelope-line" />
          </svg>
          <div className="ac-envelope-points">
            {points.map((p, i) => {
              const isActive = p.key === dragKey;
              if (p.key === 'origin' || p.key === 'sustain-end') {
                return (
                  <EnvelopeAnchorPoint
                    key={i}
                    xPct={p.x}
                    yPct={p.y}
                    isActive={isActive}
                  />
                );
              }
              const labelText = describePointLabel(p.key, { a, d, s, r });
              const key: DragKey = p.key;
              return (
                <EnvelopeDragPoint
                  key={i}
                  xPct={p.x}
                  yPct={p.y}
                  isActive={isActive}
                  disabled={disabled}
                  dragEnabled={dragEnabled}
                  ariaLabel={labelText}
                  onPointerDown={(e) => handlePointerDown(key, e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                />
              );
            })}
          </div>
        </div>
        <div className="ac-envelope-axis" aria-hidden="true">
          <span className="ac-envelope-axis-tick" style={{ left: `${(x0 + x1) / 2}%` }}>
            A
          </span>
          <span className="ac-envelope-axis-tick" style={{ left: `${(x1 + x2) / 2}%` }}>
            D
          </span>
          <span className="ac-envelope-axis-tick" style={{ left: `${(x2 + x3) / 2}%` }}>
            S
          </span>
          <span className="ac-envelope-axis-tick" style={{ left: `${(x3 + x4) / 2}%` }}>
            R
          </span>
        </div>
        {props.helpText !== undefined ? (
          <span className="ac-envelope-graph__help">{props.helpText}</span>
        ) : null}
      </div>
    </div>
  );
}

function clampParam(value: number, maxValue: number): number {
  return clampEnvelopeParam(value, maxValue, 'AcEnvelopeAdsr');
}

function describePointLabel(
  key: DragKey,
  values: { a: number; d: number; s: number; r: number },
): string {
  switch (key) {
    case 'attack':
      return `Attack ${values.a}`;
    case 'decay':
      return `Decay ${values.d} / Sustain ${values.s}`;
    case 'release':
      return `Release ${values.r}`;
  }
}
