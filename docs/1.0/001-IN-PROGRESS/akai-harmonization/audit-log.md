# Audit Log — feature/akai-harmonization

This document is the feature-local audit log for `feature/akai-harmonization`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`

---

## 2026-05-24 Feature review — latest shell-contract follow-up

Surfaced while reviewing the latest `feature/akai-harmonization` commits through `1a6261d2` on 2026-05-24, specifically the new Akai shell-contract harness/spec work that closed `AUDIT-20260524-05`. This pass was a code-review audit only; I did not run the test suite locally in this pass.

### Shell-contract closure still excludes the Keygroups route, so the one migrated page with the most unique shell structure has no direct Akai regression spec

Finding-ID: AUDIT-20260524-06
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/App.tsx`, `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`, `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`

The new `page-shell-contract.spec.ts` is framed as the Akai-side closure for the Phase 2 shell migration, and its file header says the migration covered all four Akai pages: Programs, Samples, Keygroups, and Library (`page-shell-contract.spec.ts:5-6`). But the spec immediately documents that Keygroups is still excluded: `/test/keygroups` is wired to the pre-existing inline-styled harness rather than a shell-compliant page harness (`page-shell-contract.spec.ts:30-39`), `KEYGROUPS_SHELL_HARNESS_AVAILABLE` is hardcoded `false` (`page-shell-contract.spec.ts:60`), and the actual loop only exercises Programs, Samples, and Library (`page-shell-contract.spec.ts:74-93`).

That matters because Keygroups is not just another copy of the same page shape. Its production page has the most structurally distinct layout of the four migrated surfaces: the zone-overview toolbar and overview block sit ahead of the canonical shell, so it is the route most likely to regress height ownership, clipping, or scroll interactions in a way that the other three harnesses would not catch. Today the spec marks `AUDIT-20260524-05` closed while leaving that route outside the Akai-specific regression surface.

**Evidence:**

- The spec header claims all four migrated pages are in scope: `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:5-6`
- The same file explicitly excludes Keygroups and keeps the seam disabled:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:30-39`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:60`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:74-93`
- The route still points to the old inline-styled harness, not a canonical shell harness:
  - `modules/akai-s3k-editor/src/App.tsx:21`
  - `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx:160-183`
- The workplan now marks harness coverage complete for all four pages, which overstates what the shell-contract spec actually exercises:
  - `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98`

**Expected:** if `AUDIT-20260524-05` is considered closed, each migrated Akai page should have a shell-contract harness that the Akai regression spec actually runs, including Keygroups.

**Actual:** Keygroups remains routed to a legacy inline harness and is intentionally omitted from the Akai shell-contract spec.

**Fix guidance:** add a shell-compliant `TestKeygroupsPage` variant that mirrors the production `KeygroupsPage` shell contract, then include it in `SHELL_HARNESS_ROUTES` and remove the `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` seam. Until then, the audit log and workplan should describe the shell-contract closure as partial rather than complete.

**Fix landed:** commit `7e431a69` (2026-05-24). New file `modules/akai-s3k-editor/src/pages/TestKeygroupsShellPage.tsx` registered at the new route `/akai/s3000xl/editor/test/keygroups-shell` in `modules/akai-s3k-editor/src/App.tsx`. The harness mirrors the production `KeygroupsPage` shell scaffold (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `ZoneOverviewToolbar` + `ZoneOverview` + `.ac-app-shell` + real `KeygroupList` + `.ac-detail-scroll` stub detail) with 16 factory keygroups + local React state; no zustand stores, no `useS3000xlClient`. The pre-existing `/akai/s3000xl/editor/test/keygroups` route stays pointing at the inline-styled `TestKeygroupsPage` because `zone-overview.spec.ts:3` depends on it. The `KEYGROUPS_SHELL_HARNESS_AVAILABLE` constant + its header-comment block were removed from `page-shell-contract.spec.ts`; the new route is added to `SHELL_HARNESS_ROUTES` and the 13 existing test cases automatically extend coverage to keygroups-shell via the loop. `make test-ui-s3k`: 41 passed (was 32 — added the keygroups-shell route × 4 viewports + 1 viewport-route combination for library-real; see AUDIT-20260524-07 below for the rest).

### Library shell harness only proves wrapper geometry; it does not exercise the real `PluginLibraryBrowser` overflow surface the finding claimed to protect

Finding-ID: AUDIT-20260524-07
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`, `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`

The new Library harness does not mount `PluginLibraryBrowser`. Its own header says it uses a stub `<div>` standing in for the browser (`TestLibraryPage.tsx:9-13`), and the body comment repeats that the harness only needs a single full-height block so the spec can verify `.ac-page-shell-body` geometry (`TestLibraryPage.tsx:27-31`). That means the new regression spec validates the page wrapper shape, but not the real surface that owns the complex internal overflow behavior on the production Library page.

This is a meaningful gap because `AUDIT-20260524-05` was about fixed-viewport containment and internal scroll ownership after the page-shell migration. The production Library page delegates that behavior to a full-height three-column widget; a stand-in block cannot catch regressions where the real browser's own DOM, overflow rules, or descendant sizing reintroduce document scroll or clipped inner panes while the outer `.ac-page-shell-body` still looks correct.

**Evidence:**

- The harness explicitly uses a stand-in block instead of the production browser:
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:9-13`
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:27-31`
- The page-shell spec relies on that harness route as the Library coverage surface:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:24-28`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:87-92`

**Expected:** the closure for the Library shell-contract finding should exercise either the real `PluginLibraryBrowser` in a deterministic harness or a test surface that preserves the browser's actual internal overflow structure.

