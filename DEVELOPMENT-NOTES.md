# Development Notes

Session journal for the audiocontrol project. Documents what we tried, what worked, what didn't, and — most importantly — how the user course-corrected the agent's approach.

Each correction is tagged by category for pattern analysis:
- **[COMPLEXITY]** — agent defaulted to complex solution, user wanted simpler
- **[UX]** — agent neglected user-facing feedback
- **[FABRICATION]** — agent stated something without evidence
- **[DOCUMENTATION]** — agent didn't document or read existing docs
- **[PROCESS]** — agent didn't follow established workflow

---

## 2026-04-13: Architectural Type Deduplication (Phase 5)

### Feature: contracts
### Worktree: audiocontrol-contracts

### Goal
Resolve all 11 deferred architectural type duplication findings from the Phase 1 audit.

### Accomplished
- Batch 1 (6 items): OperationProgress canonical in sampler-library, SdsTransferProgress ambient .d.ts deleted, DrumKitImportProgress/InstrumentImportProgress extend OperationProgress, SaveProgress aligned to OperationProgress, BaseKitConfig + KitOutputConfigProps<T> generics in editor-core (5eba3af5)
- Batch 2 (5 items): WavFileMetadata shared in editor-core, LibraryDragData eliminated (converged on LibraryDragPayload), Dialog promoted to editor-core (ConfirmDialog composes it), TreeSectionProps converged (deleted 460-line LibraryTreeNode.tsx, adapter hook bridges), EditorStore shared factory (9746916d)
- Integrated latest DESIGN-NOTES.md from feature/akai-ux-improvement — added 3 new foundational principles (restore user context, never show empty state, progressive disclosure) and parameter editor patterns
- PR #251 merged to main
- All 16 original type duplication findings now resolved (5 from Phase 4 + 11 from Phase 5)

### Didn't Work
- d110-editor build failed after MIDI note dedup (previous session) — editor-core re-exported from `@audiocontrol/sampler-library` (Node entry) instead of `/browser`. Fixed by switching to browser subpath.
- EditorStore agent reported Roland build failure from LibraryDragData — was actually from the concurrent LibraryDrag convergence agent's in-progress work, not the store changes. Resolved when both agents completed.

### Course Corrections
- [PROCESS] Agent started fixing all type dedup items directly. User: "Are you fixing everything yourself?" — prompted delegation of 4 parallel agents for Batch 1. Applied lesson immediately for Batch 2 (5 parallel agents).
- [DOCUMENTATION] Agent tried to `git rm DESIGN-NOTES.md` during rebase conflict without reading latest content. User: "you should review and integrate the latest design notes before deleting." Read the file, found 3 new sections (parameter editors, state persistence, loading states, responsive header, auto-selection) not yet in DESIGN-SYSTEM.md.
- [DOCUMENTATION] Agent incorporated new DESIGN-NOTES.md content literally. User pushed for generalization: found 3 new foundational principles (restore user context, never show empty state, progressive disclosure) behind the specific patterns.

### Quantitative
- User messages: ~15
- Commits: 4 (Phase 5 workplan, batch 1, batch 2, workplan update)
- User corrections: 3 (1 PROCESS — delegation, 2 DOCUMENTATION — read before delete, generalize)
- Sub-agents used: 10 (1 research, 4 batch 1, 5 batch 2)

### Insights
1. **Two-batch approach worked well** for the 11 items. Batch 1 (mechanical fixes) validated the pattern; Batch 2 (architectural changes) was higher risk but agents handled it cleanly. Only one cross-agent conflict (LibraryDrag + EditorStore both touching Roland build).
2. **The "read before delete" correction** is the same pattern from the previous session. This should be a firm rule: when resolving a delete/modify conflict, always read the modified version first.
3. **All 16 type duplication findings resolved** across the feature. The codebase went from 16 duplicated types to zero. The compiler now catches divergence — adding a field to WavFileMetadata, OperationProgress, BaseKitConfig, or EditorStoreBase breaks all consumers at compile time.
4. **460-line LibraryTreeNode.tsx deletion** was the biggest single win. The adapter hook pattern (useLibraryTreeCapabilities) bridges device-specific callbacks to generic capabilities cleanly.

---

## 2026-04-12: Compiler-Enforced Contracts and Design System

### Feature: contracts
### Worktree: audiocontrol-contracts

### Goal
Establish compiler-enforced contracts and a design system document to reduce agent corrections and reinforce codebase consistency.

### Accomplished
- Phase 1: Audited 55 contract violations across 3 modules using 4 parallel sub-agents (phase1-audit.md)
- Phase 2: StrategyResult discriminated union, RefreshNotifier/ProgressReporter interfaces, 5 tree capability interfaces replacing 15+ triplicated callbacks (11aab81d, 682517ed)
- Phase 3: DESIGN-SYSTEM.md as single source of truth with 10 foundational principles; CLAUDE.md pointer (ba8896e1)
- Phase 4: Eliminated all 13 window.prompt/confirm/alert calls, fixed pixel widths, deduplicated 5 shared types (VfdGlowVariant, BackupProgress, useS330Store, cn(), MIDI note parsing) (5a3c6773, b63b50a4)
- Merged feature/akai-ux-improvement twice to integrate DESIGN-NOTES.md content
- Restructured DESIGN-SYSTEM.md from flat pattern catalog to 10 generalized principles with concrete examples
- PR #249 merged to main, issues #240-#244 closed

### Didn't Work
- Sub-agents couldn't write files (permission denied) during Phase 1 audit — had to write files from main agent
- First attempt at cn() extraction caused d110-editor build failure — editor-core re-exported MIDI utils from `@audiocontrol/sampler-library` (Node entry) instead of `@audiocontrol/sampler-library/browser`, pulling `fs`/`os` into browser bundles

### Course Corrections
- [PROCESS] Agent started implementing Phase 2 changes directly instead of delegating. User asked "Are you fixing everything yourself?" — prompted delegation of 4 parallel agents for type dedup.
- [DOCUMENTATION] When integrating DESIGN-NOTES.md, agent tried to delete it before reading the latest content. User corrected: "you should review and integrate the latest design notes before deleting."
- [DOCUMENTATION] Agent incorporated icon-specific patterns literally. User pushed for generalization: "Can you generalize the icon consistency issue. I think there are more basic concepts in there." Led to restructuring around 10 foundational principles.
- [PROCESS] Agent proposed untangling akai-ux-improvement from the branch via cherry-pick. User had a simpler plan: merge akai-ux-improvement to main first, then rebase contracts. Even simpler: user merged akai to main themselves, then we rebased.

