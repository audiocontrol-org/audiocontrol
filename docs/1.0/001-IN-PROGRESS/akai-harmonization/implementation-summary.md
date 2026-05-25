# Akai Harmonization — Implementation Summary

**Status:** Feature complete (pending operator close-out / directory move).
**Branch:** `feature/akai-harmonization`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-akai-harmonization`
**Parent issue:** [#457](https://github.com/audiocontrol-org/audiocontrol/issues/457)

---

## Summary

The akai-harmonization feature established the cross-editor design-language contract for
`akai-s3k-editor` and `roland-sxx0-editor`, migrated the akai surface onto canonical
`editor-core` primitives wherever the spec said `adopt-roland-pattern`, extracted new
canonical primitives wherever the spec said `adopt-akai-pattern` or surfaced a
build-from-scratch primitive, and then ran the scope-discovery tooling (clones, adopter
manifests, anti-patterns, editor-symmetry matrix) over the harmonized akai surface so
the post-harmonization state is locked in by mechanical gates.

The feature is structured as four streams running on one branch:

- **Phase 0** — Rolling Bug-Fix Pass. One bug surfaced + fixed (BUG-EC-001, editor-core
  test contract drift).
- **Phase 1** — Design-language audit. Produced
  [`harmonization-spec.md`](./harmonization-spec.md) plus four HTML mockups under
  [`mockups/`](./mockups/) covering programs / keygroups / samples / library at the
  s3000xl dialect.
- **Phase 2** — Harmonization implementation. 10 task groups, every primitive in
  the spec either landed canonically or was amended out-of-scope per operator
  directive (virtual front panel only).
- **Phase 3** — Scope-discovery on the harmonized akai surface. All 49 pending
  akai-touching clones dispositioned; adopter manifests + anti-patterns clean;
  editor-symmetry matrix updated.

A 25-finding audit log (every finding closed + verified) ran alongside the
implementation phases. The audit cycles surfaced a recurring failure mode —
integration-layer regressions after primitive-extraction dispatches — that this
feature encoded as
[`primitive-extraction-checklist.md`](../../../../.claude/rules/primitive-extraction-checklist.md)
(local defensive countermeasure pending the deskwork canonical implementation).

---

## Section 1: Outcomes by the numbers

### Commits

- **128 commits** on `feature/akai-harmonization` since the merge-base with
  `origin/main` (verified via `git log origin/main..HEAD --oneline | wc -l`).
- 126 non-merge commits; 2 merge commits from pulling main mid-feature.
- The feature opened with `7a21093d` (PRD + workplan + README + implementation-summary
  placeholder) and substantively closes with this implementation-summary doc.

### Primitives promoted to `editor-core`

Phase 2 task 2.2 landed every primitive in
[`harmonization-spec.md` § 5.1 + § 5.2](./harmonization-spec.md):

| Primitive | File | Introducing commit(s) | Disposition |
|---|---|---|---|
| `PageTitleRow` (+ `AcReloadIcon`) | `modules/editor-core/src/components/PageTitleRow.tsx` | `8632dbb4` | promoted from roland-local; adopted across 4 akai pages + roland surfaces |
| Akai dialect tokens (`:root[data-editor='s3000xl']`) | `modules/editor-core/src/design/tokens.css` | `d5d99516` + `b7b833e0` (AUDIT-02 fix added 6 `--ac-action-*` overrides) | new dialect block |
| `AcRadioTabs` (extracted + extended) | `modules/editor-core/src/components/AcRadioTabs.tsx` + `modules/editor-core/src/design/tab-primitives.css` | `a444acd5` (promote) + `b5d30089` (controlled-mode) + `8545e839` (AUDIT-10/11 class-namespace + ARIA fix) | promoted from roland-local |
| `AcZoneStrip` | `modules/editor-core/src/components/AcZoneStrip.tsx` + `modules/editor-core/src/design/zone-strip-primitives.css` | `03f36ce3` + `e23de8b3` (HandleA11yOverride extension) + `de95eb82` (AUDIT-12/13 source-index + ARIA fix) | extracted from roland's `.ac-zone-*` family |
| `AcEnvelope` extended with `kind: 'adsr'` + nullable `activeSegment` | `modules/editor-core/src/components/AcEnvelope.tsx` (+ `AcEnvelopeAdsr.tsx`) | `d524da07` + `d39b150a` (AUDIT-15 `activeSegment: number \| null`) | API extension; discriminated-union variant |
| `AcFrequencyResponse` | `modules/editor-core/src/components/AcFrequencyResponse.tsx` + `modules/editor-core/src/design/frequency-response-primitives.css` | `b83318d3` | extracted from akai `FilterDisplay` |
| `AcLiveStatusFooter` | `modules/editor-core/src/components/AcLiveStatusFooter.tsx` + `modules/editor-core/src/design/live-status-footer-primitives.css` | `1e6e40ad` + `f2f3e1e0` (AUDIT-16 split-announcement contract) | build-from-scratch |
| `.ac-page-shell--fixed-viewport` mobile escape hatch | `modules/editor-core/src/design/layout-primitives.css` | `a078fc0b` (AUDIT-20260523-03 closure) | extended canonical rule |
| `.ac-tree-disclosure-btn` 24×24 hit area + button semantics | `modules/editor-core/src/design/library.css` + `modules/editor-core/src/components/library/TreeView.tsx` | `a078fc0b` (AUDIT-01 closure) + `68799ed9` (AUDIT-20260524-01 `tabIndex={-1}`) | a11y fix |

8 fully promoted primitives + the dialect-token + 2 canonical extensions to existing
primitives = 11 substantive editor-core surfaces landed during the feature.

### Adopter manifests

`docs/scope-discovery/adopter-manifests.yaml`:

- **14 manifests registered** (verified via `make check-adopters`: "0 holdouts across
  14 manifests; 9 tracked holdouts reported separately").
- **6 manifests are new this feature**:
  `ac-control-primitives-row`, `ac-zone-strip`, `slide-drawer-library-dialogs`,
  `ac-envelope`, `ac-frequency-response`, `ac-live-status-footer`.
- **2 manifests extended** (multi-path `from:` and/or expanded
  `expected_adopters_glob` to admit akai): `page-title-row`, `ac-radio-tabs`.
- **6 roland-only manifests surveyed during task 2.3**: 2 left roland-only with
  NO-USE-CASE annotation (`bank-header`, `destination-eyebrow`); 4 registered as
  `tracked_holdouts:` for cross-editor harmonization (`use-export-dialog-lifecycle`,
  `slot-info`, `library-device-memory-panel-adapter`, `library-preview-panel-adapter`).

### Anti-pattern entries

`docs/scope-discovery/anti-patterns.yaml`:

- **18 entries registered** (verified via `make check-anti-patterns`: "18 entries
  scanned across 1376 files; 0 findings").
- **6 entries are new this feature** (the spec § 6 list): `s3k-zone-tabs-inline`,
  `s3k-envelope-display-inline`, `s3k-param-input-inline`, `s3k-param-select-inline`,
  `s3k-param-toggle-inline`, `tailwind-link-chrome-inline`,
  `tailwind-button-chrome-inline`, `ac-page-sticky-header-inline`. (8 ids total —
  the spec's "6 anti-patterns" count grouped the 3 `s3k-param-*` items as one.)
- Adversarial-scenario corpus grew from 35 → 59 paired scenarios across the new
  scenario files.

### Clones drained

`make clone-summary SURFACE='modules/akai-s3k-editor/**'`:

- **Total**: 450 (akai-touching baseline).
- **Pending touching**: 0 (was 49 at task 3.1 start).
- **Pending intra**: 0 (was 48 at task 3.1 start).
- **Dispositioned touching**: 68 (was 19 at task 3.1 start; +49 from task 3.2).
- Task 3.2 dispositioned every pending akai-touching clone as `keep-with-reason` via 7
  batched `batch-dispose.ts` calls grouped by category (library-dialog scaffolding 14,
  roster-list parallelism 9, test-harness 3, page-level wiring 3, intra-file
  repetition 10, library helpers 8, hook + cross-editor 2). 0 marked `refactor`;
  task 3.3 was therefore closed-by-definition (no `Closes clones.yaml <id>` commits
  required).
- 12 refactor CANDIDATES surfaced for future operator scheduling (5 small + clean,
  7 substantial) — cited in `dd7b985e` commit body. See Section 7.

### Audit findings

`grep -c "^Finding-ID:" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`:

- **25 findings**, all closed + verified.
  - AUDIT-20260523-01 / -02 / -03 — Phase 1 mockup audit (canonical chrome a11y +
    fixed-viewport mobile escape hatch).
  - AUDIT-20260524-01 through -15 (skipping 06+07 re-closed into -05; -10+-11 as
    one cycle; etc.).
  - AUDIT-20260525-16 through -22.
- Every finding closure carries a `verified-<sha>` status with a paired
  validator-paired-changes hard test demonstrating the regression-detection
  assertions have teeth.

### Tests added / preserved

| Suite | Pre-feature | Post-feature | Delta | Notes |
|---|---|---|---|---|
| `editor-core` unit | 384 (7 failing) | 393 | +9 | BUG-EC-001 closure fixed 7 stale tests + AUDIT-21/-22 added 2 paired tests |
| `editor-core` UI harness | (none) | 30 | +30 | New `keyboard-navigation.spec.tsx` (task 2.7); wired into default test path (AUDIT-22 fix) |
| `akai-s3k-editor` | 200 | 234 | +34 | New `page-shell-contract.spec.ts` (43 viewport/route combinations), new `SamplesPage.test.tsx` (AUDIT-17 wiring), expanded `ProgramsPage.test.tsx` (AUDIT-17 + -18), `akai-filter-adapter.test.ts` (24 tests AUDIT-14), VelocityRangeBar source-index tests (AUDIT-12) |
| `roland-sxx0-editor` | (baseline) | unchanged | 0 | 7 wiring/rendering specs updated for the `AcRadioTabs` ARIA contract change (AUDIT-11) — count unchanged |
| Scope-discovery validators | 35 | 59 | +24 | Anti-pattern scenarios per spec § 6 + 2 new gate scenario files (tab-active-state, editor-core-css-exports) |

### Pre-commit / build gates added

- **`check-editor-core-css-exports`** (task 2.9, commit `c0207f99`) — fails commit if a
  `modules/editor-core/src/design/*.css` file lacks a matching `package.json` `exports:`
  entry, or if an existing exports entry points to a missing file. 5 paired scenarios +
  gutted-stub.
- **`check-tab-active-state`** (task 2.10 Gate A, commit `8e9163cd`) — re-runs the
  codegen in `--check` mode; rejects the commit if the on-disk
  `tab-active-state.css` differs from a fresh regeneration from
  `docs/scope-discovery/tab-groups.yaml`.
- **`check-tab-active-state-sources`** (task 2.10 Gate B, commit `8e9163cd`) — scans
  tab-consumer surface (`modules/**/*.{tsx,ts,html}`) for `id: '<prefix>-<rest>'`
  references whose prefix matches a registered family id; fails if any scanned id is
  not in the registry.
- **AcRadioTabs `imports:` filter** (cross-editor harmonization) — narrows the
  adopter-manifest match to consumers actually importing `AcRadioTabs` rather than
  any other symbol from `@audiocontrol/editor-core`.
- **`check-disposition-survivor`** (TF-013 closure, PR #463 — adjacent but not in this
  feature's commit set; documented here as it landed mid-feature and changed the
  workflow). Prevents clone-detector regen from silently wiping operator-curated
  dispositions.

### Tooling-feedback (TF) entries

- **10 TFs filed** across the feature; **7 closed**.
  - PR #462 (2026-05-24) closed TF-001 through TF-006 + TF-010 — primitive-relocation
    awareness, paste-ready batch-dispose hint, pre-commit consolidation, PRD-scoped
    module pruning, synthesizer References skeleton, check-adopters summary line.
  - PR #463 (2026-05-24 evening) closed TF-013 — disposition-survivor gate.
- **3 open**:
  - **TF-014** (low) — `batch-dispose.ts` refresh-baseline workflow gap.
  - **TF-015** (low) — anti-pattern regex prefix-matching trap (sibling-class negatives).
  - **TF-016** (canonical pending deskwork) — primitive-extraction dispatch hygiene gap;
    local defensive countermeasure is
    [`.claude/rules/primitive-extraction-checklist.md`](../../../../.claude/rules/primitive-extraction-checklist.md)
    until the deskwork canonical ships.

---

## Section 2: Primitives promoted (the cross-editor canonical surface)

The substantive editor-core primitive surface that future editors (jv1080, d110, etc.)
will adopt. Each entry names the canonical file, the API surface, and the akai adopter
(or akai contribution to the canonical's design).

### PageTitleRow

- **File**: `modules/editor-core/src/components/PageTitleRow.tsx`
- **Introducing commit**: `8632dbb4` (Phase 2 task 2.2)
- **API**: `{ title: string; metricStatus?: string; loadingProgress?: number;
  reloadIcon?: ReactNode; ... }` — also renders a `.ac-page-title-metric-status`
  `role="status"` + `aria-live="polite"` span and an optional
  `.ac-page-title-progress-fill` bar.
- **Akai adopters**: 4 pages — `ProgramsPage`, `KeygroupsPage`, `SamplesPage`,
  `LibraryPage`. Roland canonical-side: `PatchesPage`, `TonesPage`, `LibraryPage`.
- **Akai-driven change**: none (akai adopted the roland canonical verbatim).
- **Test contract**: `PageTitleRow.tsx:134-166` renders the loading message via
  `.ac-page-title-metric-status` (separate channel from `AcLiveStatusFooter`
  announcements — see AUDIT-18 closure).

### AcRadioTabs (controlled-mode extension)

- **File**: `modules/editor-core/src/components/AcRadioTabs.tsx` +
  `modules/editor-core/src/design/tab-primitives.css`
- **Introducing commits**: `a444acd5` (promote from roland), `b5d30089` (controlled-mode
  extension), `8545e839` (AUDIT-10/11 class-namespace + ARIA fix)
- **API**: `{ ariaLabel: string; groupName: string; tabs: { id: string; label: string;
  panel: ReactNode }[]; activeId?: string; onActiveIdChange?: (id: string) => void;
  defaultActiveId?: string }`. Two modes: uncontrolled (CSS `:checked` sibling
  selectors drive panel visibility); controlled (React state + `.ac-tabs--controlled
  .ac-panel { display: block }` rule for sibling-dependent tab strips).
- **Akai adopter**: `VelocityZoneEditor.tsx` (controlled mode — selected zone drives
  sibling-dependent UI). Roland canonical-side: `PatchEditorTabs`, `ToneEditorTabs`.
- **Akai-driven change**: the controlled-mode extension was added specifically because
  the akai velocity-zone editor needs the tab state observable from sibling
  components. ARIA contract (AUDIT-11): container is `role="radiogroup"` +
  `aria-label`; visible labels are decorative-only and click-forward to the radios via
  `htmlFor`; native browser keyboard semantics own the tab order. Class namespace
  (AUDIT-10): `.ac-radio-*` to keep distinct from the legacy `.ac-tabs` / `.ac-tab`
  button-tab system used by `LibraryPanel` + `BuildInfo`.
- **Tab-active-state codegen** (task 2.10): the per-tab-ID `:checked` CSS selector
  chains live in a YAML registry (`docs/scope-discovery/tab-groups.yaml`); codegen
  emits `tab-active-state.css`; the gate prevents silent drop of any tab id from any
  of the four coupled selector lists.

### AcZoneStrip (build-from-extraction)

- **File**: `modules/editor-core/src/components/AcZoneStrip.tsx` +
  `modules/editor-core/src/design/zone-strip-primitives.css`
- **Introducing commits**: `03f36ce3` (extract), `e23de8b3` (HandleA11yOverride
  extension for `role="slider"` per-edge handles), `de95eb82` (AUDIT-12/13 fix)
- **API**: `{ zones: AcZoneStripZone[]; selectedIndex?: number; splitHandles?:
  boolean; onSelect?: (index: number) => void; onStartDrag?: (handle:
  AcZoneStripDragHandle, splitIndex: number) => void; handleA11yOverride?:
  HandleA11yOverride }`. Two operating modes: per-edge handles (each handle is its
  own `role="slider"`, with `aria-valuemin`/`max`/`now`); split handles (one handle
  between adjacent zones, drag drives the split point).
- **Akai adopters**: `VelocityRangeBar` (split-handles mode + akai hue-token palette),
  `KeyRangeEditor` (per-edge mode with `HandleA11yOverride` for the Low note / High
  note `role="slider"` promotion). Roland canonical-side: `ToneZoneEditor`.
- **Akai-driven change**: the `HandleA11yOverride` extension was added because the akai
  key-range editor needs to expose the Low/High note handles as
  `role="slider"` (the akai-specific `aria-valuemin`/`max`/`now` contract). Also drove
  the AUDIT-12 source-index preservation fix: the consumer wrapper rebuilds
  `{ sourceIndex, zone }` pairs through compaction so `onSelect` / `onStartDrag`
  callbacks translate the rendered index back to the source-array index.
- **AUDIT-13 fix**: selection state on `role="group"` segments moved from invalid
  `aria-pressed` to CSS-only `data-selected="true"`.

### AcEnvelope (discriminated-union extension)

- **File**: `modules/editor-core/src/components/AcEnvelope.tsx` (+ extracted
  `AcEnvelopeAdsr.tsx`, `envelopeDragHelpers.ts`, `envelopeChromeHelpers.tsx`)
- **Introducing commits**: `d524da07` (`kind: 'adsr'` variant), `d39b150a`
  (AUDIT-15 `activeSegment: number | null`)
- **API**: discriminated-union by `kind`:
  - `kind: 'multi-segment'` (default, backwards-compatible for roland) — `{ totalSegments;
    activeSegment: number | null; points: EnvelopePoint[]; onPointSelect?; ... }`.
  - `kind: 'adsr'` (new variant) — `{ maxValue: number; attack; decay; sustain;
    release; ... }` — fixed 75/25 layout for classic 4-parameter ADSR rendering.
- **Akai adopters**: `KeygroupEditor` filter-envelope (`kind="multi-segment"
  totalSegments={4} activeSegment={null}`), `KeygroupEditor` amp-envelope
  (`kind="adsr" maxValue={99}`). Roland canonical-side: `ToneEnvelopeEditor` (legacy
  multi-segment 1-based numeric `activeSegment`; backwards-compat preserved).
- **Akai-driven changes**: (a) the `kind: 'adsr'` variant — akai's filter+amp
  envelopes are classic ADSR not the 8-segment roland envelope; (b)
  `activeSegment: number | null` widening — akai's filter envelope is drag-edit-only
  with no segment-selection model, so it passes `null` to avoid the silent-clamp-to-1
  false-active highlight that AUDIT-15 surfaced.

### AcFrequencyResponse (build-from-extraction)

- **File**: `modules/editor-core/src/components/AcFrequencyResponse.tsx` +
  `modules/editor-core/src/design/frequency-response-primitives.css`
- **Introducing commits**: `b83318d3` (extract), `d39b150a` (AUDIT-14 — paired
  adapter-layer fix in akai consumer)
- **API**: `{ filterType: 'lowpass' | 'highpass' | 'bandpass' | 'notch'; frequency:
  number; resonance: number; frequencyRange: [number, number]; resonanceRange: [number,
  number]; onChange: (changes: Partial<{frequency, resonance}>) => void; ... }` —
  operates in physics Hz + dB units; per-device wire-format adapter at call site.
- **Akai adopter**: `KeygroupEditor` filter call site with `akaiFilterFreqToHz` /
  `akaiHzToFilfrq` adapters mapping the akai 0..99 `FILFRQ` range to physics Hz, and
  `dispatchAkaiFilterChange` clamping `FILQ` to integer 0..15. No roland consumer
  today (akai-driven primitive; roland uses a different filter UI).
- **Akai-driven design**: the primitive operates in continuous numeric space; the
  consumer adapter `akai-filter-adapter.ts` is the last trusted boundary that
  enforces the integer wire-format contract for the akai `FILQ` device field.
  AUDIT-14 landed the adapter extraction with 24 paired tests against fractional
  rounding + boundary clamping; floats from the primitive can no longer leak past
  the adapter into the integer device field.

### AcLiveStatusFooter (build-from-scratch)

- **File**: `modules/editor-core/src/components/AcLiveStatusFooter.tsx` +
  `modules/editor-core/src/design/live-status-footer-primitives.css`
- **Introducing commits**: `1e6e40ad` (build), `a7b1773f` (akai mount), `16f97e34`
  (roland mount), `f2f3e1e0` (AUDIT-16 split-announcement contract)
- **API**: `{ deviceLabel: string; lastEditAt: number | null; state: 'live' |
  'offline' | 'error'; errorMessage?: string }` — 100ms internal tick drives the
  visible "X.Xs ago" elapsed-time readout in `.ac-live-status-footer__text` (no ARIA
  live-region — silent to assistive tech, can re-render every tick without
  pollution); a dedicated visually-hidden `.ac-live-status-footer__announcement`
  span carries `role="status"` + `aria-live="polite"` + `.ac-sr-only`, and its
  content is set by a rising-edge effect (`"Edit confirmed."` on a new `lastEditAt`,
  `"Device offline."` on offline transition, `"Device error: {msg}."` on error
  transition, empty on initial mount).
- **Akai adopters**: `ProgramsPage`, `KeygroupsPage`, `SamplesPage`. Roland
  canonical-side: `PatchesPage`, `TonesPage`. All 5 pages call
  `setLastEditAt(Date.now())` after every successful device-write callback (including
  rename writes — AUDIT-17 fix).
- **Akai-driven design**: the split-announcement contract (AUDIT-16) — the auditor
  caught the original implementation combining `role="status"` + `aria-live="polite"`
  with a 100ms `setInterval` ticker creating continuous live-region spam. The fix
  separated visible chrome from announcement channel; this is the canonical pattern
  for any future primitive that combines auto-updating display with screen-reader
  announcements.

### Akai dialect tokens

- **File**: `modules/editor-core/src/design/tokens.css` (block
  `:root[data-editor='s3000xl']` at lines 231-269)
- **Introducing commits**: `d5d99516` (initial), `b7b833e0` (AUDIT-02 — 6
  `--ac-action-*` overrides for cream-on-dark contrast)
- **Contract**: `data-editor='s3000xl'` set on `<html>` via
  `modules/akai-s3k-editor/src/main.tsx`. The dialect overrides color / font /
  iconography variance; structure / layout / chrome stay canonical. Roland uses the
  global `:root` defaults; no dialect block needed for roland.
- **Tokens covered**: cream/champagne page background, AKAI-red accent, Departure-Mono
  uppercase eyebrow labels, dark-on-light action button states, akai red
  destructive-action hover, akai red selected-row hover. The 6 `--ac-action-*`
  overrides ensure list-row + tree-row action affordances stay legible on the light
  background (the global tokens are tuned for the dark roland surfaces).

### Canonical extensions to existing primitives

- **`.ac-page-shell--fixed-viewport` mobile escape hatch** (`a078fc0b`, AUDIT-20260523-03
  closure) — `@media (max-width: 899px)` block drops `height: auto` + `overflow:
  visible` on the shell, lets `.ac-app-shell` and children grow to content height,
  caps `.ac-list-scroll` at `70vh`. Lifted from akai mockup's dialect-scoped block;
  every roland page that consumes `.ac-page-shell--fixed-viewport` inherits the fix.
- **`.ac-tree-disclosure-btn`** (`a078fc0b` + `68799ed9`, AUDIT-20260523-01/02 +
  AUDIT-20260524-01 closures) — 24×24 hit area (WCAG SC 2.5.8), `<button>` semantics +
  `aria-label`/`aria-expanded`, `tabIndex={-1}` so the parent treeitem stays the
  single keyboard anchor. Visibility-aware `getTabStops()` helper in the editor-core
  UI harness (AUDIT-21 closure) walks ancestor chain to reject candidates inside
  `.ac-collapse[data-expanded="false"]`.
- **List-row `aria-current` contract** (`c1a26de7`, AUDIT-04 closure) — replaced
  `aria-selected` on `role="button"` rows (semantically invalid pairing) with
  `aria-current="true"` (the ARIA-spec-supported "currently selected from a set" state
  for buttons). Applied across 5 list components (2 roland + 3 akai) +
  `editor-core/src/design/list-primitives.css`.

---

## Section 3: Adopters registered

`docs/scope-discovery/adopter-manifests.yaml` — 14 manifests, 0 holdouts, 9 tracked
holdouts.

| Manifest ID | Canonical | Expected adopters | Akai status | Cross-editor reach |
|---|---|---|---|---|
| `page-title-row` | `PageTitleRow` from `@audiocontrol/editor-core` | 4 akai pages + 5+ roland pages | adopted (4/4) | roland + akai |
| `use-export-dialog-lifecycle` | `useExportDialogLifecycle` hook | 3 roland export dialogs + 4 akai export dialogs (tracked) | tracked-holdout (4 akai dialogs) | roland today; cross-editor pending |
| `bank-header` | `BankHeader` from roland | roland only | NO-USE-CASE (akai lists are flat, no bank structure) | roland-only |
| `slot-info` | `SlotInfo` from `@/components/common/SlotInfo` | 3 roland surfaces + 3 akai lists (tracked) | tracked-holdout (3 akai lists) | roland today; cross-editor pending |
| `ac-radio-tabs` | `AcRadioTabs` from `@audiocontrol/editor-core` | 2 roland tab strips + 1 akai velocity-zone editor | adopted (3/3) | roland + akai |
| `destination-eyebrow` | `DestinationEyebrow` from roland | roland only | NO-USE-CASE (akai dialogs auto-start transfers; no pre-operation form phase) | roland-only |
| `library-device-memory-panel-adapter` | `LibraryDeviceMemoryPanel` adapter | 2 roland library plugins + 1 akai plugin (tracked) | tracked-holdout (1 akai plugin) | roland today; cross-editor pending |
| `library-preview-panel-adapter` | `LibraryPreviewPanel` adapter | 2 roland + 1 akai (tracked) | tracked-holdout (1 akai plugin) | roland today; cross-editor pending |
| `ac-control-primitives-row` | `AcInput` / `AcSelect` / `AcSlider` / `AcCheckbox` from `@audiocontrol/editor-core` | 4 akai editor components | adopted (4/4) | akai-led; future editors |
| `ac-zone-strip` | `AcZoneStrip` from `@audiocontrol/editor-core` | 1 roland (ToneZoneEditor) + 2 akai (VelocityRangeBar, KeyRangeEditor) | adopted (3/3) | roland + akai |
| `slide-drawer-library-dialogs` | `SlideDrawer` from `@audiocontrol/editor-core` | roland library dialogs + akai DrumKit / LibraryToDisk dialogs | adopted | roland + akai |
| `ac-envelope` | `AcEnvelope` from `@audiocontrol/editor-core` | 1 roland tone envelope + 2 akai keygroup envelopes | adopted (3/3) | roland + akai |
| `ac-frequency-response` | `AcFrequencyResponse` from `@audiocontrol/editor-core` | 1 akai keygroup filter | adopted (1/1) | akai-only today; future editor candidate |
| `ac-live-status-footer` | `AcLiveStatusFooter` from `@audiocontrol/editor-core` | 3 akai pages + 2 roland pages | adopted (5/5) | roland + akai |

**Substantive `reason:` text** on every tracked-holdout (per AUDIT-20260525-20
closure): each entry's `reason:` field is a WHAT / WHY / UNLOCKS-WHEN block naming
the migration target file + canonical primitive, the technical blocker (state-contract
delta / missing primitive / multi-item progress shape / semantic slot-label
variation), and the conditional that would make adoption feasible. Future
cross-editor-harmonization sessions can grep `tracked_holdouts:` in
`adopter-manifests.yaml` for this work queue.

---

## Section 4: Anti-patterns registered

`docs/scope-discovery/anti-patterns.yaml` — 18 entries, 0 findings.

The 6 spec § 6 entries that landed during this feature (the "don't re-introduce" list
for future-editor harmonization):

| Entry id | Catches | Canonical replacement | Paired scenarios | TF-015 sibling negatives |
|---|---|---|---|---|
| `s3k-zone-tabs-inline` | inline `.s3k-zone-tab*` CSS family | `<AcRadioTabs>` in controlled mode | + paired scenario file | yes (sibling-class negatives) |
| `s3k-envelope-display-inline` | inline `.s3k-envelope-display` / `.s3k-adsr-*` CSS family | `<AcEnvelope kind="multi-segment">` / `<AcEnvelope kind="adsr">` | 8 paired scenarios | yes (`s3k-envelope-section` sibling MUST NOT match; `s3k-envelope-display-history` MUST match) |
| `s3k-param-input-inline` | inline akai `ParamRow` with embedded `<input>` chrome | `<S3kParamRow>` wrapping `AcInput` (or canonical `AcInput` directly) | + paired scenario file | yes |
| `s3k-param-select-inline` | inline akai `ParamRow` with embedded `<select>` chrome | `<S3kParamSelectRow>` wrapping `AcSelect` | + paired scenario file | yes |
| `s3k-param-toggle-inline` | inline akai `ParamRow` with embedded checkbox chrome | `<S3kParamToggleRow>` wrapping `AcCheckbox` | + paired scenario file | yes |
| `tailwind-link-chrome-inline` | inline `text-blue/cyan + hover:underline` className shapes (with `<(a\|button)` element token co-located within 5 source lines) | `.ac-link` | 5 paired scenarios + gutted-stub | yes (informational `<span text-blue-*>` without hover:underline MUST NOT match) |
| `tailwind-button-chrome-inline` | inline `<button ... bg-color ... rounded>` className shapes (constrained by `[^<]` to prevent element-boundary crossing) | `.ac-btn` / `.ac-btn-primary` / `.ac-btn-danger` / `.ac-btn-sm` | 8 paired scenarios + gutted-stub | yes (parent-div-with-chrome-wrapping-minimal-button MUST NOT match; layout-utilities-on-ac-btn MUST NOT match; non-button elements MUST NOT match) |
| `ac-page-sticky-header-inline` | inline `.ac-page-sticky-header` class | retired (sticky-header pattern replaced by `.ac-page-shell` chrome) | + paired scenarios | yes |

**Validator-paired-changes hard test** passed for every entry: stashing the migration
diff (keeping registry + validator + scenarios) re-ran the gate and surfaced findings
for every migrated file at the expected file-level granularity. Each entry's
adversarial-scenario file ships a gutted-stub self-check proving the
rejection assertions have teeth.

The **TF-015 lesson** (sibling-class prefix-matching trap) was applied
proactively to all new entries: anti-pattern regexes are tightened to explicit
suffix-alternation where prefix-matching would false-positive on sibling classes,
and every scenario file carries negative-match scenarios asserting that named
sibling classes do NOT match.

---

## Section 5: Audit cycles + the TF-016 pattern

25 findings closed across 6 review passes. The headline finding is the
**TF-016 pattern** — primitive-extraction dispatches recurrently land integration-layer
regressions that the next audit pass catches. This pattern landed in **5 distinct
cycles** in this feature, each producing 2-3 findings against the same dispatch
shape. The discipline gap is real and load-bearing for future-editor work.

### Cycle 0 (Phase 1 mockup audit) — 3 findings

- **Dispatch**: Phase 1 mockup transposition (`62ee5373`) faithfully replicated the
  canonical chrome.
- **Findings**: AUDIT-20260523-01 / -02 / -03 — chevron hit-area below WCAG 24×24
  (canonical `.ac-tree-disclosure-btn`); disclosure-btn is `<span>` not `<button>`
  (no a11y for voice-control element enumeration); `.ac-page-shell--fixed-viewport`
  collapses mobile detail body to ~120px (no media-query escape hatch).
- **Root-cause pattern**: the mockup surface the underlying canonical defects because
  the dialect contract forbids per-editor primitive forks. Fix lived in editor-core,
  not in the akai mockup.
- **Fix shape**: `a078fc0b` — 24×24 hit area; `<button>` semantics + ARIA labels;
  `@media (max-width: 899px)` escape hatch lifted into canonical
  `layout-primitives.css`.
- **Lesson encoded**: the dialect contract means audit findings against the
  akai mockup are findings against the canonical primitive. Phase 1's mockup work
  doubles as a canonical-primitive a11y review.

### Cycle 1 (AcRadioTabs promotion + extension) — 2 findings

- **Dispatch**: `a444acd5` + `b5d30089` — promote `AcRadioTabs` from roland-local to
  `editor-core`, extend with controlled-mode for akai velocity-zone editor.
- **Findings**: AUDIT-20260524-10 (HIGH) — promoted CSS class names `.ac-tabs` /
  `.ac-tab` collided with existing `LibraryPanel` + `BuildInfo` button-tab consumers
  (different layout, different active-state contract); the global override silently
  restyled them. AUDIT-20260524-11 (medium) — promoted ARIA contract was a faux
  `role="tablist"` / `"tab"` / `"tabpanel"` without keyboard handler implementation;
  carried forward from the legacy roland-local source.
- **Root-cause pattern**: dispatch focused on primitive shape + migration mechanics;
  did not grep for class-name conflicts pre-promotion; did not audit the legacy
  primitive's ARIA contract for validity.
- **Fix shape**: `8545e839` — rename class namespace to `.ac-radio-*` (option 1 from
  the fix guidance); rewrite ARIA contract to honor the underlying radio-driven
  mechanism (`role="radiogroup"`, presentation labels click-forward to sr-only radios
  via `htmlFor`, native browser keyboard semantics own focus).
- **Encoded in**: `primitive-extraction-checklist.md` item 1 (CSS class-name conflict
  grep) + item 2 (ARIA role / state validity audit on legacy source).

### Cycle 2 (AcZoneStrip extraction + akai migration) — 2 findings

- **Dispatch**: `03f36ce3` + `544d41f3` + `e23de8b3` + `edab3add` — extract
  `AcZoneStrip` from roland `.ac-zone-*` family; migrate akai `VelocityRangeBar`
  (split-handles mode) and `KeyRangeEditor` (per-edge mode + a11y override);
  tokenize ZoneOverviewZone palette.
- **Findings**: AUDIT-20260524-12 (medium) — `VelocityRangeBar` wrapper compacted
  malformed zones via `.filter(Boolean)`, but `onSelect` / `onStartDrag` callbacks
  forwarded the rendered (compacted) index instead of the source-array index; click on
  the second rendered zone called `onSelect(1)` when source-array index was 2.
  AUDIT-20260524-13 (medium) — selected-state on zone segments used `aria-pressed`
  attribute on `role="group"` containers — invalid ARIA pairing (`aria-pressed` is a
  button-only state); carried forward from the legacy implementation.
- **Root-cause pattern**: wrapper introduced index-translation without preserving the
  callback contract; copied an invalid ARIA pattern from the legacy source.
- **Fix shape**: `de95eb82` — wrapper rebuilds `{ sourceIndex, zone }` pairs through
  compaction; `handleStripSelect` / `handleStripStartDrag` translate rendered index
  back to source index; selected-state moved to CSS-only `data-selected="true"` on
  the structural group container.
- **Encoded in**: `primitive-extraction-checklist.md` item 2 (ARIA role / state
  validity) + item 3 (value-domain delta enumeration — index base, nullability).

### Cycle 3 (AcEnvelope kind variants + AcFrequencyResponse extraction) — 2 findings

- **Dispatch**: `d524da07` + `b83318d3` + `2f949329` + `1a47b60c` + `0ffe43f6` —
  extend `AcEnvelope` with `kind: 'adsr'` discriminated-union variant; extract
  `AcFrequencyResponse` from akai `FilterDisplay`; migrate 3 akai surfaces.
- **Findings**: AUDIT-20260524-14 (medium) — `AcFrequencyResponse` emits float
  `resonance` (intentional, primitive operates in continuous numeric space); akai
  `KeygroupEditor` consumer forwarded float straight into integer device field `FILQ`
  without rounding (legacy `FilterDisplay` rounded via `clamp()`). AUDIT-20260524-15
  (low) — akai filter-envelope passes `activeSegment={0}` to AcEnvelope's 1-based
  API; silent clamp to 1 = permanent fake "segment 1 active" highlight on a surface
  with no selection model.
- **Root-cause pattern**: primitive's API surface changed (float-vs-integer, 1-based
  API with no nullability) and the consumer adapter passed through what the legacy
  primitive accepted; semantic correctness lost in the contract delta.
- **Fix shape**: `d39b150a` — extract akai filter adapter into
  `akai-filter-adapter.ts` (pure helpers, unit-testable); `clampToFilq` rounds + clamps
  to 0..15; `dispatchAkaiFilterChange` is the centralized dispatcher applying both
  quantizers. Widen `AcEnvelope`'s `activeSegment: number` to `number | null`; akai
  consumer passes `null`.
- **Encoded in**: `primitive-extraction-checklist.md` item 3 (value-domain delta
  enumeration — integer-vs-float, range bounds, nullability, index base).

### Cycle 4 (AcLiveStatusFooter build + adoption) — 3 findings

- **Dispatch**: `1e6e40ad` + `a7b1773f` + `16f97e34` — build `AcLiveStatusFooter`
  from scratch; mount on 3 akai pages + 2 roland pages.
- **Findings**: AUDIT-20260525-16 (HIGH) — `role="status"` + `aria-live="polite"` on
  the root combined with a 100ms `setInterval` ticker created continuous live-region
  announcement spam. AUDIT-20260525-17 (medium) — akai rename handlers
  (`handleRenameProgram`, `handleRename`) on Programs + Samples pages don't call
  `setLastEditAt(Date.now())`; rename successfully updated the device but footer
  stayed READY. AUDIT-20260525-18 (medium) — `ProgramsPage.test.tsx` had a
  pre-existing failure (queried `data-testid="loading-status"` that no longer
  rendered); the dispatch touched `ProgramsPage.tsx` and inherited responsibility
  for the test.
- **Root-cause pattern**: ARIA + auto-update interaction not audited in the brief;
  device-write callsite enumeration listed `handleParameterChange`-shaped handlers
  by pattern (sub-agent grep'd for the pattern, missed rename handlers); pre-existing
  test failure tracked as "baseline-flaky" while the dispatch was actively modifying
  the page.
- **Fix shape**: `f2f3e1e0` — split announcement contract from visual timer (visible
  chrome is silent to AT; dedicated `__announcement` sr-only span carries the live
  region attributes; content set by a rising-edge effect, not the 100ms tick); wire
  `setLastEditAt(Date.now())` into rename handlers on both pages + paired regression
  tests; update the stale `ProgramsPage.test.tsx` assertion + add the AUDIT-17
  page-layer test.
- **Encoded in**: `primitive-extraction-checklist.md` item 4 (consumer-side adapter
  survey — enumerate every literal handler) + item 5 (test-contract drift survey) +
  item 6 (ARIA + interaction-timing audit).

### Cycle 5 (TF-016 countermeasure + task 2.7 + task 2.3 follow-ups) — 4 findings

- **Dispatch**: cleanup-pass landing the primitive-extraction-checklist + the
  editor-core keyboard-navigation harness + the cross-editor adopter-manifest
  backfill.
- **Findings**: AUDIT-20260525-19 (medium) — TF-016 countermeasure encoded only in
  `.claude/rules/primitive-extraction-checklist.md`; Codex's canonical surface
  (`AGENTS.md`) had no mirror, so Codex sessions in this repo wouldn't inherit the
  discipline. AUDIT-20260525-20 (medium) — tracked-holdouts used placeholder
  `#cross-editor-akai-*` issue refs that satisfied the parser but weren't navigable
  tracker artifacts (registry becoming a "fix-it-later dumping ground" — the exact
  pathology the registry was designed to prevent). AUDIT-20260525-21 (medium) — the
  TreeView keyboard-navigation spec counted hidden mounted descendants as tab stops
  (`getTabStops()` was purely selector-based, didn't filter for visibility); could
  pass a regression that made collapsed descendants tabbable. AUDIT-20260525-22
  (medium) — the editor-core keyboard-navigation harness was a manual-only target
  (`pnpm test:ui` / `make test-ui-editor-core`); the workplan's "fail at commit time"
  property wasn't achieved.
- **Root-cause pattern**: every closure paragraph claimed a property the closure
  didn't actually achieve. The audit verifies the property by reading what landed
  vs the claim.
- **Fix shape**: `8a93bac9` — mirror the TF-016 checklist into `AGENTS.md`;
  `f2e49c0e` + `f90c989d` — amend the adopter-manifest parser to accept issue-less
  entries with substantive (>= 80 chars, anti-gaming-phrase-filtered) `reason:` text +
  rewrite all 9 tracked holdouts as WHAT/WHY/UNLOCKS-WHEN blocks; `82c1a401` — make
  `getTabStops()` visibility-aware (walks ancestor chain, rejects descendants in
  `.ac-collapse[data-expanded="false"]` and other unreachable wrappers); `d82e37a4` —
  amend `modules/editor-core/package.json` `test` script to invoke both vitest configs
  sequentially so the UI harness runs on every `pnpm -r test` + a paired
  self-asserting unit test (`package-test-script.test.ts`) catches a future revert.
- **Encoded in**: the checklist itself — when a closure claims a property, audit
  verifies the claim against what shipped.

### The TF-016 pattern in aggregate

Across 5 dispatches (Cycles 1-5) the same root-cause shape produced 11 findings:

| Cycle | Primitive | Findings | Common shape |
|---|---|---|---|
| 1 | AcRadioTabs | 10 + 11 | class-name conflict + faux ARIA carried forward |
| 2 | AcZoneStrip | 12 + 13 | callback-index drift + invalid ARIA pairing carried forward |
| 3 | AcEnvelope + AcFrequencyResponse | 14 + 15 | float-into-integer wire-format regression + index-base sentinel coercion |
| 4 | AcLiveStatusFooter | 16 + 17 + 18 | ARIA + ticker interaction + missed rename callsites + stale test on touched page |
| 5 | various follow-ups | 19 + 20 + 21 + 22 | closure-paragraph claims didn't match what shipped |

The discipline gap is real. The countermeasure is
[`.claude/rules/primitive-extraction-checklist.md`](../../../../.claude/rules/primitive-extraction-checklist.md) +
its [`AGENTS.md` mirror](../../../../AGENTS.md). The checklist's 6 pre-dispatch
checks (CSS class-name conflict grep / ARIA role+state validity / value-domain delta
enumeration / consumer-side adapter survey / test-contract drift survey / ARIA +
interaction-timing audit) directly close each of the 5 cycles' surfaces. Until the
deskwork canonical implementation lands, the checklist IS the contract.

---

## Section 6: Lessons for next-editor harmonization

Concrete, actionable advice for the next editor harmonization (jv1080-harmonization /
d110-harmonization / etc.).

### 1. Start with the primitive-extraction-checklist

Every primitive-extraction dispatch (extract / build / extend / migrate / rename)
fires the 6 pre-dispatch checks + the 4 mandatory brief sections in
[`.claude/rules/primitive-extraction-checklist.md`](../../../../.claude/rules/primitive-extraction-checklist.md).
Don't ship a dispatch without working through it. The 5 audit cycles in this feature
demonstrate the cost of skipping it (each cycle = 2-3 findings + a follow-up
dispatch). When the deskwork canonical lands, use that; until then, the checklist
is the contract.

### 2. Each cross-editor primitive promotion needs its adopter-manifest registered in the SAME commit

The `make check-adopters` gate only catches missing adopters when the manifest
exists. A primitive that promotes without a manifest entry can ship with one consumer
and the gate stays green for months. Same-commit registration ensures the gate
catches the next consumer that drifts.

### 3. For pre-existing editor-local primitives: 3-stage commit shape

Akai had `.ac-tabs`, `.ac-tab`, etc. as editor-local classes. Promoting them to
canonical was a 3-stage commit shape:
1. **Promote** with multi-path `from:` so both old + new paths recognize as adopters.
2. **Migrate** consumers one editor at a time.
3. **Delete** the old path + simplify `from:` after all consumers migrate.

Skipping stage 1 (multi-path `from:`) breaks the gate during migration; skipping
stage 3 leaves cruft.

### 4. Tailwind-utility chrome migrations: expect visual deltas

Anti-patterns 2 + 3 (`tailwind-button-chrome-inline`, `tailwind-link-chrome-inline`)
surfaced as visible-delta migrations. The canonical `.ac-btn` family uses uppercase
Departure-Mono eyebrow labels — that may or may not fit the surface. Surface the
visual delta to the operator BEFORE the dispatch lands and get an explicit decision.
Don't ship the migration without operator visual approval.

### 5. Audit cycle pattern is real and recurring

Every primitive-extraction dispatch produced ~2-3 audit findings, almost always at
the integration layer:
- consumer-side adapter rounding / clamping / index-base mismatches,
- ARIA role+state pairing correctness,
- class-name conflicts with pre-existing consumers,
- test-contract drift on touched pages,
- ARIA + auto-update interaction (live-region spam, etc.).

The primitive-extraction-checklist exists to catch these proactively. Expect findings
even with the checklist applied; the checklist reduces their frequency, not to zero.

### 6. `make` is topological; `pnpm -r build` isn't

Use `make` to ensure cross-module dependencies build in the right order. A
`pnpm -r build` after a cross-module API change can leave editor-core dist/ stale
while consuming modules build against the old build artifact.

### 7. The controller IS the gate (no CI)

Every sub-agent dispatch's reported counts are claims until the controller
independently re-runs the load-bearing gates (`make`, `make test-ui-roland`,
`make test-ui-s3k`, `make test-ui-editor-core`, `pnpm test:scope-discovery`, and the
`make check-*` chain). The 2-minute re-run cost pays for itself the first time it
catches a sub-agent's optimistic count.

### 8. Per-dispatch screenshot verification for cross-page CSS changes

`.claude/rules/css-refactor.md` requires before/after Playwright screenshots on every
CSS change touching cross-page chrome. Don't skip — AUDIT-10 was the regression this
rule would have caught. The 5-page roland sweep (`make test-rendering-roland`) +
pairwise `compare -metric AE` diff is the load-bearing verification.

### 9. Operator decisions are operator decisions

When a dispatch hits an architectural fork (extend primitive vs accept visual delta;
refactor scope vs amend spec; widen brief vs file separate issue), pause and surface
to the operator. Don't silently commit to one path. The `NEEDS DECISION:` framing in
sub-agent reports is the canonical signal.

### 10. Implementation-summary doc IS the artifact

The cycles that went wrong are more valuable than the wins. Future-editor sessions
will read this doc and the audit log to understand what failure modes recur in
primitive-extraction work. Be honest about the misses; the value is in pattern
recognition, not looking good.

### 11. Validator-paired changes is non-negotiable

Every gate-semantic change ships with adversarial scenarios that would have FAILED
against the prior behavior. The gutted-stub self-check is mandatory for new
validators. The hard test: stash the production-code diff (keep scenarios), re-run —
the new scenarios MUST go red. Without the hard test, scenarios are coverage padding,
not coverage.

### 12. Substantive `reason:` text on every tracked-holdout

Placeholder issue refs satisfy parsers but defeat tracking discipline. The
post-AUDIT-20 schema accepts issue-less entries when `reason:` is substantive
(>= 80 chars, no anti-gaming phrases) and follows a WHAT / WHY / UNLOCKS-WHEN block.
Apply this discipline to every new tracked-holdout entry.

---

## Section 7: Open work for cross-editor harmonization

### Tracked-holdouts (9 entries, substantive reasons)

All registered in `docs/scope-discovery/adopter-manifests.yaml`. Each carries a
WHAT/WHY/UNLOCKS-WHEN block; future-editor sessions can grep `tracked_holdouts:`
for the queue.

| Manifest | Akai surface | Migration unblocked when |
|---|---|---|
| `use-export-dialog-lifecycle` | `ExportProgramDialog.tsx` | a `StepState[]` lifecycle adapter accepts the multi-program akai export progress shape |
| `use-export-dialog-lifecycle` | `ExportSampleDialog.tsx` | same |
| `use-export-dialog-lifecycle` | `ExportKeygroupDialog.tsx` | same |
| `use-export-dialog-lifecycle` | `DiskToLibraryDialog.tsx` | same |
| `slot-info` | `ProgramList.tsx` | `SlotInfo` accepts a `slotLabel` prop for the akai 1-based program-number convention |
| `slot-info` | `SampleList.tsx` | same |
| `slot-info` | `KeygroupList.tsx` | same |
| `library-device-memory-panel-adapter` | `s3k-library-plugin.tsx` (`S3kMemoryPanelAdapter`) | the canonical `LibraryDeviceMemoryPanel` adapter accepts akai's program/sample 1-based addressing |
| `library-preview-panel-adapter` | `s3k-library-plugin.tsx` (`S3kPreviewPanelAdapter`) | the canonical `LibraryPreviewPanel` adapter accepts akai's sample-data shape |

### Refactor candidates (12 from task 3.2 codebase-auditor pass)

Surfaced as keep-with-reason during task 3.2 but flagged for future operator
scheduling. Cited in commit `dd7b985e`'s body.

**5 small + clean** (could land as a single dispatch each):
- `MetaRow` extraction (sub-shape across 2 akai detail panes)
- `BaseNoteInput` consolidation (3 akai surfaces)
- `DeviceMemoryCallbacks` lift (1 akai plugin)
- `readPartitionFile` helper consolidation
- `writeCommonProgramYaml` helper consolidation

**7 substantial** (each is a multi-commit refactor):
- `SteppedProgressDrawer` chrome promotion (cross-editor)
- `AcRosterList` primitive extraction (would absorb 9 roster-list parallels)
- `S3kEditorDialogsMount` consolidation
- `useCloneFlow` hook extraction
- `DiskToLibraryDialog` split
- `program-serialization` generic
- `saveSampleYamlToCommon` consolidation

These are explicit out-of-scope for this feature; the operator schedules them
separately. None are blocking; akai is fully scope-discovery-clean (`pending-touching
= 0`) with these as keep-with-reason.

### Phase 1 task 1.3 (screenshot baseline)

Operator-deferred per AUDIT-20260524-03 closure. The harness routes
(`/akai/s3000xl/editor/test/{programs,samples,keygroups,library,keygroups-shell,
library-real}`) are reachable; baseline captures can happen at any point. The
`page-shell-contract.spec.ts` provides continuous structural-contract coverage
that's stronger than a single-point baseline diff (task 2.6 closure).

---

## Commits + key SHAs

| Commit | Description |
|---|---|
| `7a21093d` | Feature setup — PRD + workplan + README + implementation-summary placeholder |
| `4ab7ea1d` | Phase 1 design-language audit + 4 page mockups |
| `62ee5373` | Restart mockups using canonical editor-core chrome (Phase A) |
| `a078fc0b` | Close AUDIT-20260523-01/02/03 — disclosure-btn target size + button semantics + mobile escape hatch |
| `d5d99516` | Phase 2 task 2.1 — akai dialect tokens lifted into canonical tokens.css |
| `8632dbb4` | Phase 2 task 2.2 — promote PageTitleRow + AcReloadIcon |
| `68799ed9` | Close AUDIT-20260524-01 — disclosure-button `tabIndex={-1}` |
| `b7b833e0` | Close AUDIT-20260524-02 — akai action-icon tokens |
| `c1a26de7` | Close AUDIT-20260524-04 — `aria-current` row selected-state |
| `ff07963c` | Close AUDIT-20260524-03 + -05 — harness pages + shell-contract spec |
| `c8b09bc4` | Close AUDIT-08 + -09 — detail-scroll assertion + contentful library harness |
| `7e431a69` | Close AUDIT-06 + -07 — shell-compliant keygroups harness + real PluginLibraryBrowser library harness |
| `20e56322`, `74505449`, `f25b10a1` | AcInput/AcSelect/AcSlider/AcCheckbox migration |
| `a444acd5`, `b5d30089`, `3b93fa91` | AcRadioTabs promotion + controlled-mode + akai migration |
| `8545e839` | Close AUDIT-10 + -11 — AcRadioTabs class-namespace + radio-group ARIA |
| `03f36ce3`, `544d41f3`, `e23de8b3`, `edab3add`, `6722605c`, `cfe6337b` | AcZoneStrip extraction + akai migration + spec amendment |
| `de95eb82` | Close AUDIT-12 + -13 — VelocityRangeBar source-index + AcZoneStrip ARIA cleanup |
| `d524da07`, `b83318d3`, `2f949329`, `1a47b60c`, `0ffe43f6`, `6ff7ad44`, `6c1bb4fe` | AcEnvelope kind variants + AcFrequencyResponse extraction + akai migration |
| `d39b150a` | Close AUDIT-14 + -15 — akai filter adapter + AcEnvelope nullable activeSegment |
| `1e6e40ad`, `a7b1773f`, `16f97e34`, `2355c97c` | AcLiveStatusFooter build + akai + roland adoption + manifest |
| `f2f3e1e0` | Close AUDIT-16 + -17 + -18 — split-announcement contract + rename adapter + stale test repair |
| `8af8a2c9` | Spec amendment — virtual front panel out-of-scope for akai |
| `48d711af` | Land `primitive-extraction-checklist.md` (TF-016 defensive countermeasure) |
| `90a771ef` | Cross-editor adopter-manifest backfill (task 2.3) |
| `0473616a`, `7463b072`, `dbfde688`, `282bdb5d` | BUG-EC-001 closure — editor-core regression gate restored |
| `ec4cb35a`, `427a8d4d` | A11y keyboard-navigation harness (task 2.7) |
| `c0207f99`, `0d1194ce` | CSS-exports gate (task 2.9) |
| `31997a08`...`d41d5fcb`, `b413375c` | `_shared.css` decomposition (task 2.8) — 8 extraction commits + workplan annotation |
| `11b3dea6`, `8e9163cd`, `9759f0bd`, `ee0ed6b0` | Tab-active-state codegen + gates (task 2.10) |
| `128ab75c`, `84f44f17`, `9e8d99c0` | Tailwind link + button chrome migration (task 2.5 items 2 + 3) |
| `1b19c311` | Editor-symmetry matrix regenerated with akai tracked-holdouts (task 2.4) |
| `8a93bac9` | Mirror TF-016 checklist into AGENTS.md (AUDIT-19 closure) |
| `f2e49c0e`, `f90c989d` | Substantive tracked-holdout reasons + parser amendment (AUDIT-20 closure) |
| `82c1a401` | TreeView spec asserts visible tab order (AUDIT-21 closure) |
| `d82e37a4` | UI keyboard-nav harness wired into default test script (AUDIT-22 closure) |
| `6321b17d`, `dd7b985e`, `87025515` | Phase 3 task 3.1 + 3.2 + 3.3 + 3.4 closure (clone baseline current + 49 clones dispositioned + sweep clean) |

---

## What was out of scope

Per the PRD plus deferrals discovered mid-feature with explicit operator acceptance:

- **`jv1080-editor` harmonization** — separate feature (next-editor harmonization
  candidate).
- **`d110-editor` harmonization** — separate feature.
- **sample-editor + future editors** — separate features.
- **Hardware-protocol / device-communication work** — editor-UI scope only.
- **akai-s3000xl-specific device-memory model** — UI presentation layer only;
  device-memory contract unchanged.
- **`modules/launch-control-xl3`** — not modified.
- **Virtual front panel for akai** — out-of-scope per operator directive 2026-05-25.
  The S3000XL is a 19" rackmount with a fully functional physical front panel; a
  virtual one is extraneous. Roland's S-330/S-550 keep their virtual front panels
  (hardware harder to reach). Spec § 2.4 + § 3.4 + § 3.5 amended.
- **`S3kParamRow` tooltip prop wiring** — non-blocking; akai has no Tooltip primitive
  today; the prop is opt-in and no call site passes it.
- **Phase 1 task 1.3 (screenshot baseline)** — operator-deferred per AUDIT-20260524-03
  closure; task 2.6's structural-contract coverage is stronger.
- **12 refactor candidates** from task 3.2 (5 small + 7 substantial) — out of scope
  for this feature; future operator scheduling.
- **9 cross-editor tracked-holdouts** — substantively documented with
  WHAT/WHY/UNLOCKS-WHEN blocks; not blocking the feature; future cross-editor
  harmonization work.

---

## Verification

Final state at the close of Phase 3 task 3.5:

- `make` — clean (cached build; nothing to do).
- `pnpm --filter @audiocontrol/editor-core test` — **393 passed** (unit) +
  **30 passed** (UI harness, now wired into default test script).
- `pnpm --filter @audiocontrol/akai-s3k-editor test` — **234 passed**.
- `make test-ui-roland` — green (last verified after each cross-editor primitive
  promotion).
- `make test-ui-s3k` — 43 passed (page-shell-contract).
- `make test-ui-editor-core` — 30 passed.
- `make check-css-duplication` — clean.
- `make check-clone-duplication` — clean (0 NEW / 0 DROPPED via diff).
- `make check-chevron-sizing` — clean.
- `make check-anti-patterns` — **18 entries scanned across 1376 files; 0 findings**.
- `make check-adopters` — **0 holdouts across 14 manifests; 9 tracked holdouts
  reported separately**.
- `make check-editor-symmetry` — clean (matrix: 21 ✓ adopted / 0 ⚠ partial / 0 ✗
  holdouts / 4 ⏳ tracked (all akai) / 73 — n/a).
- `make check-tab-active-state` + `make check-tab-active-state-sources` — clean.
- `pnpm test:scope-discovery` — green (~177 scenarios across ~20 validators).
- `make clone-summary SURFACE='modules/akai-s3k-editor/**'`:
  **total 450 / pending-touching 0 / pending-intra 0 / dispositioned-touching 68**.
- Workplan task inspection: 7 (Phase 1) + 10 (Phase 2) + 5 (Phase 3) = 22 task
  checkboxes; all [x] except 1.3 (operator-deferred per AUDIT-20260524-03 closure).
- Audit-log inspection: 25 findings, all `verified-<sha>`.
- TF inspection: 10 entries; 7 closed (PR #462 + PR #463); 3 open (TF-014 + TF-015
  low; TF-016 canonical pending deskwork with local defensive countermeasure).

---

## Closure note

The feature established the cross-editor design-language contract, migrated the akai
surface onto canonical primitives, locked in the post-harmonization state via
mechanical gates, and surfaced + closed the recurring primitive-extraction
integration-layer-regression pattern via the local
[`primitive-extraction-checklist.md`](../../../../.claude/rules/primitive-extraction-checklist.md).

The next editor harmonization (jv1080 / d110) inherits 11 canonical primitives + 14
adopter manifests + 18 anti-pattern entries + the editor-symmetry matrix + the
primitive-extraction-checklist. Read Section 6 first.
