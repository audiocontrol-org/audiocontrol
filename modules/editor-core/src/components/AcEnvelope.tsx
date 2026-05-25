import { AcEnvelopeAdsr, type AcEnvelopeAdsrProps } from './AcEnvelopeAdsr';
import { AcEnvelopeGraph } from './AcEnvelopeGraph';
import { AcEnvelopeMeta } from './AcEnvelopeMeta';
import { AcEnvelopeTable } from './AcEnvelopeTable';

/**
 * `<AcEnvelope>` — VFD-glow envelope editor with two discriminated-union
 * variants.
 *
 * Variant selection is via the `kind` prop:
 *
 *   - `kind: 'multi-segment'` (default) — uniform N-segment envelope with a
 *     per-segment `{time, level}` shape. Composes three sub-components:
 *       - `<AcEnvelopeGraph>` — the "monitor" with grid, fill, line, points,
 *         axes (cumulative-advance time model; see AcEnvelopeGraph.tsx).
 *       - `<AcEnvelopeMeta>`  — sustain + end segment pip rows.
 *       - `<AcEnvelopeTable>` — per-segment numeric table with mini bars.
 *     Consumed by roland tone envelopes (8 segments) and akai filter
 *     envelopes (4 segments).
 *
 *   - `kind: 'adsr'` — classic 4-parameter ADSR (attack time / decay time /
 *     sustain LEVEL held / release time) with a fixed 75/25 horizontal
 *     layout split (attack + decay + sustain-hold occupy the left 75%,
 *     release the right 25%). Sustain is a HELD level, not a time value.
 *     Consumed by the akai amp envelope (0–99 parameter range).
 *
 * Backwards compatibility: the discriminated union defaults to
 * `kind: 'multi-segment'` when omitted. Every pre-extension consumer
 * (roland tone envelopes) continues to render unchanged.
 *
 * Per project memory `feedback_envelope_pattern`. Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1570-1862, 2640-2840
 */
export interface AcEnvelopeSegment {
  /** Time value, 0..maxTime (typically 0..127). */
  time: number;
  /** Level value, 0..maxLevel (typically 0..127). */
  level: number;
}

/** Multi-segment variant props (the original AcEnvelope contract). */
export interface AcEnvelopeMultiSegmentProps {
  /** Variant discriminator. Omit or pass `'multi-segment'` for this shape. */
  kind?: 'multi-segment';
  /** Eyebrow label shown top-left of the graphic, e.g. "TVF · 8-SEGMENT". */
  label: string;
  /** Per-segment values; expected length is `endSegment`. */
  segments: ReadonlyArray<AcEnvelopeSegment>;
  /** 1-based sustain segment index (1..segments.length). */
  sustainSegment: number;
  /** 1-based final segment index (used as max for the meta end-pip row). */
  endSegment: number;
  /**
   * 1-based active segment index, used to highlight the active row + point.
   * Pass `null` (or omit) when the consumer has no segment-selection model
   * and wants NO segment rendered as active. The akai filter envelope, for
   * example, is drag-editable but has no selected-segment state — passing a
   * numeric index there would create a false-active highlight. See
   * AUDIT-20260524-15 for the regression context.
   */
  activeSegment: number | null;
  /** Maximum time value; defaults to 127. */
  maxTime?: number;
  /** Maximum level value; defaults to 127. */
  maxLevel?: number;
  /** Number of segments the envelope supports total; defaults to 8. */
  totalSegments?: number;
  /** Called when the user clicks a segment number cell or point. */
  onPointSelect?: (segmentIndex: number) => void;
  /** Called when the user picks a sustain segment from the meta pips. */
  onSustainChange?: (segmentIndex: number) => void;
  /** Called when the user picks an end segment from the meta pips. */
  onEndChange?: (segmentIndex: number) => void;
  /** Called with (1-based segment index, time) when a per-segment time bar in the table is dragged or keyboarded, OR when an envelope-graph point is dragged horizontally. */
  onTimeChange?: (segmentIndex: number, time: number) => void;
  /** Called with (1-based segment index, level) when a per-segment level bar in the table is dragged or keyboarded, OR when an envelope-graph point is dragged vertically. */
  onLevelChange?: (segmentIndex: number, level: number) => void;
  /** Fired at the end of an envelope-graph drag (pointerup / cancel). Used by the consumer to perform the device write at drag-end instead of per move. */
  onCommit?: () => void;
  /** Called when the user clicks the expand button. */
  onExpand?: () => void;
  /** Help text shown along the bottom of the graphic. */
  helpText?: string;
  /** Optional className appended to the envelope root. */
  className?: string;
  /**
   * When true, the entire envelope (graph point buttons, meta pip
   * radiogroups, table segment-select buttons) is rendered inert. Pip
   * elements drop out of the tab order and stop firing change callbacks
   * on click or keyboard activation; native `<button>` elements carry the
   * HTML `disabled` attribute so the browser blocks mouse and keyboard
   * activation. The root acquires `data-disabled="true"` so CSS can dim.
   *
   * IMPORTANT: do NOT rely on the caller wrapping this component in
   * `pointer-events: none` to enforce disabled — pointer-events blocks
   * mouse but not keyboard. This prop is the canonical disabled gate.
   */
  disabled?: boolean;
}

