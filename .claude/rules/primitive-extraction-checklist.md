# Primitive-extraction dispatch checklist (defensive countermeasure)

**Status: defensive countermeasure pending deskwork canonical release.** This file encodes the controller-side pre-dispatch discipline that prevents the integration-layer-regression pattern surfaced by TF-016 and 4 audit cycles (AUDIT-20260524-10/11, 12/13, 14/15; AUDIT-20260525-16/17/18). When the deskwork repository ships its canonical dispatch-hygiene implementation, this file will be superseded; until then, the controller MUST work through this checklist before dispatching any primitive-extraction or primitive-promotion sub-agent.

## When this rule fires

Any dispatch that:
- **Extracts** a primitive into `editor-core` from a per-editor `common/` directory (e.g., AcRadioTabs promotion, AcZoneStrip extraction)
- **Builds** a new shared primitive in `editor-core` (e.g., AcFrequencyResponse, AcLiveStatusFooter)
- **Extends** a shared primitive's API surface (e.g., AcEnvelope's `kind: 'adsr'` variant, AcRadioTabs' controlled-mode, AcEnvelope's `activeSegment: number | null`)
- **Migrates** any consumer file to adopt a primitive that has changed shape since the consumer was last touched
- **Renames** any CSS class family that consumers may reference

If the dispatch touches `modules/editor-core/src/components/` AND any non-editor-core consumer file in the same change-set, this rule fires.

If the dispatch is purely intra-editor (no `editor-core` touch), this rule does not fire — proceed normally.

## Pre-dispatch checklist (controller-side; before sending the sub-agent brief)

Work through every item below. If any check surfaces a concern, fold it into the dispatch brief explicitly — DO NOT defer to "the sub-agent will figure it out." The pattern this rule names is precisely the controller assuming the sub-agent will catch what the brief didn't say.

### 1. CSS class-name conflict grep (AUDIT-20260524-10 lesson)

For every CSS class you intend the primitive to declare, grep across the WHOLE repo for existing usages of identical or close-prefix class names:

```bash
grep -rEn '\.ac-<class-name>\b' modules/ 2>/dev/null
grep -rEn 'className=.*\bac-<class-name>\b' modules/ 2>/dev/null
```

If any consumer outside the primitive's source-of-truth files matches, the class-name space is shared. Either:
- **Pick a different namespace for the new primitive** (e.g., `.ac-radio-tabs` instead of `.ac-tabs` when an existing button-tab system already uses `.ac-tabs`)
- **Migrate the existing consumer in the same dispatch** (riskier; touches more files)
- **Surface in the brief as NEEDS DECISION** if the conflict is non-trivial

What surfaced AUDIT-10: AcRadioTabs promotion lifted `.ac-tabs` / `.ac-tab` / `.ac-tab-strip` / `.ac-panels` / `.ac-panel` to global `editor-core/src/design/tab-primitives.css` — but `LibraryPanel` + `BuildInfo` already used `.ac-tabs` / `.ac-tab` for an unrelated button-tab system. The global override broke those consumers in production.

### 2. ARIA role / state validity audit on the legacy source (AUDIT-20260524-11, AUDIT-20260524-13 lesson)

Read every `role="..."` and `aria-*` attribute in the source you're promoting. Cross-check each role + state attribute pairing against the WAI-ARIA spec. Common invalid pairings:

| Role | Valid states | Common-mistake invalid pairing |
|---|---|---|
| `group` | `aria-labelledby`, `aria-label`, `aria-describedby`, `aria-disabled` | `aria-pressed` (button-only), `aria-selected` (option/tab/treeitem/gridcell), `aria-checked` (radio/checkbox/menuitemcheckbox) |
| `button` | `aria-pressed`, `aria-expanded`, `aria-haspopup`, `aria-controls` | `aria-selected` (use `aria-current` for "this is the current one") |
| `tablist` / `tab` / `tabpanel` | requires full ARIA tab contract (selected-state, controls linkage, keyboard nav for Left/Right/Home/End) | declaring the roles without the keyboard handler = faux tab semantics that don't behave |
| `status` + `aria-live` | requires that the element's CONTENT only mutates on discrete state changes | combining with a high-frequency ticker (e.g., 100ms setInterval) creates continuous announcement spam |

If the legacy source has any invalid pairing, the promotion is an opportunity to fix it — don't carry the invalid pattern forward. Surface explicitly in the brief: "Legacy primitive declares `aria-pressed` on `role="group"` containers — invalid per WAI-ARIA. Fix in this dispatch by switching to `data-selected` CSS-only state OR moving the selected-state to the inner interactive element."

