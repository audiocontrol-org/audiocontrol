# Audit Log — feature/roland-bugfix

This document is the feature-local audit log for `feature/roland-bugfix`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`

---

## 2026-05-21 PR #440 Review

### Ctrl/Cmd-click mutates the device-memory anchor, so the next Shift-click range starts from the wrong slot

Finding-ID: AUDIT-20260521-01
Status:     verified-2026-05-21
Severity:   high
Surface:    `modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx`

Fix: removed the `lastToneAnchorRef.current = index` / `lastPatchAnchorRef.current = index` assignment from the ctrl/meta branch in both `handleToneClick` and `handlePatchClick`. The anchor now only moves on plain click (or after a shift-click implicitly via the operator's next plain click). Inline comments updated to make the contract explicit. Regression test: `D-LIB-32` covers the plain → ctrl → shift sequence and asserts the resulting multi-set is `{T11..T15}` (range from the original anchor `T11`), not `{T13..T15}` (range from the most recent ctrl-click).

The new device-memory multi-select logic contradicts its own documented anchor behavior and breaks the `Ctrl/Cmd-click` then `Shift-click` workflow. The comment says modifier toggles should keep the page-level anchor where it was, but both handlers overwrite the anchor inside the modifier branch:

- tone path: [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:156) and [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:170)
- patch path: [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:188) and [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:201)

Repro:

1. Plain-click `T11` to establish the anchor.
2. `Cmd/Ctrl-click` `T13` to extend the set.
3. `Shift-click` `T15`.

Expected: the range extends from the original anchor (`T11`) through `T15`.

Actual: the range starts from the last modifier-clicked slot (`T13`) because the anchor was mutated during step 2.

Evidence the current test coverage misses this exact path: the PR's wiring suite passed (`make test-wiring-roland ARGS='library-flows-dnd.spec.ts'`), but the new specs cover plain-click plus modifier toggles and non-contiguous modifier selection, not the `ctrl/meta -> shift` sequence.

This is a load-bearing correctness bug in the headline multi-select workflow introduced by PR #440.

### Export drawers hard-code `S330` in user-facing copy, so S-550 mode is mislabeled

Finding-ID: AUDIT-20260521-02
Status:     verified-2026-05-21
Severity:   medium
Surface:    `modules/roland-sxx0-editor/src/components/library/ExportToneDialog.tsx`, `ExportPatchDialog.tsx`, `BatchExportDrawer.tsx`

Fix: replaced the hardcoded `S330` literal in all three drawers with `deviceName` extracted from `useDeviceConfig()` and uppercased at render. `ExportToneDialog` and `ExportPatchDialog` already called `useDeviceConfig()` for `memoryLayout`; both now destructure `deviceName` alongside it and route it through the form-body components. `BatchExportDrawer` didn't call the hook — added the import + call + threaded `deviceName` through `BatchFormBody`. Each rendered span gets a `data-testid={kind}-device-name` for direct test assertion. Regression test: `D-LIB-33` mounts the export drawer on the S-550 surface and asserts the eyebrow span resolves to `S-550`.


The new export UI hard-codes `S330` in three user-facing eyebrow rows instead of deriving the active device name from configuration:

- [ExportToneDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/ExportToneDialog.tsx:183)
- [ExportPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/ExportPatchDialog.tsx:195)
- [BatchExportDrawer.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/BatchExportDrawer.tsx:184)

Expected: the eyebrow copy reflects the active Roland surface, the same way slot labels already do via `memoryLayout`.

Actual: all three drawers render `... · LIBRARY · S330`, even when the editor is running in S-550 mode.

This is cross-device UI drift in a shared Roland surface. It likely escaped because the exercised review/test path was S-330-only.

---

## 2026-05-21 Feature-Docs Review

### The branch is still described as a narrow bug-fix catchment, but the extended PRD/workplan repurpose it into a broad clone-disposition and refactor program

Finding-ID: AUDIT-20260521-03
Status:     fixed-a93f8384
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md`, `workplan.md`, `README.md`

