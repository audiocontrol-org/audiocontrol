/**
 * PatchEditor — radio-driven tab strip.
 *
 * Tabs: Common · Mapping. Mirrors `ToneEditorTabs` (same radio-driven,
 * CSS-only activation pattern). The tabbed shell keeps the patch
 * common parameters visible without forcing the operator to scroll
 * past them to reach the tone-mapping zone editor.
 *
 * Chrome lives in `.ac-tabs*` / `.ac-tab-strip` / `.ac-tab` / `.ac-panels`
 * / `.ac-panel` in `_shared.css`. Active-state rules (which radio IDs
 * light up which tab + panel) are page-local in `patches.css`.
 *
 * Tab ids must match the `id` selectors in `patches.css`:
 *   pt-common / pt-mapping
 */

import type { ReactNode } from 'react';

interface TabDef {
  id: string;
  label: string;
}

const TABS: readonly TabDef[] = [
  { id: 'pt-common', label: 'Common' },
  { id: 'pt-mapping', label: 'Mapping' },
] as const;

interface PatchEditorTabsProps {
  /** The panels keyed by tab id (e.g., `{ 'pt-common': <Common /> }`). */
  panels: Record<string, ReactNode>;
  /** Default-active tab id. Defaults to `pt-common`. */
  defaultTabId?: string;
  /** Unique radio-group name — must be unique per patch selection so
   *  toggling between patches doesn't carry tab state across them. */
  groupName: string;
}

export function PatchEditorTabs({
  panels,
  defaultTabId = 'pt-common',
  groupName,
}: PatchEditorTabsProps) {
  return (
    <div className="ac-tabs">
      {TABS.map((tab) => (
        <input
          key={tab.id}
          type="radio"
          name={groupName}
          id={tab.id}
          defaultChecked={tab.id === defaultTabId}
        />
      ))}

      <nav className="ac-tab-strip" role="tablist" aria-label="Patch editor sections">
        {TABS.map((tab) => (
          <label
            key={tab.id}
            htmlFor={tab.id}
            id={`${tab.id}-label`}
            className="ac-tab"
            role="tab"
            tabIndex={0}
          >
            {tab.label}
          </label>
        ))}
      </nav>

      <div className="ac-panels">
        {TABS.map((tab) => (
          <section
            key={tab.id}
            className="ac-panel"
            data-tab={tab.id}
            role="tabpanel"
            aria-labelledby={`${tab.id}-label`}
          >
            {panels[tab.id]}
          </section>
        ))}
      </div>
    </div>
  );
}