What surfaced AUDIT-11: AcRadioTabs declared `role="tablist"` + `role="tab"` + `role="tabpanel"` + `tabIndex={0}` without keyboard handlers; carried-forward fake-tab semantics.

What surfaced AUDIT-13: AcZoneStrip carried `aria-pressed` on `role="group"` containers — invalid pairing.

What surfaced AUDIT-16: AcLiveStatusFooter combined `role="status"` + `aria-live="polite"` with a 100ms `setInterval` ticker; screen readers got continuous spam.

### 3. Value-domain delta enumeration (AUDIT-20260524-14, AUDIT-20260524-15 lesson)

For every value the primitive accepts or emits, compare the NEW primitive's contract against the LEGACY primitive's contract on these axes:

- **Integer vs float** — does the legacy primitive round? Does the new one? Does the consumer device-field require integer?
- **Range bounds** — does the legacy primitive clamp? Does the new one? What's the consumer's device-field acceptable range?
- **Index base** — 0-based vs 1-based — does the new primitive's API match the legacy's contract?
- **Nullability** — does the new primitive accept `null` / `undefined` as a sentinel? Does the legacy consumer pass a sentinel value (e.g., `0`) that the new primitive will silently coerce?
- **Unit semantics** — Hz vs MIDI vs normalized — does the consumer's adapter need to translate?

If ANY axis has a delta, the consumer adapter MUST translate. List each delta explicitly in the brief's "Consumer-side adapter contract delta" section. The sub-agent's grep for the legacy `onChange` shape will miss the delta unless the brief names it.

What surfaced AUDIT-14: AcFrequencyResponse emitted float `resonance`; legacy `FilterDisplay` rounded with `clamp()`; akai adapter forwarded float straight into integer device field `FILQ`.

What surfaced AUDIT-15: AcEnvelope's `activeSegment` is 1-based; consumer passed `0` as "no selection" sentinel; silent clamp to 1 = permanent fake-active highlight.

### 4. Consumer-side adapter survey (AUDIT-20260525-17 lesson)

For every page / component that will adopt the new primitive, ENUMERATE every existing `onChange`-like handler that issues device writes. Do not say "wire into every device-write callsite" — list each one in the brief. Common shapes the sub-agent's grep will miss:

- `handleParameterChange` (the common name)
- `handleRename<Thing>` (rename handlers — issue device writes via `client.renameProgram(...)` / `renameSample(...)` etc.)
- `handleDelete<Thing>` (delete handlers — device writes; may or may not warrant the same wiring)
- `handleClone<Thing>` (clone handlers — device writes)
- `handleSwap` / `handleReorder` (drag-reorder handlers — device writes)
- `handle<Action>Confirm` (dialog-confirm handlers in import/export flows — device writes)

If the brief names only the example handler shape, the sub-agent's grep will catch only matches. The brief must enumerate every actual handler in every consumer page — not the pattern, the literal list.

What surfaced AUDIT-17: brief said "wire `setLastEditAt(Date.now())` into every device-write callsite per page." Sub-agent grep'd for `handleParameterChange` and wired the matches. The rename handlers (`handleRenameProgram`, `handleRename`) don't follow that name pattern — they were missed; rename successfully updated device but footer stayed READY.

### 5. Test-contract drift survey (AUDIT-20260525-18 lesson)

For every page / component the dispatch will TOUCH (not just import the new primitive — actually modify any line), list its pre-existing test files. Read them. If any pre-existing test asserts a contract that the dispatch will break (e.g., asserts a test-id that the page no longer renders; asserts a string-format the page now renders differently), CALL IT OUT in the brief. Don't let the sub-agent leave a red test as "pre-existing baseline-flaky" — if the dispatch touches the page, the test goes with the page.

What surfaced AUDIT-18: `ProgramsPage.test.tsx:137-151` queried `data-testid="loading-status"` from a prior page-rendering contract. The page had migrated to `PageTitleRow` (metric/progress slot); test-id no longer rendered. I tracked it as "1 baseline-flaky failure" all session, but my AcLiveStatusFooter dispatch touched `ProgramsPage.tsx` — I had responsibility for that test.

### 6. ARIA + interaction-timing audit (AUDIT-20260525-16 lesson)

If the new primitive has BOTH (a) ARIA roles/states (`role="status"`, `aria-live`, `role="alert"`, etc.) AND (b) any interval/animation/auto-update behavior (`setInterval`, `setTimeout`, CSS animations, `useEffect` polling), the brief MUST specify whether/how the two contracts INTERACT.

Common failure: combining `role="status"` + `aria-live="polite"` with a high-frequency ticker creates continuous live-region announcement spam. The fix shape is almost always: split the announcement contract from the visual update. Visible chrome in a non-live `<div>`; separate `<div role="status" aria-live="polite">` carries a discrete announcement string that fires only on rising-edge state changes.

