import type { ChangeEvent, CSSProperties } from 'react';
import type {
  AcRangeBarLinearProps,
  AcRangeBarProps,
} from '@/components/AcRangeBar';
import { AcRangeBar } from '@/components/AcRangeBar';

/**
 * BROKEN variant: `no-pointer-events`.
 *
 * Renders the bar AND the overlay `<input type="range">` correctly, but
 * applies inline `pointer-events: none` to the input. Pointer drag and
 * click-to-set fail silently; keyboard focus may still work via tab.
 *
 * Only the `linear` variant is rewritten; `bipolar` / `enum` pass through
 * to the production primitive.
 */
interface RangeBarFillStyle extends CSSProperties {
  '--ac-range-fill'?: string;
}

export function AcRangeBarBrokenNoPointerEvents(props: AcRangeBarProps): JSX.Element {
  if (props.variant === 'bipolar') {
    return <AcRangeBar {...props} />;
  }
  if (props.variant === 'enum') {
    return <AcRangeBar {...props} />;
  }
  return renderLinearNoPointer(props);
}

/**
 * Linear render path here MUST stay paint-equivalent to AcRangeBar.tsx's
 * linear render path; only the input's `pointer-events: none` differs.
 * If production's linear render changes, update this in lockstep.
 *
 * The helpers `rootAriaProps`, `renderTicks`, and `pct` are NOT exported
 * from production AcRangeBar, so their logic is inlined below. Any
 * change to those helpers in production must be mirrored here.
 */
function renderLinearNoPointer(p: AcRangeBarLinearProps): JSX.Element {
  const min = p.min ?? 0;
  const max = p.max ?? 127;
  const step = p.step ?? 1;
  const fillPct = pct(p.value, min, max);
  const fillStyle: RangeBarFillStyle = { '--ac-range-fill': `${fillPct}%` };
  const className = p.className ? `ac-range-bar ${p.className}` : 'ac-range-bar';
  const interactive = p.onChange !== undefined;
  return (
    <div className={className} {...rootAriaProps(p.ariaLabel, interactive)}>
      {renderTicks(p.startTick, p.midTick, p.endTick)}
      <div className="ac-range-bar__fill" style={fillStyle} />
      {interactive ? (
        <input
          className="ac-range-bar__input"
          type="range"
          min={min}
          max={max}
          step={step}
          value={p.value}
          disabled={p.disabled}
          aria-label={p.ariaLabel}
          style={{ pointerEvents: 'none' }}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            p.onChange?.(Number(e.target.value))
          }
        />
      ) : null}
    </div>
  );
}

// Mirror of AcRangeBar.tsx's `rootAriaProps` (kept in lockstep — see file JSDoc).
function rootAriaProps(
  ariaLabel: string | undefined,
  interactive: boolean,
): { role?: string; 'aria-label'?: string } {
  if (interactive) {
    return {};
  }
  return { role: 'img', 'aria-label': ariaLabel };
}

// Mirror of AcRangeBar.tsx's `renderTicks` (kept in lockstep — see file JSDoc).
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

// Mirror of AcRangeBar.tsx's `pct` (kept in lockstep — see file JSDoc).
function pct(value: number, min: number, max: number): number {
  if (max <= min) {
    throw new Error(
      `AcRangeBar linear requires max > min (got min=${min}, max=${max})`,
    );
  }
  const clamped = Math.min(max, Math.max(min, value));
  return ((clamped - min) / (max - min)) * 100;
}