Fix: rewrote the top-level framing in all three docs to acknowledge the dual purpose explicitly. PRD title is now "Roland Bug-Fix Catchment + Scope-Discovery Validation"; Problem Statement opens with two numbered purposes (post-merge bug-fix catchment + validation test subject for scope-discovery-protocol Phase 4); both purposes cite the relevant PRs (#433/#434 for the catchment, #441 for the validation) and route the reader to the matching workplan phase. README mirrors the same dual framing in its title + intro. Workplan grew a new "Dual-purpose mandate (post-2026-05-22)" section before "Technical Approach" that names the three concurrent streams (Phase 1 / 2 / 3) and the discipline-conflict warning: implementers must check the Phase header of any task before applying its discipline, and Phase 1's "no sweep refactors" rule stays incompatible with Phase 3's refactor-PR shape so the two streams don't co-commit.

The feature docs still frame `roland-bugfix` as a post-merge bug-fix catchment for the Roland editor surface, but the extended Phase 2 and Phase 3 scope now turns the branch into a validation branch for the scope-discovery protocol plus a broad duplication-removal program.

Evidence:

- narrow bug-fix framing remains at [prd.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md:7) and [README.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/README.md:1)
- expanded mandate appears at [prd.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md:23) and [prd.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md:29)
- the workplan now requires dispositioning 172 clone groups and opening refactor PRs from those decisions at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:87) and [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:133)

Expected: if the branch has been intentionally repurposed, the top-level framing should say so directly, so future implementers understand they are working in a dual-purpose branch rather than a bug-fix-only branch.

Actual: the docs keep the old bug-fix framing while layering on a much larger scope-discovery/refactor charter underneath it.

This is not a code bug, but it is a planning/documentation defect that invites scope confusion and conflicting execution rules.

### Phase 2's closure target is too large for a sidecar validation effort and is likely to sprawl while Phase 1 bug intake remains open

Finding-ID: AUDIT-20260521-04
Status:     acknowledged-operator-deferred
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Operator disposition (2026-05-22): noted; deferred. The sprawl risk is real and the audit's framing is accurate. Operator instruction: address in the future as the need arises — i.e., if execution sprawl actually materializes, narrow Phase 2 to a bounded slice (Option A from the implementer's response) or restructure into two sub-features (Option B). No doc edits required now; this audit row stays in the log so the framing is preserved and a future re-trip into the failure mode has a paper trail to consult.

The Phase 2 / Phase 3 extension is mechanically coherent, but the closure target is oversized for a branch that is also expected to keep accepting operator-found bug fixes in Phase 1.

Evidence:

- Phase 2 calls for zero pending clone groups touching the Roland surface, from a stated starting point of 172 groups, at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:87)
- Phase 3 then requires one refactor PR per `refactor`-marked group (or batched sibling group) at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:133)
- Phase 1 remains open-ended and concurrent in the same branch at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:21) and [README.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/README.md:7)

Expected: either Phase 2 is narrowed to a bounded validation slice, or the docs explicitly acknowledge that this is effectively a second feature with its own sustained implementation stream.

Actual: the branch is asked to function as both an open-ended bug-fix catchment and a large-scale duplication-disposition/refactor vehicle, with no stated cap or stop condition short of clearing all 172 touching groups.

Risk: execution sprawl, priority thrash between incoming bug fixes and large refactor work, and pressure to batch unrelated changes in a branch whose Phase 1 discipline explicitly argues against sweep refactors.

---

## 2026-05-21 Scope-Inventory Docs Review

### The scope-manifest exists but is still a strawman, not a curated Phase 2 scope artifact

