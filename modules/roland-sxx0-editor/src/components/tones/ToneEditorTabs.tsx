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
 * Tab ids must match the `id` selectors in `tones.css`:
 *   tt-wave / tt-pitch-lfo / tt-filter / tt-amp
 *
 * The radio inputs are visually hidden but keyboard-reachable.
 * Labels carry `role="tab"` for accessibility tooling.
 */

import type { ReactNode } from 'react';

import { AcRadioTabs, type AcRadioTabDef } from '@/components/common/AcRadioTabs';

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
