/**
 * AcRadioTabs
 *
 * Radio-driven tab strip primitive used by ToneEditorTabs and
 * PatchEditorTabs. CSS-only activation: hidden radio inputs gate
 * which panel shows via sibling-selector rules in each consumer's
 * page-local CSS (tones.css selects on tt-*, patches.css on pt-*).
 *
 * Extracted 2026-05-22 from PatchEditorTabs.tsx + ToneEditorTabs.tsx
 * per clones.yaml groups 80f494ba63d3 (31 lines) + 5578c63410e2
 * (14 lines). Pre-extraction both files held byte-identical
 * radio-strip + label-strip + panel-section render shapes; the only
 * divergence was the TABS constant + aria-label. Contract pinned by
 * D-PATCH-EDITOR-TABS-01 + D-TONE-EDITOR-TABS-01 wiring assertions
 * added before this extraction.
 *
 * Lives in the per-editor `common/` directory (next to BankHeader,
 * SlotInfo, PatchLabel) rather than editor-core because no
 * non-roland editor consumes it yet. Promotion to editor-core is
 * appropriate the next time another editor adopts a tabbed-panel
 * shell — at that point a separate refactor moves this file out.
 */

import type { ReactNode } from 'react';

export interface AcRadioTabDef {
  id: string;
  label: string;
}

export interface AcRadioTabsProps {
  tabs: readonly AcRadioTabDef[];
  /** Panels keyed by tab id (e.g., `{ 'tt-wave': <WavePanel /> }`). */
  panels: Record<string, ReactNode>;
  /** Default-active tab id. Falls back to `tabs[0].id` if omitted. */
  defaultTabId?: string;
  /** Unique radio-group name — must be unique per parent selection so
   *  toggling between parents doesn't carry tab state across them. */
  groupName: string;
  /** Accessible label for the role="tablist" nav (e.g., "Patch editor
   *  sections"). */
  ariaLabel: string;
}

export function AcRadioTabs({
  tabs,
  panels,
  defaultTabId,
  groupName,
  ariaLabel,
}: AcRadioTabsProps): JSX.Element {
  const activeId = defaultTabId ?? tabs[0]!.id;
  return (
    <div className="ac-tabs">
      {tabs.map((tab) => (
        <input
          key={tab.id}
          type="radio"
          name={groupName}
          id={tab.id}
          defaultChecked={tab.id === activeId}
        />
      ))}

      <nav className="ac-tab-strip" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
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
        {tabs.map((tab) => (
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