Finding-ID: AUDIT-20260521-05
Status:     fixed-dfb8baed
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-manifest.yaml`, `scope-inventory/journal.md`, `scope-inventory/runs/2026-05-22T05-35-58-088Z-6oi63i/synthesis.md`

Fix: curated `scope-manifest.yaml` per the synthesis.md hints. `generated_by: strawman` → `curated`; modules pruned 10 → 4 (kept `roland-sxx0-editor`, `editor-core`, `sampler-devices`, `e2e-infra` per PRD; dropped 6 out-of-scope); `/connect` route added; `devices: [s330, s550]` set on the five canonical Roland routes (`/_harness/*` + bare `/` kept device-agnostic); noise themes dropped (`https`, `audiocontrol-org`, `branch`, `disposition`); notes field updated with curation provenance. PRD gained a `## References` section (synthesizer warning addressed). Manifest validates against `tools/scope-discovery/schema/scope-manifest.schema.json` post-curation. Journal entry appended to `scope-inventory/journal.md` recording the curation mutations.

The feature now has scope-inventory artifacts, but the manifest does not yet satisfy the workplan's "curated manifest" acceptance bar. It is still explicitly documented as a strawman with known gaps.

Evidence:

- every route currently carries `devices: [none]` and `/connect` is missing from the detected route list in [scope-manifest.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-manifest.yaml:20)
- the successful run journal entry explicitly says `/connect` is missing, modules are over-enumerated, and themes contain noise tokens in [journal.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-inventory/journal.md:21)
- the synthesis reiterates that the operator should prune out-of-scope modules and add the device-axis matrix before downstream phase work treats the manifest as binding in [synthesis.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-inventory/runs/2026-05-22T05-35-58-088Z-6oi63i/synthesis.md:21)

Expected: either the manifest is curated to match the Roland Phase 2 scope, or the docs clearly mark the task as still in progress and not yet ready to satisfy the acceptance line in the workplan.

Actual: the artifact exists, but its current documented state is still "informational strawman" rather than "curated scope artifact."

This is not a tooling failure; it is a documentation/state-of-completion gap. The inventory run is usable evidence, but the curation step is still outstanding.

### `tooling-feedback.md` still marks `/scope-inventory` as pending even though the feature has already exercised it

Finding-ID: AUDIT-20260521-06
Status:     fixed-a93f8384
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md`

Stale evidence noted, but the fix already landed in commit `a93f8384` (the AUDIT-03/04 commit) — that commit updated `tooling-feedback.md` lines 24–32 with the real `/scope-inventory` experience (failed-then-successful run, ~30s timing, missing-`pnpm install` finding flagged as ❌ medium-severity, strawman over-enumeration noted, missing-`/connect` route noted, URL-noise themes noted, synthesizer warning lands-in-stderr-only noted). The audit-log evidence cite (`tooling-feedback.md:24`) is the section header, which is unchanged — but the body underneath was overwritten. The audit reviewed state at `07f6e2ae` (after the re-scope commit, before the AUDIT-03 commit landed). No further action required.

The feature has already exercised `/scope-inventory` and recorded both a failed run and a successful run, but the corresponding section in `tooling-feedback.md` is still a placeholder.

Evidence:

- the feature docs now contain a failed run, a successful run, a journal, and a synthesis under `scope-inventory/`
- `tooling-feedback.md` still says the `make scope-inventory FEATURE=<slug>` and `/scope-inventory` section is pending at [tooling-feedback.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md:24)

Expected: after exercising `/scope-inventory`, this section should summarize the actual experience, including the missing-dependency failure and the successful strawman run, because Phase 2 acceptance requires one feedback section per exercised surface.

Actual: the underlying evidence exists, but the feedback document has not been updated to reflect it.

This is a low-severity documentation drift issue, but it weakens the claim that the Phase 2 validation feedback loop is being maintained as work happens.

---

## 2026-05-21 Recent Implementation Review

### The Phase 2 acceptance counter in the workplan is stale after the probe-script disposition commits

Finding-ID: AUDIT-20260521-07
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: reframed the Phase 2 acceptance bullet to call out the 172 figure as the EXTENSION-TIME BASELINE (2026-05-22) rather than the current count; added "Current count drifts as dispositions land" + a new "Recompute pending counts" section with a tsx snippet that prints current `total / pending-touching / pending-intra`; updated the second acceptance bullet to record the most-recent computed numbers (146 pending touching us / 67 pending intra-roland at commit `4b069b82`). Tooling-feedback updated with the upstream recommendation to ship `make clone-summary` so future workplan numbers can be auto-computed rather than hand-edited.

The Phase 2 acceptance bullet still claims the current scope is "**172 of 495 pending**" clone groups touching `modules/roland-sxx0-editor` or `modules/editor-core`, but that count is no longer true after the recent disposition work.

Evidence:

- the workplan still presents the old count at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:73)
- the current `clones.yaml` has 146 `pending` groups that touch `modules/roland-sxx0-editor` or `modules/editor-core`, not 172
- the recent commits explicitly dispositioned 25 Roland-local groups (`c4067caecfdd` plus the 24-script batch), so leaving the top-line metric unchanged misstates remaining Phase 2 scope

Expected: the headline acceptance metric should stay synchronized with the current detector file, because it is the number operators will use to judge remaining work.

Actual: the disposition log moved forward, but the workplan's top-line scope counter still reflects the pre-disposition baseline.

### The batch-disposition row reports the wrong remaining intra-Roland count after applying 25 keep-with-reason decisions

Finding-ID: AUDIT-20260521-08
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: corrected the off-by-one in the batch row from `92 → 68` to `92 → 67`. Added an inline note ("(Earlier revision of this row said '→ 68'; off-by-one corrected per AUDIT-20260521-08.)") so the correction is traceable and the audit-row reference is bidirectional. Root cause was hand-arithmetic against the running ledger; the AUDIT-07 fix (recompute snippet + tooling-feedback upstream recommendation for `make clone-summary`) closes the recurrence risk by removing the hand-arithmetic step entirely.

The batch row says the recent probe-script dispositions changed the "Pending intra-roland count" from `92 -> 68 (-25 including the single-walkthrough)`, but that arithmetic does not match the current detector file.

Evidence:

- the row at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:135) claims `92 -> 68 (-25 including the single-walkthrough)`
- the same row lists 24 ids in the batch plus the prior single-walkthrough `c4067caecfdd`, which is 25 groups total
- the current `clones.yaml` contains 25 `keep-with-reason` groups whose members are all under `modules/roland-sxx0-editor/scripts/probe-wave-*.ts`, and 67 remaining `pending` groups whose members are all under `modules/roland-sxx0-editor`

Expected: if 25 groups were removed from an intra-Roland pending count of 92, the remaining count should be 67.

Actual: the row records 68, so the workplan's running tally is off by one.

This is not a detector or code defect, but it does weaken the trustworthiness of the disposition ledger that Phase 2 is relying on as its operator-facing source of truth.

---

## 2026-05-22 Latest Implementation Review

### The published Phase 2 recompute counts are stale again after the newest disposition batches and export-surface refactor

Finding-ID: AUDIT-20260522-09
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: removed the published "Most recent recompute" number from the Phase 2 acceptance bullet entirely. Replaced with a pointer to the recompute snippet ("Recompute pending counts" section) + the disposition log. The earlier AUDIT-07 fix mitigated the staleness by making recompute one bash command, but did NOT auto-update the published line — so the same staleness pattern recurred (caught by this finding). Eliminating the headline number eliminates the staleness surface entirely; future readers run the snippet or read the log. Both AUDIT-07 and AUDIT-09 are referenced in the bullet so the rationale is traceable.

The workplan's top-level Phase 2 progress line still cites the earlier recompute from commit `4b069b82` (`146 pending touching us / 67 pending intra-roland-sxx0-editor`), but several more disposition batches and one refactor have landed since then.

Evidence:

- the current published line remains at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:121)
- the latest `clones.yaml` now reports `493` total groups, with `101` pending groups touching `modules/roland-sxx0-editor` or `modules/editor-core`, and `62` pending intra-`roland-sxx0-editor`
- the recent landed commits `214a99b8`, `77d8003e`, `a793e4cc`, `38d42dcf`, and `81da20a9` all explicitly reduced the pending count after that older `4b069b82` snapshot

Expected: the published "most recent recompute" should either be refreshed to the latest on-disk counts or explicitly moved to the disposition log only, so the top-level progress indicator does not lag behind several landed batches.

Actual: the workplan now contains a known recount mechanism, but the headline progress line still points at an obsolete snapshot.

### The new `38c8236d8a7b` refactor row still omits the landed commit hash even though the refactor commit exists

Finding-ID: AUDIT-20260522-10
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: replaced the "Refactor commit lands with this row" placeholder in the `38c8236d8a7b` disposition row with the actual commit hash `81da20a9`, matching the `Commit \`30e7346e\`` convention from the earlier `80299d9fda8d` (SlotInfo) row. Root cause: my refactor commit message can't know its own SHA at write time, so the workplan row gets the placeholder; the post-commit step (replace placeholder with SHA) was skipped. Going forward, every refactor commit's follow-up should immediately swap the placeholder for the SHA — adding this as a 1-line discipline note to the workplan's Refactoring protocol section.

The newest refactor disposition row still says "Refactor commit lands with this row" instead of naming the actual landed commit, which breaks the same traceability convention the earlier `SlotInfo` row already follows.

Evidence:

- the row for clone group `38c8236d8a7b` at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:159) ends with `Refactor commit lands with this row`
- the refactor has already landed as commit `81da20a9` (`refactor(roland): extract DestinationEyebrow from 3 export surfaces — clones.yaml 38c8236d8a7b`)
- the earlier `80299d9fda8d` row already uses the desired shape: `Commit \`30e7346e\``

Expected: once the refactor commit exists, the disposition row should record its hash directly so the workplan remains a reliable index from clone-group decision to implementation commit.

Actual: the implementation landed and the tests pass, but the row still carries placeholder wording instead of the real commit reference.

---

## 2026-05-22 Latest Implementation Review (Phase 2 Closure)

### The Phase 2 closure summary claims 10 refactor commits, but the table only lists 9

Finding-ID: AUDIT-20260522-11
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

The new Phase 2 closure summary says "Refactor commits landed during Phase 2 (10)", but the table immediately underneath contains only 9 rows.

Evidence:

- the summary header at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:185) says `Refactor commits landed during Phase 2 (10):`
- the table rows at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:189) through [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:197) enumerate 9 refactor entries, ending with `ae0b5192`
- `clones.yaml` itself is closed correctly for this surface (`pendingTouchingUs: 0`), so this is a summary-table mismatch rather than a detector failure

Expected: the closure summary count and the table row count should match, because this section is the top-level audit trail for which refactors actually landed during Phase 2.

Actual: the narrative says 10 while the table documents 9.

Fix: changed the summary header from "Refactor commits landed during Phase 2 (10):" to "Refactor commits landed during Phase 2 (9):" to match the 9-row table. The count was simply wrong — there really were 9 refactor commits, not 10. (The phrasing "10" was probably remembering an early sketch that double-counted the test-first commits as separate "refactors.")

### The `downloadBlob` refactor row explicitly records that no protecting test was added, which conflicts with the workplan’s own refactor protocol

Finding-ID: AUDIT-20260522-12
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

The `5873e17e78bb` refactor row says "No protecting test added" even though the workplan’s Phase 3 / refactor protocol says every `refactor` disposition needs a regression-catching protecting test, or at minimum a clearly cited existing test that would fail under a botched refactor.

Evidence:

- the `downloadBlob` row at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:169) ends with `No protecting test added`
- the protocol section says every `refactor`-marked clone-group disposition must add at least one regression-catching test before the refactor lands, with only a narrow allowance for citing an existing meaningful test when that is genuinely sufficient, at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:219) and [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:236)
- the same commit `ae0b5192` cites existing protecting suites for the sibling `PatchList`/`ToneList` helper refactors in the next row, which shows the workplan already has a compliant pattern available for mixed refactor commits

Expected: either the `downloadBlob` row should cite an existing meaningful protecting test, or the protocol should explicitly carve out and document a real exemption for this class of pure browser utility refactor.

Actual: the row records a refactor with no protecting test while the governing protocol still says that is non-negotiable.

Fix: added `modules/roland-sxx0-editor/test/unit/browser-download.test.ts` — a focused vitest unit test that pins the four observable side effects of `downloadBlob` (createObjectURL fires with the blob; anchor href + download attributes at click time; click fires once; revokeObjectURL fires with the matching URL; DOM cleanup leaves no orphan anchor). Updated the workplan row to cite the test in place of the "No protecting test added" note. Test verified passing 2026-05-22. The auditor's framing — "if you have to argue for it, write the new test instead" — was the right call; the rationalization was the failure mode, not the function size.

---

## 2026-05-23 Latest Implementation Review

### The Phase 2 closure summary still lists `ROLAND-BUGFIX-V3-IMPORT` as a remaining follow-up even though V3-IMPORT is now complete

Finding-ID: AUDIT-20260523-13
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: rewrote the "Deferred-with-explicit-follow-up (remaining)" section at `workplan.md:206-207` — V3-IMPORT moved to a new "(closed since this list was opened)" sub-list with the 4 closing commit SHAs (`f2670944` / `c6c769b3` / `2f8b235b` / `19104420`) + closure date + GitHub issue link. "Remaining" list is now empty. The two-list structure preserves the historical record (what the follow-up was, when it was filed) without misrepresenting the current state. Duplicate AUDIT-15 closed in the same commit.

The latest implementation completed all three production import-dialog migrations, but the older Phase 2 closure summary still presents `ROLAND-BUGFIX-V3-IMPORT` as an outstanding deferred follow-up.

Evidence:

- the closure summary still lists `ROLAND-BUGFIX-V3-IMPORT` under "Deferred-with-explicit-follow-up (remaining)" at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:207)
- the latest commits explicitly complete that work:
  - `c6c769b3` migrated `ImportLibraryToneDialog`
  - `2f8b235b` migrated `ImportSamplesDialog`
  - `19104420` migrated `ImportLibraryPatchDialog` and states `V3-IMPORT complete`
- the adopter manifest comments now also say "All 3 production Import dialogs are now v3 SlideDrawer adopters; V3-IMPORT is complete" in [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:273)

Expected: once the follow-up is fully closed, the Phase 2 closure summary should stop presenting it as remaining work.

Actual: the summary still reads as though the import-dialog migration is outstanding.

### The `slide-drawer-library-dialogs` adopter-manifest commentary still describes 5 Roland import holdouts even though none remain

Finding-ID: AUDIT-20260523-14
Status:     fixed-awaiting-verification
Severity:   low
Surface:    `docs/scope-discovery/adopter-manifests.yaml`, `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: scrubbed the stale "5 Roland holdouts" narrative across the cited locations. `adopter-manifests.yaml`: top-of-file backfill comment (lines 95-114), SlideDrawer section header (lines 223-231), per-editor breakdown comment (lines 237-245), `tracked_holdouts:` block lead-in (lines 264-272), and the diagnostic `message:` (lines 312-318) all updated to describe the post-V3-IMPORT state (6 Roland adopters / 0 Roland tracked / 9 Akai tracked). `workplan.md`: Phase 5 outcome table cell (line 341), Phase 6 cross-editor extension paragraph (line 374), and Phase 6 closure paragraph (line 382) all updated with the new counts + V3-IMPORT closure annotation (`[closed 2026-05-23 via #450]`). Historical plan sections (Phase 5 Goal / Gate / Tasks lines 304-326) left as-is — they describe the plan at write-time and editing them would rewrite history. Duplicate AUDIT-16 closed in the same commit. Follows the `feedback_grep_after_doc_sync.md` memory rule — grepped both files for `"5 Import dialogs"`, `"5 roland"`, and `"5 tracked"` before committing to confirm no stragglers remained.

The data structure is updated correctly, but several surrounding comments/messages still describe the old state where Roland had 5 pending SlideDrawer holdouts. That makes the manifest harder to trust as current operator documentation.

Evidence:

- the manifest comments still say "The 5 Import dialogs are tracked holdouts pending ROLAND-BUGFIX-V3-IMPORT" at [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:224)
- the inline convention comment still says "roland-sxx0-editor: 3 adopters + 5 tracked-holdouts" at [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:238)
- the manifest's diagnostic `message:` still ends with "The 5 Import dialogs are TRACKED HOLDOUTS pending ROLAND-BUGFIX-V3-IMPORT" at [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:316)
- the actual manifest state no longer matches that text: the `slide-drawer-library-dialogs` entry has `9` `tracked_holdouts`, all Akai-side cross-editor deferrals, and `0` Roland holdouts

Expected: the manifest commentary and human-facing replacement message should describe the current state: Roland complete, Akai deferred cross-editor.

Actual: the structure is current but the surrounding text still narrates the pre-completion Roland holdout state.

---

## 2026-05-23 Latest Implementation Review

### The Phase 2 closure summary still lists `ROLAND-BUGFIX-V3-IMPORT` as remaining work even though the migration completed on 2026-05-23

Finding-ID: AUDIT-20260523-15
Status:     fixed-awaiting-verification (duplicate of AUDIT-20260523-13)
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: duplicate of AUDIT-13 from the same audit run. Closed by the same commit; see AUDIT-13 for the resolution narrative.

The latest import-dialog migration commits complete the V3-IMPORT follow-up, but the Phase 2 closure summary still presents that follow-up as outstanding.

Evidence:

- the "Deferred-with-explicit-follow-up (remaining)" section still includes `ROLAND-BUGFIX-V3-IMPORT` at [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:207)
- the latest landed commits explicitly complete the work:
  - `c6c769b3` migrates `ImportLibraryToneDialog`
  - `2f8b235b` migrates `ImportSamplesDialog`
  - `19104420` migrates `ImportLibraryPatchDialog` and states `V3-IMPORT complete`
- the adopter manifest now has no Roland-side SlideDrawer holdouts left, only 9 Akai-side cross-editor tracked holdouts

Expected: once the migration is complete, the remaining-follow-ups list should stop naming it as unresolved work.

Actual: the summary still reads as though V3-IMPORT is pending.

### The SlideDrawer adopter-manifest commentary and downstream workplan notes still describe 5 Roland tracked holdouts, but the current manifest data has 0

Finding-ID: AUDIT-20260523-16
Status:     fixed-awaiting-verification (duplicate of AUDIT-20260523-14)
Severity:   low
Surface:    `docs/scope-discovery/adopter-manifests.yaml`, `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`

Fix: duplicate of AUDIT-14 from the same audit run. Closed by the same commit; see AUDIT-14 for the resolution narrative.

The manifest structure is current, but several comments and workplan notes still narrate the pre-migration state where Roland had 5 pending SlideDrawer holdouts.

Evidence:

- the manifest commentary still says "The 5 Import dialogs are tracked holdouts pending ROLAND-BUGFIX-V3-IMPORT" at [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:224)
- the human-facing `message:` still ends with "The 5 Import dialogs are TRACKED HOLDOUTS pending ROLAND-BUGFIX-V3-IMPORT" at [adopter-manifests.yaml](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/scope-discovery/adopter-manifests.yaml:316)
- the workplan still repeats the old state in multiple places, for example:
  - [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:341) says `5 roland + 9 akai`
  - [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md:374) says `roland-side: 3 actual adopters + 5 tracked-holdout exceptions`
- the actual manifest data now has `tracked_holdouts: 9`, all Akai-side cross-editor deferrals, and 0 Roland tracked holdouts

Expected: the commentary and matrix notes should describe the current state: Roland complete, Akai deferred cross-editor.

Actual: the machine-readable data is current, but the surrounding text still describes the superseded Roland-holdout state.
