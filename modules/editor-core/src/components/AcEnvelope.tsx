import { AcEnvelopeGraph } from './AcEnvelopeGraph';
import { AcEnvelopeMeta } from './AcEnvelopeMeta';
import { AcEnvelopeTable } from './AcEnvelopeTable';

/**
 * `<AcEnvelope>` — 8-segment VFD-glow envelope editor.
 *
 * Composes three sub-components:
 *   - `<AcEnvelopeGraph>`  — the "monitor" with grid, fill, line, points, axes.
 *   - `<AcEnvelopeMeta>`   — sustain + end segment pip rows.
 *   - `<AcEnvelopeTable>`  — per-segment numeric table with mini bars.
 *
 * Drag interaction is OUT of scope for this dispatch — the points are
 * rendered visually with `cursor: grab`; wiring of actual drag handlers
 * arrives with the page-amendment dispatch that consumes this primitive.
 * Callbacks (`onPointSelect`, `onSustainChange`, `onEndChange`, `onExpand`)
 * are provided where the consuming page chooses to respond.
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

export interface AcEnvelopeProps {
  /** Eyebrow label shown top-left of the graphic, e.g. "TVF · 8-SEGMENT". */
  label: string;
  /** Per-segment values; expected length is `endSegment`. */
  segments: ReadonlyArray<AcEnvelopeSegment>;
  /** 1-based sustain segment index (1..segments.length). */
  sustainSegment: number;
  /** 1-based final segment index (used as max for the meta end-pip row). */
  endSegment: number;
  /** 1-based active segment index, used to highlight the active row + point. */
  activeSegment: number;
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
  /** Called with (1-based segment index, time) when a per-segment time bar in the table is dragged or keyboarded. */
  onTimeChange?: (segmentIndex: number, time: number) => void;
  /** Called with (1-based segment index, level) when a per-segment level bar in the table is dragged or keyboarded. */
  onLevelChange?: (segmentIndex: number, level: number) => void;
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

export function AcEnvelope(props: AcEnvelopeProps): JSX.Element {
  const totalSegments = props.totalSegments ?? 8;
  const maxTime = props.maxTime ?? 127;
  const maxLevel = props.maxLevel ?? 127;
  const endSegment = clampSegment(props.endSegment, totalSegments);
  const sustainSegment = clampSegment(props.sustainSegment, endSegment);
  const activeSegment = clampSegment(props.activeSegment, endSegment);
  const segments = props.segments.slice(0, endSegment);

  const rootClass = props.className ? `ac-envelope ${props.className}` : 'ac-envelope';
  const disabled = props.disabled === true;

  return (
    <div className={rootClass} data-disabled={disabled ? 'true' : undefined}>
      <AcEnvelopeGraph
        label={props.label}
        segments={segments}
        maxLevel={maxLevel}
        sustainSegment={sustainSegment}
        activeSegment={activeSegment}
        helpText={props.helpText}
        onPointSelect={props.onPointSelect}
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
