import type { CSSProperties } from 'react';

/**
 * `<AcRangeBar>` — bounded visualization with start/end ticks INSIDE and an
 * accent-filled width. Three modes:
 *
 *   - **linear**   (default): single fill from left, width % via `value` / `min` / `max`
 *   - **bipolar**  : fill anchored from center, growing left or right of `center`
 *   - **enum**     : N-cell pip track, `activeIndex` chooses the lit cell
 *
 * Used standalone in display-only rows AND as the bar slot inside
 * `<AcSlider>`. Styled by `control-primitives.css`.
 *
 * Per project memory `feedback_range_bar_pattern`. Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1486-1568
 */
export interface AcRangeBarLinearProps {
  variant?: 'linear';
  /** Current value. */
  value: number;
  /** Minimum value (inclusive); defaults to 0. */
  min?: number;
  /** Maximum value (inclusive); defaults to 127 (S-330/S-550 standard range). */
  max?: number;
  /** Optional start label rendered INSIDE the bar. */
  startTick?: string;
  /** Optional midpoint label rendered INSIDE the bar. */
  midTick?: string;
  /** Optional end label rendered INSIDE the bar. */
  endTick?: string;
  /** Optional aria-label for screen readers. */
  ariaLabel?: string;
  /** Optional className appended to the bar root. */
  className?: string;
}

export interface AcRangeBarBipolarProps {
  variant: 'bipolar';
  /** Current value (may be negative). */
  value: number;
  /** Minimum value (typically negative). */
  min: number;
  /** Maximum value (typically positive). */
  max: number;
  /** Anchor value the bar grows out from; defaults to 0. */
  center?: number;
  startTick?: string;
  midTick?: string;
  endTick?: string;
  ariaLabel?: string;
  className?: string;
}

export interface AcRangeBarEnumProps {
  variant: 'enum';
  /** Number of pip cells in the track. */
  count: number;
  /** Index of the lit cell (0-based). */
  activeIndex: number;
  /** Optional per-cell `title` text. */
  itemTitles?: ReadonlyArray<string>;
  ariaLabel?: string;
  className?: string;
}

export type AcRangeBarProps =
  | AcRangeBarLinearProps
  | AcRangeBarBipolarProps
  | AcRangeBarEnumProps;

interface RangeBarFillStyle extends CSSProperties {
  '--ac-range-fill'?: string;
  '--ac-range-bar-l'?: string;
  '--ac-range-bar-w'?: string;
}

export function AcRangeBar(props: AcRangeBarProps): JSX.Element {
  if (props.variant === 'enum') {
    return renderEnum(props);
  }
  if (props.variant === 'bipolar') {
    return renderBipolar(props);
  }
  return renderLinear(props);
}

function renderLinear(p: AcRangeBarLinearProps): JSX.Element {
  const min = p.min ?? 0;
  const max = p.max ?? 127;
  const fillPct = pct(p.value, min, max);
  const style: RangeBarFillStyle = { '--ac-range-fill': `${fillPct}%` };
  const className = p.className ? `ac-range-bar ${p.className}` : 'ac-range-bar';
  return (
    <div className={className} role="img" aria-label={p.ariaLabel}>
      {renderTicks(p.startTick, p.midTick, p.endTick)}
      <div className="ac-range-bar__fill" style={style} />
    </div>
  );
}

function renderBipolar(p: AcRangeBarBipolarProps): JSX.Element {
  const center = p.center ?? 0;
  const span = p.max - p.min;
  if (span <= 0) {
    throw new Error(
      `AcRangeBar bipolar requires max > min (got min=${p.min}, max=${p.max})`,
    );
  }
  const centerPct = ((center - p.min) / span) * 100;
  const valPct = ((p.value - p.min) / span) * 100;
  const left = Math.min(centerPct, valPct);
  const width = Math.abs(valPct - centerPct);
  const style: RangeBarFillStyle = {
    '--ac-range-bar-l': `${left}%`,
    '--ac-range-bar-w': `${width}%`,
  };
  const baseClass = 'ac-range-bar ac-range-bar--bipolar';
  const className = p.className ? `${baseClass} ${p.className}` : baseClass;
  return (
    <div className={className} role="img" aria-label={p.ariaLabel}>
      {renderTicks(p.startTick, p.midTick, p.endTick)}
      <div className="ac-range-bar__fill" style={style} />
    </div>
  );
}

function renderEnum(p: AcRangeBarEnumProps): JSX.Element {
  if (p.count < 1) {
    throw new Error(`AcRangeBar enum requires count >= 1 (got ${p.count})`);
  }
  const baseClass = 'ac-range-bar ac-range-bar--enum';
  const className = p.className ? `${baseClass} ${p.className}` : baseClass;
  const pips = [];
  for (let i = 0; i < p.count; i += 1) {
    const active = i === p.activeIndex;
    pips.push(
      <span
        key={i}
        className="ac-range-bar__enum-pip"
        data-active={active ? 'true' : undefined}
        title={p.itemTitles?.[i]}
      />,
    );
  }
  return (
    <div className={className} role="img" aria-label={p.ariaLabel}>
      <div className="ac-range-bar__enum-track" aria-hidden="true">
        {pips}
      </div>
    </div>
  );
}

function renderTicks(
  startTick: string | undefined,
  midTick: string | undefined,
  endTick: string | undefined,
): JSX.Element[] {
  const out: JSX.Element[] = [];
  if (startTick !== undefined) {
    out.push(
      <span key="s" className="ac-range-bar__tick ac-range-bar__tick--start">
        {startTick}
      </span>,
    );
  }
  if (midTick !== undefined) {
    out.push(
      <span key="m" className="ac-range-bar__tick ac-range-bar__tick--mid">
        {midTick}
      </span>,
    );
  }
  if (endTick !== undefined) {
    out.push(
      <span key="e" className="ac-range-bar__tick ac-range-bar__tick--end">
        {endTick}
      </span>,
    );
  }
  return out;
}

function pct(value: number, min: number, max: number): number {
  if (max <= min) {
    throw new Error(
      `AcRangeBar linear requires max > min (got min=${min}, max=${max})`,
    );
  }
  const clamped = Math.min(max, Math.max(min, value));
  return ((clamped - min) / (max - min)) * 100;
}