If the brief doesn't audit this, the sub-agent ships both contracts as specified — and the interaction is the regression.

What surfaced AUDIT-16: AcLiveStatusFooter brief required `role="status"` + `aria-live="polite"` AND a 100ms `setInterval`. Sub-agent shipped both as specified. The interaction was the regression.

## Mandatory brief sections (if this rule fires)

Every primitive-extraction dispatch brief MUST contain these sections (in addition to whatever else the dispatch needs):

### A. "Consumer-side adapter contract delta"

For each consumer file:
- What changed in the primitive's API surface vs the legacy implementation (value types, ranges, ARIA roles, class-name semantics, index base, state contract)
- What EACH consumer adapter MUST do to preserve the legacy wire-format / UI-state contract (round-then-clamp at the boundary, pass-null-instead-of-0, translate-rendered-index-to-source-index, etc.)
- Regression-test scaffolding the sub-agent MUST add at the adapter layer (NOT just at the primitive layer)

### B. "Test-contract drift survey"

For each page / component the dispatch touches:
- List its pre-existing test files
- Note any tests whose assertions will need updating after the dispatch lands
- Explicit instruction: failing tests on touched pages are in scope for the dispatch; the sub-agent does not get to leave them red

### C. "ARIA + interaction-timing audit" (only if primitive has ARIA roles + auto-update behavior)

- Enumerate the ARIA role/state attributes the primitive declares
- Enumerate the auto-update mechanisms (`setInterval`, `setTimeout`, animations, polling)
- Specify whether/how they interact
- If they MUST be split (e.g., visible chrome vs live-region announcement), name the split shape in the brief

### D. "Device-write callsite enumeration" (only if dispatch wires into per-page state)

- Read EVERY consumer page
- LIST EVERY handler that issues device writes (literally — not the pattern)
- The sub-agent's job is to wire the new state into the named handlers, not to grep for a pattern

## What this rule explicitly forbids

- "Sub-agent will figure out the adapter wiring" — no, the brief enumerates every callsite
- "Just check for class-name conflicts when writing the CSS" — no, the controller grep's pre-dispatch and surfaces conflicts in the brief
- "Carry forward the legacy ARIA pattern; we can fix it later" — no, audit catches it and the fix dispatch is more work than fixing in-place
- "Pre-existing baseline-flaky test is unrelated" — no, if the dispatch touches the page, the test goes with the page
- "Sub-agent's reported DONE is good enough" — no, controller re-runs the load-bearing gate AND scans for the 6 checklist items independently

## Process discipline when working on a primitive-extraction dispatch

1. Read this checklist BEFORE writing the dispatch brief.
2. Work through items 1-6 with concrete greps + reads.
3. Fold every finding into the brief as a Consumer-side adapter contract delta / Test-contract drift survey / ARIA + interaction-timing audit / Device-write callsite enumeration entry.
4. Send the brief.
5. After the sub-agent returns DONE, controller re-runs `make test-ui-roland` + `make test-ui-s3k` + `pnpm test:scope-discovery` + `make check-*` gates independently.
6. ALSO controller-side audit: scan the produced diff for each of the 6 checklist items — confirm the sub-agent didn't drift from the brief on any of them.
7. If a NEW finding surfaces (audit pass after the dispatch lands), add it to this checklist as a numbered item with a "What surfaced X" link.

## When this rule is superseded

The deskwork repository is shipping a canonical implementation of this dispatch-hygiene contract. When it lands and is available to this repo, the canonical replaces this file. Until then, this checklist is the contract — keep adding lessons to it as audit cycles surface them.

## Cross-references

- Pattern source: [`docs/1.0/001-IN-PROGRESS/akai-harmonization/tooling-feedback.md`](../../docs/1.0/001-IN-PROGRESS/akai-harmonization/tooling-feedback.md) TF-016
- Audit findings catalogued: `docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md` AUDIT-20260524-10 / -11 / -12 / -13 / -14 / -15 / AUDIT-20260525-16 / -17 / -18 / -19
- Codex-visible mirror: [`AGENTS.md`](../../AGENTS.md) "Primitive-Extraction Dispatch Checklist (TF-016 countermeasure)" — substantive mirror so Codex sessions inherit the same discipline; kept in sync per AGENTS.md "Canonical Sync Path". Both files retire together when the deskwork canonical lands.
- Reactive rule this is upstream of: [`.claude/rules/agent-discipline.md`](agent-discipline.md) "Validator-paired changes"
- Related CSS-promotion discipline: [`.claude/rules/css-refactor.md`](css-refactor.md) "CSS refactor protocol — screenshot first, one rule at a time"