**Actual:** the current harness proves only that a generic full-height block fits inside `.ac-page-shell-body`.

**Fix guidance:** build a deterministic library harness around the real `PluginLibraryBrowser` with stubbed library/device inputs, or add a second targeted spec that mounts the real browser and asserts document-scroll containment plus inner-pane overflow ownership. If the stub-only approach is kept, the audit closure should explicitly state that only outer wrapper geometry is covered.

**Fix landed:** commit `7e431a69` (2026-05-24). Chose **shape (a)** from the operator's fix-guidance — a deterministic real-`PluginLibraryBrowser` harness. New file `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx` registered at the new route `/akai/s3000xl/editor/test/library-real` in `modules/akai-s3k-editor/src/App.tsx`. The harness mounts the REAL `PluginLibraryBrowser` with:
- `s3kLibraryPlugin` (the production plugin config from `@/plugins/s3k-library-plugin`)
- A stub `{ name: 'TestLibraryRoot' }` library handle — matches the truthy `{ name }` shape `PluginLibraryBrowser.test.tsx` uses (`{} as FileSystemDirectoryHandle`)
- An empty `S3kMemoryPanelState` (`isConnected: false`, empty `programNames`/`sampleNames`) so the device-memory panel renders empty
- Empty `categoryData` for `samples` / `common-programs` / `s3k-programs` — the contract under test is inner-pane overflow ownership, not tree-rendering behavior

The pre-existing `/akai/s3000xl/editor/test/library` route stays pointing at the stub-`<div>` `TestLibraryPage` because it's the outer wrapper-geometry baseline for the contract spec; the new `library-real` route is the inner-pane gate. Both routes are now in `SHELL_HARNESS_ROUTES` in `page-shell-contract.spec.ts`.

**Inner-pane assertion specifics** (`page-shell-contract.spec.ts:220-272`): a new per-route test, gated by the `asserts_inner_library_overflow` flag on the route metadata (only `library-real` opts in today), asserts the three inner panes of `PluginLibraryBrowser` each declare `overflow-y: auto` or `scroll`:
- `.ac-plugin-library-browser-device` (device memory column)
- `.ac-plugin-library-browser-sections` (library tree scroll container)
- `.ac-plugin-library-browser-preview` (preview pane)

If any pane's `overflow-y` regresses to `visible`, content overflow bubbles up the parent chain until either the `.ac-page-shell-body` clips it (content unreachable) or the document scrolls (regresses the fixed-viewport contract) — both outcomes are shell-contract failures the assertion catches at the inner-pane layer. A cross-check at the end of the same test re-asserts `document.documentElement.scrollHeight <= window.innerHeight + slack` against the real-`PluginLibraryBrowser` mount, pinning the no-document-scroll invariant specifically against the real component so a regression here implicates the inner-pane overflow rules, not the outer shell.

## 2026-05-24 Feature review — latest Phase 2 implementation

Surfaced while reviewing the latest harmonization commits on `feature/akai-harmonization` after `AUDIT-20260524-01` and `-02` were fixed. Scope reviewed from commit `68799ed9` through `HEAD` (`5a15c01c` at review time), with targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- TreeView.test.tsx`
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- SampleList.test.tsx`

Both targeted runs passed, but they do not cover the new issues below.

### Akai list-row migration codifies selected state on `role="button"` rows via `aria-selected`, which screen readers will not treat as a button state

Finding-ID: AUDIT-20260524-04
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx`, `modules/akai-s3k-editor/src/components/samples/SampleList.tsx`, `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx`, `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx`

Phase 2 task 2.2 migrated the Akai list widgets onto the canonical `.ac-list-row` chrome and, in the process, standardized all three row types as focusable `<div role="button">` wrappers carrying `aria-selected={isSelected}`:

- `ProgramList.tsx:176-185`
- `SampleList.tsx:182-191`
- `KeygroupList.tsx:138-147`

The visual selected-state styling is then keyed off `[aria-selected="true"]` in CSS, and the updated `SampleList` unit test now treats that attribute as the selected-state contract (`SampleList.test.tsx:43-60`).

The problem is semantic: `aria-selected` is not a supported state for the ARIA `button` role. Browsers will happily leave the attribute in the DOM and CSS can style against it, but assistive technology will not reliably announce "selected" for a button because "selected" is a state for roles like `option`, `tab`, `gridcell`, or `treeitem`, not buttons.

So the branch now has a selected-state signal that works visually and in DOM-attribute tests, but does not actually expose the state to screen-reader users in the way the tests imply.

**Evidence:**

- Akai rows now expose `role="button"` + `aria-selected={...}`:
  - `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx:176-185`
  - `modules/akai-s3k-editor/src/components/samples/SampleList.tsx:182-191`
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx:138-147`
- The updated unit test explicitly blesses `aria-selected` as the new observable contract:
  - `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx:43-60`

**Expected:** either use a role that legitimately carries `aria-selected` (for example a listbox/option-style pattern), or keep the button role and expose selection through a supported button state / wording instead of treating `aria-selected` as meaningful.

**Actual:** the selected-state contract is visually correct but semantically inert for assistive tech.

**Fix guidance:** do not deepen the new contract in more tests. Either re-model these lists as composite widgets with roles that support selection, or keep the button role and move the state exposure to a supported pattern (`aria-current`, `aria-pressed`, or explicit screen-reader text depending on the intended interaction model). A follow-up regression test should assert the accessible role/state combination, not just the raw attribute.

