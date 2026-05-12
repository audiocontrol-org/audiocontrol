import type { CSSProperties } from 'react';

/**
 * `<AcEnvelopeTable>` — per-segment numeric table for `<AcEnvelope>`.
 *
 * One row per segment. Each row has a segment number, a time mini-bar with
 * readout, and a level mini-bar with readout. The active segment row is
 * highlighted; the sustain row shows a small ▸ marker on the seg number.
 *
 * Mockup source: 04-tones.html:1786-1862, 2737-2840.
 */
export interface AcEnvelopeTableSegment {
  time: number;
  level: number;
}

export interface AcEnvelopeTableProps {
  segments: ReadonlyArray<AcEnvelopeTableSegment>;
  maxTime: number;
  maxLevel: number;
  activeSegment: number;
  sustainSegment: number;
  onPointSelect?: (index: number) => void;
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
  const timePct = (seg.time / props.maxTime) * 100;
  const levelPct = (seg.level / props.maxLevel) * 100;
  const timeStyle: FillStyle = { '--ac-envelope-mini-fill': `${timePct}%` };
  const levelStyle: FillStyle = { '--ac-envelope-mini-fill': `${levelPct}%` };
  const handleClick = props.onPointSelect === undefined
    ? undefined
    : (): void => props.onPointSelect?.(index);
  return (
    <div
      key={index}
      className="ac-envelope-table__row"
      role="row"
      data-active={active ? 'true' : 'false'}
      data-sustain={sustain ? 'true' : undefined}
      onClick={handleClick}
    >
      <span className="ac-envelope-table__seg" role="cell">
        {index}
      </span>
      <div className="ac-envelope-table__cell" role="cell">
        <div className="ac-envelope-mini" role="img" aria-label={`Time ${seg.time} of ${props.maxTime}`}>
          <div className="ac-envelope-mini__fill" style={timeStyle} />
        </div>
        <span className="ac-envelope-mini__readout">{seg.time}</span>
      </div>
      <div className="ac-envelope-table__cell" role="cell">
        <div className="ac-envelope-mini" role="img" aria-label={`Level ${seg.level} of ${props.maxLevel}`}>
          <div className="ac-envelope-mini__fill" style={levelStyle} />
        </div>
        <span className="ac-envelope-mini__readout">{seg.level}</span>
      </div>
    </div>
  );
}
