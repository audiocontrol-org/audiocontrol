/**
 * Shared JSX helpers for AcEnvelope's two variants (multi-segment +
 * adsr). Both variants render identical "monitor" chrome: top/middle/
 * bottom grid lines and an interactive point button with the same
 * pointer-event wiring. Extracted in akai-harmonization Phase 2 task
 * 2.2 (AcEnvelopeAdsr landing) so the variant components don't share
 * inline copies of the chrome the clone-detector would (correctly) flag.
 */
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * The three baseline grid lines (top / middle / bottom) every envelope
 * graph variant renders inside its `<svg viewBox="0 0 100 100">` canvas.
 * Variant-specific guides (segment dividers, active-segment marker)
 * render after this group.
 */
export function EnvelopeGridLines(): JSX.Element {
  return (
    <>
      <line x1="0" y1="0" x2="100" y2="0" className="ac-envelope-grid-line" />
      <line
        x1="0"
        y1="50"
        x2="100"
        y2="50"
        className="ac-envelope-grid-line ac-envelope-grid-line--baseline"
      />
      <line
        x1="0"
        y1="100"
        x2="100"
        y2="100"
        className="ac-envelope-grid-line ac-envelope-grid-line--baseline"
      />
    </>
  );
}

/** Props for an inert anchor point (rendered as a non-interactive span). */
export interface EnvelopeAnchorPointProps {
  readonly xPct: number;
  readonly yPct: number;
  readonly isActive?: boolean;
}

/** Inert anchor marker — used for the origin point and (in the ADSR
 *  variant) the fixed sustain-end point. Reads as decorative to ARIA. */
export function EnvelopeAnchorPoint(props: EnvelopeAnchorPointProps): JSX.Element {
  const className =
    props.isActive === true
      ? 'ac-envelope-point ac-envelope-point--active'
      : 'ac-envelope-point';
  return (
    <span
      className={className}
      style={{ left: `${props.xPct}%`, top: `${props.yPct}%` }}
      aria-hidden="true"
    />
  );
}

/** Props for an interactive drag-point button. */
export interface EnvelopeDragPointProps {
  readonly xPct: number;
  readonly yPct: number;
  readonly isActive: boolean;
  readonly disabled: boolean;
  readonly dragEnabled: boolean;
  readonly ariaLabel: string;
  readonly onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly onPointerMove?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly onPointerUp?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
}

/**
 * Interactive drag-point button. Renders the canonical
 * `.ac-envelope-point` chrome with the canonical pointer-event wiring
 * (pointerdown / pointermove / pointerup / pointercancel) the multi-
 * segment + adsr variants both consume.
 *
 * Disabled gate: when `disabled === true`, the button carries the HTML
 * `disabled` attribute (browser drops from tab order, blocks click +
 * keyboard activation) and the pointer-down handler becomes inert.
 * Pointer-move / pointer-up only wire when `dragEnabled === true`.
 */
export function EnvelopeDragPoint(props: EnvelopeDragPointProps): JSX.Element {
  const className = props.isActive
    ? 'ac-envelope-point ac-envelope-point--active'
    : 'ac-envelope-point';
  return (
    <button
      type="button"
      className={className}
      style={{ left: `${props.xPct}%`, top: `${props.yPct}%` }}
      onPointerDown={props.disabled ? undefined : props.onPointerDown}
      onPointerMove={
        props.dragEnabled && !props.disabled ? props.onPointerMove : undefined
      }
      onPointerUp={
        props.dragEnabled && !props.disabled ? props.onPointerUp : undefined
      }
      onPointerCancel={
        props.dragEnabled && !props.disabled ? props.onPointerUp : undefined
      }
      aria-label={props.ariaLabel}
      aria-pressed={props.isActive}
      disabled={props.disabled}
    />
  );
}
