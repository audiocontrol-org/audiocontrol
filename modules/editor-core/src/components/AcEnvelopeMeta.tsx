/**
 * `<AcEnvelopeMeta>` — sustain + end segment pip rows for `<AcEnvelope>`.
 *
 * Two 8-pip radio groups laid out side-by-side. The sustain row is bounded
 * by `endSegment` (later pips disabled); the end row is bounded by
 * `totalSegments` (all pips enabled).
 *
 * Mockup source: 04-tones.html:1882-1945, 2708-2735.
 */
export interface AcEnvelopeMetaProps {
  totalSegments: number;
  sustainSegment: number;
  endSegment: number;
  onSustainChange?: (index: number) => void;
  onEndChange?: (index: number) => void;
}

export function AcEnvelopeMeta(props: AcEnvelopeMetaProps): JSX.Element {
  return (
    <div className="ac-envelope-meta" role="group" aria-label="Envelope shape">
      <div className="ac-envelope-meta__control">
        <span className="ac-envelope-meta__label">{'Sustain ▸'}</span>
        <div className="ac-envelope-meta__pips" role="radiogroup" aria-label="Sustain segment">
          {renderPipRow(
            props.totalSegments,
            props.sustainSegment,
            props.endSegment,
            props.onSustainChange,
          )}
        </div>
      </div>
      <div className="ac-envelope-meta__control">
        <span className="ac-envelope-meta__label">{'End ▣'}</span>
        <div className="ac-envelope-meta__pips" role="radiogroup" aria-label="Envelope length">
          {renderPipRow(props.totalSegments, props.endSegment, props.totalSegments, props.onEndChange)}
        </div>
      </div>
    </div>
  );
}

function renderPipRow(
  total: number,
  active: number,
  maxEnabled: number,
  onChange: ((index: number) => void) | undefined,
): JSX.Element[] {
  const out: JSX.Element[] = [];
  for (let i = 1; i <= total; i += 1) {
    const isActive = i === active;
    const disabled = i > maxEnabled;
    const handleClick = onChange === undefined || disabled ? undefined : (): void => onChange(i);
    out.push(
      <span
        key={i}
        className="ac-envelope-meta__pip"
        role="radio"
        aria-checked={isActive}
        data-active={isActive ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
        tabIndex={disabled ? -1 : 0}
      >
        {i}
      </span>,
    );
  }
  return out;
}
