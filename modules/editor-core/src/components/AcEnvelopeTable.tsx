import type { CSSProperties, ChangeEvent } from 'react';

/**
 * `<AcEnvelopeTable>` — per-segment numeric table for `<AcEnvelope>`.
 *
 * One row per segment. Each row has a segment number, a time mini-bar with
 * readout, and a level mini-bar with readout. The active segment row is
 * highlighted; the sustain row shows a small ▸ marker on the seg number.
 *
 * Row selection is exposed through the first column (a native button with
 * `aria-pressed`). When `onTimeChange` / `onLevelChange` are passed, the
 * per-segment time and level bars become real controls (transparent native
 * `<input type="range">` overlays — pointer drag + full keyboard). The row
 * itself stays non-interactive (`role="row"` per the ARIA contract).
 */
export interface AcEnvelopeTableSegment {
  time: number;
  level: number;
}

export interface AcEnvelopeTableProps {
  segments: ReadonlyArray<AcEnvelopeTableSegment>;
  maxTime: number;
  maxLevel: number;
  /**
   * 1-based active segment index, or `null` for "no row is active".
   * Pass `null` when the consumer has no segment-selection model (e.g.
   * the akai filter envelope) — every row will render with
   * `data-active="false"` and `aria-pressed="false"`. See
   * AUDIT-20260524-15 for the regression context.
   */
  activeSegment: number | null;
  sustainSegment: number;
  onPointSelect?: (index: number) => void;
  /** Called with (segmentIndex 1-based, newTime) when the time bar is dragged or keyboarded. */
  onTimeChange?: (index: number, time: number) => void;
  /** Called with (segmentIndex 1-based, newLevel) when the level bar is dragged or keyboarded. */
  onLevelChange?: (index: number, level: number) => void;
  /**
   * Per-segment row disable. Pass an array of length `segments.length` to
   * disable individual rows (e.g. segments beyond the end-point). Pass
   * `true` to disable the whole table. Missing entries default to enabled.
   */
  rowDisabled?: ReadonlyArray<boolean>;
  /**
   * When true, every interactive control in the table carries `disabled`.
   */
  disabled?: boolean;
}

interface FillStyle extends CSSProperties {
  '--ac-envelope-mini-fill'?: string;
}

export function AcEnvelopeTable(props: AcEnvelopeTableProps): JSX.Element {
  return (
    <div
      className="ac-envelope-table"
      role="table"
      aria-label={`Envelope segments — ${props.segments.length} segments, sustain at segment ${props.sustainSegment}`}
    >
      <div className="ac-envelope-table__header" role="row">
        <span className="ac-envelope-table__head" role="columnheader">
          Seg
        </span>
        <span className="ac-envelope-table__head" role="columnheader">
          {`Time · 0–${props.maxTime}`}
        </span>
        <span className="ac-envelope-table__head" role="columnheader">
          {`Level · 0–${props.maxLevel}`}
        </span>
      </div>
      {props.segments.map((seg, i) => renderRow(i + 1, seg, props))}
    </div>
  );
}

function renderRow(
  index: number,
  seg: AcEnvelopeTableSegment,
  props: AcEnvelopeTableProps,
): JSX.Element {
  const active = index === props.activeSegment;
  const sustain = index === props.sustainSegment;
  const globalDisabled = props.disabled === true;
  const rowDisabled = globalDisabled || props.rowDisabled?.[index - 1] === true;
  const timePct = (seg.time / props.maxTime) * 100;
  const levelPct = (seg.level / props.maxLevel) * 100;
  const timeStyle: FillStyle = { '--ac-envelope-mini-fill': `${timePct}%` };
  const levelStyle: FillStyle = { '--ac-envelope-mini-fill': `${levelPct}%` };
  const handleSelect = props.onPointSelect === undefined || globalDisabled
    ? undefined
    : (): void => props.onPointSelect?.(index);
  const timeInteractive = props.onTimeChange !== undefined;
  const levelInteractive = props.onLevelChange !== undefined;
  return (
    <div
      key={index}
      className="ac-envelope-table__row"
      role="row"
      data-active={active ? 'true' : 'false'}
      data-sustain={sustain ? 'true' : undefined}
    >
      <span role="cell">
        <button
          type="button"
          className="ac-envelope-table__seg"
          aria-label={`Select segment ${index}`}
          aria-pressed={active}
          onClick={handleSelect}
          disabled={handleSelect === undefined}
        >
          {index}
        </button>
      </span>
      <div className="ac-envelope-table__cell" role="cell">
        <div
          className="ac-envelope-mini"
          {...(timeInteractive
            ? {}
            : { role: 'img', 'aria-label': `Time ${seg.time} of ${props.maxTime}` })}
        >
          <div className="ac-envelope-mini__fill" style={timeStyle} />
          {timeInteractive ? (
            <input
              className="ac-envelope-mini__input"
              type="range"
              min={0}
              max={props.maxTime}
              step={1}
              value={seg.time}
              disabled={rowDisabled}
              aria-label={`Segment ${index} time`}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onTimeChange?.(index, Number(e.target.value))
              }
            />
          ) : null}
        </div>
        <span className="ac-envelope-mini__readout">{seg.time}</span>
      </div>
      <div className="ac-envelope-table__cell" role="cell">
        <div
          className="ac-envelope-mini"
          {...(levelInteractive
            ? {}
            : { role: 'img', 'aria-label': `Level ${seg.level} of ${props.maxLevel}` })}
        >
          <div className="ac-envelope-mini__fill" style={levelStyle} />
          {levelInteractive ? (
            <input
              className="ac-envelope-mini__input"
              type="range"
              min={0}
              max={props.maxLevel}
              step={1}
              value={seg.level}
              disabled={rowDisabled}
              aria-label={`Segment ${index} level`}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                props.onLevelChange?.(index, Number(e.target.value))
              }
            />
          ) : null}
        </div>
        <span className="ac-envelope-mini__readout">{seg.level}</span>
      </div>
    </div>
  );
}