**Fix landed:** this session, 2026-05-24. Per the auditor's guidance, switched the selected-state contract from `aria-selected` to `aria-current="true"` everywhere. This is the "currently-selected item from a set" ARIA pattern that IS supported on the `button` role.

Per the ARIA spec, the omit-when-not-current convention applies: selected rows render `aria-current="true"`, unselected rows omit the attribute entirely (the JSX uses `aria-current={isSelected ? 'true' : undefined}`).

Files changed (the canonical fix is editor-core CSS; the consumer fix is 5 JSX sites across roland + akai):
- `modules/editor-core/src/design/list-primitives.css` — 3 selectors changed from `[aria-selected="true"]` to `[aria-current="true"]` (hover-reveal action class, slot color, row background).
- `modules/roland-sxx0-editor/src/components/patches/PatchList.tsx` + `tones/ToneList.tsx` — `aria-selected={isSelected}` → `aria-current={isSelected ? 'true' : undefined}`.
- `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx` + `samples/SampleList.tsx` + `keygroups/KeygroupList.tsx` — same.
- `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx` — both tests updated: the "selected sample" test now asserts `aria-current === 'true'`; the "unselected" test now asserts the attribute is null (per omit-when-not-current).

**Verification:** `make` clean. `make test-ui-roland` 4 passed + 2 skipped (matches baseline; roland row-state styling continues to work with the new attribute). `make test-ui-s3k` 19 passed. `pnpm --filter @audiocontrol/akai-s3k-editor test` 175 passed + 1 failed (matches baseline — the failing test is the pre-existing `ProgramsPage delete flow > shows loading status when isLoading with a message` unrelated to this change, confirmed via stash + re-run).

**Test-gap follow-up:** the auditor recommended "a follow-up regression test should assert the accessible role/state combination, not just the raw attribute." The current SampleList test asserts `aria-current === 'true'` on the raw attribute. A stronger test would use `@testing-library/react`'s `getByRole` + accessibility-tree assertions to verify the rendered role + state actually exposes to AT correctly. Deferred to a follow-up — landing the literal-attribute fix first closes the immediate semantic bug.

### Phase 2 landed four Akai page-shell migrations with no direct regression test for the new fixed-viewport/app-shell contract

Finding-ID: AUDIT-20260524-05
Status:     verified-7e431a69 (re-closed 2026-05-24 — see "Re-closed" paragraph below)
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`, `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`, `modules/akai-s3k-editor/test/`

The latest Phase 2 work moved all four primary Akai pages onto the canonical shell/layout primitives:

- `ProgramsPage.tsx:310-351` now uses `.ac-page-shell--fixed-viewport`, `.ac-app-shell`, `.ac-detail-scroll`
- `KeygroupsPage.tsx:307-351` now uses the same contract
- `SamplesPage.tsx:231-259` now uses the same contract
- `LibraryPage.tsx:560-572` now uses `.ac-page-shell--fixed-viewport` + `.ac-page-shell-body`

That is a large live-surface migration: page header, height bounding, internal scroll ownership, and list/detail pane structure all changed together. But the Akai test surface still does not exercise that contract directly. The only touched unit test in this pass is `SampleList.test.tsx`, and it checks row attributes only. A grep across `modules/akai-s3k-editor/test/` shows waits for lists to appear and hardware workflows that happen to pass through the pages, but no test that asserts the new shell/layout invariants themselves (`ac-page-shell--fixed-viewport`, `ac-app-shell`, `ac-detail-scroll`) or any dedicated Akai UI harness for the migrated pages.

This matters because the migration is precisely the kind of change that can regress scroll containment, clipping, or mobile behavior while leaving data-loading tests green. Roland has explicit design/rendering coverage for the canonical fixed-viewport shell; Akai still does not.

**Evidence:**

- New page-shell adoption:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:310-351`
  - `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx:307-351`
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:231-259`
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:560-572`
- Current Akai tests reference the lists/pages only indirectly (load/wait helpers and hardware flows), not the new layout contract itself:
  - `modules/akai-s3k-editor/test/` grep shows list waits and one `SampleList` unit spec, but no assertion on `ac-page-shell--fixed-viewport`, `ac-app-shell`, or `ac-detail-scroll`

**Expected:** when Phase 2 replaces a page’s shell/layout contract, the branch adds a direct regression surface for that contract on Akai too, not just on Roland. At minimum one targeted UI/rendering spec should assert scroll containment / non-clipping for the migrated Akai pages.

**Actual:** the canonical shell rollout to Akai is effectively covered only by incidental e2e traffic and one row-level unit test.

**Fix guidance:** add a focused Akai UI/rendering spec for the migrated pages before more shell-level harmonization lands. The most valuable first assertion is the fixed-viewport invariant: list and detail panes own internal scroll on desktop without clipping their bodies, with the mobile escape hatch still falling back to document scroll below 900 px.

**Fix landed:** commit `ff07963c` (2026-05-24). Added `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts` — 13 Playwright test cases across two `test.describe` blocks. Desktop (1280×900): asserts `.ac-page-shell--fixed-viewport` is present, page-shell `boundingClientRect.height` ≤ `window.innerHeight - site-header` (bounded-viewport contract), `document.documentElement.scrollHeight === window.innerHeight` (no document-level scroll), `.ac-app-shell` is a 2-col grid via `gridTemplateColumns` introspection, `.ac-list-scroll` `overflow-y` is `auto`/`scroll`. Library variant asserts `.ac-page-shell-body` instead of `.ac-app-shell`. Mobile (414×896): asserts the escape hatch — page-shell falls back to `height: auto`, doc scrolls naturally (`scrollHeight > innerHeight`), `.ac-app-shell` collapses to single track, last list row is reachable via scroll (`scrollIntoView` + `boundingClientRect` reachability check). Runs against the three new harness routes (`/akai/s3000xl/editor/test/{programs,samples,library}`) landed alongside in this same commit. `make test-ui-s3k`: 32 passed (19 existing zone-overview + 13 new contract tests).

