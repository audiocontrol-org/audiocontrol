import type { CSSProperties, ReactNode } from 'react';

/**
 * BROKEN context: `sticky-overlay`.
 *
 * Wraps `children` and ALSO renders an absolutely-positioned `<div>`
 * covering the same area with `pointer-events: auto` and a high
 * z-index. The overlay sits on top of the children and intercepts every
 * pointer event, even though the underlying primitive is fully
 * functional.
 *
 * Mimics the PlayPage sticky-header occlusion bug (#423) — the page's
 * controls were intact, but a sticky element above them swallowed the
 * clicks before they reached the controls.
 */
const wrapperStyle: CSSProperties = {
  position: 'relative',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'auto',
  zIndex: 9999,
  background: 'transparent',
};

export function BrokenStickyOverlayContext({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div style={wrapperStyle}>
      {children}
      <div
        style={overlayStyle}
        aria-hidden="true"
        data-broken-context="sticky-overlay"
      />
    </div>
  );
}
