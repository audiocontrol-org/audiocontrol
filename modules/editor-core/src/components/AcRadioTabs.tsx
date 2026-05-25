/**
 * AcRadioTabs
 *
 * Radio-driven tab strip primitive used by editor pages with tabbed
 * detail panes. Two modes:
 *
 *   - UNCONTROLLED (default): hidden radio inputs gate which panel
 *     shows via sibling-selector rules in each consumer's page-local
 *     CSS (roland tones.css selects on `tt-*`; patches.css on `pt-*`).
 *     All panels render in the DOM; CSS hides/shows based on
 *     `:checked`. A consumer adopting this mode MUST register its tab
 *     ids in the per-tab-ID active-state selector list in
 *     `roland-sxx0-editor/src/styles/_shared.css`.
 *
 *   - CONTROLLED (akai VelocityZoneEditor uses this): supply
 *     `activeId` + `onActiveIdChange`. ONLY the active panel renders;
 *     no per-tab-ID CSS registration is needed. Use this when a parent
 *     or sibling component needs read access to the active tab id
 *     (e.g., a VelocityRangeBar above the tabs that highlights the
 *     active zone). The container gets the `ac-tabs--controlled` modifier
 *     class so the single rendered `.ac-panel` is visible (overriding
 *     the default `display: none` that uncontrolled mode relies on).
 *
 * Originally extracted 2026-05-22 from PatchEditorTabs.tsx +
 * ToneEditorTabs.tsx per clones.yaml groups 80f494ba63d3 (31 lines) +
 * 5578c63410e2 (14 lines). Pre-extraction both files held byte-
 * identical radio-strip + label-strip + panel-section render shapes;
 * the only divergence was the TABS constant + aria-label. Contract
 * pinned by D-PATCH-EDITOR-TABS-01 + D-TONE-EDITOR-TABS-01 wiring
 * assertions added before that extraction.
 *
 * Promoted to editor-core 2026-05-24 (Phase 2 task 2.2 of
 * feature/akai-harmonization) so cross-editor consumers (akai's
 * VelocityZoneEditor first; jv1080 / d110 later) can adopt the
 * canonical primitive without duplicating it per-module. The chrome
 * CSS (`.ac-tabs`, `.ac-tab-strip`, `.ac-tab`, `.ac-panels`,
 * `.ac-panel`, `.ac-panel-stack`) moved to
 * `editor-core/src/design/tab-primitives.css` in the same commit.
 *
 * Controlled-mode props (`activeId` + `onActiveIdChange`) added in a
 * follow-on commit (2026-05-24) so akai's sibling-dependent zone-tabs
 * can read the active tab id without per-tab-ID CSS registration.
 * Bypasses the TF-012 per-tab-ID selector list growth concern named in
 * Phase 2 task 2.10 — controlled-mode consumers add ZERO entries to
 * the selector list.
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
  /** Default-active tab id (uncontrolled mode only). Falls back to
   *  `tabs[0].id` if omitted. Ignored when `activeId` is supplied. */
  defaultTabId?: string;
  /** Unique radio-group name — must be unique per parent selection so
   *  toggling between parents doesn't carry tab state across them. */
  groupName: string;
  /** Accessible label for the role="tablist" nav (e.g., "Patch editor
   *  sections"). */
  ariaLabel: string;
  /** Controlled-mode active tab id. When provided, AcRadioTabs renders
   *  ONLY the panel matching `activeId` (instead of all panels) and
   *  selects via React state rather than CSS `:checked`. The radio
   *  inputs still render `checked={tab.id === activeId}` for assistive
   *  tech compatibility, but per-tab-ID CSS selectors in consumer
   *  stylesheets are no longer required. Use this for sibling-
   *  dependent tab strips where a parent / sibling component reads
   *  the active id (e.g., akai VelocityZoneEditor's range-bar above
   *  the zone tabs). */
  activeId?: string;
  /** Controlled-mode change handler. Called with the newly-active tab
   *  id when the user clicks/keys to a different tab. Required when
   *  `activeId` is provided; ignored in uncontrolled mode. */
  onActiveIdChange?: (id: string) => void;
}

export function AcRadioTabs({
  tabs,
  panels,
  defaultTabId,
  groupName,
  ariaLabel,
  activeId,
  onActiveIdChange,
}: AcRadioTabsProps): JSX.Element {
  const isControlled = activeId !== undefined;
  const uncontrolledDefaultId = defaultTabId ?? tabs[0]!.id;
  const containerClass = isControlled ? 'ac-tabs ac-tabs--controlled' : 'ac-tabs';

  return (
    <div className={containerClass}>
      {tabs.map((tab) =>
        isControlled ? (
          <input
            key={tab.id}
            type="radio"
            name={groupName}
            id={tab.id}
            checked={tab.id === activeId}
            onChange={() => onActiveIdChange?.(tab.id)}
          />
        ) : (
          <input
            key={tab.id}
            type="radio"
            name={groupName}
            id={tab.id}
            defaultChecked={tab.id === uncontrolledDefaultId}
          />
        ),
      )}

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
        {(isControlled
          ? tabs.filter((tab) => tab.id === activeId)
          : tabs
        ).map((tab) => (
          <PanelSection key={tab.id} tab={tab}>
            {panels[tab.id]}
          </PanelSection>
        ))}
      </div>
    </div>
  );
}

/** Shared `.ac-panel` <section> for both controlled and uncontrolled
 *  modes. Extracted so the canonical panel shape lives in one place —
 *  prevents the clone-detector flagging the two mode branches as a
 *  copy-paste pair (and prevents one branch drifting from the other
 *  during future edits). */
function PanelSection({
  tab,
  children,
}: {
  tab: AcRadioTabDef;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      className="ac-panel"
      data-tab={tab.id}
      role="tabpanel"
      aria-labelledby={`${tab.id}-label`}
    >
      {children}
    </section>
  );
}