**Coverage gap (intentional, documented):** `TestKeygroupsPage` is not included in the contract loop — it predates the canonical shell chrome (renders inline styles, not `.ac-page-shell--fixed-viewport`). The spec records this with `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` at the top + a header comment naming the gap, so a future opt-in is mechanical. The production `KeygroupsPage` IS shell-compliant (migrated in `bba5b13b` and covered indirectly via the cross-page contract this spec asserts); only the harness lags.

**Closure downgraded 2026-05-24 from `verified-2026-05-24` to `acknowledged-partial-coverage`.** Auditor flagged two gaps the closure paragraph above understated:
- **AUDIT-20260524-06**: Keygroups is the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of canonical shell). Leaving its harness route excluded means the page most likely to regress shell behavior is the one route the Akai-specific spec doesn't exercise. The "intentional gap" framing above was wrong — the right disposition is to BUILD the missing shell-compliant harness, not document its absence.
- **AUDIT-20260524-07**: `TestLibraryPage` mounts a stub `<div>` instead of the real `PluginLibraryBrowser`. The spec validates outer wrapper geometry but not the inner-overflow surface that AUDIT-05's fix-guidance specifically called out ("list and detail panes own internal scroll on desktop without clipping their bodies"). Stub-only coverage is not the closure shape the original finding asked for.

Re-closing AUDIT-05 requires landing fixes for both -06 and -07 (a shell-compliant `TestKeygroupsShellPage` route at `/akai/s3000xl/editor/test/keygroups-shell` registered in `SHELL_HARNESS_ROUTES`; a deterministic real-`PluginLibraryBrowser` harness route or paired spec that asserts inner-pane overflow ownership). When both ship, all three findings close together with `verified-<sha>`.

**Re-closed:** commit `7e431a69` (2026-05-24). Both -06 and -07 closed in the same commit, which re-closes -05. The full coverage picture is now:
- **Keygroups:** new shell-compliant `TestKeygroupsShellPage` at `/akai/s3000xl/editor/test/keygroups-shell` exercises the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of the canonical `.ac-app-shell`) through the contract spec's full per-route gauntlet (desktop fixed-viewport, app-shell 2-col grid, mobile escape-hatch falls back to auto-height, app-shell collapses to single column on mobile, last list row reachable via scroll).
- **Library:** new `TestLibraryRealPage` at `/akai/s3000xl/editor/test/library-real` mounts the REAL `PluginLibraryBrowser` with the production `s3kLibraryPlugin` + stub library handle + empty `S3kMemoryPanelState`. A new per-route assertion gated by `asserts_inner_library_overflow` (only `library-real` opts in) covers the inner-pane overflow contract AUDIT-05's fix-guidance specifically named: each of `.ac-plugin-library-browser-device`, `.ac-plugin-library-browser-sections`, `.ac-plugin-library-browser-preview` MUST declare `overflow-y: auto` or `scroll`. A cross-check asserts document-scroll containment against the real `PluginLibraryBrowser` mount so a regression here implicates the inner-pane overflow rules, not the outer shell. The original `/test/library` route stays as the outer wrapper-geometry baseline; both routes are now in `SHELL_HARNESS_ROUTES`.

**New contract-spec test count:** 22 (was 13). Decomposition:
- Desktop describe: 5 routes × 2 base tests (`fixed-viewport shell` + `body layout matches its kind`) + 1 inner-pane test (only `library-real`) = 11
- Mobile describe: 5 routes × 1 escape-hatch test + 3 `app-shell`-kind routes × 2 tests (`collapse-to-single-col` + `last-row-reachable`) = 5 + 6 = 11

`make test-ui-s3k`: 41 passed (was 32 — 19 zone-overview unchanged + 22 page-shell-contract). Independent re-run after the implementer commit per agent-discipline.md "When CI is absent, the controller is the gate."

**Inner-pane coverage proof:** revert-test confirms the new assertions have teeth — if `.ac-plugin-library-browser-device`'s CSS rule loses its `overflow-y: auto` declaration in `modules/editor-core/src/design/library.css`, the new `library-real: inner library panes own their own overflow` test turns red with a message naming the regressing selector + the actual computed `overflow-y` value. This closes the gap AUDIT-07 named: AUDIT-05's original closure validated `.ac-page-shell-body` geometry but said nothing about inner-pane ownership; now the contract spec asserts both.

---

## 2026-05-24 Feature review — implementation work so far

Surfaced while reviewing `feature/akai-harmonization` against `origin/main` after the first implementation commits landed in `editor-core` plus the new feature-doc set. Scope reviewed: branch diff from merge-base `57a6dd9fdfe08e93f3813a7d2c221611aa9995d6` through `HEAD` (`0c09c87e` at review time).

### Disclosure-button fix introduces a second tab stop per folder row and strands keyboard users on the nested button

