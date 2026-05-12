/**
 * `<AcEnvelopeGraph>` — the VFD-glow "monitor" portion of `<AcEnvelope>`.
 *
 * Renders the full-width phosphor-scanline graphic with grid lines, an
 * accent fill polygon, the bright stroke line, draggable point markers,
 * x-axis ticks, the y-axis level guides, and the sustain marker label.
 *
 * Drag interaction is intentionally NOT wired here — points are visually
 * grabbable (cursor: grab); drag handlers arrive with the page-amendment
 * dispatch that consumes this primitive.
 *
 * Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1570-1862 (CSS),
 *   :2640-2715 (demo HTML for the graphic + envelope canvas).
 */
export interface AcEnvelopeGraphSegment {
  time: number;
  level: number;
}

export interface AcEnvelopeGraphProps {
  label: string;
  segments: ReadonlyArray<AcEnvelopeGraphSegment>;
  maxLevel: number;
  sustainSegment: number;
  activeSegment: number;
  helpText?: string;
  onPointSelect?: (index: number) => void;
  onExpand?: () => void;
}

interface PointXY {
  x: number;
  y: number;
}

export function AcEnvelopeGraph(props: AcEnvelopeGraphProps): JSX.Element {
  const n = props.segments.length;
  const pointsXY: PointXY[] = props.segments.map((seg, i) => ({
    x: ((i + 1) / n) * 100,
    y: 100 - (seg.level / props.maxLevel) * 100,
  }));
  const allPoints: PointXY[] = [{ x: 0, y: 100 }, ...pointsXY];
  const linePath = allPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const fillPath = `${linePath} L 100 100 L 0 100 Z`;
  return (
    <div
      className="ac-envelope-graph"
      role="region"
      aria-label={`${props.label} — ${n} segments, segment ${props.activeSegment} active`}
    >
      <span className="ac-envelope-graph__label">{props.label}</span>
      {props.onExpand !== undefined ? (
        <button
          className="ac-envelope-graph__expand"
          type="button"
          aria-label="Expand for precision editing"
          onClick={props.onExpand}
        >
          {'⤢'}
        </button>
      ) : null}
      <div className="ac-envelope-y-axis" aria-hidden="true">
        <span>L{props.maxLevel}</span>
        <span>L0</span>
      </div>
      <div className="ac-envelope-canvas">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="100" y2="0" className="ac-envelope-grid-line" />
          <line x1="0" y1="50" x2="100" y2="50" className="ac-envelope-grid-line ac-envelope-grid-line--baseline" />
          <line x1="0" y1="100" x2="100" y2="100" className="ac-envelope-grid-line ac-envelope-grid-line--baseline" />
          {renderDividers(n)}
          {props.activeSegment > 0 && props.activeSegment <= n ? (
            <line
              x1={String((props.activeSegment / n) * 100)}
              y1="0"
              x2={String((props.activeSegment / n) * 100)}
              y2="100"
              className="ac-envelope-active-guide"
            />
          ) : null}
          <path d={fillPath} className="ac-envelope-fill" />
          <path d={linePath} className="ac-envelope-line" />
        </svg>
        <div className="ac-envelope-points">
          {allPoints.map((p, i) => renderPoint(i, p, props))}
        </div>
        {pointsXY[props.sustainSegment - 1] !== undefined ? (
          <span
            className="ac-envelope-sustain-label"
            style={{
              left: `${pointsXY[props.sustainSegment - 1].x}%`,
              top: `${pointsXY[props.sustainSegment - 1].y}%`,
            }}
          >
            {'▸ SUS'}
          </span>
        ) : null}
      </div>
      <div className="ac-envelope-axis" aria-hidden="true">
        <span className="ac-envelope-axis-tick" style={{ left: '0%' }}>
          Start
        </span>
        {pointsXY.map((p, i) => {
          const isActive = i + 1 === props.activeSegment;
          const tickClass = isActive
            ? 'ac-envelope-axis-tick ac-envelope-axis-tick--active'
            : 'ac-envelope-axis-tick';
          return (
            <span key={i + 1} className={tickClass} style={{ left: `${p.x}%` }}>
              {i + 1}
            </span>
          );
        })}
      </div>
      {props.helpText !== undefined ? (
        <span className="ac-envelope-graph__help">{props.helpText}</span>
      ) : null}
    </div>
  );
}

function renderDividers(n: number): JSX.Element[] {
  const out: JSX.Element[] = [];
  for (let i = 1; i < n; i += 1) {
    const x = (i / n) * 100;
    out.push(
      <line
        key={i}
        x1={String(x)}
        y1="0"
        x2={String(x)}
        y2="100"
        className="ac-envelope-segment-divider"
      />,
    );
  }
  return out;
}

function renderPoint(
  i: number,
  p: PointXY,
  props: AcEnvelopeGraphProps,
): JSX.Element {
  const isActive = i === props.activeSegment;
  const pointClass = isActive
    ? 'ac-envelope-point ac-envelope-point--active'
    : 'ac-envelope-point';
  // Point 0 is the implicit anchor at (0%, 100%); it is not a selectable
  // segment and renders as a non-interactive marker.
  if (i === 0) {
    return (
      <span
        key={i}
        className={pointClass}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
        aria-hidden="true"
      />
    );
  }
  // Selectable segments render as native buttons so keyboard activation
  // (Space + Enter) and focus semantics come for free.
  const handleClick = props.onPointSelect === undefined
    ? undefined
    : (): void => props.onPointSelect?.(i);
  return (
    <button
      key={i}
      type="button"
      className={pointClass}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      onClick={handleClick}
      aria-label={`Select segment ${i}`}
      aria-pressed={isActive}
    />
  );
}
