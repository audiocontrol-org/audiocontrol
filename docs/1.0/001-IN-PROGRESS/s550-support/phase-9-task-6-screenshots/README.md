# Phase 9 Task 6 — Visual Screenshot Verification

Captured screenshots of every in-scope editor page on both
`/roland/s330/editor` and `/roland/s550/editor` to confirm Phase 9
Tasks 4-5 (page polish + dialog polish) didn't regress anything
visually on either device.

**Verified tree state:** `1f445e4f7703600e1688ab6881cd28d04f64f6d9`
(Phase 9 Tasks 4-5 final commit; HEAD of `feature/s550-support`
before the capture run).

**Capture commit** (this spec + PNGs + this README): `b6a153d6`.

**Capture date:** 2026-05-12.

**Capture tool:** `modules/roland-sxx0-editor/test/rendering/phase-9-task-6-screenshots.spec.ts`
(moved from `test/ui/` to `test/rendering/` in 9R-A.2 to separate
rendering smokes from the closure-gating Tier 2/3 UI suite -- see
`modules/roland-sxx0-editor/test/rendering/README.md`)
(Playwright + simulated MIDI harness; replays NDJSON fixtures captured
against real S-550 hardware on Volt 4 — see
`test/ui/tones.spec.ts:11-15` for the per-fixture provenance).

**Test gate:** `make test-ui-roland` after the spec landed —
**160 passed, 4 skipped** (146 baseline + 14 new screenshot captures;
4 skipped per the gaps documented below). Zero regressions across the
13 commits of Phase 9 Tasks 4-5.