/** Discriminated-union prop set for `<AcEnvelope>`. */
export type AcEnvelopeProps = AcEnvelopeMultiSegmentProps | AcEnvelopeAdsrProps;

export type { AcEnvelopeAdsrProps } from './AcEnvelopeAdsr';

export function AcEnvelope(props: AcEnvelopeProps): JSX.Element {
  if (props.kind === 'adsr') {
    return <AcEnvelopeAdsr {...props} />;
  }
  return <AcEnvelopeMultiSegment {...props} />;
}

function AcEnvelopeMultiSegment(props: AcEnvelopeMultiSegmentProps): JSX.Element {
  const totalSegments = props.totalSegments ?? 8;
  const maxTime = props.maxTime ?? 127;
  const maxLevel = props.maxLevel ?? 127;
  const endSegment = clampSegment(props.endSegment, totalSegments);
  const sustainSegment = clampSegment(props.sustainSegment, endSegment);
  // `null` activeSegment is the "no segment is active" path; the clamp
  // helper only runs when the consumer passed a numeric index. The two
  // sub-surfaces (graph + table) both honor `null` as "do not highlight".
  const activeSegment =
    props.activeSegment === null ? null : clampSegment(props.activeSegment, endSegment);
  const segments = props.segments.slice(0, endSegment);

  const rootClass = props.className ? `ac-envelope ${props.className}` : 'ac-envelope';
  const disabled = props.disabled === true;

  return (
    <div className={rootClass} data-disabled={disabled ? 'true' : undefined}>
      <AcEnvelopeGraph
        label={props.label}
        segments={segments}
        maxTime={maxTime}
        maxLevel={maxLevel}
        sustainSegment={sustainSegment}
        activeSegment={activeSegment}
        helpText={props.helpText}
        onPointSelect={props.onPointSelect}
        onTimeChange={props.onTimeChange}
        onLevelChange={props.onLevelChange}
        onCommit={props.onCommit}
        onExpand={props.onExpand}
        disabled={disabled}
      />
      <AcEnvelopeMeta
        totalSegments={totalSegments}
        sustainSegment={sustainSegment}
        endSegment={endSegment}
        onSustainChange={props.onSustainChange}
        onEndChange={props.onEndChange}
        disabled={disabled}
      />
      <AcEnvelopeTable
        segments={segments}
        maxTime={maxTime}
        maxLevel={maxLevel}
        activeSegment={activeSegment}
        sustainSegment={sustainSegment}
        onPointSelect={props.onPointSelect}
        onTimeChange={props.onTimeChange}
        onLevelChange={props.onLevelChange}
        disabled={disabled}
      />
    </div>
  );
}

function clampSegment(value: number, ceiling: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`AcEnvelope received non-finite segment index: ${value}`);
  }
  if (value < 1) {
    return 1;
  }
  if (value > ceiling) {
    return ceiling;
  }
  return Math.floor(value);
}