### Quantitative
- User messages: ~25
- Commits: 9 (on rebased branch)
- User corrections: 4 (2 PROCESS, 2 DOCUMENTATION)
- Sub-agents used: ~12 (4 audit, 1 core contracts, 1 tree refactor, 1 consumer graph research, 1 design patterns research, 4 type dedup)

### Insights
1. **Generalization with concrete examples** is the right structure for a design system doc. The user pushed for this twice — first with icons, then asking what else could benefit. The result (10 principles) is more useful than the flat pattern catalog it replaced.
2. **Sub-agent permission issues** are a recurring friction. Agents consistently can't write files, requiring the orchestrator to do the writes. This adds latency and context burden.
3. **The DESIGN-NOTES.md → DESIGN-SYSTEM.md consolidation pattern** worked well: scratchpad captures decisions as they happen, periodic integration into the formal doc generalizes and structures them. The key insight is to always read the latest scratchpad before deleting — it may have evolved.
4. **Browser entry vs Node entry** for sampler-library is a recurring footgun. Any re-export from editor-core must use the `/browser` subpath to avoid pulling Node-only deps into browser bundles.

---

## 2026-04-12: Akai S3000XL Editor UX Improvement — All 5 Phases

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Restructure the Akai S3000XL editor from memory-oriented pages to workflow-oriented editing with full CRUD, zone mapping, multi-editor, and visual polish.

### Accomplished
- Phase 1: Audit — delegated 4 parallel research agents to audit CRUD coverage, map all parameters, review Roland editor patterns, identify editor-core extraction candidates. Wrote phase1-audit.md.
- Phase 2: Program Editor — delete with ConfirmDialog, inline KeygroupSummary, post-connect redirect to Programs page, 16 unit tests.
- Phase 3: Keygroup & Zone Mapping — ZoneOverview 2D visualization (keyboard x velocity), KeyRangeEditor (draggable bar), VelocityRangeBar (colored zone segments), CollapsibleSection for keygroup parameters, interactive KeygroupSummary (add/delete from program editor), 32 unit tests.
- Phase 4: Multi-Editor — ComparePane split view, ProgramSelector dropdown, usePaneKeygroups hook for per-pane state, responsive stacking below 1024px. Extraction deferred until Roland needs it. 12 unit tests.
- Phase 5: Visual Polish — extracted 5 duplicated UI primitives to @/components/ui/, fixed midiNoteToName duplication, added ac-page-shell to all pages, increased section spacing (space-y-1 → space-y-4), normalized typography (text-gray-200/font-semibold), polished not-connected states, ErrorBanner extraction. Wrote phase5-audit.md.
- Total: 98 unit tests passing, 14 test files, build clean.

### Didn't Work
- Phase 5 parallel agents both modified overlapping files (ProgramsPage, KeygroupEditor) — the P1 agent added ErrorBanner imports before P0 created the file. P0 agent resolved this by creating the file. Lesson: overlapping file edits in parallel agents need sequencing or conflict resolution.

### Course Corrections
- [PROCESS] User flagged that I hadn't reviewed the library-ux drawer patterns (SlideDrawer, SteppedProgressDrawer) before delegating dialog implementations. The recent merge introduced new UI patterns that I should have read first.
- [PROCESS] User clarified that ConfirmDialog is specifically for destructive action confirmation only — not for general operations.

### Quantitative
- User messages: ~12
- Commits: 0 (uncommitted — awaiting user review)
- User corrections: 2 (both PROCESS)
- Sub-agents spawned: ~18

### Insights
1. Parallel research agents (Phase 1) were highly effective — 4 audit agents completed in ~2.5 minutes total, producing comprehensive findings that informed all subsequent phases.
2. The orchestrator pattern works well when the main agent has enough context to write precise implementation prompts. The key is reading the actual source files before delegating, not just relying on descriptions.
3. Phase 5 audit-then-fix pattern (codebase-auditor agent produces findings report, then implementation agents fix) is more reliable than delegating "audit and fix" in one pass.
4. Pre-existing test failures in sampler-library (6 tests) should be investigated separately — they're on main.

---

## 2026-04-12: Program-Based Slicing — All 4 Phases

### Feature: program-based-slicing
### Worktree: audiocontrol-program-based-slicing

### Goal
Implement the full program-based slicing feature: chopping a sample produces a program (self-contained directory with program.yaml + WAV) instead of modifying the source sample.

### Accomplished
- Phase 1: Implemented `saveProgram()` / `loadProgram()` with `SourceInfoSchema` for provenance tracking, 38 tests (7f541aca)
- Phase 2: `handleChopperSave()` now builds ProgramYaml and calls `saveProgram()`, S3K strategy adds drum-kit key mappings via `transformChopperProgram()` (5ca148d2)
- Phase 3: Verified pre-existing program support in library browser, added zone count badge (ff5c4167)
- Phase 4: Editors work with programs — re-chop loads WAV, drum kit editor loads/saves zones, preview panel has Re-chop and Edit Kit buttons (1260f928)
- Created GitHub issues #223 (parent), #224 (Phase 1), #225 (Phase 2)
- All 4 phases complete in a single session

### Didn't Work
- Tried to remove slice fields from SampleSchema in Phase 1 — blast radius too large (saveChoppedSample, loadChoppedSample, library scanner, UI components all reference them). Deferred to a separate migration effort.

### Course Corrections
- [PROCESS] Agent started implementing Phase 2 directly instead of delegating to a sub-agent. User asked "are you delegating?" — same pattern as orchestrator sessions.
- [PROCESS] Agent needed to be told "proceed to feature complete" — was waiting for confirmation at each step instead of driving to completion.

### Quantitative
- User messages: ~8
- Commits: 4
- User corrections: 2 (both PROCESS — delegation and autonomy)
- Sub-agents used: 4 (Explore for research, typescript-pro x2 for Phases 2+4, ui-engineer for Phase 3)

### Insights
1. Sub-agent delegation worked well for Phases 2-4 — each agent received precise context and produced clean, buildable changes
2. Much of the program infrastructure (schema, scanner, preview panels, item type plugins) already existed from the library-ux feature — Phase 3 was mostly verification
3. The SampleSchema cleanup is the right thing to defer — it's a migration concern, not a feature concern
4. The "are you delegating?" correction is the same pattern from 4/4 orchestrator-adjacent sessions now. The structural fix (restricted tool access) from the orchestrator-agent feature should help, but the instinct to implement directly is strong when the context is loaded

---

## 2026-04-12: SteppedProgressDrawer, All Dialogs Migrated (Session 5)

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Complete Phase 18: build SteppedProgressDrawer, migrate all remaining transfer dialogs, eliminate all modal dialogs from the library page.