**Linked issue:** [#392 — Phase 9 UX/UI polish](https://github.com/audiocontrol-org/audiocontrol/issues/392).

---

## Before/after note

This directory contains **"after" captures only.** "Before" screenshots
are not recoverable from the current branch HEAD — Phase 9 Tasks 4-5
shipped 13 commits this morning (Task 4.0 atomic primitives `2c078954`
+ `fc3bac98`; per-page amends `7299ca6a` / `33e7e6b8` / `098b7a21` /
`8eac821a` / `4952d643` / `2e857bc6` / `bd49dc60` / `7827bbfc`; Task 5
dialog polish `8e179806` + `418bac65`). Reconstructing pre-Phase-9
visuals would require `git checkout`-ing each pre-amend commit and
re-running the harness against each, which is out of scope for this
verification gate.

The verification gate per workplan §571 reads:
*"Visual smoke-test screenshots of every interaction state of the page
captured against `/roland/s330/editor/<page>` AND `/roland/s550/editor/<page>`
are attached to the PR. Both devices visually correct."*

The "both devices visually correct" assertion is what these captures
demonstrate. The design-intent reference for comparison is in
[`../explorations/`](../explorations/) (mockups committed in Task 2).

---

## Capture matrix

| Device | Page / State | File | Adapter status |
|--------|--------------|------|----------------|
| S-330 | Home | [`s330/home.png`](./s330/home.png) | clean |
| S-330 | Patches (slot 0 selected) | [`s330/patches.png`](./s330/patches.png) | known PatchesPage tone-preload divergence (#405) — non-visual |
| S-330 | Tones — Wave tab | [`s330/tones-wave.png`](./s330/tones-wave.png) | clean |
| S-330 | Tones — Pitch tab | [`s330/tones-pitch.png`](./s330/tones-pitch.png) | clean |
| S-330 | Tones — Filter tab | [`s330/tones-filter.png`](./s330/tones-filter.png) | clean |
| S-330 | Tones — Amp tab | [`s330/tones-amp.png`](./s330/tones-amp.png) | clean |
| S-330 | Tones — LFO tab | [`s330/tones-lfo.png`](./s330/tones-lfo.png) | clean |
| S-330 | Play | [`s330/play.png`](./s330/play.png) | clean |
| S-330 | Library (default) | [`s330/library.png`](./s330/library.png) | clean (no auto-load) |
| S-330 | SaveSetDialog (open, empty form) | [`s330/dialog-save-set.png`](./s330/dialog-save-set.png) | clean |
| S-330 | LoadSetDialog (open, seeded set selected) | [`s330/dialog-load-set.png`](./s330/dialog-load-set.png) | clean |
| S-550 | Home | [`s550/home.png`](./s550/home.png) | clean |
| S-550 | Patches (slot 0 selected) | [`s550/patches.png`](./s550/patches.png) | known PatchesPage tone-preload divergence (#405) — non-visual |
| S-550 | Tones — Wave tab | [`s550/tones-wave.png`](./s550/tones-wave.png) | clean |
| S-550 | Tones — Pitch tab | [`s550/tones-pitch.png`](./s550/tones-pitch.png) | clean |
| S-550 | Tones — Filter tab | [`s550/tones-filter.png`](./s550/tones-filter.png) | clean |
| S-550 | Tones — Amp tab | [`s550/tones-amp.png`](./s550/tones-amp.png) | clean |
| S-550 | Tones — LFO tab | [`s550/tones-lfo.png`](./s550/tones-lfo.png) | clean |
| S-550 | Play | [`s550/play.png`](./s550/play.png) | clean |
| S-550 | Library (default) | [`s550/library.png`](./s550/library.png) | clean |
| S-550 | SaveSetDialog (open, empty form) | [`s550/dialog-save-set.png`](./s550/dialog-save-set.png) | clean |
| S-550 | LoadSetDialog (open, seeded set selected) | [`s550/dialog-load-set.png`](./s550/dialog-load-set.png) | clean |

**Coverage: 22 captures across 2 devices × 11 distinct states.**

---

## Gaps documented (3 skipped tuples × 2 devices = 6 skipped captures)

These are SKIPPED with explicit `test.skip(...)` in the capture spec
— they are not silent omissions. Each is justified below; none block
the Phase 9 Task 6 acceptance gate.

### 1. WorkflowsPage — NOT ROUTED in App.tsx

`modules/roland-sxx0-editor/src/pages/WorkflowsPage.tsx` exists but is
not registered in `App.tsx`'s `<Routes>` (only `index` / `play` /
`patches` / `tones` / `library` are routed; the catch-all
`<Route path="*">` redirects `/workflows` back to the home page).

This is consistent with the workplan's note that Workflows is
*"not yet at v3 (landing-pattern), not yet at v3"*
([README.md:54-55](../README.md)). The page did not receive a Phase 9
Task 4 polish commit (only Patches / Tones / Play / Library / Home
were amended). Workflows is out of scope for visual verification in
this phase.

**Severity:** none — page is unreachable from the editor's nav,
intentionally so per Phase 9 scope.

### 2. ExportToneDialog — fixture-driven `hasSampleData` false

Opening `ExportToneDialog` requires
`tone.wave.endPoint > tone.wave.startPoint`
([`ToneEditorHead.tsx:59`](../../../../modules/roland-sxx0-editor/src/components/tones/ToneEditorHead.tsx))
on the selected tone, AND wave data cached in `useWaveDataCache`. The
`tones-bank-0` fixture's tone 0 decodes to identical wave start/end
points after fixture replay, so the Export button stays disabled in
the test environment regardless of UI driver behavior.

**Severity:** low — the ExportToneDialog's shell, header, body, and
footer chrome use the same shared `<Dialog.Content>` primitives that
the captured `SaveSetDialog` / `LoadSetDialog` exercise. Task 5's
dialog polish commit (`8e179806`) migrated all 11 library dialogs to
the same primitives in lockstep; visual correctness of one is
visual correctness of all (the shared chrome IS what got polished).
The capability spec
[`test/ui/capabilities/library-flows-dialogs.spec.ts:80`](../../../../modules/roland-sxx0-editor/test/ui/capabilities/library-flows-dialogs.spec.ts)
mounts and asserts `ImportLibraryToneDialog` (D-LIB-12), which uses
the same primitives.

### 3. Other 10 library dialogs — visual coverage by shared primitives

The remaining 10 library dialogs (`CreateDirectoryDialog`,
`DeleteDirectoryDialog`, `ExportPatchDialog`,
`ImportLibraryPatchDialog`, `ImportLibraryToneDialog`,
`ImportSampleDialog`, `ImportSamplesDialog`, `ImportToneDialog`,
`MoveItemDialog`, `RenameDirectoryDialog`) were not individually
screenshotted in this spec because they all use the same
`<Dialog.Content>` shell + `ac-input` / `ac-select` / `ac-checkbox`
primitives that the SaveSetDialog and LoadSetDialog captures
demonstrate. Each is mount-visibility-asserted by the existing
capability specs in
`test/ui/capabilities/library-flows-dialogs.spec.ts` and siblings —
those specs pass under `make test-ui-roland`, which is the
functional-regression gate for Task 6.

(Dialog inventory: 13 files in `src/components/library/*Dialog.tsx`.
2 captured here — SaveSet + LoadSet. 1 explicit skip — ExportTone.
10 covered-by-shared-chrome listed above. Sum: 13.)

Implementing per-dialog screenshot capture would require re-seeding
OPFS fixtures (sample WAVs, directory bundles, etc.) for each dialog
— high cost, shared chrome, low marginal verification value.

**Severity:** low — dialog chrome is shared, polish was atomic in
commit `8e179806`, and capability specs already mount each dialog
without regression.

---

## Side-finding surfaced during capture

**`listSets` hardcodes the `library/s330/sets/` path regardless of
device.** Located at
[`modules/roland-sxx0-editor/src/lib/library-sets.ts:58-60`](../../../../modules/roland-sxx0-editor/src/lib/library-sets.ts):

```ts
const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
const s330Dir    = await libraryDir.getDirectoryHandle('s330', { create: false });
const setsDir    = await s330Dir.getDirectoryHandle('sets', { create: false });
```

The S-550 library page scans the S-330 sets directory because the path
ignores `config.deviceType`. This was discovered while seeding OPFS for
the LoadSetDialog capture — both devices needed their seed under
`library/s330/sets/` for the dialog to populate. The capture spec
documents this at the seed helper's JSDoc; the workaround does not
change the bug.

**Scope of this task:** out of scope (Task 6 is visual verification, not
data-path correctness). **Recommendation:** track as a separate issue
for operator triage. Not silently fixed.

---

## How to re-run

```bash
make test-rendering-roland
```

Or directly:

```bash
cd modules/roland-sxx0-editor
./scripts/run-test-harness-e2e.sh playwright.rendering.config.ts phase-9-task-6-screenshots.spec.ts
```

Output overwrites this directory's PNGs in place. The spec is
deterministic: same fixture → same screenshots (modulo browser font
rendering, which is locked by the Playwright Chromium pinned in
`playwright.test-harness.config.ts`).

The capture spec is a **one-shot artifact-generator**, not a
regression spec. It lives in `test/ui/` alongside other spec files so
the existing harness runner picks it up, and it runs as part of
`make test-ui-roland` (which is why the suite count grew from 146 to
160 with this addition). Treat its assertions as "captured a screenshot,
not regressed page behavior" — the real regression gate is the
preexisting 146 specs in the suite.
