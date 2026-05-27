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
  /**
   * When true, the meta pip rows are fully inert: every pip carries
   * `tabIndex={-1}` (no keyboard tab-stop), the radiogroup wrappers carry
   * `aria-disabled="true"`, and neither click nor keyboard events fire the
   * change callbacks. The visual `data-disabled-row` attribute lets CSS dim
   * the row. Defensive: this does NOT rely on the caller setting
   * `pointer-events: none`, because that style blocks mouse but not keyboard.
   */
  disabled?: boolean;
}

export function AcEnvelopeMeta(props: AcEnvelopeMetaProps): JSX.Element | null {
  const disabled = props.disabled === true;
  // A row whose onChange callback is undefined is structurally fixed for
  // this envelope (e.g., the Akai S3000XL TVF filter envelope's sustain
  // and end segments are anchored by the device, not user-selectable).
  // Render it as inert chrome would mislead — clicks do nothing, keyboard
  // does nothing. Hide the row entirely instead; if neither is editable,
  // skip the whole meta block. Operator review 2026-05-27: "why don't
  // these buttons work? Are they fake?"
  const showSustain = props.onSustainChange !== undefined;
  const showEnd = props.onEndChange !== undefined;
  if (!showSustain && !showEnd) {
    return null;
  }
  return (
    <div className="ac-envelope-meta" role="group" aria-label="Envelope shape">
      {showSustain ? (
        <PipRow
          rowLabel={'Sustain ▸'}
          ariaLabel="Sustain segment"
          total={props.totalSegments}
          active={props.sustainSegment}
          maxEnabled={props.endSegment}
          onChange={props.onSustainChange}
          disabled={disabled}
        />
      ) : null}
      {showEnd ? (
        <PipRow
          rowLabel={'End ▣'}
          ariaLabel="Envelope length"
          total={props.totalSegments}
          active={props.endSegment}
          maxEnabled={props.totalSegments}
          onChange={props.onEndChange}
          disabled={disabled}
        />
      ) : null}
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
  disabled: boolean;
}

function PipRow(props: PipRowProps): JSX.Element {
  const { total, active, maxEnabled, onChange, disabled: rowDisabled } = props;
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
      if (rowDisabled) {
        return;
      }
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
    [rowDisabled, onChange, maxEnabled, nextEnabled, firstEnabled, lastEnabled, focusPip],
  );

  // Roving tabindex: exactly one enabled pip carries `tabIndex={0}` so
  // keyboard users have a single tab stop per radio group. The chosen pip
  // is the active one if it is enabled; otherwise the first enabled pip.
  const activeIsEnabled = active >= 1 && active <= maxEnabled;
  const tabStop = activeIsEnabled ? active : firstEnabled();

  const pips: JSX.Element[] = [];
  for (let i = 1; i <= total; i += 1) {
    const isActive = i === active;
    const pipDisabled = rowDisabled || i > maxEnabled;
    const handleClick = onChange === undefined || pipDisabled
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
        aria-disabled={pipDisabled ? true : undefined}
        data-active={isActive ? 'true' : undefined}
        data-disabled={pipDisabled ? 'true' : undefined}
        onClick={handleClick}
        onKeyDown={(event): void => handleKeyDown(event, i)}
        tabIndex={!rowDisabled && i === tabStop && i <= maxEnabled ? 0 : -1}
      >
        {i}
      </span>,
    );
  }

  return (
    <div className="ac-envelope-meta__control" data-disabled-row={rowDisabled ? 'true' : undefined}>
      <span className="ac-envelope-meta__label">{props.rowLabel}</span>
      <div
        className="ac-envelope-meta__pips"
        role="radiogroup"
        aria-label={props.ariaLabel}
        aria-disabled={rowDisabled ? true : undefined}
      >
        {pips}
      </div>
    </div>
  );
}
