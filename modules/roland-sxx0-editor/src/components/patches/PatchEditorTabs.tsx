/**
 * PatchEditor — radio-driven tab strip.
 *
 * Tabs: Common · Mapping. Mirrors `ToneEditorTabs` (same radio-driven,
 * CSS-only activation pattern). The tabbed shell keeps the patch
 * common parameters visible without forcing the operator to scroll
 * past them to reach the tone-mapping zone editor.
 *
 * Chrome lives in `.ac-tabs*` / `.ac-tab-strip` / `.ac-tab` / `.ac-panels`
 * / `.ac-panel` in `editor-core/src/design/tab-primitives.css` (promoted
 * from `_shared.css` 2026-05-24 per akai-harmonization Phase 2 task 2.2).
 * Active-state rules (which radio IDs light up which tab + panel) stay
 * in roland's `_shared.css` since the radio-input ids are consumer-owned.
 *
 * Tab ids must match the `id` selectors in `patches.css`:
 *   pt-common / pt-mapping
 */

import type { ReactNode } from 'react';

import { AcRadioTabs, type AcRadioTabDef } from '@audiocontrol/editor-core';

const TABS: readonly AcRadioTabDef[] = [
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
    <AcRadioTabs
      tabs={TABS}
      panels={panels}
      defaultTabId={defaultTabId}
      groupName={groupName}
      ariaLabel="Patch editor sections"
    />
  );
}