### Accomplished
- SteppedProgressDrawer component in editor-core — standard for all multi-step operations (6d94e6df)
- ImportInstrumentDialog → stepped flow, no second approval, 520→220 lines (5ed3822d)
- ExportProgramDialog → stepped flow, auto-start (5652c069)
- SendSampleDialog → stepped flow with SDS progress bar (5652c069)
- ReceiveSampleDialog → stepped flow (5652c069)
- ImportProgramDialog → stepped flow, 350→180 lines (3a7c26ba)
- DiskToLibraryDialog → stepped flow with per-sample progress (93ca9322)
- ImportDrumKitDialog → stepped flow with per-slice progress (2f1d5611)
- Cancel button on SteppedProgressDrawer (0d0eab67)
- Device memory refreshes after each sample upload (0d0eab67)
- Consistent no-confirm deletes everywhere — removed window.confirm from device delete (7f91e70f)
- Fixed DiskToLibrary infinite re-render loop from unstable callback deps (0a1656dd)
- Fixed SendSample progress byte calculation (7812317e)
- Filed #222 — chopped samples should be programs, not modified samples
- Total: ~3,000 lines of modal code → ~1,500 lines of stepped drawer code

### Didn't Work
- DiskToLibraryDialog had infinite re-render loop — `onTransferComplete` and `ensureFileBlocks` in effect deps got new references each render. Fixed with refs.
- SendSample progress showed inflated byte counts — used made-up formula (`packetsSent * 120 * 2`) instead of deriving from known total size and percentage.

### Course Corrections
- [UX] User pointed out second approval dialog in import flow — "It's all a single operation that doesn't need a second approval step." Led to SteppedProgressDrawer design.
- [UX] User requested stepped progress be the standard for ALL multi-step operations, not just transfers.
- [UX] User noted delete inconsistency — library objects had no confirm, device objects had window.confirm.
- [UX] User noted missing progress bar on sample upload.
- [UX] User noted inflated byte count in progress display.
- [UX] User clarified chopped sample/drum kit conceptual model — slicing should be tied to programs, not samples. Filed #222.

### Quantitative
- User messages: ~20
- Commits: 12
- User corrections: 6