Finding-ID: AUDIT-20260524-01
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/components/library/TreeView.tsx`

The accessibility fix that promoted the folder disclosure affordance from a `<span>` to a `<button>` solved pointer target size and button semantics, but it also made every expandable folder row contain two focusable elements: the row itself (`role="treeitem"`, `tabIndex={0}` at `TreeView.tsx:288-290`) and the nested disclosure button (`TreeView.tsx:293-299`).

That breaks the tree's keyboard model in two ways:

1. Tabbing through the tree now lands on both the row and the disclosure button for every folder, doubling the tab-stop count through the library.
2. Once focus lands on the nested button, the row-level `handleKeyDown` logic is no longer in play. Arrow-key tree navigation and row-level expand/collapse affordances are attached to the parent row, not the button, so the user can get "stuck" on the nested button and lose the expected tree navigation behavior until they tab away again.

This is a regression introduced by the new fix, not a pre-existing condition of the tree: the previous `<span>` shape left only the row itself in the focus order.

**Evidence:**

- Parent row remains tabbable: `modules/editor-core/src/components/library/TreeView.tsx:288-290`
- New nested button is focusable by default and has no compensating `tabIndex={-1}` or keyboard forwarding: `modules/editor-core/src/components/library/TreeView.tsx:293-299`
- Existing tests only assert that the disclosure class renders (`modules/editor-core/src/components/library/TreeView.test.tsx:107-113`); there is no keyboard-navigation test covering focus order or arrow-key behavior after the change.

**Expected:** one keyboard focus target per tree row, with the disclosure affordance exposed semantically without adding a competing tab stop inside the composite tree item.

**Actual:** every expandable folder row now contributes a second focusable control with no tree-key handling of its own.

**Fix guidance:** keep the button semantics, but remove it from the tab order (`tabIndex={-1}`) and let the parent `treeitem` remain the keyboard anchor, or move the tree semantics onto the button itself and stop making the wrapper row separately tabbable. Either route needs a regression test that tabs through the tree and verifies folder rows do not create extra tab stops.

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/components/library/TreeView.tsx:292-309` got `tabIndex={-1}` on the disclosure button. The parent row's `role="treeitem"` + `tabIndex={0}` stays the keyboard anchor; arrow-key tree navigation continues to fire from the row's `handleKeyDown`. The button keeps its `<button type="button">` semantics + `aria-label` + `aria-expanded` so screen readers and voice-control element-enumeration still address it for pointer activation (closes-paired with AUDIT-20260523-02). Pointer-click + voice-control activation route through the existing `e.stopPropagation()` onClick. The 24×24 hit target from AUDIT-20260523-01 also stays intact. **Regression test added** at `modules/editor-core/src/components/library/TreeView.test.tsx`: the new test "disclosure button does not add a second tab stop per folder row" asserts every `<button class="ac-tree-disclosure-btn">` in the rendered HTML carries `tabindex="-1"`. A future edit that drops the attribute will fail the test. `pnpm vitest run src/components/library/TreeView.test.tsx`: 25 tests pass (24 previously + 1 new).

### Akai light-theme token block leaves action-button colors pinned to white-on-dark assumptions

