/**
 * ToneEditor — radio-driven tab strip.
 *
 * Tabs (post merge): Wave · Pitch & LFO · Filter · Amp. The original
 * mockup's 5-tab layout (Wave · Pitch · Filter · Amp · LFO) was
 * collapsed to 4 by merging Pitch + LFO into one tab — the LFO
 * controls are pitch-modulation territory and live more naturally
 * alongside the pitch tracking flags than as a standalone tab.
 *
 * Per project memory `feedback_tabbed_detail_pane`: parameter
 * editors with 4+ logical sections must use this radio-driven tab
 * shell, and strongly-interacting controls (filter + filter-env;
 * amp + amp-env; pitch + LFO) are grouped in the SAME tab.
 *
 * Tab ids must match the `id` selectors in `_shared.css` (the per-
 * tab-ID active-state selector list; the generic chrome moved to
 * `editor-core/src/design/tab-primitives.css` on 2026-05-24 per
 * akai-harmonization Phase 2 task 2.2):
 *   tt-wave / tt-pitch-lfo / tt-filter / tt-amp
 *
 * The radio inputs are visually hidden (sr-only via CSS clip) but
 * stay in the keyboard tab order. The container exposes
 * `role="radiogroup"` and each radio carries `aria-label={tab.label}`
 * so assistive tech announces the group + its members. The visible
 * `<label>` elements are presentation-only (no `role="tab"`, no
 * `tabIndex={0}`) — they click-forward via `htmlFor`. Updated
 * 2026-05-24 per AUDIT-20260524-11 (closed); the prior shape advertised
 * `role="tablist"` / `role="tab"` / `role="tabpanel"` but did not
 * honor the ARIA tabs contract (no aria-selected, no aria-controls,
 * no Left/Right/Home/End keyboard handler).
 */

import type { ReactNode } from 'react';

import { AcRadioTabs, type AcRadioTabDef } from '@audiocontrol/editor-core';

const TABS: readonly AcRadioTabDef[] = [
  { id: 'tt-wave', label: 'Wave' },
  { id: 'tt-pitch-lfo', label: 'Pitch & LFO' },
  { id: 'tt-filter', label: 'Filter' },
  { id: 'tt-amp', label: 'Amp' },
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
    <AcRadioTabs
      tabs={TABS}
      panels={panels}
      defaultTabId={defaultTabId}
      groupName={groupName}
      ariaLabel="Tone editor sections"
    />
  );
}