### Insights
1. **SteppedProgressDrawer is a major UX improvement.** Multi-step operations are now transparent — the user sees exactly what's happening, what's done, what's next. No modal popups, no second approvals.
2. **Callback stability in React effects is critical.** Three separate dialogs had to use refs for callbacks to avoid infinite re-render loops. This is a recurring pattern — every dialog migration hit it.
3. **~1,500 lines removed** across 7 dialog migrations. The stepped pattern is more concise because it eliminates per-phase UI (separate JSX for confirm, progress, success, error states).
4. **The chopped-sample-as-program insight (#222)** is architecturally significant — it resolves the fuzzy distinction between samples, chopped samples, and drum kits by making slicing a property of programs, not samples.

---

## 2026-04-11: Visual Polish, SlideDrawer, Program Save Fixes (Session 4)

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Implement Phase 18 (visual polish, slide-over drawers) and fix program save/import bugs found during testing.

### Accomplished
- Merged latest main into feature branch, resolved conflicts (a4ba63bb)
- Consistent panel headers across all four columns — new `ac-panel-header` CSS class (e6c1a5cf)
- Preview panel gets background/border matching other columns (e6c1a5cf)
- Library column header integrates connection status + refresh button (e6c1a5cf)
- SlideDrawer component in editor-core — slides from right with backdrop and transition (626f658d)
- MoveDialog migrated to SlideDrawer (4a20fc9d)
- CreateFolderDialog migrated to SlideDrawer, replaced window.prompt (3a7f3091)
- ImportInstrumentDialog migrated to SlideDrawer (ff5c5426)
- Category-aware filesystem routing — create/move/delete/batch ops route to correct root based on categoryId (56f7217d)
- Inline error banner replaces full-page error takeover (56f7217d)
- Removed window.confirm from library delete (8b15f2b7)
- Import-instrument passes fromProgramsDir based on category (ff5c5426)
- Save device programs to common area — converts S3K keygroups to zones (1815ceb6)
- sanitizeForFilename converts spaces to underscores (akaitools convention) with backward-compatible fallback (380afbab, 48e119c3)
- Auto-reload disk data when partition cache is missing after page reload (b74e12c6)
- Actionable error messages for NotFoundError (db912448)
- Disk browser restores both common and Akai library save options for programs (a5107a0b)

### Didn't Work
- sanitizeForFilename space→underscore change broke lookups for existing directories. Had to add fallback to raw trimmed name for backward compatibility.
- Removed "Save to Common Library" from disk browser programs when the capability existed — just wasn't wired correctly. Removed the option instead of fixing the code.
- Multiple rounds of debugging fromProgramsDir: preview panel hardcoded `false`, context menu handler didn't pass it through, effect deps didn't include it.

### Course Corrections
- [PROCESS] Agent removed "Save to Common Library" from disk browser instead of fixing the save path. User: "Why can't I save a program from the Akai device to the common area?" The code existed — agent just hadn't traced the full flow.
- [PROCESS] Agent assumed "stale data" caused the import error without reading the code. User: "Why do you think the error is from stale data?" — forced proper investigation.
- [UX] Error message "The object can not be found here" was the raw browser NotFoundError. User: "Did you make the user-facing error more informative?" — needed explicit prompt to fix.
- [UX] No console logging for import errors — user reported "there's no error in the log". Errors were caught and displayed but never logged.
- [UX] Modal dialogs throughout — user: "so 1995 to have modal dialogs popping up all over the place." Shifted to slide-over drawer pattern.
- [UX] Delete used window.confirm — user showed screenshot of native browser dialog.
- [UX] Create folder used window.prompt — user showed screenshot of native browser dialog.
- [UX] Error display took over entire library view — user: "this is a weird way to present errors."
- [DOCUMENTATION] Agent tried to implement Phase 18 without documenting plan first (corrected in Session 3, repeated pattern awareness needed).

### Quantitative
- User messages: ~40
- Commits: 18
- User corrections: 9

### Insights
1. **Trace the full data flow before claiming a fix.** The `fromProgramsDir` flag had to be passed through 5 layers (context menu → strategy → transfer callback → dialog state → dialog component → library function). Missing it at any layer caused silent failure.
2. **sanitizeForFilename changes are migration events.** Changing how filenames are generated breaks all existing lookups. Always add a fallback for the old naming convention.
3. **The `saveToCommonLibrary` function already existed** — the disk browser had a working common-area save for programs. The agent removed the menu option instead of checking the code. "The code exists — I just hadn't traced the full flow" is a pattern to watch for.
4. **Every catch block should log.** The import error was caught and displayed to the user but never logged to console. The user had to report "nothing in the log" before the agent added logging.
5. **Slide-over drawers are a clear UX win** over centered modals for library operations — the tree stays visible and interactive.

---

## 2026-04-11: Orchestrator Agent Implementation

### Feature: orchestrator-agent
### Worktree: audiocontrol-orchestrator-agent

### Goal
Replace the generic boilerplate orchestrator with two purpose-built roles (project-orchestrator and feature-orchestrator) and a full set of lifecycle skills.

### Accomplished
- Split orchestrator into project-orchestrator (plans, investigates, creates infrastructure) and feature-orchestrator (delegates implementation) — two distinct agent definitions (31681531)
- Created 8 lifecycle skills: feature-setup, feature-issues, feature-complete, feature-teardown, feature-implement, feature-pickup, feature-review, feature-ship (31681531)
- Updated project.yaml with both orchestrator entries and fixed workflow references (61dd7999)
- Ran code review via `/feature-review` skill, found 2 critical + 8 warning issues, fixed all (61dd7999)
- All phases of the workplan complete in a single session

### Didn't Work
- Agent initially tried to implement Phase 1 directly instead of delegating — user caught this twice before any code was written.

### Course Corrections
- [PROCESS] Agent started reading PROJECT-MANAGEMENT.md and gathering context to write code itself. User asked "did you delegate?" — agent had not. This is the same correction as the previous session (3 out of 3 orchestrator sessions have had this correction).
- [PROCESS] User asked "Why didn't you delegate?" — forcing explicit acknowledgment of the pattern. The honest answer: the agent has capability and context, so the path of least resistance is to "just do it."
- [PROCESS] User identified a missing architectural distinction: the single "orchestrator" concept needed splitting into project-level (infrastructure) and feature-level (implementation delegation). Agent had not considered this separation on its own.

### Quantitative
- User messages: ~12
- Commits: 2
- User corrections: 3 (all PROCESS — delegation and architectural distinction)

### Insights
1. The "orchestrator tries to implement" pattern has occurred in 3/3 orchestrator sessions. The fix is structural: restrict tools in the agent definition so it literally cannot write code files. Soft instructions are insufficient — the agent needs mechanical constraints.
2. The project/feature orchestrator split is a key insight: the project-orchestrator's session ends when infrastructure is ready; the feature-orchestrator's session ends when code is PR-ready. Different scopes, different tools, different delegation targets.
3. Running `/feature-review` as a self-check before merge caught real issues (stale references, missing tool permissions). The skill paid for itself immediately.

---

## 2026-04-11: Build Source Dependency Planning and Investigation

### Feature: build-source-deps
### Worktree: audiocontrol-build-source-deps

### Goal
Investigate GitHub issue #173 ("Build stamps should be sensitive to source code changes"), create a plan, feature branch/worktree, and feature documentation.

### Accomplished
- Root cause analysis: issue filed from library-ux worktree that branched before e4f4ee05 (the fix). Source deps already work on main.
- Session transcript forensics: decrypted and searched 15 sessions' content, found 20+ instances of unnecessary stamp deletion in a single session. Identified the cargo-cult pattern: agents learn `rm -f .build-stamp && make` from the Makefile and never test whether `make` alone works.
- Identified remaining gap: CSS files (9 across 5 modules) not tracked in find patterns.
- Created feature branch `feature/build-source-deps` and worktree.
- Created feature docs (prd.md, workplan.md, README.md) via documentation agent.
- Created GitHub issues: #203 (parent), #204, #205, #206 (implementation tasks).
- Updated workplan with issue links.
- User implemented all tasks in a separate session, merged PR #207, closed all issues.

### Didn't Work
- Initially tried to jump into implementation instead of staying in orchestrator role. User corrected twice.
- First investigation attempt (launching Explore agent) was rejected — user wanted me to look at session transcripts instead.

### Course Corrections
- [PROCESS] User said "you are the orchestrator, not the implementation team" — I tried to start implementing instead of delegating.
- [PROCESS] User said "look in tools/ to find out how to decrypt the session files" — I was trying alternative search approaches instead of checking the obvious place for instructions.
- [PROCESS] User pointed out that agents learn the wrong pattern from examining the Makefile itself, not from CLAUDE.md — documentation needs to be at the source of confusion.

### Quantitative
- User messages: ~15
- Commits: 0 (planning session on main; implementation done in separate session)
- User corrections: 3

### Insights
1. Session transcript forensics (decrypting and searching content files) is a powerful investigation tool — it revealed the true root cause (stale worktree + cargo-cult pattern) that code inspection alone missed.
2. Documentation belongs at the source of confusion, not in a separate guide. Agents read the Makefile, so the Makefile must teach them the right pattern.
3. The orchestrator role means creating plans and docs, then handing off — not doing the implementation yourself.

---

## 2026-04-11: Move, Multi-Select, UX Polish (Session 3)

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Implement Phase 17 (drag-to-move, multi-select, batch operations) and address UX issues found during iPad testing.

### Accomplished
- Move to... context menu wired — opens MoveDialog with category directory tree (51a2cb78)
- Drag-to-folder within same category — validates targets, prevents no-op moves (51a2cb78, b4eaf431)
- Drag to section root to move items out of folders (1c00112d)
- Multi-select: Ctrl/Cmd+click toggle, Shift+click range (5108c756)
- Batch context menu: Move N items, Delete N items (7710d00c)
- Multi-select drag moves all selected items (87140e4f)
- Batch context menu includes batchable transfer actions (5c1f0a1b)
- Required `batchable: boolean` on PluginMenuAction — compiler enforces batch declaration (3d0836fe)
- Multi-select preview panel with count and action buttons (74af8349)
- Transfer actions marked not-batchable until queue exists (46c1aefd)
- On-hover delete icons for device memory items with delete-in-progress indicator (2d37c826, 93d27ecc)
- Selected item contrast fix in device memory panel (0626eed2)
- FSAA library auto-reconnect fix (dec35b3c)
- Disk browser: explicit save destinations, file type icons, grouped by type (765a61eb, d5bc4607, eac9c14f)
- Disk browser: clean target display — stripped vendor/size, disk icon (b2045039)
- Import WAV button on Samples section header (b2953831)
- Preview panel redesign with labeled action groups and visual hierarchy (d769d15d)
- Phase 18 plan documented — visual polish and slide-over drawers (2dcbbabd)
- Filed #214 for batch transfer queue

### Didn't Work
- Batch "Send to Device" silently dropped all but the last item — `setSendDialog` called N times, React batches, only last wins. Marked as `batchable: false` until queue system exists.
- Section drop zone activated for all drag types — had to filter to only OS file drops + library-item moves
- Delete from Device was missing from device memory context menu — ContextMenu's `separator: true` property means "render as separator divider" not "add separator before this action"

### Course Corrections
- [PROCESS] Agent marked transfer actions as `batchable: true` without testing if batch actually worked. User tested, found only first sample sent. Reverted to `batchable: false`.
- [PROCESS] Agent didn't document Phase 17 plan to feature docs before implementing. User: "document your plan to the feature documentation before implementing."
- [PROCESS] Agent tried to exit plan mode without documenting Phase 18 to feature docs. User: "Document your plan to the feature documentation before you implement."
- [UX] Batch context menu initially only had Move and Delete. User: "Why doesn't it have a Send to Device option?" — needed to include batchable transfer actions.
- [UX] Multi-select preview panel was missing. User: "What should the preview pane show for a multi-select?" — added count and batchable action buttons.
- [UX] Section drop zone showed "Drop to add sample" during library-item moves. Should only activate for OS file imports.
- [UX] "Move to top level" drop zone appeared even for items already at root.
- [UX] Preview panel buttons were a messy soup of colored buttons. User asked for best-practices approach — redesigned with labeled action groups.
- [UX] Disk browser had crowded, repetitive text. User asked for icons and type grouping.
- [UX] Modal dialogs described as "so 1995" — user prefers slide-over drawers.
- [FABRICATION] Agent claimed device memory context menu labels were correct without reading code. User: "Are you *sure*? I think you made that up."
- [DOCUMENTATION] Agent tried to implement Phase 18 without documenting plan first.

### Quantitative
- User messages: ~60
- Commits: 20
- User corrections: 12
- Issues filed: 1 (#214)

### Insights
1. **Document plans before implementing.** The user corrected this twice. The feature docs are the source of truth — if the plan isn't there, the next session has no context.
2. **Test batch operations end-to-end before marking as batchable.** The `batchable` contract exists to prevent exactly the kind of silent failure we hit with batch Send to Device.
3. **The `separator` property on ContextMenu is a footgun.** `separator: true` on an action turns it into a divider — it should be a separate entry. A failing test caught this.
4. **UX feedback is gold.** The user found ~10 visual/interaction issues that code review wouldn't catch: crowded text, missing icons, invisible buttons on blue backgrounds, jarring modals. Testing on the actual device matters.
5. **"Are you sure?" means read the code.** Never assert code state from memory.

---

## 2026-04-11: Contract Enforcement Refactor (Session 2)

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Implement the contract enforcement plan from Session 1: capability-declared context menus, compiler-enforced transfer contracts, eliminate duplicated types and silent failures.

### Accomplished
- `TransferActionId` union and `TransferHandlerMap` in editor-core — single source of truth for transfer action shapes (3d69a637)
- Item type factories (`createCommonSampleItemType`, `createCommonProgramItemType`) replace const exports — accept `supportedActions: Set<TransferActionId>` to filter context menus (3d69a637)
- S3K declares all 6 transfer actions; Roland declares none — phantom menu items eliminated (3d69a637)
- `handleContextMenuAction` now required on `LibraryOperationsStrategy` — Roland broke at compile time until fixed (3d69a637)
- Exhaustive action guard — throws on unhandled context menu actions (3d69a637)
- `createTransferActionHandler` uses `Required<Pick<TransferHandlerMap, T>>` — compiler enforces handlers for declared actions (3d69a637)
- Deduplicated dialog state types — `SaveToLibraryDialogState` and `SendToDeviceDialogState` in editor-core (3d69a637)
- Renamed Roland's `ItemSelection` to `RolandPageSelection` — eliminated name collision (3d69a637)
- Removed dead re-exports from both editors (nucleation sites) (3d69a637)
- 12 unit tests for item type factories and transfer action handler (3d69a637)

### Didn't Work
- Nothing significant — the plan from Session 1 was thorough enough that implementation was straightforward.

### Course Corrections
- [PROCESS] Agent wrote handlers that silently returned when device not connected (`if (canTransfer) return;`). User: "what are you doing 'for now'?" Changed to throw with actionable error message.

### Quantitative
- User messages: ~15
- Commits: 1 (plus 1 docs commit from Session 1 wrap-up)
- User corrections: 1
- Files changed: 24
- Tests added: 12

### Insights
1. A good plan makes implementation fast. The 10-step plan with explicit "breaks Roland?" columns meant no surprises.
2. `Required<Pick<TransferHandlerMap, T>>` is the key type trick — it ties the declared capability set to the required handler signatures at compile time.
3. The `createTransferActionHandler<never>({})` pattern is how an editor explicitly opts out of all transfer actions. The compiler accepts it because `Required<Pick<Map, never>>` is `{}`.

---

## 2026-04-11: Reload Resilience, Context Menu Parity, Contract Enforcement

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
UX bug-hunting session on iPad — fix quirks found by using the library in the browser.

### Accomplished
- Disk browser error visibility — save errors shown inline instead of silent console.error (d4fad551)
- Dev server crash resilience — widened uncaught exception handler to survive WebSocket drops (d4fad551)
- Shared vite config — `createEditorConfig` in editor-core, both editors use it (b10a227a)
- Library auto-reconnect on reload — persist active backend to localStorage, OPFS/FSAA reconnect without user interaction (b10a227a)
- Device memory and disk browser cached in sessionStorage — stale-while-revalidate pattern (8bf5fac7)
- Fixed device memory flash on reload — disconnect effect was clearing cached names during transport double-init (63391dc2, 1eca517a)
- Shared LoadingBar component in editor-core for all panel titles (6fc1e93b)
- Context menu parity with preview panels — transfer actions, device memory context menus, disk browser Send to Device (3c015c51, stashed)
- Shared `createTransferActionHandler` and `LibraryTransferCallbacks` in editor-core (3c015c51, stashed)
- Contract enforcement directive added to CLAUDE.md (28906033)
- Contract enforcement design doc with capability-declaration approach (cd923334)
- SDS WebSocket error messages improved — was "[object Event]" (d4fad551)

### Didn't Work
- Context menu parity introduced phantom menu items in Roland — shared item types now define transfer actions that Roland can't handle, silently dropped
- Device memory "Save to Library" opened confirmation dialog — user wanted direct execution from context menu
- Multiple iterations of trying to prevent device memory flash on reload — `wasConnected` ref, `isLoading` suppression — root cause was transport double-initialization triggering the disconnect clear branch
- Stashed work has duplicated dialog state types and all-optional callback interfaces that violate the new contract enforcement directive

### Course Corrections
- [PROCESS] Agent added context menu actions to shared item types without checking whether Roland would handle them. Roland shows phantom menu items that silently do nothing. User: "I want broken things to break loudly, not silently hidden away in corners and under the bed."
- [PROCESS] Agent made all transfer callbacks optional, allowing `{}` to satisfy the compiler. User: "The whole point of a strongly typed language is that the compiler catches contract violations."
- [PROCESS] Agent duplicated `SendDialogState`/`ReceiveDialogState` in two files. User: "Why is there a duplicate?"
- [PROCESS] Agent added crash protection to S3K vite config but not Roland. User: "Instead of duplicating the code, can you think of a way to make the common config actually common?" Then corrected: "a shared config that *all* editors import from."
- [PROCESS] Agent proposed manual testing for verification. User: "You should automate the verification testing instead of relying on manual testing."
- [UX] Device memory "Save to Library" context menu opened a confirmation dialog. User: "Why does it need further confirmation? Why doesn't it just do it?"
- [UX] Context menu had single "Save to Library" instead of explicit destination choices. User: "there should be separate options instead of asking the user to fill out a form"
- [FABRICATION] Agent claimed device memory context menu labels were correct without reading the code. User: "Are you *sure*? I think you made that up."

### Quantitative
- User messages: ~50
- Commits: 8 (6 pushed, 1 stashed batch)
- User corrections: 8

### Insights
1. The contract enforcement directive is the most important outcome of this session. Adding features to shared code without compiler-enforced contracts creates silent failures that are worse than crashes.
2. The capability-declaration pattern (editors declare which actions they support, menu filters accordingly) is the right approach. Optional bags of callbacks are not contracts.
3. When the user asks "how much will need to be duplicated in other editors?" — that's the signal to stop and redesign, not to proceed and hope.
4. "Are you sure?" means "go read the code" — never answer from memory about code state.
5. Transport details should not affect UI. "Save to library" is a storage operation regardless of whether the device talks SDS or SysEx.

## 2026-04-13: Codex Draggable Zones - Phase 1 + Browser Harness

### Feature: codex-draggable-zones
### Worktree: audiocontrol-codex-draggable-zones

### Goal
Complete Phase 1 of the clean-room draggable-zones implementation by aligning `ZoneOverview` and `KeyRangeEditor` on one shared note coordinate model, and establish a browser-only harness for isolated UI iteration without hardware.

### Accomplished
- Added shared note mapping utility `note-coordinate.ts` for Akai keygroup surfaces
- Updated `ZoneOverview` and `KeyRangeEditor` to consume the same visible note range
- Threaded the shared visible range through `KeygroupsPage` and `KeygroupEditor`
- Added focused unit coverage for coordinate mapping and alignment behavior
- Added browser-only harness route: `/akai/s3000xl/editor/harness/draggable-zones`
- Added local fixture scenarios for isolated keygroup/zone testing
- Added Playwright spec `library-draggable-zones-harness.spec.ts` to exercise the harness through the existing browser-only Akai test path
- Added `TESTING-UI-CODEX.md` documenting the feature-harness methodology
- Updated `AGENTS.md` and the Codex `session-start` skill to point UI-heavy work at the harness/testing doc
- Verified repo build via `make`
- Verified isolated browser harness via `modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library 'ARGS=--grep "Draggable Zones Harness"'` (`3 passed`)

### Didn't Work
- Initial targeted test attempt failed because this worktree had no installed dependencies (`vitest: command not found`)
- First browser harness Playwright run failed on an assertion bug in the new spec; corrected and reran successfully

### Course Corrections
- [PROCESS] I initially proposed ad hoc test execution instead of following the repo's `make`-based build guidance. User correctly pushed back. Verification was redone through the project build system before proceeding.
- [PROCESS] I inferred the feature from stale nearby docs before re-checking for local `codex-draggable-zones` feature docs. User corrected this; later session work used the local feature docs as source of truth.

### Quantitative
- New browser harness routes: 1
- New browser-only Playwright specs: 1
- New coordinate utility files: 2 (`note-coordinate.ts` + test)
- Build verification: `make` passed
- Harness verification: `3` Playwright tests passed

### Insights
1. The repo already had enough mock/browser infrastructure to support isolated UI harnesses; the missing piece was wiring feature-specific routes and realistic local fixtures into the app.
2. For UI-heavy work, the best order is harness first, feature implementation second, broader e2e last.
3. Shared coordinate systems need to be threaded from the owning page, not retrofitted independently in sibling components, if visual alignment is the acceptance criterion.

---

## 2026-04-10: Session Data Extraction, Analysis, and LLM Integration

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Integrate ASPACK fast upload end-to-end: bridge WebSocket endpoint, web editor wiring, bug fixes for timeouts and UI issues.

### Accomplished
- ASPACK bridge endpoint (`sample-upload-fast`) with stall-based timeout (99a23b6c)
- Web editor wired to use ASPACK fast path instead of SDS (676c9b0b)
- Stall-based timeout replaces fixed overall timeout — resets on every progress message, works for any sample size (99a23b6c)
- Fixed ghost SendSampleDialog caused by `deviceSampleCount` in useEffect deps (99a23b6c)
- Fixed device memory panel scroll cap — removed `max-h-48` (99a23b6c)
- Fixed progress label, IPv6 proxy, drop event propagation, removed defensive sleep (c03dfe96)
- Phase 13 (ASPACK fast upload) marked complete

### Didn't Work
- Initial ASPACK bridge timeout of 57s was too short for 573K-sample uploads (67s actual transfer time). The transfer completed on the device but the bridge killed the WebSocket connection. Root cause: throughput estimate (20 KB/s) was too optimistic vs actual (17.2 KB/s).

### Course Corrections
- [COMPLEXITY] User asked "why does the bridge set a single timeout for the entire transfer?" — prompted redesign from fixed timeout to stall-based timeout that resets on progress. Better design that works for any sample size.
- [UX] User reported ghost dialog appearing after successful transfer — traced to `deviceSampleCount` dependency triggering effect re-run.
- [UX] User reported device memory scroll pane artificially small — `max-h-48` was capping lists unnecessarily.

### Quantitative
- User messages: ~8
- Commits: 4 (on feature branch, post-rebase)
- User corrections: 3

### Insights
- Stall-based timeouts are universally better than estimated-duration timeouts for hardware transfers. The per-chunk progress messages are the natural heartbeat — if they stop, something is wrong.
- useEffect dependency arrays need careful thought about what SHOULD vs SHOULDN'T re-trigger the effect. `deviceSampleCount` was logically relevant (initial value) but operationally destructive (re-triggers after transfer).

---

## 2026-04-10: Session Data Extraction, Analysis, and LLM Integration

### Feature: continuous-improvement
### Worktree: audiocontrol-continuous-improvement

### Goal
Implement Phases 6 and 7: build TypeScript tools to extract, persist, encrypt, and analyze Claude Code session logs. Add LLM-powered analysis via Claude Haiku API.

### Accomplished
- Session metrics extractor (`tools/extract-sessions.ts`) — 37 sessions extracted from orion-m4 into `data/sessions/sessions.jsonl` with 16 fields per session (`df0e591f`)
- Session content extractor (`tools/extract-session-content.ts`) — extracts user messages, assistant text, thinking blocks, and tool calls into age-encrypted per-session files (`00615efb`)
- Session analyzer (`tools/analyze-sessions.ts`) — markdown/JSON reports with project, machine, token, duration, tool distribution (`eb49a690`, `5dcfe079`)
- LLM session analyzer (`tools/analyze-session-llm.ts`) — sends encrypted content to Claude Haiku for arc classification, correction detection, and improvement suggestions. Results cached encrypted in `data/sessions/analysis/`
- Removed Python/Docker analyzer infrastructure (`df0e591f`)
- age encryption with passphrase-protected recovery key for content files
- Bakeoff script validated Haiku produces quality analysis (~$0.002/session)
- Updated CLAUDE.md analytics section, session-end skill, analyze-session skill
- Closed issues #188, #189, #190, #191, #192, #195, #196
- Opened PR #198

### Didn't Work
- Sonnet/Opus API access — account tier only supports Haiku. Bakeoff ran Haiku only.
- Regex-based correction detection — high false positive rate (~12% flagged but most were normal conversation). Replaced with LLM analysis.
- `require()` calls in ESM context — had to fix twice (appendFileSync, statSync)
- API credits initially not active — took multiple retries across the session

### Course Corrections
- **[PROCESS]** Agent tried to read code to answer "what happens if we run on one machine" instead of just trying it. User: "Why don't you just try it and see what happens?"
- **[PROCESS]** Agent claimed data extraction was complete without re-running after adding content extraction. User caught this: "after we augmented our data extraction... did we actually run that augmented extraction?"
- **[PROCESS]** Agent proposed regex for correction detection. User correctly identified LLM as better tool: "I feel like this kind of analysis is better done with an LLM than regex"
- **[PROCESS]** Agent proposed sending only corrections to LLM. User: "let's give the LLM as much information as we can instead of just corrections"
- **[PROCESS]** Agent didn't test whether the analyzer could read encrypted data. User: "did we test the analyzer to make sure it can read the encrypted data?"
- **[PROCESS]** Agent needed to be told "we need the analyzer to be a one-click operation" — should have designed for that from the start

### Quantitative
- User messages: ~70
- Commits: 6
- User corrections: 6
- Data extracted: 37 sessions, 36 encrypted content files
- PR opened: #198

### Insights
1. "Try it and see" is almost always faster than reading code to predict behavior
2. Don't claim work is done until you've verified the output exists and is correct
3. Regex pattern matching for natural language intent classification is a dead end — LLM is the right tool
4. When the user says to give the LLM more data, they're right — the marginal cost of more context is low compared to the value of better analysis
5. Design for one-click operation from the start — if the user has to run multiple commands or know about intermediate steps, the tool isn't finished
6. Haiku is surprisingly good at session analysis — quality sufficient for production use at ~$0.002/session

---

## 2026-04-09 / 2026-04-10: Library UX, Disk Browser, SDS Speed

### Feature: library-ux
### Worktree: audiocontrol-library-ux

### Goal
Improve the S3000XL editor's library UX: SCSI disk browser, drag-and-drop workflows, sample transfer speed.

### Accomplished
- SCSI disk browser with lazy metadata loading (~50KB vs 60MB+), collapsible volumes, context menus (`689da1fd`)
- Drag-and-drop: disk→library, disk→device, library→device with type filtering (`b98ccdf0`, `bfe221b6`, `6e0e1fae`)
- Three library sections (Samples, Programs, Akai Programs) with expandable programs (`112e457c`)
- NavLink query param preservation — real app bug fix (`0d2ef0bf`)
- SDS upload 9x faster via packet batching, 227ms→25ms per packet (`7088d535`)
- Bridge hardening: disconnect cancellation, exponential backoff, dynamic timeouts (`16a8b36c`, `2485d76e`)
- ASPACK discovery: 23.4 KB/s proprietary transfer, 10.6x faster than batched SDS (`e314fbc5`)
- S3000XL SysEx protocol reference doc (`e314fbc5`)
- SCSI travel log covering full reverse engineering journey (`0f308de8`, `b7d61f95`, `793164e6`)
- Progress indicators meeting project spec (bytes, elapsed, ETA) (`5bc223a3`)
- Sample rename after SDS upload (`510a2ace`)
- PR #186 merged to main

### Didn't Work
- Streaming port 6870 for SDS — doesn't relay device ACKs, dead end
- ASPACK multi-chunk writes (offset > 0) — empty reply, unsolved
- ASPACK sample creation — can only overwrite existing, not create new
- Pre-loading all volume files before save — hung UI for minutes
- Multiple iterations of defensive sleeps — all removed

### Course Corrections
- **[COMPLEXITY]** Added defensive sleeps (50ms, 100ms, 3s) throughout SDS path. User: "STOP TRYING TO ADD DELAYS." ACK is definitive. Removed all sleeps, implemented exponential backoff.
- **[COMPLEXITY]** Pre-loaded all 27 files in a volume before opening save dialog. User saw it hang. Fixed to load single file on demand.
- **[COMPLEXITY]** Built EditorDialogGroup package to share dialog rendering. Circular dependency. Abandoned after user asked "what are you doing?"
- **[UX]** Implemented disk browser with no loading indicators. User: "Garbage UX." Added scanning/reading states.
- **[UX]** No progress indicator on sample transfers. User had to ask repeatedly. Now required by project guidelines.
- **[UX]** Progress showed item count (3/10 samples) not bytes. User: "Showing the number of samples is useless since samples can range in size."
- **[UX]** Double-click to download — user: "double-clicking on an item almost never means download" and "Download as WAV is very counterintuitive in the context of a library."
- **[UX]** Hardcoded pixel widths for layout. User: "why are you using pixel values instead of the 12-column layout system?"
- **[FABRICATION]** Said S3000XL needed time to recover after failed transfer. User: "don't blame the device."
- **[FABRICATION]** Said MESA II used direct SCSI block writes to sampler memory. User: "No you can't write directly to the sampler's memory. You just made that up."
- **[FABRICATION]** Guessed sampler was stuck from previous test without checking logs. User: "why do you think that?"
- **[FABRICATION]** Fell back to hardcoded 44100 for zero sample rate. User: "why would you fall back to 44100 instead of interrogating the actual sample file?"
- **[DOCUMENTATION]** Didn't read the library-ux feature docs (PRD, workplan) at session start. Operated blind to 14 sub-feature documents and existing phase structure for the entire session.
- **[DOCUMENTATION]** User had to ask for protocol documentation, SCSI travel log, progress indicator guidelines — agent didn't create them proactively.
- **[PROCESS]** Didn't create feature branch/worktree for continuous improvement — started work on library-ux branch. User: "What do our project guidelines say about feature branches and worktrees?"
- **[PROCESS]** Set 5-minute timeout on a test expected to take seconds. User: "why did you set a 5 minute timeout?"
- **[PROCESS]** Used `sleep 30` to wait for test results instead of checking immediately. User: "why did you wait for 2 minutes to find out it was stuck?"
- **[PROCESS]** Tested ASPACK via control plane (HTTP sds/send) instead of data plane (raw SCSI CDBs). User: "the current sysex channel is meant for the control plane, not the data plane."

### Quantitative
- User messages: ~350+
- Commits: 37 (on library-ux branch)
- User corrections: ~20
- Tool calls: thousands (extended session spanning two days)
- Time sinks: SDS speed investigation (~4 hours), ASPACK exploration (~2 hours), drag-drop type filtering (~1 hour)

### Insights
1. Agent should read feature workplan at session start — would have known about existing phases
2. Every hardware claim should be tested, not reasoned about
3. Progress indicators should be implemented at the same time as the feature, not retrofitted
4. Documentation (protocol ref, travel log) was ultimately more valuable than some of the code
5. The user's instinct to "just try it" was right every time — the ASPACK discovery, the batch SDS test, the larger packet size test all happened because the user pushed past theorizing

---

## 2026-04-11: Build Source Dependency Tracking

### Feature: build-source-deps
### Worktree: audiocontrol-build-source-deps

### Goal
Add CSS file tracking to Makefile source dependencies and add inline documentation to prevent agents from cargo-culting `rm -f .build-stamp && make`.

### Accomplished
- Added `*.css` to all 26 `$(shell find ...)` source file lists in Makefile (`2e2e30a9`)
- Removed duplicate `SYNTH_CORE_SRC` declaration that was misplaced at line 391
- Added "HOW SOURCE CHANGE DETECTION WORKS" comment block before stamp targets
- Added reinforcement note to `.claude/CLAUDE.md` Build System section
- Verified CSS changes trigger rebuilds via `make -n` dry runs
- PR #207 merged, issues #173, #203, #204, #205, #206 closed

### Didn't Work
- Nothing — clean session with well-scoped tasks

### Course Corrections
- None

### Quantitative
- User messages: ~3
- Commits: 1
- User corrections: 0

### Insights
1. Well-scoped features with clear workplans and pre-created issues make sessions fast and frictionless
2. Small features benefit from doing all tasks in a single commit rather than splitting artificially

---

## 2026-04-13: Codex Draggable Zones Phase 2 Start

### Feature: codex-draggable-zones
### Worktree: audiocontrol-codex-draggable-zones

### Goal
Start Phase 2 by making `ZoneOverview` boundaries directly draggable in the real page and in the browser-only harness, without depending on hardware.

### Accomplished
- Added note-edge and velocity-edge drag handles to `ZoneOverview`
- Implemented local drag preview with commit on pointer release
- Routed `ZoneOverview` parameter writes through both `KeygroupsPage` and the draggable-zones harness
- Added `zone-constraints.ts` for conservative shared clamping helpers
- Added unit coverage for note-handle rendering and note/velocity boundary commits
- Extended the Playwright harness spec to drag a note boundary and assert isolated browser state changes
- Verified the changes with targeted Vitest coverage, `make modules/akai-s3k-editor/.build-stamp`, and the filtered draggable-zones Playwright harness run

### Didn't Work
- The first browser-spec version used a fixed pixel drag distance and landed on the wrong note because the harness uses the shared padded visible range
- Rendering resize handles inside clickable zone buttons caused invalid nested-button DOM warnings

### Course Corrections
- Reworked the browser spec to compute the drag target from the actual harness surface bounds instead of assuming a pixel-to-note mapping
- Changed zone surfaces from nested `<button>` elements to keyboard-accessible `div[role="button"]` containers so resize handles can remain real buttons without invalid DOM nesting
- Kept constraints intentionally conservative until adjacent-keygroup overlap rules are verified from hardware or a primary source

### Quantitative
- Component tests: 26 passed
- Browser harness tests: 4 passed

### Insights
1. The isolated browser harness is now good enough for real UI interaction work, not just static rendering checks
2. Shared coordinate math needs geometry-based assertions in browser tests; fixed pixel drags are too brittle
3. Phase 2 can advance in the harness without guessing hardware-specific overlap behavior, as long as constraint scope is documented honestly

---

## 2026-04-13: Codex Draggable Zones Phase 2 Closeout

### Feature: codex-draggable-zones
### Worktree: audiocontrol-codex-draggable-zones

### Goal
Close Phase 2 after resolving the last boundary-rule uncertainty and aligning note clamps with the documented S3000XL range.

### Accomplished
- Confirmed that keygroup keyspans can overlap, so adjacent-keygroup overlap is intentionally allowed
- Kept `ZoneOverview` note dragging permissive across keygroups rather than adding artificial no-overlap constraints
- Tightened keygroup note editors and drag clamping to the documented S3000XL `21-127` range
- Added unit coverage for the Akai note minimum in both `KeyRangeEditor` and `ZoneOverview`
- Re-verified targeted keygroup tests and the module build

### Evidence
- `modules/sampler-devices/src/devices/s3000xl.ts` documents `LONOTE` as `21 to 127`
- `docs/1.0/s3000xl-editor/comprehensive-test-plan.md` also treats note-range editing as `21-127`
- User guidance for this feature session: keygroup keyspans can overlap

### Quantitative
- Component tests: 27 passed
- Module build: passed

### Insights
1. The right constraint model here is asymmetric: enforce verified per-field bounds, but do not invent cross-keygroup exclusivity
2. The harness and targeted unit tests are sufficient to close UI interaction phases when the remaining question is a rule clarification rather than a rendering bug
