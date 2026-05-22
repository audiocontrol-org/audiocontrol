/**
 * AcChevron — the ONLY disclosure-chevron primitive in the editor.
 *
 * Every collapse / expand affordance MUST render this component. The
 * component owns the glyph (▾ / ▸), the 1.1rem square box, the accent
 * color, and the transition. None of those are exposed as props — the
 * abstraction is intentionally fully closed so consumers cannot accept
 * a per-context size or color.
 *
 * Background — why this exists as a component rather than a CSS class:
 *
 *   Prior architecture had four hand-coded CSS classes
 *   (`.ac-list-bank-chevron`, `.ac-tree-chevron`, `.ac-tree-chevron-btn`,
 *   `.ac-device-memory-section-eyebrow-chevron`) that "agreed" by
 *   convention. One drifted to `1rem` without anyone noticing — caught
 *   by the operator on 2026-05-21. The pre-commit chevron-sizing gate
 *   allow-listed the classes by name, so an allow-listed class could
 *   silently drift on a future edit without tripping the gate.
 *
 *   Replacing those four classes with this one component closes the
 *   pathology structurally: there's no class name to redeclare, no
 *   sizing prop to override, and the gate now fails on any CSS file
 *   that contains the literal word "chevron" outside this file's
 *   companion stylesheet. Agents cannot ship a divergent chevron
 *   without consciously editing AcChevron.tsx + its sole CSS rule.
 */

import React from 'react';

export interface AcChevronProps {
  /** Whether the disclosure is expanded (true → ▾) or collapsed (false → ▸). */
  expanded?: boolean;
}

export function AcChevron({ expanded }: AcChevronProps): JSX.Element {
  return (
    <span className="ac-chevron" data-expanded={expanded ? 'true' : 'false'} aria-hidden="true">
      {expanded ? '▾' : '▸'}
    </span>
  );
}
