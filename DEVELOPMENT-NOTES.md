# Development Notes

Session journal for the audiocontrol project. Documents what we tried, what worked, what didn't, and — most importantly — how the user course-corrected the agent's approach.

Each correction is tagged by category for pattern analysis:
- **[COMPLEXITY]** — agent defaulted to complex solution, user wanted simpler
- **[UX]** — agent neglected user-facing feedback
- **[FABRICATION]** — agent stated something without evidence
- **[DOCUMENTATION]** — agent didn't document or read existing docs
- **[PROCESS]** — agent didn't follow established workflow

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
