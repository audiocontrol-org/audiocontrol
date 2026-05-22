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
Status:     fixed-awaiting-verification
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
Status:     acknowledged-2026-05-22
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
Status:     open
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-manifest.yaml`, `scope-inventory/journal.md`, `scope-inventory/runs/2026-05-22T05-35-58-088Z-6oi63i/synthesis.md`

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
Status:     open
Severity:   low
Surface:    `docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md`

The feature has already exercised `/scope-inventory` and recorded both a failed run and a successful run, but the corresponding section in `tooling-feedback.md` is still a placeholder.

Evidence:

- the feature docs now contain a failed run, a successful run, a journal, and a synthesis under `scope-inventory/`
- `tooling-feedback.md` still says the `make scope-inventory FEATURE=<slug>` and `/scope-inventory` section is pending at [tooling-feedback.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md:24)

Expected: after exercising `/scope-inventory`, this section should summarize the actual experience, including the missing-dependency failure and the successful strawman run, because Phase 2 acceptance requires one feedback section per exercised surface.

Actual: the underlying evidence exists, but the feedback document has not been updated to reflect it.

This is a low-severity documentation drift issue, but it weakens the claim that the Phase 2 validation feedback loop is being maintained as work happens.
