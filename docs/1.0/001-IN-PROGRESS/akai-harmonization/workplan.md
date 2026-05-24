# Akai Harmonization — Workplan

**Branch:** `feature/akai-harmonization`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-akai-harmonization`

## GitHub Tracking

- **Parent issue:** [#457](https://github.com/audiocontrol-org/audiocontrol/issues/457) — `[akai-harmonization] feature lifecycle parent`
- **Phase 0 (rolling bug-fix pass):** [#458](https://github.com/audiocontrol-org/audiocontrol/issues/458)
- **Phase 1 (design-language audit):** [#459](https://github.com/audiocontrol-org/audiocontrol/issues/459)
- **Phase 2 (harmonization implementation):** [#460](https://github.com/audiocontrol-org/audiocontrol/issues/460) — blocked on #459 closure
- **Phase 3 (scope-discovery on the harmonized akai surface):** [#461](https://github.com/audiocontrol-org/audiocontrol/issues/461) — blocked on #460 closure

## Four-phase mandate

This workplan covers four intentionally co-located streams running concurrently on one branch:

- **Phase 0 — Rolling Bug-Fix Pass** (operator-surfaced, open-ended). Cross-cutting; runs throughout. Each fix is one commit; no sweep refactors slipped in. Discipline: "no while-I-was-in-here."
- **Phase 1 — Design-language audit** (`/frontend-design`-gated). Produces `harmonization-spec.md` — a primitive-by-primitive, page-by-page disposition spec. No code change; audit output only.
- **Phase 2 — Harmonization implementation** (post-Phase-1 approval). Migrates akai to canonical primitives where the spec says `adopt-roland-pattern`; promotes akai patterns to canonical where the spec says `adopt-akai-pattern`; extends `editor-core` with theme-token support for dialect variance. Each primitive migration is a refactor commit with `canonical_side` declared.
- **Phase 3 — Scope-discovery on the harmonized akai surface** (post-Phase-2 stabilization). Refreshes the akai clone baseline; dispositions every akai-touching entry in `clones.yaml`; lands refactor commits per the protocol's Step 0 (canonical-side + tests-proof) discipline; backfills adopter-manifests + anti-patterns; updates the editor-symmetry matrix.

The bug-catchment pass (Phase 0) runs concurrently with the design-audit / harmonization / scope-discovery streams, in separate commits. Phase 0's "no while-I-was-in-here" discipline is incompatible with Phase 2's primitive-migration shape and Phase 3's refactor-PR shape, so the streams co-locate on the branch but stay in separate commits. Implementers must check the Phase header of any task before applying its discipline.

Phase ordering between Phases 1 → 2 → 3 is load-bearing. Running scope-discovery (Phase 3) on the un-harmonized akai surface would produce a baseline that gets invalidated the moment Phase 2's harmonization commits land. The 142 existing akai entries in `clones.yaml` will need to be refreshed (via the `migration-map` system) after Phase 2 lands.

See [`prd.md` § Problem Statement](./prd.md) for the operator-level framing.

## Technical Approach

### Modules Affected

- `modules/akai-s3k-editor` (primary write target — conforms to canonical primitives in Phase 2)
- `modules/roland-sxx0-editor` (secondary write target where akai is the better canonical, or where roland is also drifting)
- `modules/editor-core` (canonical primitives + per-editor theme/dialect tokens)
- `docs/scope-discovery/` (`clones.yaml`, `adopter-manifests.yaml`, `anti-patterns.yaml`, `editor-symmetry.md`)
- `modules/launch-control-xl3` — NOT modified. An uncommitted `CLAUDE.md` edit there is unrelated and should be committed or stashed before branching.

### Strategy

- **Phase ordering is load-bearing.** Harmonization → scope-discovery. Running scope-discovery on the un-harmonized akai surface produces a baseline that gets invalidated as soon as harmonization commits land.
- **The `/frontend-design` skill drives Phase 1.** Use it to produce side-by-side screenshots of every akai page next to its roland equivalent (where one exists) and to propose harmonization moves. The audit's output is a markdown spec, not code.
- **Dialect variance lives in design tokens, not code paths.** Per the standing CLAUDE.md guideline: "Never use conditionals in UI components to switch behavior based on device configuration." Color/font/iconography variance between akai and roland surfaces is expressed through CSS variables / theme tokens, never through `if (device === 'akai')` branches. If a harmonization step would require a code-path branch, it is not actually a dialect — it is a structural divergence that needs a different `disposition`.
- **Bilateral changes use the canonical-side discipline.** Each refactor commit that promotes a primitive declares `canonical_side` in the commit message per the scope-discovery-protocol contract. The `harmonization-spec.md` entry for that primitive is the proof-of-design for the `canonical_side` choice.
- **The controller IS the gate.** After every implementer dispatch, the controller independently re-runs `make` and the relevant `make test-ui-*` gates plus `pnpm test:scope-discovery`. No CI; sub-agent reported counts are claims until verified.
- **Bugs are fixed as found — no deferral.** Per the standing agent-discipline rules ("Just for now is bullshit" + "Drive every effort to completion before starting the next"), every bug surfaced during the audit, harmonization, or scope-discovery phases is fixed in scope, in its own commit, before the surfacing phase advances. Filing-an-issue is not a `disposition` unless the operator explicitly accepts the deferral. See Phase 0 for the rolling-bug-fix discipline.
- **Dogfooding-feedback loop on scope-discovery-protocol.** If the audit or the harmonization phase surfaces gaps in the protocol (schema, scanner partitioning, registry shape), file them as issues against the scope-discovery-protocol feature and apply fixes back before continuing.

### Dependencies

- **`scope-discovery-protocol`** (merged via PR #454, 2026-05-22). All gates and tooling in place.
- **`roland-sxx0-editor` post-roland-bugfix-merge state** (PR #456, 2026-05-23). V3 chrome is the canonical baseline.
- **`editor-core`'s existing shared primitives.** SlideDrawer, PageTitleRow, AcChevron, useExportDialogLifecycle, useStepHistory, AcRadioTabs, BankHeader, SlotInfo, etc.

## Phase 0: Rolling Bug-Fix Pass (cross-cutting)

**Deliverable:** Operator-declared completion. Any bug surfaced during the audit, harmonization, or scope-discovery phases is fixed in its own commit before the surfacing phase advances. No deferral to "a separate effort"; no "we'll handle that later"; no IOU comments.

**Tasks:** Added to the triage table below as bugs are reported. No upfront task list — this phase is intentionally open-ended.

### Bug Triage Table

| ID | Reported | Surface | Description | Status | Commit |
|----|----------|---------|-------------|--------|--------|
| *(populate as bugs are surfaced by the audit, harmonization, or scope-discovery passes — one row per bug)* | | | | | |

### Discipline (mirrors roland-bugfix Phase 1)

- One bug per commit; descriptive commit messages; no sweep refactors folded in (the "no while-I-was-in-here" discipline).
- Visual verification of the reproduction (screenshot or test-harness check) before the bug-row is marked `Closed`.
- Each fix runs the load-bearing test gate (`make test-ui-akai` / `make test-ui-roland` as applicable) before claiming done; controller re-runs independently.
- Bugs accumulate in this triage table as they are discovered; no upfront task list.

### Per-Fix Acceptance Criteria

Each fix must satisfy all of:

- Visual verification of the reproduction (screenshot or test-harness check)
- Load-bearing test gate green at the fix commit (`make test-ui-akai` and/or `make test-ui-roland`, depending on surface touched)
- `make check-css-duplication` clean at the fix commit (only if CSS touched)
- `make check-clone-duplication` clean at the fix commit (only if TS/TSX touched — pre-commit hook enforces this automatically)
- `make check-chevron-sizing` clean at the fix commit (only if disclosure-chrome touched)
- `make check-anti-patterns` clean at the fix commit (only if TS/TSX touched)
- `make check-adopters` clean at the fix commit (only if a file in an adopter glob was touched)
- Controller independently re-runs the load-bearing test gate after the implementer reports `DONE`
- Operator confirms the bug is resolved before the row is marked `Closed`

A fix is not `Closed` until the operator has confirmed the row. `Closed` in the table means operator-confirmed.

## Phase 1: Design-language audit

**Deliverable:** `docs/1.0/001-IN-PROGRESS/akai-harmonization/harmonization-spec.md` — a primitive-by-primitive, page-by-page disposition spec with side-by-side screenshots. Audit produced via the `/frontend-design` skill.

If the spec grows past the 300–500-line file cap, split the per-page sections into sibling files (e.g., `harmonization-spec-skeleton.md`, `harmonization-spec-library.md`, `harmonization-spec-editors.md`) rather than padding a single mega-spec.

### Tasks

- [ ] **1.1 Inventory akai pages + test-harness coverage.** Walk `modules/akai-s3k-editor/src/pages/` and identify every page. For each, confirm whether a `Test<PageName>Page.tsx` (or equivalent harness route) exists. If a page lacks a harness route, add one before the audit can iterate against it (per the established convention: API tests are not UI tests; browser UI needs Playwright tests).
- [ ] **1.2 Inventory roland canonical-equivalent pages for each akai page.** Walk `modules/roland-sxx0-editor/src/pages/` and pair each roland page with its akai equivalent (1:1 where possible). Mark akai-only pages and roland-only pages explicitly; pages with no cross-editor pair go through the audit as single-surface entries.
- [ ] **1.3 Capture screenshots of every akai page** in default state plus key interaction states (hover, focus, expanded, error). Repeat for every roland equivalent. Commit the screenshots (or reference them via repo-relative paths) so the post-Phase-2 visual regression sweep can diff against the baseline.
- [x] **1.4 Run the `/frontend-design` audit** comparing each akai page to its roland equivalent. Produce per-page sections in `harmonization-spec.md` listing every visible primitive (page header, list rows, drawers, dialogs, chrome bands, eyebrow rows, status footers, virtual front panel, etc.) and its current state in each editor. → [`harmonization-spec.md`](./harmonization-spec.md) + 4 mockups under [`mockups/`](./mockups/) landed 2026-05-23.
- [x] **1.5 Disposition every primitive in the spec.** For each primitive, record one of:
  - `adopt-roland-pattern` — akai migrates to match roland.
  - `adopt-akai-pattern` — roland migrates to match akai.
  - `genuinely-dialect` — variance is constrained to color / font / iconography, expressed via design tokens.
  Document the rationale per disposition. The disposition entry is the proof-of-design for the `canonical_side` declaration in the Phase 2 refactor commit that implements it. → see [`harmonization-spec.md` § 5](./harmonization-spec.md#5-disposition-table-every-primitive-on-every-page).
- [x] **1.6 Identify akai-specific anti-patterns** surfaced by the audit. Add to a Phase 1 deliverable list of anti-patterns to register in Phase 2 against `docs/scope-discovery/anti-patterns.yaml`. → see [`harmonization-spec.md` § 6](./harmonization-spec.md#6-anti-patterns-identified-for-phase-2-task-25-registry-backfill) — 6 anti-patterns identified.
- [x] **1.7 Identify scope-discovery-protocol tooling gaps.** If the audit surfaces gaps (e.g., the editor-symmetry matrix needs to accept akai as a participant, or a registry schema field is missing), file them as issues against the scope-discovery-protocol feature for backfill during Phase 2. → see [`harmonization-spec.md` § 7](./harmonization-spec.md#7-scope-discovery-protocol-tooling-gaps-surfaced) — 3 gaps identified (filing as separate issues pending operator confirmation).

### Phase 1 Acceptance Criteria

- `harmonization-spec.md` covers every akai page in `modules/akai-s3k-editor/src/pages/` and every roland page in `modules/roland-sxx0-editor/src/pages/`.
- Every primitive in the spec has a `disposition` (`adopt-roland-pattern` / `adopt-akai-pattern` / `genuinely-dialect`) plus a one-line rationale.
- Audit screenshots committed (or referenced via repo-relative paths) for the post-Phase-2 visual regression diff.
- Anti-pattern candidate list captured (informs Phase 2 task 2.5).
- Tooling-gap issues filed against `scope-discovery-protocol` where applicable.
- Operator has reviewed and approved the spec before Phase 2 begins.

## Phase 2: Harmonization implementation

**Deliverable:** `akai-s3k-editor` uses canonical primitives wherever the spec says `adopt-roland-pattern`. `roland-sxx0-editor` takes promotions wherever the spec says `adopt-akai-pattern`. `editor-core` grows theme-token support for dialect variance where needed. The editor-symmetry matrix is updated.

### Tasks

Each task is one commit or one tight commit-set; `canonical_side` is declared in the commit message per the scope-discovery-protocol's refactor-preconditions checklist.

- [ ] **2.1 Theme-token infrastructure** (if not already in place per Open Question § "Theme-token infrastructure"). Introduce per-editor CSS custom-property scopes (root-level class or data-attribute) in `editor-core`. Wire `akai-s3k-editor` and `roland-sxx0-editor` to set their respective dialect tokens (color, font-family, accent variants). Validate via existing roland test pages.
- [ ] **2.2 Per-primitive migration commits.** One commit per primitive in `harmonization-spec.md`, in dependency order (lowest-level primitives first, page-level shells last). For each:
  - Ensure the canonical version of the primitive exists in `editor-core`.
  - Migrate the non-canonical-side consumer to import the canonical.
  - Close any `clones.yaml` entries the migration eliminates per the protocol's refactor-disposition rules (`canonical_side`, `canonical_reason`, `tests`, `tests_proof.{sha,demonstration}`, optional `new_shape_summary`).
  - Update the relevant adopter-manifest in `docs/scope-discovery/adopter-manifests.yaml`.
- [ ] **2.3 Cross-editor adopter-manifest backfill.** Add `akai-s3k-editor` as an adopter (or `tracked_holdouts:` entry where applicable) in every adopter manifest in `docs/scope-discovery/adopter-manifests.yaml`. Same for any roland additions made in Phase 2.
- [ ] **2.4 Editor-symmetry matrix update.** Run `make check-editor-symmetry-write` to regenerate `docs/scope-discovery/editor-symmetry.md` with akai as a first-class participant. If the matrix renderer does not yet support akai, file a tooling-feedback issue against `scope-discovery-protocol` and apply the fix as a paired commit (per the validator-paired-changes rule).
- [ ] **2.5 Anti-pattern registry backfill.** For each akai-specific anti-pattern identified in Phase 1 task 1.6, register an entry in `docs/scope-discovery/anti-patterns.yaml` with a paired adversarial scenario in the scope-discovery validator suite. Same-commit discipline applies: the anti-pattern entry and its adversarial scenario land in the SAME commit, and the gutted-stub self-check pattern is preserved.
- [ ] **2.6 Visual regression sweep.** Re-screenshot every akai + roland page post-harmonization; diff against the Phase 1 baseline (task 1.3) to verify the dialect-variance contract holds (color / font / iconography may differ; structure / layout / chrome must match).

### Phase 2 Acceptance Criteria

- Every `adopt-roland-pattern` and `adopt-akai-pattern` disposition from `harmonization-spec.md` has a corresponding commit.
- `genuinely-dialect` primitives differ ONLY in CSS variable values (no per-editor code branches in the JSX or hooks).
- All scope-discovery gates green at every commit: `make check-css-duplication`, `make check-clone-duplication`, `make check-chevron-sizing`, `make check-anti-patterns`, `make check-adopters`, `make check-editor-symmetry`.
- `pnpm test:scope-discovery` green at every commit.
- `make test-ui-akai` and `make test-ui-roland` green at every commit; controller independently re-runs after every implementer dispatch.
- `editor-symmetry.md` shows the post-harmonization parity state (or registered `tracked_holdouts:` entries where parity is intentionally deferred).
- Operator has visually approved the post-harmonization screenshot sweep before Phase 3 begins.

## Phase 3: Scope-discovery on the harmonized akai surface

**Deliverable:** Akai clone baseline is fully dispositioned; refactor-marked groups are closed; adopter-manifests and anti-patterns reflect the final state. The akai surface reaches scope-discovery parity with roland.

### Tasks

- [ ] **3.1 Refresh the akai clone baseline.** Run `make check-clone-duplication` against the post-Phase-2 tree. Any new clone groups that appear (because content-hashed IDs survive line shifts, but harmonization may have moved code into new file shapes) need IDs reconciled via `tsx tools/scope-discovery/clone-detector.ts --diff` and the `migration-map.yaml` system if IDs shifted.
- [ ] **3.2 Disposition every akai clone group.** Walk the akai-touching entries in `docs/scope-discovery/clones.yaml`. For each, record one of:
  - `refactor` — operator-approved cleanup target; will be closed in task 3.3 with a refactor commit.
  - `keep-with-reason` — intentional duplication; `reason` field MUST carry a one-line justification.
  - `ignore-with-justification` — false positive; `reason` field MUST carry a one-line justification.
  Use the bulk `tsx tools/scope-discovery/batch-dispose.ts --ids <ids> --disposition <kind> --reason "<text>"` tool where multiple groups share a `disposition` + `reason`.
- [ ] **3.3 Refactor commits for refactor-marked groups.** One commit per group (or batched sibling set per the protocol), each closing the `clones.yaml` entry with the `Closes clones.yaml <id>` marker plus `canonical_side` + `canonical_reason` + (when extracting a new primitive) `new_shape_summary` + `tests` + `tests_proof.{sha,demonstration}` per the refactor-preconditions checklist. The `commit-msg` hook enforces every required field at commit time.
- [ ] **3.4 Final adopter-manifest + anti-patterns sweep.** Re-run `make check-adopters` and `make check-anti-patterns` to verify the akai surface is locked in. Backfill any `tracked_holdouts:` entries the manifest scanner partitions out, with a one-line `reason`.
- [ ] **3.5 Implementation-summary doc.** Update [`./implementation-summary.md`](./implementation-summary.md) covering: clones drained (count), primitives promoted to `editor-core` (list), adopters registered (list), anti-patterns added (list), lessons for the next editor's harmonization (jv1080 / d110 / etc.).

### Phase 3 Acceptance Criteria

- All akai-touching entries in `docs/scope-discovery/clones.yaml` have a `disposition`; `pending-touching` count for akai is 0.
- All `refactor`-marked akai groups are closed with the protocol's full disposition shape (`canonical_side`, `canonical_reason`, `tests`, `tests_proof.{sha,demonstration}`, optional `new_shape_summary`).
- `make check-adopters` clean for the akai surface.
- `make check-anti-patterns` clean for the akai surface.
- `make check-editor-symmetry` clean; matrix lists akai as a first-class participant.
- `pnpm test:scope-discovery` green.
- `make test-ui-akai` and `make test-ui-roland` green; controller independently re-runs.
- Implementation-summary doc captures the cross-editor design-language contract as a reusable reference for future editor harmonizations.

## Per-phase gate summary

| Gate | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|---|
| `make check-css-duplication` | when CSS touched | n/a (audit only) | every commit | every commit |
| `make check-clone-duplication` | when TS/TSX touched | n/a | every commit | every commit |
| `make check-chevron-sizing` | when disclosure-chrome touched | n/a | every commit | every commit |
| `make check-anti-patterns` | when TS/TSX touched | n/a | every commit | every commit |
| `make check-adopters` | when adopter-glob file touched | n/a | every commit | every commit |
| `make check-editor-symmetry` | n/a | n/a | every commit (read-only) | every commit (read-only) |
| `pnpm test:scope-discovery` | when scope-discovery file touched | n/a | every commit | every commit |
| `make test-ui-akai` / `make test-ui-roland` | every fix commit | n/a | every commit | every commit |
| Controller re-runs gate independently | after every implementer dispatch | n/a | after every implementer dispatch | after every implementer dispatch |
