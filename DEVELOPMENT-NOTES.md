# Development Notes

Session journal for the audiocontrol project. Documents what we tried, what worked, what didn't, and — most importantly — how the user course-corrected the agent's approach.

Each correction is tagged by category for pattern analysis:
- **[COMPLEXITY]** — agent defaulted to complex solution, user wanted simpler
- **[UX]** — agent neglected user-facing feedback
- **[FABRICATION]** — agent stated something without evidence
- **[DOCUMENTATION]** — agent didn't document or read existing docs
- **[PROCESS]** — agent didn't follow established workflow

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
