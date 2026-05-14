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

function renderLinearNoPointer(p: AcRangeBarLinearProps): JSX.Element {
  const min = p.min ?? 0;
  const max = p.max ?? 127;
  const step = p.step ?? 1;
  const clamped = Math.min(max, Math.max(min, p.value));
  const fillPct = ((clamped - min) / (max - min)) * 100;
  const fillStyle: RangeBarFillStyle = { '--ac-range-fill': `${fillPct}%` };
  const className = p.className ? `ac-range-bar ${p.className}` : 'ac-range-bar';
  const interactive = p.onChange !== undefined;
  return (
    <div className={className}>
      {p.startTick !== undefined ? (
        <span className="ac-range-bar__tick ac-range-bar__tick--start">{p.startTick}</span>
      ) : null}
      {p.midTick !== undefined ? (
        <span className="ac-range-bar__tick ac-range-bar__tick--mid">{p.midTick}</span>
      ) : null}
      {p.endTick !== undefined ? (
        <span className="ac-range-bar__tick ac-range-bar__tick--end">{p.endTick}</span>
      ) : null}
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