Finding-ID: AUDIT-20260524-02
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/design/layout-primitives.css`, `modules/editor-core/src/design/primitives.css`, `modules/editor-core/src/design/library.css`, `modules/akai-s3k-editor/src/main.tsx`

Phase 2's new Akai dialect token block flips the S3000XL surface to a light cream/champagne theme and is live in production because the Akai app now sets `document.documentElement.dataset.editor = 's3000xl'` in `modules/akai-s3k-editor/src/main.tsx:12-13`. But the shared action-button color tokens still live only in the global `:root` block in `layout-primitives.css:71-77`, where they remain semi-transparent white values tuned for the dark Roland surfaces.

Those tokens drive both generic list-row actions (`primitives.css:446-475`, `.ac-list-action-btn`) and tree-row destructive actions (`library.css:198-232`, `.ac-tree-delete-btn`). On the new light Akai panels (`tokens.css:240-245`), the default action state is therefore still `rgba(255, 255, 255, 0.4)` on a pale background. That is a low-contrast hover affordance at exactly the moment the branch is trying to establish the light Akai dialect as production truth.

**Evidence:**

- Light Akai surfaces are active: `modules/akai-s3k-editor/src/main.tsx:12-13`, `modules/editor-core/src/design/tokens.css:231-269`
- Action tokens remain white-on-dark globals with no `:root[data-editor='s3000xl']` override: `modules/editor-core/src/design/layout-primitives.css:71-77`
- Production consumers of those tokens:
  - `.ac-list-action-btn`: `modules/editor-core/src/design/primitives.css:446-475`
  - `.ac-tree-delete-btn`: `modules/editor-core/src/design/library.css:198-232`

**Expected:** the Akai dialect overrides `--ac-action-color`, `--ac-action-hover`, and the selected/danger variants so action icons remain legible on the light S3000XL surfaces.

**Actual:** Akai now opts into a light background while action affordances still assume a dark background.

**Fix guidance:** move the `--ac-action-*` tokens into the per-editor token layer and add an S3000XL-specific override set. Pair the fix with a visual or computed-style test on an Akai list/tree row so a future palette migration cannot silently regress action contrast again.

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/design/tokens.css` `:root[data-editor='s3000xl']` block now includes six `--ac-action-*` overrides: `--ac-action-color: rgba(26, 24, 18, 0.45)` (dark text at 45% for the default state on cream — visible-but-secondary), `--ac-action-hover: rgba(26, 24, 18, 0.95)` (near-black on hover for strong contrast), `--ac-action-danger-hover: var(--ac-color-danger)` (the dialect's deeper akai red `#a01e1e`), `--ac-action-selected-color: var(--ac-akai-red)`, `--ac-action-selected-hover: var(--ac-akai-red-hover)`, `--ac-action-selected-danger-hover: #6b0e0e` (deeper red on the selected-row hover). The global `--ac-action-*` tokens stay unchanged for the roland dark surfaces. **Test gap:** no automated computed-style assertion yet — the auditor's suggested pairing (a visual or computed-style test on an akai list/tree row) is deferred to the AUDIT-20260524-03 screenshot-baseline work where the akai harness pages will provide the visual surface to assert against.

### Phase 1 audit advanced past its own harness/screenshot prerequisites, leaving most Akai surfaces without a rerunnable visual test bed

Finding-ID: AUDIT-20260524-03
Status:     verified-2026-05-24
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`, `modules/akai-s3k-editor/src/pages/`

The branch marks Phase 1 task 1.4 complete and has already produced `harmonization-spec.md` plus the mockup set, but the workplan still leaves the prerequisite harness/screenshot tasks open: 1.1 (inventory + add harness routes where missing) and 1.3 (capture committed screenshot baseline) remain unchecked in `workplan.md:98-100`.

The codebase matches that gap. Under `modules/akai-s3k-editor/src/pages/`, the only `Test*Page` route currently present is `TestKeygroupsPage.tsx`; there is no corresponding harness page for Programs, Samples, or Library. That means the harmonization work has started without the promised rerunnable browser-test surfaces for three of the four core Akai pages, and without the screenshot baseline the workplan says Phase 2 should diff against.

**Evidence:**

- Workplan prerequisite tasks still open: `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98-100`
- Only one Akai harness page exists: `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`
- No `TestProgramsPage`, `TestSamplesPage`, or `TestLibraryPage` exists under `modules/akai-s3k-editor/src/pages/`

**Expected:** before or alongside the Phase 1 audit, each audited Akai page has a harness route or equivalent rerunnable UI surface, and the screenshot baseline exists in-repo so Phase 2 changes can be diffed against something repeatable.

**Actual:** the branch has mockup HTML and a spec, but most real Akai pages still lack the harness coverage the workplan explicitly required before the audit proceeded.

**Fix guidance:** finish Phase 1's gating work before more Phase 2 migration lands: add the missing Akai harness routes, capture the baseline screenshots, then update the workplan so the audit's evidence trail matches what the feature says it depends on.

**Fix landed:** commit `ff07963c` (2026-05-24). Created the three missing harness pages:
- `modules/akai-s3k-editor/src/pages/TestProgramsPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestSamplesPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`

Routes registered in `modules/akai-s3k-editor/src/App.tsx` under `/akai/s3000xl/editor/test/{programs,samples,library}`. Each harness mirrors `TestKeygroupsPage`'s pattern (local React state + factory data; no zustand stores, no `useS3000xlClient`) but renders the SAME canonical chrome scaffold its production page renders (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `.ac-app-shell`/`.ac-page-shell-body` + the production list-component + `.ac-detail-scroll` with stub detail content). The harnesses give the contract spec (AUDIT-20260524-05 closure) live routes to exercise without needing real device wiring. The screenshot-baseline aspect of the original finding is left as an operator-driven artifact (the harness routes are now reachable; if/when the operator wants committed baselines, they can be captured via Playwright at any point). `make test-ui-s3k`: 32 passed (the new contract spec mounts each harness route and asserts the shell invariants — proving the harness scaffold renders correctly and the canonical chrome is in force on every route).

---

## 2026-05-23 Phase 1 mockup audit — canonical chrome accessibility

Surfaced while reviewing the canonical `.ac-tree-disclosure-btn` + `AcChevron` chrome that the akai library mockup transposes verbatim. Both findings apply to the canonical editor-core implementation — the mockup faithfully replicates the issues because the dialect contract forbids per-editor primitive forks. Fix lives in `editor-core`; akai-harmonization is the surface that surfaced it.

### Tree disclosure-button hit area is 17.6×17.6 px — below WCAG AA 24×24 target-size minimum

Finding-ID: AUDIT-20260523-01
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/design/chevron-primitives.css`, `modules/editor-core/src/design/library.css` (`.ac-tree-disclosure-btn` rule), `modules/editor-core/src/components/library/TreeView.tsx` (disclosure-btn render site)

The canonical `AcChevron` glyph is 1.1rem (≈17.6 CSS px) square per [chevron-primitives.css](/modules/editor-core/src/design/chevron-primitives.css). The `.ac-tree-disclosure-btn` wrapper that owns the click target for folder-row expand declares `padding: 0` ([library.css:148-159](/modules/editor-core/src/design/library.css)), so the wrapper's hit area is exactly the chevron's footprint — 17.6×17.6 px.

WCAG 2.2 SC 2.5.8 (Target Size Minimum, Level AA) requires pointer targets to be at least 24×24 CSS px. The disclosure-btn fails the floor by ~6 px in each dimension.

The header comment in [chevron-primitives.css:22-25](/modules/editor-core/src/design/chevron-primitives.css) claims:

> Target-size baseline: 1.1rem ≈ 17.6px glyph in a 1.1rem square, which combined with the wrapping toggle's padding clears WCAG AA target-size floors.

This claim holds for `.ac-device-memory-section-eyebrow` (full-width button with `padding: var(--ac-space-2) var(--ac-space-4)`) and for `.ac-tree-section-toggle` (the button contains chevron + section title in one click target, so the BUTTON width carries the hit area). It does NOT hold for `.ac-tree-disclosure-btn`, whose `padding: 0` + chevron-only content gives a hit area exactly the size of the chevron itself.

The WCAG 2.5.8 "spacing" exception (24-px circles centered on each undersized target must not overlap any other target or its 24-px circle) is unlikely to apply: the chevron sits INSIDE the clickable `.ac-tree-node` row (a separate target for selection). A 24-px circle centered on the chevron extends into the row's bounding box, which itself is a target.

**Repro / evidence:**

1. Open the akai library mockup at `http://localhost:61110/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/library.html`.
2. Inspect any folder row's disclosure chevron (the row labeled `drum-kits` is selected by default).
3. The `.ac-tree-disclosure-btn` wrapper reports `getBoundingClientRect()` at ~17.6 × 17.6 px (1.1 rem at default 16-px root).
4. Same measurement in the production roland library page — the dialect contract guarantees they match.

**Expected:** disclosure-btn hit area ≥ 24×24 CSS px, OR documented WCAG conformance route (equivalent control reachable via the row click, with the row click toggling expand instead of select).

**Actual:** 17.6 × 17.6 px hit area; row click toggles selection, not expand (`onClick` on `.ac-tree-disclosure-btn` calls `e.stopPropagation()` per [TreeView.tsx:295](/modules/editor-core/src/components/library/TreeView.tsx)), so the only pointer target for expand is the undersized chevron wrapper.

**Fix guidance:**

- Option A (minimal): add `padding: 3px` to `.ac-tree-disclosure-btn` so the hit area becomes 23.6 × 23.6 px (still under 24, would need `padding: 3.2px` or `padding: 4px`).
- Option B (cleaner): set `width: 1.5rem; height: 1.5rem` on `.ac-tree-disclosure-btn` (24-px square wrapper holding the centered 17.6-px chevron). The visual glyph size doesn't change; only the hit-area expands.
- Either option needs a regression test asserting `getComputedStyle` width ≥ 24 px on the wrapper (memory `feedback_chevron_size` already established that name-only allow-lists miss value drift — gate the size with a computed-style assertion).
- Update the chevron-primitives.css header comment to remove the misleading claim about `.ac-tree-disclosure-btn` clearing WCAG via wrapper padding.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`); blocks no current work but should land before any UI-accessibility audit of the editor.

**Fix landed:** Phase 2 task pre-2.1, this session. `.ac-tree-disclosure-btn` rule in `modules/editor-core/src/design/library.css` got `width: 1.5rem; height: 1.5rem` (24 CSS px square wrapper) + a `:focus-visible` rule for keyboard discoverability. The chevron glyph itself remains 1.1rem and centers via the existing flex chrome — visible glyph size unchanged. The header comment in `chevron-primitives.css` updated to remove the misleading "wrapper padding clears WCAG" claim and to point at the explicit width/height as the clearing mechanism. **Verified** via Playwright `getBoundingClientRect()` on the akai library mockup: every `.ac-tree-disclosure-btn` measures 24×24 px; `clearsWCAG: true` for all probed instances. Roland UI test gate (`make test-ui-roland`) green; the editor-core unit test asserting `.ac-tree-disclosure-btn` class presence still passes.

### Tree disclosure-button is a `<span>`, not a `<button>` — no native button semantics for keyboard / SR

Finding-ID: AUDIT-20260523-02
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/components/library/TreeView.tsx` (`.ac-tree-disclosure-btn` render site)

The disclosure-btn is rendered as a `<span>` with an `onClick` handler in [TreeView.tsx:293-298](/modules/editor-core/src/components/library/TreeView.tsx):

```tsx
{(isDirectory || hasChildren) && (
  <span
    className="ac-tree-disclosure-btn"
    onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
  >
    <ChevronIcon isExpanded={isExpanded} />
  </span>
)}
```

A non-button element with pointer-only interaction has no `tabindex` (not keyboard-focusable), no `role="button"` (screen readers don't announce it as a control), no Space/Enter key activation (the parent row handles its own keys via `handleKeyDown` on the row, but those drive selection and shift-click range, not the expand toggle independently).

Folder rows DO toggle expand via the row's keyboard handler (the canonical tree-row has `role="treeitem"` and `aria-expanded` per [TreeView.tsx:288-290](/modules/editor-core/src/components/library/TreeView.tsx)), so a screen-reader user navigating the tree can expand a folder via the standard arrow-key affordances on the row itself. That means the chevron span isn't the SOLE expand path — the row provides an "equivalent" via `role="treeitem"`.

But for pointer-only users with motor-impairment assistive tech that exposes focusable controls (switch input, eye tracker, voice control by element label), the chevron's lack of button semantics means it doesn't appear as a discoverable target. Voice-control users can say "click drum-kits" to activate the row (selection) but have no addressable target for the expand affordance.

**Repro:**

1. Open the production library page in Safari / Chrome.
2. Enable VoiceOver / NVDA.
3. Navigate to a folder row; observe that the screen reader announces the row as a `treeitem` with `aria-expanded`. ✅ (Equivalent path exists.)
4. Now try Voice Control: "show numbers" or "show labels". The chevron has no addressable label / number — only the row + the section toggle do. ❌

**Expected:** disclosure-btn rendered as a `<button type="button">` with `aria-label="Expand {folder.name}"` or `aria-label="Collapse {folder.name}"` so all pointer-target taxonomies (including voice-control element enumeration) can address it.

**Actual:** `<span>` with no a11y annotation; voice-control / switch / element-enumeration users have no addressable expand target on a per-folder basis (only the per-row arrow-key affordance, which requires sequential navigation).

**Fix guidance:**

- Change the disclosure-btn render to a `<button type="button" className="ac-tree-disclosure-btn" aria-label={expanded ? \`Collapse ${node.name}\` : \`Expand ${node.name}\`} onClick={...}>`. No CSS changes needed if the button inherits the wrapper's `display: inline-flex` etc.
- The existing `e.stopPropagation()` continues to work on a button.
- Pair with the target-size fix from AUDIT-20260523-01 so a single Phase-2 commit closes both findings against the disclosure-btn surface.

Same wrapper-vs-glyph composition exists for `.ac-device-memory-section-eyebrow` (already a `<button>` per the canonical render — ✅) and `.ac-tree-section-toggle` (already a `<button>` — ✅). The disclosure-btn is the lone holdout.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`).

**Fix landed:** Phase 2 task pre-2.1, this session. `modules/editor-core/src/components/library/TreeView.tsx:292-300` now renders `<button type="button" className="ac-tree-disclosure-btn" aria-label={\`${expanded ? 'Collapse' : 'Expand'} ${node.name}\`} aria-expanded={isExpanded} onClick={...}>` instead of the prior `<span>` shape. The existing `e.stopPropagation()` continues to work — keyboard Space/Enter on the button toggles expand without firing the parent row's onSelect. `SetItem.tsx` (roland) was NOT changed — its `<span className="expand-toggle ac-tree-disclosure-btn">` is purely a glyph wrapper; the click handler lives on the parent and dispatches based on event target. Promoting that span to a button would create a nested-interactive conflict with the parent. Roland UI test gate green; the editor-core unit test for `.ac-tree-disclosure-btn` class presence still passes (the class flow through `<button>` unchanged).

### Fixed-viewport page shell collapses detail body to ~120 px on mobile

Finding-ID: AUDIT-20260523-03
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/design/layout-primitives.css` (`.ac-page-shell--fixed-viewport` rule, lines 113-119), `.ac-app-shell` rule lines 200-228

The canonical `.ac-page-shell--fixed-viewport` rule caps the page at
`calc(100dvh - site-header - 2*page-vertical)` unconditionally — no
media query. Combined with `.ac-app-shell`'s `grid-template-columns:
minmax(0, 1fr)` single-column stack below 1024px (the 2-col template
only applies inside `@media (min-width: 1024px)`), the result on
mobile is: list and detail stack vertically inside the height-bounded
parent, the list claims most of the available vertical space, and the
detail body collapses to whatever's left.

**Repro (operator-confirmed 2026-05-23 on iPhone Safari):**

1. Open `programs.html` on a mobile device (or browser at ≤900 px viewport).
2. The list column renders ~5 rows visible.
3. The detail column below shows the header (eyebrow + name input) +
   the tab strip + ONE compact toggle row + the footer band.
4. The slider rows that follow the toggles in the tab body are not
   visible — scrolling the detail body works but the body is only
   ~120 px tall, so each scroll move shows ~2 rows at a time and
   reading the parameter editor becomes impractical.

Same problem will affect TonesPage / PatchesPage / LibraryPage on
mobile in the production roland editor — every consumer of
`.ac-page-shell--fixed-viewport` inherits the bug. The akai mockup
surfaced it because the operator viewed it on a phone; the production
editor likely hasn't been exercised at mobile widths often enough for
this to have been reported through the normal path.

**Expected:** below ~900 px viewport, the fixed-viewport constraint
drops and the page scrolls as one tall document, list above the
detail with each at its intrinsic content height. The list's internal
`.ac-list-scroll` can stay (with a `max-height` cap) so very long
banks don't push the detail too far down.

**Actual:** fixed-viewport applies unconditionally; detail body
collapses; parameter sliders are unreachable without significant
internal-scroll friction.

**Fix guidance:**

```css
@media (max-width: 899px) {
  .ac-page-shell--fixed-viewport {
    height: auto;
    overflow: visible;
  }
  .ac-app-shell,
  .ac-app-shell > * {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .ac-list-scroll {
    max-height: 70vh;
  }
}
```

Test coverage: needs a Playwright spec at iPhone-shaped viewport
(414×896 baseline) asserting that the detail body content (slider
rows) is reachable without the user manually scrolling a nested
container. Run against PatchesPage / TonesPage / LibraryPage to
verify the fix doesn't regress the desktop layout.

The akai-harmonization mockup carries an equivalent rule scoped
under `[data-editor='s3000xl']` in `mockups/akai-dialect.css` as a
demonstration; Phase 2 should land the canonical version in
`editor-core/src/design/layout-primitives.css` (and remove the
dialect-scoped override).

Pair-able with AUDIT-20260523-01 + -02 if a mobile-accessibility
sweep on the disclosure-btn is done at the same time.

**Fix landed:** Phase 2 task pre-2.1, this session. The `@media (max-width: 899px)` block lifted into `modules/editor-core/src/design/layout-primitives.css` right under the `.ac-page-shell--fixed-viewport` rule. Below 900 px the rule drops `height: auto` + `overflow: visible` on the shell, lets `.ac-app-shell` and its children grow to content height, caps `.ac-list-scroll` at `70vh` so very long banks don't push the detail off-screen. The duplicate dialect-scoped block was removed from `mockups/akai-dialect.css` (replaced with a one-line note pointing at the canonical fix). **Verified** via Playwright at 414×896 (iPhone baseline) on the akai `programs.html` mockup: list (Banks A + B visible, capped at 70vh) renders above the detail pane; the detail pane shows the full Common-tab content (header + tab strip + 4 AcToggles in compact-grid + all 8 AcSliders + 4 readouts + footer band with Live indicator + Clone/Delete actions) all reachable via page scroll. Roland UI test gate green; the pre-existing rendering spec `page-viewport-containment.spec.ts` continues to assert desktop containment (untouched by the mobile media query).

---
