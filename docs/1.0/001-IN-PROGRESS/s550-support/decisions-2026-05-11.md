---
deskwork:
  id: e5cdc258-ae9f-463b-8b87-58de9dca8716
---
# Decisions needed — Phase 0 Task 10 closing + Phase 9 entry

**Date:** 2026-05-11
**Branch:** `feature/s550-support`
**Author:** controller (Claude)
**For:** operator decision

## Context

Phase 0 Task 10 (the capability test suite) was substantially driven forward this session under the new agent-discipline rule. Five waves were dispatched; four completed cleanly and one shipped partial with an honest BLOCKED return. Six concrete decisions are required from the operator before Phase 0 Task 10 can be marked fully complete and Phase 9 (the actual redesign) can resume.

This document enumerates each decision with:
- **Background** — what surfaced and why a decision is needed
- **Options** — concrete paths forward, each with scope estimate
- **Recommendation** — controller's read, with the dissent-friendly framing
- **Blast radius** — what changes if you pick option A vs B

The decisions are largely independent — pick option per item.

---

## Status snapshot

| Wave | Status | Tests added | Notes |
|------|--------|-------------|-------|
| Wave 1 (display capabilities, shipped before this session) | ✅ Done | 16 | |
| **Wave 2b** — multi-mode writes (#412) | ✅ Done | 4 (3 commits: main + 2 amendments) | Contract change to `SimulatedMidiTransport.connect()` — same adapter per transport lifetime |
| **Wave 2a** — patch writes (#411) | ✅ Done | 11 (2 commits) | Notable: scenario-file refactor + URL routing change (`/roland/s550/...` for write tests) |
| **Wave 2c** — tone writes (#413) | ✅ Done | 39 (3 commits) | 40 fixtures, 8-file scenario split, new `SimulatedAdapterIntrospection` interface, positive-assertion infrastructure that caught 7 silently-broken tests |
| **Wave 3** — display gaps (#414) | ✅ Done | 37 (1 commit) | 8 affordances honestly deferred (5 VFP + 3 web-MIDI D-CONN) — surfaced for operator decision |
| **Wave 4** — library/dialog flows (#415) | ⚠️ Partial | 8 of 15 (1 commit) | 7 affordances blocked on library-content-seeding infrastructure — operator decision |
| **Wave 5** — drag-drop (#416) | ⏸ Not started | — | 4 affordances; 2 of 4 are blocked on (3) library seeding |
| **Wave 6** — cross-cutting (#417) | ⚠️ Partial | 3 of ~7 (1 commit) | 4 VFP DT1-emit affordances blocked on (1) VFP mounting |

**Cumulative UI test count:** 31 (session start) → **132** (now)

**Inventory coverage:**
- Tested: ~21 → ~120 affordances bound to passing tests
- Untested (implemented, no test yet): ~128 → ~30 (most blocked on these decisions)
- Pending UI (missing affordances, separate features): 24 (unchanged — covered by issues #407-#410)

**Discipline-rule audit:** No `for now` / `TODO` / `FIXME` / `defer` markers introduced this session. CI workflow removed per earlier operator direction.

---

## Decision 1 — Virtual Front Panel mounting

### Background

[`feedback_virtual_front_panel`](../../../../.claude/CLAUDE.md) is a project memory rule that says:

> "Virtual front panel beneath the CRT — every editor page with the CRT also mounts a virtual front panel mirroring the S-550's physical buttons; it's not optional."

But: `VirtualFrontPanel.tsx` exists as a component and is **never instantiated anywhere in the editor source tree** (verified via grep). The same control set (NavigationPad, ValueButtons, FunctionButtonRow) is mounted inside `VideoCapture` (the camera drawer) — that's what currently provides the front-panel emit affordance.

**5 affordances are stuck on this decision:**

| ID | Affordance | Current status |
|----|-----------|----------------|
| D-XX-01 | Floating draggable VFP panel | partial (component exists, never instantiated) |
| D-XX-05 | VFP keyboard shortcuts | partial |
| D-XX-06 | VFP drag to reposition | partial |
| D-XX-07 | VFP collapse/expand | partial |
| D-XX-08 | VFP connection status indicator | partial |

Plus Wave 6's remaining DT1-emit tests (D-XX-02, 03, 04, 05) need the VFP mounted to be testable.

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Mount the VFP in `Layout.tsx`** | Probably ~50-100 lines in `Layout.tsx`; visual integration with existing page layouts; may need design tuning so it doesn't conflict with the CRT placement | Matches `feedback_virtual_front_panel`. Unblocks 5 affordances + Wave 6 DT1 tests (~9 specs total). Visually substantial — will need v3 mockup review. |
| **B. Strike the 5 D-XX rows; declare D-XX-09/10 (drawer-embedded controls) canonical** | Documentation-only — update inventory entries to note the VFP was deprecated in favor of drawer-embedded panel | Discards `feedback_virtual_front_panel` (operator decision; explicit override). 5 D-XX rows leave the inventory as "removed". Wave 6 DT1 tests can be written against the drawer panel instead (Wave 6 full close becomes possible). |
| **C. Defer the decision; let Wave 6 stay partial** | No work | Phase 0 Task 10 remains incomplete; Phase 9 still blocked. Status quo accumulates as drift over time. |

### Recommendation

**Option B (strike the rows)** for short-term unblock. Reasoning:
- The drawer-embedded panel already provides the same DT1-emit capability (per Wave 3's D-XX-10 binding); functional capability is preserved.
- Mounting the VFP per the memory rule is substantial Phase 9 work — better done as a redesign decision under `/frontend-design`, not as a Phase-0-Task-10 prerequisite.
- The memory rule was written when the v3 mockups assumed VFP mounting; the production code never matched. Rather than retrofit, declare the actual production behavior the contract and revise the memory rule.

**If you prefer A:** mount VFP — but this becomes Phase 9 atomic-primitives work; Task 10 stays blocked until then.

### Blast radius

- Option A: ~9 affordances unblocked; Layout.tsx changes; Phase 9 visual considerations.
- Option B: 5 affordances struck; inventory + memory rule updated; Wave 6 fully closeable.
- Option C: status quo drift.

---

## Decision 2 — Web-MIDI harness mode

### Background

`MidiConnectionPage` (in `editor-core`) hides the MIDI input/output port selectors AND the secure-context warning when `transportMode !== 'web'`. The Phase 0 simulated harness uses `transportMode === 'simulated'`. Wave 3 tried to bind these affordances but couldn't — they're not rendered in the harness.

**3 affordances stuck on this:**

| ID | Affordance |
|----|-----------|
| D-CONN-01 | MIDI input port selector |
| D-CONN-02 | MIDI output port selector |
| D-CONN-05 | Secure-context warning + help items |

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Build a web-MIDI mock transport** | New `mockWebMidiTransport.ts` in `editor-core` (~150 lines) + new harness URL param `?midi=web-mock` + 3 test fixtures | Unblocks 3 affordances; reusable for any future test of MidiConnectionPage's web-mode UI |
| **B. Accept "needs web-MIDI harness mode" as a permanent gap** | Documentation only — update the 3 inventory entries to note the gap; rely on manual / E2E hardware tests | 3 affordances stay untested forever (or until Phase 9 changes MidiConnectionPage significantly) |
| **C. Defer; revisit later** | No work | Drift |

### Recommendation

**Option B (accept the gap).** Reasoning:
- The port selectors are well-tested manually every time you connect to hardware (you've used them many times already).
- The secure-context warning fires only on HTTPS without `localhost`; the simulated harness can't trigger it without infrastructure for fake-insecure-context.
- Building a web-MIDI mock transport is ~150 lines of test-only code. Cost > benefit at this project size.
- If Phase 9 redesigns MidiConnectionPage, this decision can be revisited then.

### Blast radius

- Option A: 3 affordances unblocked; ~150 lines of test infrastructure; reusable for future ConnectPage changes.
- Option B: 3 affordances stay tagged "manual-only"; honest inventory; no work now.
- Option C: drift.

---

## Decision 3 — Library content seeding infrastructure

### Background

Wave 4 (library/dialog flows) shipped 8 of 15 affordances. The remaining 7 are blocked because they require **seeded library content**: individual tone / patch / sample YAML files (+ companion WAV files for samples) in OPFS, with the YAML content validated by the editor's import path.

**7 affordances stuck:**

| ID | Affordance | What it needs |
|----|-----------|---------------|
| D-LIB-12 | Import Library Tone dialog | Seeded library tone (YAML + valid `convertYamlToS330Tone`) |
| D-LIB-13 | Import Library Patch dialog | Seeded library patch (YAML) |
| D-LIB-17 | Loop Editor dialog (from library) | Seeded library sample (YAML + WAV) |
| D-LIB-18 | Sample Editor dialog | Seeded library sample |
| D-LIB-19 | Sample Chopper dialog | Seeded library sample |
| D-LIB-14 | Import Samples dialog (+ BestFitPicker) | Library samples seeded + DnD source (Wave 5) |
| D-LIB-21 | MemoryMapPanel WaveSegmentMap | Library samples seeded |

The Wave 4 implementer estimated ~300-500 lines of new seeding helpers (`seedOPFSTone`, `seedOPFSPatch`, `seedOPFSSample`) to unblock these. Wave 5 (DnD) is partially gated on the same infrastructure (drop library → device requires seeded library).

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Build the seeding helpers** | ~300-500 lines of new helpers + 7 specs + 7 device-side fixtures | Closes Wave 4 fully + unblocks 2 of 4 Wave 5 affordances. Total: 7 + 2 = 9 affordances bound. |
| **B. Accept Wave 4 partial; declare the 7 affordances "deferred to a dedicated library-test sub-phase"** | Documentation only — file a follow-up issue with explicit operator acceptance | 7 D-LIB affordances stay untested. The dialog flows have known correctness risk during redesign (no test catches if a save-set dialog stops emitting the right SysEx). |
| **C. Defer; revisit later** | No work | Drift |

### Recommendation

**Option A (build the helpers).** Reasoning:
- This is the largest single unlock in the remaining work — 9 affordances out of ~30 untested.
- The seeding helpers are reusable across the entire library test surface; they compound.
- The dialog flows touch core editor-derived functionality (Save Set, Load Set, Import) — these MUST be locked in before Phase 9 redesigns the LibraryPage.
- The 300-500 line estimate is a one-time cost; the helper test infrastructure is a long-term asset.

**Option B is a real deferral that the discipline rule was written to prevent.** I'm flagging it explicitly so you see it for what it is — but recommending against.

### Blast radius

- Option A: 9 affordances unblocked; Wave 4 fully closes; Wave 5 becomes 50% unblocked.
- Option B: 9 affordances deferred indefinitely; LibraryPage redesign work proceeds with reduced safety net.
- Option C: drift.

---

## Decision 4 — Wave 5 (drag-drop) approach

### Background

Wave 5 covers 4 DnD affordances:

| ID | Affordance | Blocked on |
|----|-----------|-----------|
| D-LIB-06 | Drag device tone → library | None — device tone state already available |
| D-LIB-07 | Drag device patch → library | None |
| D-LIB-08 | Drop library tone → device tone slot | (3) library seeding |
| D-LIB-09 | Drop library patch → device patch slot | (3) library seeding |

Playwright DnD is notoriously fiddly. Worth flagging:
- HTML5 DnD events (`dragstart`, `dragover`, `drop`) need precise simulation
- React-DnD (if used here) has its own test backend that can simulate drops without real browser events
- The Wave 5 implementer (when dispatched) will need to investigate which approach the library uses

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Wait on (3); then do Wave 5 fully (4 affordances)** | All-or-nothing | Cleanest; aligns DnD work into one focused dispatch |
| **B. Do partial Wave 5 now (D-LIB-06, 07 — device→library, 2 affordances)** | Per the partial pattern Wave 4 + Wave 6 used | Adds 2 affordances now; the other 2 wait on (3) |
| **C. Skip Wave 5 entirely; the 4 DnD affordances stay untested** | Documentation only | Acceptable if you're confident DnD won't be touched in Phase 9 |

### Recommendation

**Option A (wait + do Wave 5 fully after (3) lands).** Coupled work belongs in one dispatch; Playwright DnD setup is shared across all 4 specs.

### Blast radius

- Option A: 4 affordances unblocked after (3); single coherent dispatch.
- Option B: 2 affordances now; messy split.
- Option C: 4 affordances stay untested.

---

## Decision 5 — Progress-bar state bug in editor-core

### Background

The Wave 6 implementer surfaced a pre-existing bug while investigating D-XX-12 (progress indicators):

> The percent-bar `role="status"` progress region in `PatchesPage.tsx:266` never renders during a real load because `useBankLoader.loadPatchBank` calls `setError(null)` immediately after `setLoading(true, msg)`, and `editorStoreBase.setError` is contracted to reset `isLoading: false`. Verified via direct store inspection.

This is a pre-existing state-management bug in `editor-core`. The percent-bar is implemented but unreachable. D-XX-12 was bound as `partial` (test asserts the per-row `(loading...)` placeholder + page-title counter that ARE visible).

This is also a known shape of the design-system gap mentioned in the inventory: "% bar only; no bytes/elapsed/ETA per design system."

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Fix the editor-core bug** | ~5-line `setError` contract fix or `loadPatchBank` reordering. Affects S3K editor too. Audit needed | Percent bar starts rendering during loads. D-XX-12 test could be strengthened to assert it. |
| **B. Accept the partial test + design-system gap** | Documentation only — note in inventory + commit message that the percent bar is unreachable in production | Status quo. Percent bar code becomes dead code; consider removing in a future cleanup. |
| **C. Defer; revisit later** | No work | Drift |

### Recommendation

**Option A (fix it).** Reasoning:
- 5-line fix; the contract violation is in plain sight once named.
- Cross-cuts S3K editor; one fix benefits both.
- D-XX-12's test can be strengthened.
- Project memory `feedback_actually_review` says: when the operator catches a deferral the controller missed, the response is fix or revert. The Wave 6 implementer caught this bug; per discipline, fix it.

If you prefer not to touch editor-core now (it has its own ownership / regression-risk concerns), Option B is acceptable as long as the inventory entry is honest.

### Blast radius

- Option A: 5-line fix; 1 affordance strengthened; cross-cuts S3K (audit shared code path).
- Option B: dead code + honest inventory.
- Option C: drift.

---

## Decision 6 — Phase 9 atomic-control primitives sequencing

### Background

Once Phase 0 Task 10 is closed (every implemented affordance bound — or honestly struck), Phase 9 work resumes. The first prerequisite is the **atomic-control primitives**: `.ac-slider` (range-bar pattern), `.ac-select` (custom chevron), `.ac-checkbox`, `.ac-input`, VFD-glow envelope.

These were called out earlier as the gap between "shells polished" and "page complete." The PatchesPage + TonesPage redesign commits (`4bd11911`, `f633b95f`) shipped with vanilla browser controls inside polished shells — they are NOT counted as Phase 9 Task 4 done under the new workplan-discipline gate.

Also surfaced from Wave 2a code review (deferred at the time, surfacing now): promote `data-capability` + `aria-label` onto PlayPage's output and level controls so `play-writes.spec.ts` can use accessible queries (parity with sibling capability specs).

### Options

| Option | Scope | Effect |
|--------|-------|--------|
| **A. Build atomic primitives first; then amend PatchesPage + TonesPage; then continue per-page polish** | Substantial: 5 atomic primitives, design tokens, design-system doc updates, amendments to already-shipped redesign commits, then PlayPage / LibraryPage / WorkflowsPage / HomePage polish | Cleanest: each per-page commit becomes "page complete" under the new gate |
| **B. Continue per-page polish with vanilla controls; revisit atomic primitives at the end of Phase 9** | Same as the original Phase 9 plan that the discipline reform invalidated | Reverts to the "shell-only" pattern the operator just called out as half-assing |
| **C. Defer Phase 9 entirely; do other work first (e.g., the missing-affordance features #407-#410)** | Scope discussion | Substantial roadmap reshape; not implied by the original feature scope but possible |

### Recommendation

**Option A.** This is what the discipline reform was set up to enforce — Option B is explicitly the failure mode the operator flagged. The atomic primitives are the work that makes the redesign actually finished.

Sub-decisions inside A (defer to the operator):
- `data-capability` + `aria-label` promotion to PlayPage controls — couple this with the atomic-primitive build, since the primitives provide those attrs natively.
- The `networkidle` wait semantics in tests (broader test-utility refactor) — couple with atomic-primitive amendments, since the spec files will be touched anyway.

### Blast radius

- Option A: Phase 9 actually finishes; substantial UI work.
- Option B: half-assed redesign ships; operator catches it again later; discipline rule violated.
- Option C: Roadmap reshape.

---

## Summary table

| # | Decision | Recommendation | Unblocks |
|---|----------|----------------|----------|
| 1 | VFP mounting | B (strike rows) | Wave 6 full close; 5 D-XX affordances struck |
| 2 | Web-MIDI harness mode | B (accept gap) | 0 affordances unblocked; honest inventory |
| 3 | Library content seeding | A (build helpers) | 7 D-LIB + 2 D-LIB DnD = 9 affordances |
| 4 | Wave 5 approach | A (wait + full after 3) | 4 D-LIB DnD affordances (after 3) |
| 5 | Progress-bar bug | A (fix 5-line bug) | D-XX-12 strengthened |
| 6 | Phase 9 atomic primitives | A (build + amend) | Phase 9 actually completable |

If you accept all recommendations: ~14 more affordances bound; Phase 0 Task 10 closes cleanly; Phase 9 unblocks with the right ordering.

If you reject any: I'll surface the consequence in the workplan and adjust the next dispatch's scope.

## What happens after the decisions land

1. Apply per-decision work: VFP rows struck (1), library seeding helpers built (3), Wave 5 dispatched (4), progress-bar bug fixed (5), Phase 9 atomic primitives planned (6).
2. Wave 4 and Wave 5 close fully; Wave 6 closes if (1) goes Option B.
3. Retroactive validation: run the now-complete suite against PatchesPage + TonesPage redesign commits. (Already implicitly verified — 132 tests pass on HEAD which sits on top of those commits.)
4. Task 10 marked complete.
5. Phase 9 Task 4 resumes with the atomic-primitive prerequisite as task 4.0.
6. Per-page redesign continues, each commit landing the WHOLE page under the new gate.

The path is clear. The decisions are the next-move bottleneck.

---

## Appendix: commit history this session

```
4435eae4 feat(roland-sxx0-editor): Phase 0 Task 10 Wave 6 partial — panic + progress + live-edit guard
e14fbe83 feat(roland-sxx0-editor): Phase 0 Task 10 Wave 4 partial — library + dialog flow tests
dd3fe5a5 feat(roland-sxx0-editor): Phase 0 Task 10 Wave 3 — display-gap tests
aea2acdf fix(sampler-devices): expose SimulatedAdapterIntrospection interface
8c15d2d5 fix(sampler-devices): Phase 0 Task 10 Wave 2c — spec-review fixes
b4910e5c feat(roland-sxx0-editor): Phase 0 Task 10 Wave 2c — tone write tests
f490fa81 fix(roland-sxx0-editor): Phase 0 Task 10 Wave 2a — code-quality review fixes
cb78d439 feat(roland-sxx0-editor): Phase 0 Task 10 Wave 2a — patch write tests
cae7c994 fix(roland-sxx0-editor): Phase 0 Task 10 Wave 2b — code-quality review fixes
5634b35b fix(roland-sxx0-editor): Phase 0 Task 10 Wave 2b — amend per spec-review findings
fffde378 feat(roland-sxx0-editor): Phase 0 Task 10 Wave 2b — multi-mode write tests
55fe2c56 chore: remove CI workflow per operator decision
0cc4c2fd fix(roland-sxx0-editor): kill vite descendant tree, not just direct child
230c06b2 docs: workplan-discipline reform + port "Just for now is bullshit" rule
```
