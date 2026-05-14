import type { CSSProperties, ReactNode } from 'react';

/**
 * BROKEN context: `pointer-events-none-ancestor`.
 *
 * Wraps `children` inside a div with inline `pointer-events: none`.
 * `pointer-events: none` inherits down the subtree, so every descendant
 * (including the production primitive's native `<input>` overlays)
 * refuses pointer events. Keyboard focus via tab may still work.
 *
 * Mimics the failure mode where an unrelated ancestor style — often
 * applied to "disable" a section visually — silently turns off pointer
 * interaction across an entire region of the page.
 */
const wrapperStyle: CSSProperties = {
  pointerEvents: 'none',
};

export function BrokenPointerEventsNoneAncestorContext({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div style={wrapperStyle} data-broken-context="pointer-events-none-ancestor">
      {children}
    </div>
  );
}
