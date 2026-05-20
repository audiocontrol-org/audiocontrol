import type { CSSProperties, ReactNode } from 'react';

/**
 * BROKEN context: `zero-width-grid`.
 *
 * Wraps `children` inside a `display: grid` container whose only column
 * has `grid-template-columns: 0fr`, collapsing the column (and therefore
 * the children) to zero width. The children still mount in the DOM but
 * paint at 0 px wide, so any pointer hit-tests fall outside their box.
 *
 * Mimics the failure mode where a layout regression collapses an
 * editor's column, leaving the controls present but visually and
 * interactively inaccessible.
 */
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '0fr',
  overflow: 'hidden',
};

export function BrokenZeroWidthGridContext({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div style={gridStyle} data-broken-context="zero-width-grid">
      {children}
    </div>
  );
}
