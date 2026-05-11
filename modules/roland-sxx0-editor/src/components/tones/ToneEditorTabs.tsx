/**
 * ToneEditor — radio-driven tab strip (Phase 9 Task 4 polish).
 *
 * The mockup's 5-tab pattern (Wave · Pitch · Filter · Amp · LFO)
 * uses CSS-only radio inputs + `:checked ~ siblings` so no React
 * state is needed for tab activation. This component renders the
 * radio inputs + the tab labels; the panels live in `ToneEditor`
 * and are revealed by the `:checked` rule in `tones.css`.
 *
 * Per project memory `feedback_tabbed_detail_pane`: parameter
 * editors with 4+ logical sections must use this radio-driven tab
 * shell, and strongly-interacting controls (filter + filter-env;
 * amp + amp-env) are grouped in the SAME tab.
 *
 * Tab ids must match the `id` selectors in `tones.css`:
 *   tt-wave / tt-pitch / tt-filter / tt-amp / tt-lfo
 *
 * The radio inputs are visually hidden but keyboard-reachable.
 * Labels carry `role="tab"` for accessibility tooling.
 */

import type { ReactNode } from 'react';

interface TabDef {
  id: string;
  label: string;
}

const TABS: readonly TabDef[] = [
  { id: 'tt-wave', label: 'Wave' },
  { id: 'tt-pitch', label: 'Pitch' },
  { id: 'tt-filter', label: 'Filter' },
  { id: 'tt-amp', label: 'Amp' },
  { id: 'tt-lfo', label: 'LFO' },
] as const;

interface ToneEditorTabsProps {
  /** The panels keyed by tab id (e.g., `{ 'tt-wave': <WavePanel /> }`). */
  panels: Record<string, ReactNode>;
  /** Default-active tab id. Defaults to `tt-wave`. */
  defaultTabId?: string;
  /** Unique radio-group name — must be unique per tone selection so
   *  toggling between tones doesn't carry tab state across them. */
  groupName: string;
}

export function ToneEditorTabs({
  panels,
  defaultTabId = 'tt-wave',
  groupName,
}: ToneEditorTabsProps) {
  return (
    <div className="tones__tabs">
      {TABS.map((tab) => (
        <input
          key={tab.id}
          type="radio"
          name={groupName}
          id={tab.id}
          defaultChecked={tab.id === defaultTabId}
        />
      ))}

      <nav className="tones__tab-strip" role="tablist" aria-label="Tone editor sections">
        {TABS.map((tab) => (
          <label
            key={tab.id}
            htmlFor={tab.id}
            id={`${tab.id}-label`}
            className="tones__tab"
            role="tab"
            tabIndex={0}
          >
            {tab.label}
          </label>
        ))}
      </nav>

      <div className="tones__panels">
        {TABS.map((tab) => (
          <section
            key={tab.id}
            className="tones__panel"
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
