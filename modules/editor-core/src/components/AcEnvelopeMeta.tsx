import { useCallback, useRef, type KeyboardEvent } from 'react';

/**
 * `<AcEnvelopeMeta>` — sustain + end segment pip rows for `<AcEnvelope>`.
 *
 * Two 8-pip radio groups laid out side-by-side. The sustain row is bounded
 * by `endSegment` (later pips disabled); the end row is bounded by
 * `totalSegments` (all pips enabled).
 *
 * Each row is a WAI-ARIA radio group: Space / Enter activates the focused
 * pip; ArrowRight / ArrowDown / ArrowLeft / ArrowUp navigates between
 * enabled pips with wrap-around; Home / End jump to the first / last
 * enabled pip. Disabled pips are skipped during arrow navigation.
 *
 * Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1882-1945 (CSS),
 *   :2707-2735 (demo HTML for the sustain + end radio rows).
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
      <PipRow
        rowLabel={'Sustain ▸'}
        ariaLabel="Sustain segment"
        total={props.totalSegments}
        active={props.sustainSegment}
        maxEnabled={props.endSegment}
        onChange={props.onSustainChange}
      />
      <PipRow
        rowLabel={'End ▣'}
        ariaLabel="Envelope length"
        total={props.totalSegments}
        active={props.endSegment}
        maxEnabled={props.totalSegments}
        onChange={props.onEndChange}
      />
    </div>
  );
}

interface PipRowProps {
  rowLabel: string;
  ariaLabel: string;
  total: number;
  active: number;
  maxEnabled: number;
  onChange: ((index: number) => void) | undefined;
}

function PipRow(props: PipRowProps): JSX.Element {
  const { total, active, maxEnabled, onChange } = props;
  const pipRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const firstEnabled = useCallback((): number => {
    for (let i = 1; i <= total; i += 1) {
      if (i <= maxEnabled) {
        return i;
      }
    }
    return 1;
  }, [total, maxEnabled]);

  const lastEnabled = useCallback((): number => {
    for (let i = total; i >= 1; i -= 1) {
      if (i <= maxEnabled) {
        return i;
      }
    }
    return 1;
  }, [total, maxEnabled]);

  const nextEnabled = useCallback(
    (from: number, direction: 1 | -1): number => {
      // Walk enabled pips with wrap-around. Bounded at `total` steps to
      // guarantee termination even if `maxEnabled` is unusually small.
      let candidate = from;
      for (let step = 0; step < total; step += 1) {
        candidate += direction;
        if (candidate < 1) {
          candidate = total;
        } else if (candidate > total) {
          candidate = 1;
        }
        if (candidate <= maxEnabled) {
          return candidate;
        }
      }
      return from;
    },
    [total, maxEnabled],
  );

  const focusPip = useCallback((index: number): void => {
    const el = pipRefs.current[index - 1];
    if (el !== null && el !== undefined) {
      el.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>, index: number): void => {
      if (onChange === undefined) {
        return;
      }
      const disabled = index > maxEnabled;
      switch (event.key) {
        case ' ':
        case 'Enter': {
          if (disabled) {
            return;
          }
          event.preventDefault();
          onChange(index);
          return;
        }
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault();
          const target = nextEnabled(index, 1);
          onChange(target);
          focusPip(target);
          return;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault();
          const target = nextEnabled(index, -1);
          onChange(target);
          focusPip(target);
          return;
        }
        case 'Home': {
          event.preventDefault();
          const target = firstEnabled();
          onChange(target);
          focusPip(target);
          return;
        }
        case 'End': {
          event.preventDefault();
          const target = lastEnabled();
          onChange(target);
          focusPip(target);
          return;
        }
        default:
          return;
      }
    },
    [onChange, maxEnabled, nextEnabled, firstEnabled, lastEnabled, focusPip],
  );

  // Roving tabindex: exactly one enabled pip carries `tabIndex={0}` so
  // keyboard users have a single tab stop per radio group. The chosen pip
  // is the active one if it is enabled; otherwise the first enabled pip.
  const activeIsEnabled = active >= 1 && active <= maxEnabled;
  const tabStop = activeIsEnabled ? active : firstEnabled();

  const pips: JSX.Element[] = [];
  for (let i = 1; i <= total; i += 1) {
    const isActive = i === active;
    const disabled = i > maxEnabled;
    const handleClick = onChange === undefined || disabled
      ? undefined
      : (): void => onChange(i);
    pips.push(
      <span
        key={i}
        ref={(el): void => {
          pipRefs.current[i - 1] = el;
        }}
        className="ac-envelope-meta__pip"
        role="radio"
        aria-checked={isActive}
        aria-disabled={disabled ? true : undefined}
        data-active={isActive ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
        onClick={handleClick}
        onKeyDown={(event): void => handleKeyDown(event, i)}
        tabIndex={i === tabStop && !disabled ? 0 : -1}
      >
        {i}
      </span>,
    );
  }

  return (
    <div className="ac-envelope-meta__control">
      <span className="ac-envelope-meta__label">{props.rowLabel}</span>
      <div
        className="ac-envelope-meta__pips"
        role="radiogroup"
        aria-label={props.ariaLabel}
      >
        {pips}
      </div>
    </div>
  );
}
