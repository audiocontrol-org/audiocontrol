# Development Notes

Session journal for the audiocontrol project. Documents what we tried, what worked, what didn't, and — most importantly — how the user course-corrected the agent's approach.

Each correction is tagged by category for pattern analysis:
- **[COMPLEXITY]** — agent defaulted to complex solution, user wanted simpler
- **[UX]** — agent neglected user-facing feedback
- **[FABRICATION]** — agent stated something without evidence
- **[DOCUMENTATION]** — agent didn't document or read existing docs
- **[PROCESS]** — agent didn't follow established workflow

---

## 2026-04-20: MESA II Parity Baseline Resynced To Claude Option 2 Reply

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Refresh the parity baseline after Claude updated both the feature docs and the live
`#315` thread to commit to Option 2 and clarify how Path A fits into that plan.

### Accomplished
- Reviewed the current Claude branch head `2576636f`, its `README.md`, `workplan.md`,
  and `decision-record-2026-04-19.md`
- Reviewed the latest Claude reply on issue `#315`
- Updated the Codex parity README, workplan, and `claude-baseline.md` so they no longer
  describe Claude as merely "re-evaluating" the runtime boundary
- Recorded the new explicit sequencing from Claude's reply:
  Path A / task `#31` is step 0 of Option 2, not a competing strategy

### Didn't Work
- No new technical reverse-engineering finding came out of this pass; it was a
  state-sync/documentation correction only

### Course Corrections
- **[DOCUMENTATION]** The parity baseline had drifted behind the active Claude branch.
  The docs still reflected the earlier task-21 / "still deciding" state after Claude had
  already committed to Option 2 in both branch docs and issue comments.

### Quantitative
- Feature docs materially updated: 3
  `README.md`, `workplan.md`, `claude-baseline.md`

### Insights
1. For this feature, issue `#315` is part of the live baseline, not just side-channel
   discussion. Branch docs alone were not enough once the tactical sequencing changed in
   comments.
2. The meaningful sync unit is now "Claude Option 2 + Path A as step 0 + asymmetric
   split remains active," not the older task-21 framing.

## 2026-04-20: MESA II Resource-Tag Branch Ruled Out As Primary Sender Lead

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Decide whether the constructor-side registry/tag/resource branch was still worth
treating as a live candidate for the missing sender-install edge, and resync the Codex
plan with Claude's current Option 2 state before going further.

### Accomplished
- Re-checked Claude's current branch state locally:
  README/workplan now clearly commit to Option 2, with Path A/task `#31` as step 0.
- Wrote down the stronger Codex exclusion result:
  the `0x287ee` constructor-side registry plus its low-address payload families now
  align with file/resource/document handling, not upload transport or callback install.
- Updated parity README/workplan/findings/comparison docs so the plan is now:
  - keep following Path A in parallel with Claude
  - stop treating the constructor/tag/resource branch as a likely sender path unless
    new evidence points back to it

### Didn't Work
- This pass still did not expose the owner that calls the generic `SetCommandProc`
  setter with the live callback.
- The resource/tag branch kept yielding internally coherent structure, but that
  coherence was about file/resource dispatch rather than the sender boundary we care
  about.

### Course Corrections
- **[PROCESS]** The earlier "Codex should stop spending cycles here" framing was too
  coarse. The user wants Codex to keep running the same Path A frontier in parallel with
  Claude for cross-pollination, not to stand down entirely.
- **[DOCUMENTATION]** The plan needed two ideas written together, not separately:
  continue parallel static work, but mark the constructor/tag/resource branch as a
  ruled-out false lead for the sender question.

### Quantitative
- Parity docs updated: 5
  `README.md`, `workplan.md`, `codex-findings.md`, `comparison-record.md`,
  `DEVELOPMENT-NOTES.md`

### Insights
1. "Keep working in parallel" and "stop chasing this specific branch" are compatible.
   The right correction is to narrow the frontier, not to stop the second track.
2. The tag/resource branch is now useful mainly as exclusion evidence: it tells us
   where the live sender probably is not.
3. Claude's current Option 2 state matters operationally. Once their branch has already
   committed to the runtime path, Codex static work should complement that path rather
   than try to reopen already-closed strategic debates.

## 2026-04-20: MESA II Parity Work Split Clarified

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Turn the recent static-boundary results into an explicit division of labor between the
Claude and Codex efforts so both branches stop duplicating low-yield static work.

### Accomplished
- Wrote down the recommended split in the parity README and workplan:
  - Claude owns runtime and hardware validation
  - Codex owns narrow static owner-boundary proof around the `+0xa20` install path
- Synced that recommendation to issue `#315` so the active Claude branch has the same
  tactical framing
- Kept the recommendation tied to the current evidence instead of preference:
  the static `CSCSIPlug::SendData` surface is effectively exhausted, while the remaining
  unresolved mechanism now sits at the seam between recovered static owner logic and
  runtime-installed behavior

### Didn't Work
- There is still no recovered ordinary in-resource caller or pointer trail into
  `InitModule` / `SetCommandProc`, so the static side still cannot name the exact
  owner that provides the live command-proc

### Course Corrections
- **[STRATEGY]** Broad static analysis in both branches is now the wrong use of
  parallel effort. The branch docs now say that explicitly.
- **[COORDINATION]** Rather than leaving the split implicit in issue comments, I
  recorded it in feature docs so the next session does not reopen the same debate.

### Quantitative
- Commits pushed in the surrounding owner-boundary pass: 4
  `217bfb3a`, `55ac3f87`, `77977265`, `4aeab475`
- New GitHub issue activity in this pass: 1 additive `#315` comment with the recommended
  split

### Insights
1. The best use of Codex now is as a boundary prover, not as a second general-purpose
   reverse-engineering branch on the same static plug surface.
2. The best use of Claude now is the runtime/hardware loop, because that is where the
   remaining uncertainty is concentrated.
3. Once a static surface reaches exhaustion, documenting the stopping rule is as
   important as documenting the findings that led there.

## 2026-04-17: MESA II Codex Parity Baseline, Issue Review, and Upload-Sequence Narrowing

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Baseline the active Claude-side MESA II reverse-engineering branch, record Codex-side
comparison artifacts, review Claude's responses to parity issues, and keep narrowing the
remaining upload-path uncertainty from primary artifacts.

### Accomplished
- Created and updated the parity feature docs under
  `docs/1.0/001-IN-PROGRESS/mesa-ii-codex-parity/`, including baseline, comparison,
  and findings records.
- Confirmed from raw bytes that `CAkaiMIDIDispatcher` slot `0x38` maps to
  `SwapLongWord`, not nibble-encode-in-place.
- Confirmed the caller-side class identity correction: the repeated slot-`0x38` path in
  `BuildSampleHeaderFromMAH` is `CAkaiSampler` / `CAkaiMIDIDispatcher`, not
  `CMESASocket`.
- Filed parity issues `#309`, `#310`, and `#311`, reviewed Claude's fixes, then closed
  all three after verifying the actual branch changes.
- Identified a further stale claim in the Claude branch: the old direct
  `CSCSIPlug::SendData('BULK')` harness was still described as equivalent to the real
  upload path. Filed follow-up issue `#312`.
- Narrowed the next technical target: `SendAudioBufferToSampler` clearly performs
  repeated socket-level phase calls around BULK transfer, especially slot `0x30` calls
  with SDS opcode `0x01`.

### Didn't Work
- First attempt to file issue `#312` failed because the shell command body was not
  quoted safely and then hit sandboxed network restrictions. Retried with proper quoting
  and escalation.
- I briefly misclassified the `UALL` dispatch at `0x030c93` as a socket-vtable call.
  The disassembly shows it goes through `CSamplerModule`, not `CMESASocket`. Corrected
  the parity docs immediately.

### Course Corrections
- **[PROCESS]** The user explicitly required that parity disagreements be handled through
  GitHub issues that Claude can remediate or refute. That changed the threshold for
  "interesting discrepancy" into "documented, evidence-backed issue."
- **[DOCUMENTATION]** The active Claude baseline was not on `main`; it lived in the
  separate `feature/mesa-ii-reverse-engineering` worktree. The session had to anchor on
  that branch's docs and `DEVELOPMENT-NOTES.md`, not the stale merged snapshot.
- **[FABRICATION]** While tracing the upload sequence, I caught and corrected my own
  overreach on the `UALL` path before turning it into a persisted finding. The same
  evidence standard used to challenge Claude has to apply locally too.

### Quantitative
- GitHub issues filed: 4 (`#309`-`#312`)
- Issues reviewed and closed this session: 3 (`#309`, `#310`, `#311`)
- Parity docs added or materially updated: 6+
- New unresolved target narrowed to 1 concrete socket slot: `CMESASocket` slot `0x30`

### Insights
1. The Codex/Claude parity workflow is useful only if stale contradictions are forced
   into concrete issue threads. Otherwise the branch drifts into "historical notes plus
   live findings" with no boundary between them.
2. The synthetic BULK harness was useful for exploring `SendData`, but the checked-in
   disassembly now makes clear it was not a faithful reproduction of the full MESA
   caller path.
3. The next high-value step is not more speculation about header bytes. It is naming
   `CMESASocket` slot `0x30` and understanding what state transition those repeated
   SDS-opcode calls are performing around BULK.

---

## 2026-04-16: ASPACK Upload SLNGTH Bug Investigation (Session 8)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Fix sample uploads producing truncated samples (SLNGTH stuck at 40 regardless of actual data size). Also: progress indicators, cancel support, sample length in preview, ReceiveSampleDialog abort loop fix.

### Accomplished
- **ReceiveSampleDialog abort loop fixed**: useEffect cleanup was aborting the transfer on every re-render. Added `hasStartedRef` guard so transfer only starts once per dialog open.
- **Sample length in preview panel**: library samples show sample count + duration from WAV file scan. Device samples show SLNGTH/SSRATE from header fetched on selection.
- **SDS upload progress**: SteppedProgressDrawer during save-to-device with direction-aware labels.
- **ASPACK SLNGTH investigation test** (`test-aspack-slngth.ts`): raw SCSI CDB test that bypasses the client entirely. Tests both creation theories.
- **Key finding**: Theory A (real length header, no data packet) → sample NOT created. Theory B (40-sample stub + data packet) → sample created but SLNGTH stays at 40.
- **Bridge poll bug found**: midiPoll parsed 3-byte response as 4-byte, returning 0 for all polls. Fixed.

### Didn't Work
- **5 failed attempts to fix ASPACK upload SLNGTH**:
  1. Real length in SDS header → device NAK'd data packet (malformed: passed `total` as `samples_per_packet`, creating 132KB SDS packet)
  2. Real length in SDS header, no data packet → sample not created in RSLIST
  3. Bridge-side SLNGTH patch via RSDATA/SDATA after ASPACK → device doesn't respond to RSDATA in SCSI MIDI context (0 bytes after 10s)
  4. Client-side SLNGTH patch via SDATA → device rejects with error code 1 (can't set SLNGTH beyond allocated memory)
  5. Real length in header + proper 40-sample data packet → still not creating sample (bridge deployed with current code)
- **Cited test-sds-header-aspack-data.ts as evidence** without running it. When finally run, it failed. The test had a session conflict (used `/sds/send` for RSLIST but raw SCSI for data), saw wrong sample count, and never actually validated its own success condition.

### Course Corrections
- [PROCESS] Agent deferred progress indicators during implementation despite explicit project guidelines. User: "Why didn't that get added in the first place?"
- [UX] Agent opened progress drawer only after device round-trip (perceptible delay). User: "The drawer should slide open instantly."
- [UX] Agent's cancel just dismissed the UI without stopping the transfer. User: "Don't just dismiss the window if the action isn't actually cancelled."
- [PROCESS] Agent didn't update library ReceiveSampleDialog to match new progress pattern. User: "You need to update the sample download progress indicator in the library to match."
- [PROCESS] Agent created a leaky abstraction (client patching SLNGTH that the bridge should own). User: "Are you creating a leaky abstraction?"
- [PROCESS] Agent cited a test as evidence without running it. User: "How do you know the test you found is actually working?"
- [PROCESS] Agent made snap judgement about test results without checking device state. User: "There are four samples in the device right now. Why does the test say there are two?"
- [PROCESS] Agent kept trying fixes without understanding the full history. User: "Can you look at the development log and the commit log to reconstruct the reasoning behind why the upload process was built the way it was."
- [FABRICATION] Agent assumed test-sds-header-aspack-data.ts worked because the code had a success message, without verifying against hardware.
- [PROCESS] Agent didn't delegate investigation work. User: "Why aren't you delegating?"

### Quantitative
- User messages: ~40
- Commits: 12
- User corrections: 10 (5 PROCESS, 3 UX, 1 FABRICATION, 1 delegation)
- Bridge deploys: 6

### Insights
1. **Never cite a test as evidence without running it.** The test-sds-header-aspack-data.ts file had "✓ New sample created" in its output logic, but it never actually worked. Source code is not evidence — test results are.
2. **Understand the full history before changing battle-tested code.** The ASPACK upload process was developed over multiple sessions with extensive hardware testing. Each decision (40-sample stub, data packet requirement, chunk size 8191) was discovered through hardware behavior, not theory.
3. **Test at the right layer.** The client library has caching, retry logic, and session management that can mask bugs. A raw SCSI CDB test removes all abstraction and shows exactly what the device does.
4. **Progress indicators and cancel are not polish — they're requirements.** The project guidelines are explicit. Build them with the feature.
5. **Don't thrash.** Five failed attempts in a row, each based on a theory rather than evidence. The right approach was to write a clean test first, run it, then decide.
6. **The SLNGTH problem is still open.** The 40-sample stub creates samples correctly but ASPACK writes don't update SLNGTH, and SDATA writes to increase SLNGTH are rejected (error code 1). The nibble offset parsing in the raw test also needs fixing. Next session must start here.

---

## 2026-04-16: Progress Indicators and Cancel for SDS Transfers (Session 7)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Fix missing progress indicators and cancel support for SDS sample transfers, bringing editor loading and library receive dialogs into compliance with project guidelines.

### Accomplished
- **SDS download progress for editors**: SteppedProgressDrawer opens instantly on editor button click, shows progress bar with bytes/elapsed/ETA during SDS download
- **Proper cancel via AbortSignal**: threaded AbortSignal through receiveSampleViaSds → SdsChannel.downloadSample → WebSocket close. Cancel actually terminates the transfer.
- **Library ReceiveSampleDialog updated**: progress bar, elapsed/ETA, and AbortSignal cancel — matching the Samples page pattern
- **Instant drawer open**: progress drawer opens immediately with placeholder name, updates to real name after header fetch
- PR #295 updated with progress fixes

### Didn't Work
- First attempt at progress used `SdsProgressBar` component inside `SteppedProgressDrawer` step detail — but `detail` is `string`, not `ReactNode`. Switched to native step `progress` field (number 0-100) with formatted detail string.
- Initial cancel implementation just set a flag and dismissed the drawer without actually stopping the SDS transfer.

### Course Corrections
- [PROCESS] Agent deferred progress indicators during Phase 14 implementation despite project guidelines being explicit: "All long-running operations must show progress indicators." User called this out.
- [UX] Agent initially opened the progress drawer only after fetching the sample header (a device round-trip), creating a perceptible delay. User: "The drawer should slide open instantly." Fixed to open immediately with placeholder.
- [UX] Agent's first cancel implementation just dismissed the UI without stopping the transfer. User: "Don't just dismiss the window if the action isn't actually cancelled. You have to make cancel work properly." Fixed with AbortSignal through the full stack.
- [PROCESS] Agent didn't update the library's ReceiveSampleDialog to match. User: "You need to update the sample download progress indicator in the library to match." Consistency across the app.

### Quantitative
- User messages: ~10
- Commits: 4
- User corrections: 4 (2 UX, 2 PROCESS)

### Insights
1. **Progress indicators are not optional polish.** The project guidelines are explicit. Deferring them creates a UX debt that the user will immediately notice and call out. Build them as part of the feature, not after.
2. **Cancel must actually cancel.** A dismiss-only cancel is dishonest UI. If a button says "Cancel," the operation must stop. Threading AbortSignal through the stack is more work but the only correct answer.
3. **Instant UI response matters.** Any delay between a user action and visible feedback feels broken. Open the drawer first, fetch data second.
4. **Consistency is a requirement, not a nice-to-have.** When you fix the progress pattern in one place, check every other place that does the same operation.

---

## 2026-04-15: Phases 14-17 — Sample Audio Editing (Session 6)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Implement phases 14-17: bidirectional sample audio editing between device memory and the library's visual editors (loop editor, sample editor, chopper).

### Accomplished
- **Phase 14**: Device sample loading into editors via SDS. EditorDialogStrategy extended with `device-sample` node type. SamplesPage action bar: Loop Editor / Sample Editor / Chopper buttons.
- **Phase 15**: Save to device. Loop editor saves loop points directly to sample header (fast, no SDS). Sample editor opens SaveTargetDialog: overwrite original / new slot / save to library.
- **Phase 16**: Chopper-to-device: uploads each slice as a new sample via SDS, creates program with keygroup-per-slice mappings. SaveTargetDialog for bidirectional save choice.
- **Phase 17**: 3 Playwright e2e tests verify device→editor→device round-trip for all three editors.
- **Bug fix**: `EditorDialogStrategy.loadWav` root parameter made nullable — strategy-based loading (SDS) now works without a connected library root.
- **PR #295** created, reviewed, merged.
- 4 GitHub issues closed (#291-#294).

### Didn't Work
- First e2e test run: watchdog killed tests because `waitForEditorDialog` used a single long `expect` that starved the heartbeat. Fixed with polling loop.
- First editor open attempt: `useEditorDialogsCore.loadWavData` threw "Library not connected" before trying the strategy — `libraryRoot` null guard blocked device-sample loading. Fixed by making the strategy interface accept nullable root.

### Course Corrections
None this session — the implementation flow was smooth.

### Quantitative
- User messages: ~15
- Commits: 7
- User corrections: 0
- Issues closed: #291, #292, #293, #294
- PR: #295 (merged)

### Insights
1. **Strategy pattern pays off.** The `EditorDialogStrategy` abstraction let us add device loading without modifying the shared editor dialog infrastructure — just the S3K strategy implementation.
2. **Nullable parameters unlock composability.** Making `loadWav`'s root parameter nullable was a one-line interface change that eliminated the need for the library to be connected when loading from device. Small type change, big architectural unlock.
3. **Watchdog-friendly polling is non-negotiable.** Any Playwright assertion that might take >10s needs a polling loop with heartbeat assertions. Single long `expect` calls get killed.

---

## 2026-04-15: Phases 8-14 + Bug #280 — Full Feature Completion and Extension (Session 5)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Triage bug #280, complete all remaining phases (8-13), ship the feature, then extend with sample audio editing (phases 14-17).

### Accomplished
- **Bug #280**: Root cause found via throwaway diff script — S3000XL uses MODVFILT1/2/3 for velocity→freq, LFO2→freq, ENV2→freq (not the dead S1000 fields V_FREQ, P_FREQ, E_FREQ). Fixed field mapping + signed decoding.
- **Phase 8**: Promotion round-trip verified — 2 Playwright e2e tests (preview button + context menu)
- **Phase 9**: Sample editor — SampleList, SampleEditor, SamplesPage with list-detail layout, 20 unit tests
- **Phase 11**: Persistent editor cache — zustand persist + sessionStorage for all 3 stores, CacheAge indicator
- **Phase 12**: Expandable programs — listStoredPrograms scans samples/ dir, atomic sample rename with rollback, 8 unit tests
- **Phase 13**: Sample clone — cloneSample via SDS in client, UI in SamplesPage + DeviceMemoryPanel
- **All 13 phases complete** — PR #289 created, reviewed, merged
- **Feature extended** with phases 14-17 for sample audio editing, 4 GitHub issues created (#291-#294)
- **Phase 14**: Device sample loading — useEditorDialogs strategy loads via SDS, action bar in SamplesPage
- **18 Playwright e2e tests** passing across all implementations
- **176 unit tests** passing

### Didn't Work
- Initial E_FREQ investigation: spent time analyzing UI state management code paths when the bug was a field mapping issue. Unit tests all passed because both read and write used the same wrong offset.
- Playwright e2e test label case mismatch caused tests to hang (FREQ vs Freq)
- `buildScsiUrl` produces double-slash with leading-slash subpaths — caused persistent cache tests to fail silently
- Sample clone tests needed device-library config (not scsi-midi) for SDS WebSocket via Vite proxy

### Course Corrections
- [PROCESS] Agent analyzed code extensively before writing tests. User: "you should write a test that exercises the bug"
- [PROCESS] Agent wrote unit tests for UI code paths. User redirected to Playwright e2e as the right layer.
- [PROCESS] Agent proposed building proper e2e test infrastructure for field mapping. User: "Let's do this ad-hoc... just write a throwaway node script" — found root cause in one iteration.
- [PROCESS] Agent tried to run throwaway script from /tmp (outside monorepo, module resolution failed).
- [PROCESS] After e2e tests all passed, agent asked about reproduction steps. User provided the correct hypothesis: "I suspect the field for filter envelope->cutoff parameter is incorrectly mapped"

### Quantitative
- User messages: ~50
- Commits: 18
- User corrections: 5 (all PROCESS)
- Issues filed: #289 (PR), #291-#294 (new phases)
- Issues closed: #216, #274, #275, #277, #278, #279, #280
- Sub-agents spawned: ~12 (UI engineers, code reviewer, explorers)

### Insights
1. **Throwaway scripts beat ceremony for exploration.** The diff script found the bug in one iteration. The agent kept trying to build proper infrastructure when a quick comparison was all that was needed.
2. **When all tests pass, question your assumptions.** Round-trip tests passing doesn't mean the mapping is correct — both read and write used the same wrong offset.
3. **Front-panel comparison is the definitive test.** No amount of software testing catches a field that the spec says "not used" but the device actually uses.
4. **Parallel agent delegation works well.** 4 e2e test agents writing simultaneously, 2 UI component agents — all produced usable output on first try.
5. **URL builder edge cases matter.** The double-slash in `buildScsiUrl('/path', '/subpath')` wasted 3 test iterations.

---

## 2026-04-15: Bug #280 Triage — E_FREQ Field Mapping Discovery (Session 4)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Triage bug #280 (ENV2→filter parameter reset to 0 when editing filter values). Determine whether the bug is in the client/transport layer or the UI state management layer.

### Accomplished
- Ran Node e2e cross-field integrity tests against hardware — all 7 pass. Client/encoding is clean.
- Fixed label case mismatch in Playwright e2e spec (FREQ→Freq, RESONANCE→Resonance) that caused tests to hang
- Rewrote Playwright e2e spec to test all 5 filter params (Freq, Resonance, Key Track, Vel→Filt, Press→Filt) plus FilterDisplay drag path — all 6 pass
- **Root cause found**: The S3000XL repurposed three S1000 "not used" fields. Our code mapped UI knobs to dead fields:
  - "Vel→Filt" → V_FREQ (dead) — real field is MODVFILT1
  - "LFO2→Filt" → P_FREQ (dead) — real field is MODVFILT2 (label was also wrong: "Press→Filt")
  - "Env→Filt" → E_FREQ (dead) — real field is MODVFILT3
- **Discovery method**: Throwaway Node script to snapshot keygroup raw buffer, user changed value on S3000XL front panel, re-read and diffed. MODVFILT3 was the only field that changed when ENV2→freq was set to +45.
- Fixed signed decoding: K_FREQ, MODVFILT1, MODVFILT2, MODVFILT3 now use `bytes2signedNumberLE` (was `bytes2numberLE`, so -15 read as 241)
- Fixed KeygroupEditor.tsx: three knobs remapped to correct fields, "Press→Filt" label corrected to "LFO2→Filt"
- Added unit tests for E_FREQ corruption (10 tests, store lifecycle simulation)
- Added Node e2e diagnostic tests (efreq-mapping, efreq-probe) for future field investigation
- Fixed relative imports in test-filter-efreq-bug.ts to use #node/* pattern

### Didn't Work
- Initial approach: wrote unit tests simulating UI code paths (handleParameterChange, handleDragChange, handleCommitHeader). All passed because the spread/encode logic is correct — the bug wasn't in state management, it was in field mapping.
- Playwright e2e tests also passed — because they were reading/writing the same dead field (E_FREQ) consistently. Round-trip to a dead field works; it just doesn't affect the device's actual parameter.

### Course Corrections
- [PROCESS] Agent spent significant time analyzing UI state management code paths (stale closures, raw buffer references, handleCommitHeader re-encode loop) before writing a test. User: "you should write a test that exercises the bug"
- [PROCESS] Agent then wrote unit tests replicating code patterns. User redirected to Playwright e2e tests as the right layer for a bug reported as device behavior.
- [PROCESS] Agent started analyzing code again after Playwright tests passed. User hypothesized the real issue: "I suspect the field for filter envelope->cutoff parameter is incorrectly mapped and that we are mistakenly applying a zero default to the actual field" — this was correct.
- [PROCESS] Agent proposed building a proper e2e test for field mapping. User: "Let's do this ad-hoc... just write a throwaway node script" — much faster for exploratory investigation.
- [PROCESS] Agent tried to run throwaway script from /tmp (outside monorepo, module resolution failed). Should have put it inside the workspace from the start.

### Quantitative
- User messages: ~20
- Commits: 0 (session end commit pending)
- User corrections: 5 (all PROCESS — testing approach and investigation methodology)

### Insights
1. **When the obvious tests pass, question your assumptions.** Both unit and e2e tests passed because they exercised the same incorrect mapping consistently. The bug was a wrong field, not wrong logic.
2. **Throwaway scripts beat ceremony for exploration.** The user's suggestion to skip the e2e infra and write a quick diff script found the root cause in one iteration. The overhead of properly registering test groups, wiring make targets, etc. is wrong for exploratory work.
3. **Front-panel comparison is the ground truth.** The decisive test was: write to field X via SysEx, check the front panel. No amount of round-trip testing through our own code would have caught a mapping error where both read and write use the same wrong offset.
4. **S3000XL field layout diverges from S1000/S2800 spec.** Fields marked "not used" in the spec are repurposed on the S3000XL. The assignable modulation amount fields (MODVFILT1-3) map to the front panel's velocity→freq, LFO2→freq, ENV2→freq. This should be documented.
5. **Signed decoding gaps hide quietly.** K_FREQ reading as 241 instead of -15 was never noticed because the UI showed the unsigned value and nobody compared against the front panel until now.

---

## 2026-04-14: Akai S3000XL Editor UX — Phases 6-10, Filter Display, Testing Lessons (Session 3)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Implement phases 6-10 (memory CRUD, drag-drop, promotion fix, sample editor, remove Compare), add filter frequency/resonance display, fix clone, investigate E_FREQ bug.

### Accomplished
- Phase 6: DeviceMemoryPanel CRUD parity — design system icons, double-click rename, clone, ConfirmDialog, 9 tests (#272)
- Phase 7: Memory-to-Library drag & drop — draggable items, drop triggers export/receive dialogs (#273)
- Phase 8: Library promotion fix — usePromotionTransfer hook, loading state, error reporting, 6 tests (#274)
- Phase 10: Remove Compare page — deleted 702 lines (#276)
- Interactive filter frequency/resonance display (2nd-order LPF, log freq axis, draggable node)
- Throttled device writes during drag (150ms intervals for audible filter sweeps)
- cloneProgram: field-for-field copy of all keygroup values
- Velocity zone: sample list replaces dropdown, scroll-into-view on tab switch
- Zone overview: pinch zoom, trackpad pan, shift+arrow keyboard shortcuts
- Extended feature: phases 6-13 scoped and documented, 7 GitHub issues created
- CLAUDE.md: testing guidance — test at right layer, isolate with Node, never assume device fault, never bypass test pipeline
- E_FREQ cross-field corruption test written (Node e2e + Playwright specs)
- Filed #281 (Node e2e @/ imports broken), #280 tracking
- PR #282 opened

### Didn't Work
- ADSR envelope drag: took 4 iterations across sessions, still has edge cases
- Filter display Bézier curves: 3 attempts before switching to sampled magnitude response (200 points, no Béziers)
- Node e2e test runner: @/ path alias broken in tsx with nodenext moduleResolution — all Node e2e tests are currently broken (#281)
- Built a standalone test runner to work around the @/ issue instead of following the documented pipeline

### Course Corrections
- [PROCESS] Agent tried to run tsx directly, then npx tsx, then built a standalone runner — all explicitly prohibited by CLAUDE.md. User asked "did you follow CLAUDE.md guidance?" Answer: no, didn't read it before acting.
- [PROCESS] Agent defaulted to unit test for a bug reported as device behavior. User walked through 6 questions: "what's the right way to test?", "what is a unit test?", "what kind of test exercises the bug?", "what are the test categories?", "what is E_FREQ?", leading to the correct answer: e2e test against real hardware.
- [PROCESS] Agent assumed it couldn't access hardware ("can't run e2e tests without hardware"). User: "why do you think you don't have access to hardware?" — the S3000XL is connected via SCSI bridge.
- [PROCESS] Agent assumed device might be at fault. User: "never assume the device is at fault — it's been in service 30 years, our code is brand new."
- [PROCESS] Agent wrote guidance to memory but not to CLAUDE.md. User: "why didn't you write it to CLAUDE.md?" — memory helps future sessions, CLAUDE.md helps other agents.
- [PROCESS] Agent kept writing guidance instead of writing the actual test. User: "did you just take your own advice?"

### Quantitative
- User messages: ~100+
- Commits: ~15
- User corrections: 6 (all PROCESS — testing methodology and following documented procedures)
- Issues filed: #272-#282
- Issues closed: #272, #273, #276

### Insights
1. **Read the documentation before acting.** CLAUDE.md has detailed test infrastructure guidance. The agent didn't read it and spent 30 minutes reinventing (badly) what the docs already describe. Adding a "Before Running Tests" section to CLAUDE.md as a speed bump.
2. **Test at the right layer.** When a user reports a device behavior, the test must talk to the device. Don't default to the easiest test category — match it to the bug's layer. Use Node e2e tests to isolate client/encoding from UI.
3. **Never assume the device is at fault.** The device has 30 years of field service. Our code is days old. Exhaust all possibilities in our code first.
4. **The sampled magnitude response approach works.** Generating filter curves by sampling a transfer function at 200 points (like Surge XT) produces smooth, correct curves. Bézier approximations are fragile and produce visual artifacts at parameter extremes.
5. **Guidance must go to CLAUDE.md, not just memory.** Memory helps one agent in future sessions. CLAUDE.md helps ALL agents in ALL sessions.

---

## 2026-04-12: Akai S3000XL Editor UX — Design Review and Interactive Editors (Session 2)

### Feature: akai-ux-improvement
### Worktree: audiocontrol-akai-ux-improvement

### Goal
Review the implemented UI in the browser, fix design issues, and make parameter editing compelling.

### Accomplished
- Connection drawer: converted standalone Connect page to SlideDrawer accessible from any page via MIDI status indicator
- Program CRUD on list items: delete (trash icon), clone (SteppedProgressDrawer), rename (inline double-click), refresh — all with optimistic updates
- Redesigned ProgramEditor: dense multi-column grid with ParamKnob (visual value bars, draggable tracks, click-to-edit numbers)
- Redesigned KeygroupEditor: same dense grid, removed CollapsibleSection, paired sections (Filter+Filter Env, Amp Env+Pitch)
- Interactive ADSR and filter envelope editors with draggable points — fixed layout (sustain end at 75%), working decay drag
- Header controls: "All Notes Off" replaces "PANIC", gear icon on MIDI status, info icon replaces git hash, responsive collapsing at narrow widths
- Design system: ac-list-action-btn with --selected/--danger modifiers, ac-icon/ac-icon-lg classes, --ac-action-* CSS variables, ac-hide-narrow utility
- Narrowed program list column to 18rem (was 33% via 1fr/2fr)
- Selection persisted in sessionStorage (survives page reload)
- Auto-select first program/keygroup when list loads
- Created DESIGN-NOTES.md as working design scratchpad
- Filed issues: #239 (design system docs), #245 (delete stack overflow), #246 (skeleton loading), #247 (envelope drag refinement)
- Pinned Rust 1.91 in Dockerfile.arm64, deployed bridge to Pi
- Merged PR #248

### Didn't Work
- Envelope drag interaction: 4 attempts with broken math before finding the stale-closure bug (two onChange calls in same tick, second overwrites first). Should have studied the Roland EnvelopeEditor code from the start instead of building from first principles.
- Proportional envelope layout (from adsr-envelope-graph reference) caused whole graph to shift when dragging one point. Fixed by using fixed-scale layout with sustain end anchored at 75%.
- Icon sizes: started at 14px, went through 18px, 20px, and multiple rem values before settling on design system classes. Each iteration required the user to point out it was still wrong.

### Course Corrections
- [PROCESS] User flagged that I hadn't reviewed the library-ux drawer/dialog patterns before delegating implementations.
- [PROCESS] User clarified ConfirmDialog is for destructive confirmation only — not general operations.
- [PROCESS] User said "use existing code" — I kept building envelope drag from scratch instead of studying the Roland EnvelopeEditor.
- [PROCESS] User had to remind me to add design notes to DESIGN-NOTES.md after establishing a pattern.
- [PROCESS] User asked "why didn't you follow the standard?" when I set icon sizes with inline px instead of the rem-based classes I had just created.
- [PROCESS] User asked "why didn't you update the library?" when I only fixed the S3K consumer but not the editor-core source.
- [UX] User pointed out fire-and-forget delete dialog — should stay open during async operation.
- [UX] User pointed out fire-and-forget rename — should show saving state.
- [UX] User pointed out full-list-reload after rename nukes the UI — should use optimistic update.
- [UX] User pointed out non-responsive header — text labels should collapse at narrow widths.
- [UX] User pointed out affordance colors invisible on blue selection background.
- [UX] User pointed out icon sizes too small, specified in px not rem.
- [UX] User said "make the sliders draggable" — obvious interaction I missed.
- [FABRICATION] Agent attempted to implement clone without checking if createProgram works — it does, via the import pattern.

### Quantitative
- User messages: ~80
- Commits: ~20
- User corrections: 14 (7 PROCESS, 6 UX, 1 FABRICATION)
- Sub-agents spawned: ~5

### Insights
1. **Design system first**: every visual value should come from the design system. I repeatedly created variables/classes then used hardcoded values in components. The cardinal rule: if a value appears in a component, it's wrong.
2. **Study existing code before building**: the Roland EnvelopeEditor has working, debugged drag interaction. I wasted 4 iterations building broken drag math from scratch instead of adapting proven code.
3. **Stale closures in React drag handlers**: when onChange is called multiple times in the same tick, each call reads from the same stale closure. Fix: read from getState() instead of closure variables, or merge multi-field changes into a single onChange call.
4. **Optimistic updates prevent UI flicker**: never invalidateCache() + reload after a mutation. Update the known state in place; only reload from device on failure.
5. **DESIGN-NOTES.md as working scratchpad**: capture design decisions as they happen. A separate effort will formalize them into CLAUDE.md guidelines.

---

## 2026-04-12: Akai S3000XL Editor UX Improvement — All 5 Phases (Session 1)

---

## 2026-04-13: Draggable Zone Editing — Complete (Phases 1-4 + Zoom + Tests)

### Feature: draggable-zones
### Worktree: audiocontrol-draggable-zones

### Goal
Implement all 4 phases of draggable zone editing for the Akai S3000XL keygroup editor, plus zoom controls and UI test infrastructure.

### Accomplished
- Phase 1: Shared coordinate system — `note-coordinate-utils.ts` (8d2c8033)
- Phase 2: Draggable zone boundaries — `use-zone-drag.ts` hook, DragHandle on all 4 edges (8d2c8033)
- Phase 3: Draggable velocity split points in VelocityRangeBar (53a6de65)
- Phase 4: Zone creation via drag in empty ZoneOverview space (5a01034b)
- Zone translation: drag interior to slide zones along the note range (6ec097bd)
- Explicit zoom controls: Zoom In/Out, Fit, Reset, scroll-wheel zoom (14b2ce6a)
- Integrated all features into real KeygroupsPage with device communication (6ec097bd)
- Fixed overlapping zone label text with opaque selected backgrounds (6ec097bd)
- Established test architecture: TESTING.md with unit/ui/e2e categories (9471708a)
- Created TESTING-UI.md methodology and test harness pattern
- 19 Playwright UI test specs covering all interactions (7810b7fc)
- Filed #263 for migrating existing tests to new directory structure
- Closed issues #253, #254, #255, #256
- 135 unit tests + 19 UI tests all passing

### Didn't Work
- WebFetch tool cannot access localhost — used Playwright CLI for screenshots instead
- First Phase 2 agent hit API overload — retried successfully
- `handleCreateZone` used `refreshFromDevice` before it was declared — moved after declaration

### Course Corrections
- [PROCESS] Agent started implementing directly instead of delegating. User: "are you delegating?" Switched to orchestrator role immediately.
- [PROCESS] Agent proposed testing via full e2e dev environment with hardware. User pushed for minimum-friction isolated testing — led to test harness pattern.
- [PROCESS] Agent took ad-hoc screenshots without writing reusable test specs. User: "Does that comport with software engineering best practices?" Led to establishing the test architecture (TESTING.md) and writing 19 Playwright specs.
- [PROCESS] Agent didn't integrate features into real KeygroupsPage — only wired to test harness. User: "Did you integrate the feature into the s3k keygroup page?"
- [DOCUMENTATION] Agent created TESTING-UI.md without requiring reusable test specs. User pushed for the test-alongside-build practice — updated TESTING-UI.md and CLAUDE.md.
- [PROCESS] Agent proposed test files in `e2e/` directory. User: "Can't we have test/unit, test/ui, test/e2e?" Led to the standard test directory structure.

### Quantitative
- User messages: ~40
- Commits: 10
- User corrections: 6 (all PROCESS/DOCUMENTATION)
- Sub-agents used: ~15 (explore, implementation, documentation, test automation)

### Insights
1. **Test-alongside-build is non-negotiable.** The test harness pattern enables it — every manually verified interaction must become a Playwright spec. Ad-hoc screenshots are for quick checks, not deliverables.
2. **Test architecture needs explicit categories.** The user pushed for test/unit, test/ui, test/e2e — a self-documenting structure where adding a new category is obvious.
3. **Always integrate into the real app.** Building only for the test harness is incomplete. The user caught that KeygroupsPage wasn't wired up.
4. **The orchestrator pattern worked well** once established — research → delegate → review → screenshot → iterate. Each phase got faster as patterns were reused.

---

## 2026-04-13: Draggable Zone Editing — Phases 1-3

### Feature: draggable-zones
### Worktree: audiocontrol-draggable-zones

### Goal
Implement draggable zone boundaries for the Akai S3000XL keygroup editor — shared coordinate system, drag handles on ZoneOverview, and draggable velocity split points.

### Accomplished
- Phase 1: Extracted `note-coordinate-utils.ts` with shared `NoteRange`, `noteToPercent`, `percentToNote`, `computeKeyRange`. Both ZoneOverview and KeyRangeEditor now use the same coordinate mapping. (8d2c8033)
- Phase 2: Created `use-zone-drag.ts` hook (onDrag/onCommit pattern), added invisible DragHandle components on all 4 zone edges with hover highlights. Extracted `ZoneOverviewZone.tsx` to keep files under 300 lines. (8d2c8033)
- Phase 3: Added draggable split point handles to VelocityRangeBar between adjacent velocity zones. Dragging adjusts HIVEL/LOVEL to keep zones contiguous. (53a6de65)
- Created `TestKeygroupsPage.tsx` test harness at `/test/keygroups` route — renders all components with hardcoded factory data, no device needed
- Documented the targeted UI testing methodology in `TESTING-UI.md`
- Updated CLAUDE.md and session-start skill to reference UI test harness workflow
- Closed issues #253 (Phase 1), #254 (Phase 2), #255 (Phase 3)
- 135 tests pass across 15 test files

### Didn't Work
- WebFetch tool cannot access localhost URLs — had to use Playwright CLI for screenshots instead
- First implementation agent hit API overload error — retried successfully

### Course Corrections
- [PROCESS] Agent started implementing Phase 1 directly instead of delegating. User: "are you delegating?" Immediately switched to orchestrator role and delegated to sub-agents for all subsequent work.
- [PROCESS] Agent proposed testing via the full dev environment with hardware. User asked: "How can you test this yourself in a virtuous cycle?" and then "Is there a way to test in as isolated way as possible?" Led to creating the test harness pattern — standalone page with factory data, no device/store.
- [PROCESS] Agent proposed Playwright e2e tests and Storybook before researching what already exists. User: "You should research what is available." Led to discovering vitest browser mode and the existing test infrastructure.

### Quantitative
- User messages: ~15
- Commits: 2 (Phase 1-2, Phase 3)
- User corrections: 3 (all PROCESS — delegation, test approach, research first)
- Sub-agents used: ~8 (1 explore keygroups, 1 explore testing infra, 1 explore overlap rules, 3 implementation, 1 file split, 1 documentation)

### Insights
1. **Test harness pattern is high-value.** Creating a standalone page with factory data gives a visual feedback loop without hardware. This should be the default for any UI feature work. Documented in TESTING-UI.md so future sessions start with it.
2. **Research before proposing.** The agent proposed testing approaches (Storybook, Playwright e2e) before checking what tools were available. The user had to redirect to "research what is available" — which found vitest browser mode and existing Playwright infra. Always check existing infrastructure first.
3. **The "how can you test this yourself" question** is the right framing for any UI feature. The answer should always be: create a minimum-friction harness, not reach for the full e2e stack.
4. **Phase 1-3 went smoothly once the process corrections landed.** The delegation→implement→screenshot→verify loop worked well. Phase 3 was the fastest because the patterns from Phase 2 (useZoneDrag, DragHandle) were directly reusable.

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

## 2026-04-17: MESA II Parity Transport-State Trace

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Advance the Codex-side MESA II parity analysis by tightening the socket and transport
state model around sample upload and identifying any clear disagreements that should be
escalated to Claude.

### Accomplished
- Published parity-doc baseline and follow-up findings in commits:
  `a2fcd612`, `2d268d90`, `14c695f9`, `2ddb5e3d`, `5303c27b`, `84b43a5f`, `3b88631e`
- Confirmed from primary artifacts that `CAkaiMIDIDispatcher` slot `0x38` points to
  `SwapLongWord`
- Established that `CMESASocket` slot `0x30` is activation/state management rather than
  a direct SDS-header send path, with:
  `OpenModule`/`ActivateModule` -> `ActivateThisSocket(1)`
  `DeactivateModule` -> `ActivateThisSocket(0)`
- Decoded enough socket lifecycle to model:
  `ConnectToPlug` -> `SelectPlug` -> `ActivateThisSocket`
- Proved the old direct `CSCSIPlug::SendData('BULK')` harness is structurally incomplete
  because it skipped real socket/plug selection and activation choreography
- Identified `CSamplerModule+0xda0` as mutable runtime transport-selection state via a
  pre-`OpenModule` toggle path around `0x029105`
- Identified `CSamplerModule+0xdaa` as likely MIDI-plug availability state, with the
  only observed write in the current artifact window occurring after successful `'MIDI'`
  `ConnectToPlug(...)`
- Confirmed `CSamplerModule+0xb1` save/restore behavior across both
  `SendAudioBufferToSampler` and `SendAudioFileToSampler`
- Reviewed and closed Claude-response issues `#309`, `#310`, `#311`, `#312`, and `#313`
  after verifying the actual branch fixes

### Didn't Work
- A whole-binary `objdump` pass still did not expose obvious plain stores to
  `CSamplerModule+0xb0` or `+0xb1`
- Constructor/`InitModule` decoding did not reveal inline initialization of
  `+0xb0`, `+0xb1`, or the default `+0xda0` value

### Course Corrections
- **[PROCESS]** I left several stable parity-doc updates uncommitted while continuing
  analysis. User pointed out the collaboration and durability risk. I corrected course by
  publishing the stable doc slices once they crossed the evidence threshold.
- **[DOCUMENTATION]** The phase-2 unknown initially stayed framed as slot-`0x30`
  identity. The session evidence narrowed that materially; the real remaining unknown is
  initialization provenance for `+0xb0/+0xb1` and the default `+0xda0` value.
- **[FABRICATION]** This session stayed disciplined about marking artifact boundaries.
  When whole-binary searches still failed to show `+0xb0/+0xb1` stores, the result was
  recorded as an evidence limit instead of turning it into a guessed explanation.

### Quantitative
- Commits pushed on parity branch during session: 3
  `84b43a5f`, `3b88631e`, plus the earlier pushed `5303c27b` close-out commit carried
  forward into this session's continuation
- Claude-review issues resolved this session: 5
  `#309`, `#310`, `#311`, `#312`, `#313`
- New parity-doc findings added this session: transport selector `+0xda0`, MIDI
  availability byte `+0xdaa`, repeated `+0xb1` save/restore across multiple upload
  paths, and the stronger activation-state interpretation of slot `0x30`

### Insights
1. The most valuable parity work this session came from following concrete state bytes
   (`+0xda0`, `+0xdaa`, `+0xb1`) across real code paths instead of continuing to argue
   abstract transport theories.
2. The direct BULK harness problem is now much more clearly a missing lifecycle problem
   than a one-packet problem.
3. Once a parity finding is evidence-stable, publishing it quickly matters because the
   parallel Claude branch can incorporate or contest it immediately.

---

## 2026-04-17: MESA II Parity Constructor Boundary Narrowing

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push the remaining parity unknown from generic ownership speculation into a narrower,
constructor-era boundary: confirm the `CAkaiSampler` socket field setup directly and
localize the unresolved `CSamplerModule+0xda4` installation path.

### Accomplished
- Independently confirmed `CAkaiSampler::SetSocket` at file `0x028597` as a direct
  write of a `CMESASocket*` to `CAkaiSampler+0xa2`
- Independently confirmed the `CAkaiSampler` constructor at `0x068981`, including:
  vtable-at-`+2` layout, reset of the socket field at `+0xa2`, and the expected
  constructor-time zeroing of related state
- Narrowed the module-side ownership gap further:
  the remaining `CSamplerModule+0xda4` installation is no longer “some unknown external
  write” but constructor-era helper work, with `0x317dc(this)` as the strongest current
  candidate from primary artifacts
- Published the narrowed constructor-boundary finding in commit `7f1f5147`

### Didn't Work
- I still did not recover a direct primary-artifact store to `CSamplerModule+0xda4`
- Whole-binary and bounded searches still did not surface a clean, trustworthy caller
  of `__ct__12CAkaiSamplerFv` or `SetSocket` from the aligned module slices

### Course Corrections
- **[PROCESS]** The constructor start address was initially assumed too late
  (`0x0285d3`). Re-checking the binary string table corrected that boundary to
  `__ct__14CSamplerModuleFv` at `0x02857c`, which prevented the next pass from chasing
  the wrong ownership window.
- **[EVIDENCE]** I did not promote `0x317dc` from “best current candidate” to a named
  initializer because the directly bounded disassembly at that address is still noisy.
  The docs keep that distinction explicit.

### Quantitative
- Commits pushed in this constructor-boundary pass: 1
  `7f1f5147`
- New stable parity findings added: 1 major constructor-boundary finding
  (`CAkaiSampler::SetSocket` + `CAkaiSampler` ctor confirmation + narrowed `+0xda4`
  installation boundary)

### Insights
1. The string table is a practical boundary-finding tool in this binary; it corrected a
   constructor-start mistake that raw offset assumptions had introduced.
2. The ownership problem is now usefully smaller: the unresolved question is not whether
   `+0xda4` is a `CAkaiSampler*`, but which constructor-era helper installs it.

---

## 2026-04-19: MESA II Parity Static Send Surface Exhaustion

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push the static `CSCSIPlug::SendData` surface to a clean stopping point so the next
Codex move can shift outward to runtime evidence instead of one more speculative helper
hunt.

### Accomplished
- Published a series of parity refinements that collapsed the remaining apparent local
  `SendData` targets:
  - chooser-side `0x210c/0x21dc/0x229c/0x218a` targets are plain `CDialog` plumbing
  - `0x0d54` lands inside the tail/epilogue of `DoMESACommand`
  - the direct absolute `jsr` targets inside `SendData` are now effectively classified:
    `0x0148` low-memory/nonlocal, `0x0ca2` internal, `0x0d54` internal tail entry,
    `0x0dfc` selector/send dispatcher, `0x106e` unresolved sender stub
- Strengthened the `0x106e` result from “placeholder” to “not plausibly executable as
  the final sender body in the checked-in binary”:
  every `jsr 0x106e` return site expects caller-side result handling and stack cleanup
  before the shared `0x1160` tail path, but the static bytes at `0x106e` are only
  `bra 0x1160` and would skip that work entirely if executed as-is
- Synced the stronger runtime-boundary interpretation back to Claude on issue `#315`
  and then posted a second note explicitly marking the static `SendData` surface as
  effectively exhausted
- Updated the parity feature README and workplan so they no longer imply the next best
  move is another static helper search inside the plug body

### Didn't Work
- Continuing to probe inside the recovered `CSCSIPlug` body stopped producing new helper
  identities; the remaining apparent targets kept collapsing into internal entries,
  low-memory/nonlocal jumps, or UI/control plumbing
- The checked-in split disassembly files were not enough on their own to answer some of
  the late-stage call-target questions; I had to fall back to raw bytes for the final
  `0x0d54` collapse

### Course Corrections
- **[STRATEGY]** The right parity target is no longer “find one more send helper.”
  The branch now treats the static plug-side `SendData` surface as effectively exhausted
  and points the next pass at runtime installation/interception evidence instead.
- **[SYNC]** Rather than filing a new contradiction issue, I used issue `#315` as the
  additive coordination point because the new findings sharpen Claude's current runtime
  direction instead of disputing it.
- **[DOCUMENTATION]** I updated the feature README/workplan immediately after the
  exhaustion point so the next session does not reopen the same static surface by habit.

### Quantitative
- Commits pushed in this pass: 5
  `3751026d`, `ece173d5`, `90ae3a07`, `c6a17136`, plus the surrounding parity-sync work
- New GitHub issue activity: 2 additive `#315` comments
- New stable parity findings added: 4 major static-boundary refinements
  (chooser-side dialog collapse, strengthened `0x106e` sender-stub model, `0x0d54`
  collapse, and explicit `SendData` call-surface exhaustion)

### Insights
1. The most useful late-stage static result was not another symbol name but a stopping
   rule: once the direct absolute `jsr` targets inside `SendData` were effectively all
   classified except `0x106e`, the branch had a defensible reason to pivot outward.
2. The `0x106e` bytes matter more than I initially gave them credit for. They are not
   merely “unknown”; they actively look incompatible with the caller-side cleanup shape
   in the checked-in binary.
3. Claude/Codex coordination is cleaner now that `#315` is carrying additive runtime
   boundary evidence while the old stale-doc parity issues remain closed.

---

## 2026-04-17: MESA II Parity UALL Call-Family Split

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push past the broad “UALL is not `SendData`” result and recover the actual structural
split inside `SendAudioBufferToSampler`: which calls are sampler-side, which call is the
later shared command-bus dispatch, and what shared interface sits behind that path.

### Accomplished
- Confirmed from primary disassembly that `SendAudioBufferToSampler` contains two
  distinct non-socket call families:
  - early pre-loop calls at `0x030773`, `0x030793`, `0x0307f7`, `0x030841`, and
    `0x030891` all go through `CSamplerModule+0xda4` via the `object+2 -> vtable` path
  - the later post-loop `UALL` call at `0x030c93` instead goes through a separate
    secondary command table at object offset `+4`
- Confirmed that `CSamplerModule::SendCommandToSampler` and
  `CFXFilerView::SendCommandToSampler` both dispatch through slot `0x28` of that shared
  `+4` table
- Confirmed from constructor slices that both `CSamplerModule` and `CFXFilerView`
  install an A4-relative primary class vtable at offset `0` and a second A4-relative
  command-routing table at offset `+4`
- Updated the parity docs and comparison record to treat post-loop `UALL` as a shared
  command-bus path rather than a plug transport tag or a direct `CAkaiSampler`
  vtable-slot identity
- Filed issue `#314` and then added follow-up comments narrowing the stale Claude-side
  problem from “not SendData” to “conflates the early `CAkaiSampler` slot-`0x015c` call
  with the later post-loop `UALL` command-bus dispatch”

### Didn't Work
- I still did not name the shared command processor behind the secondary `+4` table
- Raw A4-table bytes alone were too noisy to promote into a named interface or clean
  slot map without risking overclaiming

### Course Corrections
- **[DOCUMENTATION]** The first `UALL` correction was still too coarse. The next pass
  showed the real issue is a call-family conflation inside the same function, so the
  docs and issue thread were tightened to separate the early `CAkaiSampler` path from
  the later shared command-bus path.
- **[PROCESS]** I kept publishing stable parity findings as soon as they crossed the
  evidence threshold instead of leaving them local. This session produced four pushed
  commits that each reflected a discrete structural refinement.
- **[EVIDENCE]** I did not promote the secondary `+4` table to a named interface from
  raw bytes alone. The notes keep the current state at the stronger, defensible level:
  shared command-routing table installed during construction, handler identity still
  unresolved.

### Quantitative
- Commits pushed in this pass: 5
  `1cc87661`, `ca445c4d`, `610b3fdb`, `afacaf7a`, plus the preceding pushed parity work
  carried forward into this close-out
- New GitHub issue activity: 1 issue filed and expanded
  `#314`
- New stable parity findings added: 4 major `UALL`/command-routing refinements
  (generic `CSamplerModule` command slot, shared `CFXFilerView` parallel, secondary
  `+4` command table installed by both constructors, and the explicit sampler-side vs
  post-loop `UALL` call-family split)

### Insights
1. The remaining `UALL` ambiguity is now smaller and more useful: the problem is not
   transport anymore, but command-routing ownership.
2. Constructor slices were more informative than raw table bytes for understanding the
   secondary `+4` table. The install sites gave a stronger structural claim than the
   table contents did.
3. `SendAudioBufferToSampler` mixes multiple object systems in a small span. Treating
   every non-socket indirect call as one “UALL phase” was the wrong abstraction; the
   parity work improved once those call families were separated explicitly.

## 2026-04-20: MESA II Far-Out Table Layer Tightened Into UI Descriptor Exclusion

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push one more narrow static pass on the remaining far-out descriptor/table layer and
see whether it still looked like a plausible owner-side callback-install boundary.

### Accomplished
- Rechecked the dense table region around `0x07b212` directly from raw bytes
- Corrected the far-out payload reading from a vague "`0xce24` table region" to the
  stronger longword-target interpretation:
  rows point into `0x0001ce24`, `0x0001ce52`, `0x0001ce80`, `0x0001ceae`, and nearby
  payload blocks
- Verified those payload blocks are repeated structured records without ordinary m68k
  function markers
- Anchored the target neighborhood to UI/help text such as `3rd loop length.` and
  `loop dwell 3`, which makes the table look like a resource/descriptor catalog rather
  than hidden executable install logic
- Updated parity findings and comparison notes with the stronger exclusion

### Didn't Work
- This pass still did not expose a new bridge into `+0xa20` or `SetCommandProc`
- The remaining install edge still does not present as an ordinary in-resource caller
  chain

### Course Corrections
- **[EVIDENCE]** The earlier wording for the far-out `0x07b212` region was too soft.
  The new pass replaced "generic index/table region" with a stronger, byte-backed
  description: repeated rows into non-code UI/resource descriptor payloads.
- **[PROCESS]** I kept the pass narrow instead of reopening the already ruled-out
  constructor/tag/resource branch. The new finding strengthens the existing boundary
  rather than creating another exploratory side quest.

### Quantitative
- New stable parity findings added: 1
  `Finding 113`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The last visible far-out table layer now looks like descriptor catalog data, not a
   blurry "maybe installer" region.
2. The static boundary is stronger when the payload targets are read as full longwords
   (`0x0001ce24`, etc.) instead of truncated local roots (`0x0000ce24`).
3. This kind of narrowing is still worth doing in parallel with Claude's runtime work:
   it gives a sharper exclusion boundary without reopening broad static reverse
   engineering.

## 2026-04-20: MESA II Final Far-Out `ce28` Site Reduced To Lifecycle Metadata

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Check whether the lone far-out `0x0000ce28` table site was the last plausible
table-shaped escape hatch for the callback-install edge.

### Accomplished
- Re-read the structured record around `0x075b8b` from raw bytes
- Matched its helper/address family back to the already-known constructor/main/destructor
  surface:
  `0x000273fa`, `0x000317dc`, `0x0002d6f6`, and `0x0000ce28`
- Verified that the same family is already present in live code around
  `0x028221-0x028245` and `0x028625-0x02864f`
- Recorded the stronger interpretation: this far-out `ce28` table site is lifecycle
  metadata for the generic scaffold/helper layer, not a fresh sender-install path

### Didn't Work
- This still did not reveal a new caller into `SetCommandProc` or a new bridge into
  `+0xa20`
- The remaining boundary still does not present as an ordinary in-resource call graph

### Course Corrections
- **[EVIDENCE]** I treated the far-out `ce28` site as a fresh possibility only until the
  raw-byte comparison showed it was re-encoding the same helper family already classified
  from direct code.
- **[PROCESS]** I kept collapsing the remaining far-out exceptions instead of reopening
  broader static terrain. That made the boundary cleaner without duplicating Claude's
  dynamic effort.

### Quantitative
- New stable parity findings added: 1
  `Finding 114`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The remaining far-out exceptions are becoming bookkeeping/lifecycle metadata, not new
   semantic terrain.
2. Re-encoding of already-known helper families is now a recurring pattern in the
   generic framework layer.
3. The static owner-boundary case is getting closer to a clean terminal conclusion:
   no visible far-out table layer is opening a new sender-install path.

## 2026-04-20: MESA II Static Owner Boundary Declared Effectively Exhausted

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Turn the accumulated boundary-tightening work into an explicit branch-level conclusion
about what the recovered `sampler-editor-rsrc.bin` graph can still realistically tell us.

### Accomplished
- Added a new terminal-style finding stating that the ordinary recovered resource graph
  is effectively exhausted as a direct owner/install path into `+0xa20`
- Updated the feature README to make the stopping rule explicit:
  the remaining install edge is now best modeled as either a deeper nonliteral/table-
  driven framework handoff or behavior outside the recovered resource graph
- Updated the workplan so future passes do not treat already-collapsed ordinary helper,
  descriptor, and lifecycle surfaces as fresh reverse-engineering terrain

### Didn't Work
- This did not reveal the live sender install edge itself
- The static side still cannot name the exact upstream owner that calls the generic
  `SetCommandProc` / `InitModule` setter

### Course Corrections
- **[PROCESS]** The right next move was not yet another local decode. It was to write
  down the stopping rule the evidence now supports, so both Codex and Claude can use the
  same boundary when choosing what not to re-investigate.
- **[DOCUMENTATION]** The docs already implied this conclusion informally, but they did
  not yet say it plainly enough. The update makes the terminal static read explicit.

### Quantitative
- New stable parity findings added: 1
  `Finding 115`
- Feature docs updated: 3
  `codex-findings.md`, `README.md`, `workplan.md`

### Insights
1. A clean terminal static conclusion is itself useful output when parallel runtime work
   is active; it prevents broad re-decoding churn.
2. The right remaining static target is no longer "one more helper." It is only boundary
   proof or contradiction handling if new evidence appears.
3. Path A still has value in parallel with Claude, but now mostly as exclusion and
   falsification work around the boundary, not as open-ended graph excavation.

## 2026-04-20: MESA II Compile-Time Vtable Model Reopens Part Of The Static Boundary

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Review Claude's latest `#315` Path A/A.5 comment, verify the load-bearing corrections
directly from the binary, and update the parity branch if the current Codex boundary
model was too broad.

### Accomplished
- Reviewed Claude's `#315` comment claiming the reply handler is compile-time
  vtable-bound rather than runtime-installed
- Verified directly from `sampler-editor-rsrc.bin`:
  - `CMESAEditor` ctor has a fifth absolute call at `0x0596fb` to `0x00027e00`
  - the corrected EDIT base `0x027f57` maps the ctor targets to real code at
    `0x04f8d3`, `0x04fd57`, `0x0506ff`, `0x05561f`, and `0x059d1d`
  - static vtable region `0x071a1f` contains entry `0x0003194e` at `0x071a53`
  - that target resolves to real code at `0x0598a5`, immediately before the
    `CMESAEditor::DoMESACommand` symbol band
- Updated parity docs to reflect the corrected model:
  the direct `+0xa20` install hunt is still exhausted, but the broader editor-side
  reply path is reopened inside the recovered graph as a compile-time vtable problem

### Didn't Work
- This pass still did not fully independently decode the exact ctor store that loads the
  embedded socket's vtable slot
- It also did not close the remaining plug-side slot-family question that Claude calls
  Path A.6

### Course Corrections
- **[EVIDENCE]** My earlier "outside the recovered resource graph" framing had become
  too broad. Claude's correction was concrete enough to test, and the binary supported
  the core of it.
- **[DOCUMENTATION]** The parity docs now separate two claims that had been conflated:
  `+0xa20` direct-install exhaustion still stands, but the live reply path is no longer
  best modeled as external/runtime by default.

### Quantitative
- New stable parity findings added: 2
  `Finding 116`, `Finding 117`
- Feature docs updated: 4
  `codex-findings.md`, `comparison-record.md`, `README.md`, `workplan.md`

### Insights
1. The right correction was not to throw out the static boundary work, but to narrow
   what exactly it had ruled out.
2. A wrong base/offset assumption can make real framework code look like data/string
   terrain; parity work needs to keep checking its address model, not just the decoded
   semantics.
3. The remaining static frontier is now sharper again: compile-time socket/vtable
   binding and the plug-side slot family, not a missing runtime install event.

## 2026-04-20: MESA II Plug-Side Callback Slot Corrected To `SocketInfo[+0]`

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Use Claude's new Path A.6 result as the next concrete parity target: verify the exact
plug-side callback slot and decide whether the remaining static question is still about
`SocketInfo[+12]` or something cleaner.

### Accomplished
- Verified directly from `scsi-plug-rsrc.bin` that the `$11fe` callback path calls
  through `plug_slot[+0]`, not `plug_slot[+12]`
- Verified that `CMESAPlugIn::ConnectToSocket` at `0x09fc-0x0a1e` verbatim-copies the
  incoming 46-byte `SocketInfo` into the plug slot
- Verified that `GetSockets` returns `this+0x38`, matching the slot-array iteration that
  reaches the `$11fe` call-through path
- Updated parity docs to replace the older `SocketInfo[+12]` framing with the cleaner
  current target: the editor-side identity of `SocketInfo[+0]` in the `CONS` payload

### Didn't Work
- This still did not identify the editor-side callback function that becomes
  `SocketInfo[+0]`
- The editor's exact `CONS` payload construction path remains unresolved on the Codex
  side

### Course Corrections
- **[EVIDENCE]** The slot-field correction is important because it removes a whole class
  of stale questions. The plug-side live callback is not waiting on `SocketInfo[+12]`.
- **[PROCESS]** Following Claude's sharper sub-problem was the right move here; it
  converted a fuzzy "socket/vtable frontier" into one exact unresolved field.

### Quantitative
- New stable parity findings added: 1
  `Finding 118`
- Feature docs updated: 4
  `codex-findings.md`, `comparison-record.md`, `README.md`, `workplan.md`

### Insights
1. The remaining static frontier is now one field narrower than before.
2. Once the plug-side copy/install semantics are fixed, the next real question belongs
   entirely on the editor side.
3. This is the kind of cross-pollination that justifies running Path A in parallel:
   a Claude-side narrowing became a Codex-side primary-artifact correction within one
   pass.

## 2026-04-20: MESA II Ambiguous Raw-Hex Hits Kept Below Finding Threshold

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Probe one last angle on the exhausted owner boundary by checking whether nearby
constructor-era addresses showed up in raw-hex/table form even though `SetCommandProc`
did not.

### Accomplished
- Ran permissive full-file raw-hex searches over the `0x028xxx` constructor-era family
- Confirmed again that `0x0286f3` / `SetCommandProc` and nearby owner anchors still do
  not show up as straightforward longword references in the recovered resource
- Rejected the tempting follow-up interpretation when some nearby addresses appeared:
  the resulting hits were ordinary control-flow immediates inside code, not a clear
  table-driven owner/install structure
- Tightened the workplan to make that process rule explicit

### Didn't Work
- This pass did not produce a new stable owner-boundary finding
- It did not reveal a deeper table-driven caller into `SetCommandProc`

### Course Corrections
- **[EVIDENCE]** I did not promote ambiguous raw-hex hits into a structural claim just
  because they landed near constructor-era addresses. They were not clean table entries
  or callback-install metadata.
- **[PROCESS]** Once the branch-level terminal boundary had been written down, the right
  standard became stricter: ambiguous branch/immediate coincidences are now negative
  process evidence, not near-miss findings.

### Quantitative
- Feature docs updated: 2
  `workplan.md`, `DEVELOPMENT-NOTES.md`
- New stable parity findings added: 0

### Insights
1. The exhausted-boundary phase needs a higher evidence bar than the earlier discovery
   phase.
2. "Interesting nearby address hit" is no longer enough; it must resolve to a real
   ownership or install mechanism.
3. Writing down what does *not* qualify as a finding helps prevent the static side from
   drifting back into low-yield graph mining.

## 2026-04-20: MESA II `PLST` vs `CONS` Flow Split Clarified

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Resolve the remaining apparent conflict between the editor-side
`descriptor[+12] -> editor_slot[+8]` path in `CMESASocket::ConnectToPlug` and the
plug-side `$11fe` callback path that clearly reads `plug_slot[+0]`.

### Accomplished
- Verified from primary artifacts that `CMESASocket::ConnectToPlug` contains two distinct
  command phases, not one:
  - a first phase using the `PLST` command record to fetch and iterate 48-byte plug
    descriptors
  - a later phase using the `CONS` command record to send the editor's own
    46-byte `SocketInfo`
- Confirmed that the editor-side descriptor phase tests and calls `descriptor[+12]`, then
  installs that field into editor-local socket storage at `editor_slot[+8]`
- Confirmed that the plug-side `ConnectToSocket` path still verbatim-copies
  `SocketInfo[+0]` into `plug_slot[+0]`, which is the field later called at `$11fe`
- Updated parity docs to make those two flows explicit instead of letting them look like
  contradictory explanations

### Didn't Work
- This still did not identify the editor-side function address that becomes
  `SocketInfo[+0]` in the `CONS` payload
- The exact plug `DoMESACommand` arm mapping for `CONS` vs `ASOK` still remains one step
  short of a fully body-decoded proof

### Course Corrections
- **[EVIDENCE]** The right way to treat the raw disassembly here is as a two-structure
  handshake, not a single-slot mystery. Once the measured `PLST`/`CONS` split is made
  explicit, the older apparent conflict disappears.
- **[PROCESS]** This is the kind of static clarification worth publishing quickly even
  without a new function identity, because it narrows the next unresolved field cleanly
  and removes a false contradiction from the active model.

### Quantitative
- New stable parity findings added: 1
  `Finding 119`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The editor and plug are not mirroring one struct blindly; they are participating in a
   measured two-phase exchange with different record shapes.
2. `descriptor[+12]` and `SocketInfo[+0]` now belong to different halves of the same
   handshake, which makes the remaining unknown narrower and more actionable.
3. The next real question is still editor-side: what concrete function address becomes
   `SocketInfo[+0]` in the `CONS` payload?

## 2026-04-20: MESA II `CMESASocket[+12]` Narrows to Reply-State, Not Callback

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push one step further on the `CONS`/`SocketInfo` frontier by checking whether the
editor-side `CMESASocket` fields exposed any concrete post-constructor write that could
clarify the lingering `SocketInfo[+12]` question.

### Accomplished
- Decoded `CMESASocket::AcceptData` from raw bytes at file `0x05a1e1`
- Verified that it is a real post-ctor writer to `CMESASocket[+12]`
- Verified the successful branch writes `IP_Data[+8]` into `this[+12]` after copying the
  payload into the receive buffer at `this[+8]`
- Verified the failure branch writes literal `OVER` into `this[+12]` and returns
  `-11005`
- Updated parity docs to treat `CMESASocket[+12]` as reply/result bookkeeping rather
  than as a plausible live callback field

### Didn't Work
- This still did not identify the editor-side function address that becomes
  `SocketInfo[+0]` in the `CONS` payload
- It also did not yet prove whether `this+24` is the exact plug-visible `SocketInfo`
  base or a nearby structure passed through the same command

### Course Corrections
- **[EVIDENCE]** The useful move here was to stop treating `SocketInfo[+12]` as an
  abstract unknown and look for any concrete write. `AcceptData` gives that write, and it
  pushes the field firmly toward reply/result state.
- **[PROCESS]** This is a good example of staying adjacent to the active frontier without
  reopening broad graph mining: one concrete socket method materially narrowed a live
  field model.

### Quantitative
- New stable parity findings added: 1
  `Finding 120`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `CMESASocket[+12]` now looks like receive-side status/result storage, not sender-side
   callback identity.
2. The plug callback question is therefore even more cleanly isolated at
   `SocketInfo[+0]`.
3. Adjacent concrete writes are more valuable than another round of speculative owner-path
   chasing when the frontier is this narrow.

## 2026-04-20: MESA II `this+24` Remains a Pressure Point, Not a Settled Callback

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Check whether the currently recovered `CMESASocket` method surface exposes any direct
overwrite of `this+24`, since `ConnectToPlug`'s `CONS` phase currently points at that
address and the plug-side frontier still asks what becomes `SocketInfo[+0]`.

### Accomplished
- Verified again from raw bytes that embedded-socket `+24` is editor `+0x8c`, and the
  constructor seeds that field with `0x212`
- Ran a bounded scan over the recovered `CMESASocket` method set
  (`ctor`, `SetBuffer`, `ConnectToPlug`, `SelectPlug`, `ActivateThisSocket`, `SendData`,
  `AcceptData`)
- Confirmed that this method surface uses `+24` for address calculation but does not
  expose a direct `move* -> this@(24)` overwrite
- Captured that tension explicitly in the parity docs instead of silently treating
  `this+24` as a settled callback field

### Didn't Work
- This still did not identify the concrete editor-side function address that becomes
  `SocketInfo[+0]`
- It also did not yet tell us whether the plug sees raw `this+24` or a transformed view
  of that data through another command-layer structure

### Course Corrections
- **[EVIDENCE]** The right stance here is pressure, not overclaim. The recovered methods
  do not yet support a clean "raw `this+24` is the callback pointer" story, but that is
  not the same thing as disproving the broader frontier.
- **[PROCESS]** This is another good narrow static move: turn a fuzzy discomfort into a
  documented bounded exception that Claude can either resolve dynamically or cross-check
  from a different static angle.

### Quantitative
- New stable parity findings added: 1
  `Finding 121`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `this+24` is now an explicit tension point in the current Path A model, not an
   unexamined assumption.
2. The remaining question is no longer just "what function is `SocketInfo[+0]`?" but
   also "what layer makes that field plug-visible?"
3. A bounded negative result is still useful when it narrows where the next overwrite can
   plausibly live.

## 2026-04-20: MESA II `0x212 -> 0x028169` Is the Strongest Current Callback Candidate

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Pressure-test Claude's newer A.7 claim that the ctor-seeded `0x212` value at embedded
socket `+24` is not just a raw constant, but a real callback candidate relevant to
`SocketInfo[+0]`.

### Accomplished
- Verified that the ctor-seeded value at embedded-socket `+24` is EDIT-relative `0x212`
- Verified that `0x212 + EDIT_BASE(0x027f57) = file 0x028169`
- Verified from raw bytes that file `0x028169` is a real function entry:
  `4e 56 00 00 48 e7 1c 30 ...`
- Verified that the function takes one stack argument, immediately performs the THINK C
  world-setup call at `0x0104`, and then checks the incoming struct's first long against
  literal `INIT`
- Updated parity docs to promote `0x028169` as the strongest current
  `SocketInfo[+0]` callback candidate, while keeping it below the threshold of a proved
  identity

### Didn't Work
- This still did not fully prove that raw socket `this+24` is exactly what the plug sees
  as `SocketInfo[+0]`
- It also did not close the exact plug-side `CONS` arm mapping gap inside
  `CMESAPlugIn::DoMESACommand`

### Course Corrections
- **[EVIDENCE]** The right posture here is "strongest concrete candidate," not "solved."
  The function evidence is real, but the last routing step is still not fully body-decoded.
- **[PROCESS]** This is a good example of letting Claude's newer hypothesis raise the
  priority of a check without inheriting the conclusion blindly. The candidate survived
  primary-artifact review, but only at the right confidence level.

### Quantitative
- New stable parity findings added: 1
  `Finding 122`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The `CONS` frontier now has a best visible function candidate, not just an abstract
   unresolved field.
2. The remaining uncertainty is routing, not the existence of a plausible callback body.
3. This is the right point to keep the distinction between "strong candidate" and
   "proved identity" explicit, because the last hop still matters.

## 2026-04-20: MESA II `CONS` and `ASOK` Arm Mapping Proved from Plug Selector Table

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Close the last plug-side routing gap in the `SocketInfo[+0]` frontier by proving from
raw bytes which `CMESAPlugIn::DoMESACommand` arm is `CONS` and which is `ASOK`.

### Accomplished
- Re-read the raw `CMESAPlugIn::DoMESACommand` bytes at file `0x089a-0x099e`
- Decoded the inline selector table format as:
  - default offset word `0x00d6`
  - then tag/offset records where each offset is relative to its own word location
- Proved these two key landings from the raw table:
  - `CONS`: offset word at `0x08de`, value `0x002e`, target `0x090c`
  - `ASOK`: offset word at `0x08d2`, value `0x0052`, target `0x0924`
- Reconfirmed that:
  - arm `0x090c` passes `(this, MESACommand[+6])` to vtable `+0x30`
  - arm `0x0924` passes `(this, MESACommand[+6])` to vtable `+0x34`
- Reconfirmed the adjacent callee anchors:
  - `ConnectToSocket__11CMESAPlugInFP10SocketInfo` at `0x09d2`
  - `ActivateSocket__11CMESAPlugInFP10SocketInfo` at `0x0a5e`
- Updated parity docs to promote the `CONS -> ConnectToSocket` / `ASOK -> ActivateSocket`
  mapping from combined inference to raw-table-backed proof

### Didn't Work
- This still does not fully prove that the editor-side `CONS` payload exposes raw
  embedded-socket `this+24` as `SocketInfo[+0]`
- So the remaining uncertainty is now entirely on the editor side of the handshake, not
  in the plug's own tag routing

### Course Corrections
- **[EVIDENCE]** The right static target was the selector table arithmetic itself, not
  more generic plug-method speculation. Once the offset-word format was read correctly,
  the `CONS`/`ASOK` ambiguity collapsed cleanly.
- **[PROCESS]** This is a good example of how to finish a narrow decode: stop looking
  for broader patterns once the raw table already contains the answer.

### Quantitative
- New stable parity findings added: 1
  `Finding 123`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The plug-side tag mapping is now settled from primary bytes: `CONS` and `ASOK` are
   no longer inference-grade.
2. The remaining `SocketInfo[+0]` question is purely editor-side packing/routing.
3. This materially strengthens the current `0x212 -> 0x028169` callback candidate,
   because the plug-side copy path it would feed is now directly matched.

## 2026-04-21: MESA II SRAW Pre-`0x106e` Path Looks Like Argument Packaging, Not Inline CDB Construction

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Push on the original outbound-SRAW question without overclaiming: determine whether the
SRAW-specific `CSCSIPlug::SendData` body visibly constructs wire/CDB bytes before the
shared sender entry at `0x106e`.

### Accomplished
- Re-decoded the relevant `CSCSIPlug::SendData` window with `m68k-elf-objdump`
  (`0x0ec0-0x1072`)
- Verified the measured SRAW branch anchor:
  `0x0f40: cmpil #'SRAW', %a3@(8)`
- Verified that the matching branch pushes a seven-argument frame and calls the shared
  sender entry at `0x0f60 -> jsr 0x106e`
- Verified that this measured SRAW path contains no obvious inline CDB-byte stores, no
  local nibble-expansion loop, and no visible `move.b #0x0c,...` opcode write before
  the shared sender call
- Verified that the immediately adjacent non-`SRAW` branch is the one doing explicit
  byte inspection and derived-length reconstruction before its own `0x106e` call
- Updated parity docs to capture this as a sharper negative claim rather than another
  vague “still unresolved” note

### Didn't Work
- This still does not reveal the final outbound SRAW wire bytes
- It also does not identify whether the shared sender at `0x106e` itself constructs the
  CDB or whether a later runtime-installed layer still intervenes

### Course Corrections
- **[EVIDENCE]** The right measured claim here is structural, not final-protocol:
  pre-`0x106e` SRAW does not look like inline CDB assembly.
- **[PROCESS]** In the exhausted-boundary phase, this is the right kind of progress:
  narrow the unresolved mechanism and separate the real SRAW-specific branch from the
  neighboring header-inspection path instead of forcing a premature wire-byte theory.

### Quantitative
- New stable parity findings added: 1
  `Finding 124`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The measured SRAW path is now cleaner: it packages arguments and hands off.
2. The obvious byte-level header parsing lives next door in the non-`SRAW` path, not in
   the measured `cmpil #'SRAW'` branch.
3. The highest-value remaining static question is now whether `0x106e` itself builds the
   outbound CDB from that call frame or whether the real wire emission still crosses a
   runtime boundary.

## 2026-04-21: MESA II `0x1072` Is a Shared-Sender Wrapper, Not a Separate Outbound Answer

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Clarify whether the `0x1072` body changes the outbound-SRAW picture materially, or just
wraps the same unresolved shared sender contract behind `0x106e`.

### Accomplished
- Re-decoded `scsi-plug` file `0x1072-0x10c2` with `m68k-elf-objdump`
- Verified that `0x1072`:
  - copies `%a3@(4)` into local `%fp@(-46)`
  - sets `CSCSIPlug+0x0e46 = 1`
  - derives a second transient flag from bit 7 of the first source byte and stores it
    at `CSCSIPlug+0x0e47`
  - then pushes the same broad seven-argument send frame and calls `jsr 0x106e` at
    `0x10b2`
  - clears `+0x0e46` on return and falls into the same shared post-send/report path at
    `0x1160`
- Updated parity docs to record `0x1072` as wrapper logic around the shared sender, not
  as a separate final emitter

### Didn't Work
- This still does not reveal what `0x106e` ultimately emits on the wire
- It also does not yet explain the semantic meaning of the transient state bytes
  `+0x0e46/+0x0e47`

### Course Corrections
- **[EVIDENCE]** The right static distinction here is between “different caller shape”
  and “different final emitter.” `0x1072` only proves the former.
- **[PROCESS]** This is another case where the frontier narrows by removing a false
  branch: `0x1072` is no longer a competing mystery target.

### Quantitative
- New stable parity findings added: 1
  `Finding 125`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The shared sender contract now has at least two measured caller shapes feeding it.
2. `0x1072` contributes per-send state, not a distinct static emission mechanism.
3. The highest-value remaining static question is the meaning of `+0x0e46/+0x0e47` and
   how `0x106e` uses them when choosing the actual wire emission path.

## 2026-04-21: MESA II `0x106e` Is Fed by Multiple Measured Caller Families

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Determine whether the shared `0x106e` sender target should still be modeled as a
one-off SRAW mystery helper, or as a broader central send engine with multiple
caller-side shapes already visible in the recovered `SendData` body.

### Accomplished
- Re-decoded `scsi-plug` file `0x0ec0-0x1160` to classify every direct `jsr 0x106e`
  call site in the recovered `SendData` window
- Verified six direct call sites at:
  `0x0f60`, `0x0fbc`, `0x102c`, `0x10b2`, `0x10f8`, `0x1144`
- Collapsed those six sites into four measured caller families:
  - measured `SRAW` arm at `0x0f60`
  - sibling mode-`#0` arm at `0x0fbc`
  - derived-length path at `0x102c`
  - wrapper-driven variants at `0x10b2` / `0x10f8` / `0x1144`
- Verified that all four families converge on the same shared post-send/report block at
  `0x1160`
- Updated parity docs to record the remaining unknown as the parameter contract of a
  central send engine rather than “the hidden SRAW helper before `0x106e`”

### Didn't Work
- This still does not reveal the outbound wire bytes emitted by the shared sender
- It also does not yet decode how the caller-family differences map onto concrete
  wire-mode selection inside or beyond `0x106e`

### Course Corrections
- **[EVIDENCE]** The strongest static claim is now structural: `0x106e` already serves
  multiple measured caller shapes. That is stronger than treating it as an unresolved
  SRAW-only helper.
- **[PROCESS]** In this phase, publishing the argument-contract framing matters more
  than chasing one more speculative branch-local byte pattern.

### Quantitative
- New stable parity findings added: 1
  `Finding 126`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The remaining `0x106e` question is broader than outbound SRAW alone.
2. The recovered `SendData` body already exposes four distinct caller families feeding
   the shared sender contract.
3. The highest-value next static question is how those caller-family differences map to
   concrete live-in fields and wire-mode selection.

## 2026-04-21: MESA II `0x106e` Uses One Stable Seven-Slot Caller Frame

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Determine whether the multiple measured caller families into `0x106e` actually imply
different call contracts, or whether they are variants of one stable send-frame schema.

### Accomplished
- Re-decoded `scsi-plug` file `0x0f40-0x1144` around every direct `jsr 0x106e`
- Verified that all six sites push the same outer seven-slot call frame:
  - `arg0 = self`
  - `arg1 = CSCSIPlug+0x0d6e`
  - `arg2 = mode byte`
  - `arg3 = source pointer`
  - `arg4 = nullable context long`
  - `arg5 = %a3@`
  - `arg6 = &fp@(-30)`
- Classified the branch-local differences as concentrated in only three positions:
  mode byte, source pointer family, and nullable context long
- Updated parity docs to treat `0x106e` as a stable central send routine with varying
  mode/source/context fields, not as a family of unrelated hidden helpers

### Didn't Work
- This still does not decode the concrete wire meaning of the mode byte
- It also does not yet identify what `%a3@` represents in the shared sender frame

### Course Corrections
- **[EVIDENCE]** The important structural claim is no longer “many branches call
  `0x106e`,” but “they already agree on one stable caller contract.”
- **[PROCESS]** That moves the frontier from branch classification to argument
  semantics: mode, context, and `%a3@` now matter more than hunting more `jsr` sites.

### Quantitative
- New stable parity findings added: 1
  `Finding 127`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `0x106e` now looks like one central send routine with a fixed outer frame.
2. The branch-local differences are sparse and analyzable: mode, source family, context.
3. The next best static target is the persistent `%a3@` field, because it survives
   across all caller families and may carry the higher-level send descriptor.

## 2026-04-21: MESA II `IP_Data[+12]` Selects the Send Target Before Branch Dispatch

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Clarify whether any part of the `IP_Data` structure already controls routing before the
shared `0x106e` sender frame is assembled, instead of treating all uncertainty as
downstream send-engine ambiguity.

### Accomplished
- Re-decoded the `SendData` prologue at file `0x0df2-0x0e40`
- Verified that `SendData`:
  - clears `CSCSIPlug+0x0d6e`
  - loops over connected entries with index `i`
  - loads a per-entry long from `self@(62 + 46*i)`
  - compares that long against `IP_Data[+12]`
  - on match, copies a per-entry word from the `0x0d72`-rooted table into
    `CSCSIPlug+0x0d6e`
  - returns `-14000` immediately if no match is found
- Updated parity docs to record `IP_Data[+12]` as measured front-end routing input,
  distinct from the later mode/source/context differences feeding `0x106e`

### Didn't Work
- This still does not identify the exact semantic name of the per-entry long matched
  against `IP_Data[+12]`
- It also does not yet explain what `%a3@` means inside the later shared sender frame

### Course Corrections
- **[EVIDENCE]** The shared sender is not the first routing decision point. One piece of
  `IP_Data` already selects the downstream target word before any branch-specific send
  logic runs.
- **[PROCESS]** This is the right kind of upstream clarification: isolate front-end
  routing fields before trying to decode deeper send semantics.

### Quantitative
- New stable parity findings added: 1
  `Finding 128`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `IP_Data[+12]` is a measured target-selection key, not part of the later branch split.
2. The later `0x106e` frame should now be read as operating on an already-selected target.
3. The next high-value unresolved `IP_Data` field is `%a3@`, not `IP_Data[+12]`.

## 2026-04-21: MESA II `IP_Data[+0]` Is Byte Count, Not an Opaque Sender Long

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Resolve the last persistent `IP_Data` field that stayed live across every measured
`0x106e` caller family, and determine whether it was length, flags, or some higher-level
descriptor pointer.

### Accomplished
- Re-decoded `CMESASocket::AcceptData` at file `0x05a1e1`
- Verified that `AcceptData` treats:
  - `%a3@` as incoming byte count
  - `%a3@(4)` as payload pointer
  - `%a3@(8)` as reply/result tag
- Verified concrete uses:
  - compare `%a3@` against socket capacity
  - call trap `0xa02e` with `%a3@(4)` as source pointer and `%a3@` as copy length
  - store `%a3@(8)` into socket `+12`
  - store `%a3@` into socket `+4`
- Combined that with the already measured `SendData` frame layout to resolve the
  persistent `%a3@` argument into the shared `0x106e` caller contract as byte count

### Didn't Work
- This still does not decode the exact semantic meaning of the mode byte in the shared
  sender frame
- It also does not yet settle what role the nullable context long plays in wire emission

### Course Corrections
- **[EVIDENCE]** The `0x106e` frame is now less mysterious than before: one more
  previously opaque live-in slot is just length.
- **[PROCESS]** This is the right way to close field-map ambiguity: verify structure
  semantics in another measured consumer instead of guessing from the sender alone.

### Quantitative
- New stable parity findings added: 1
  `Finding 129`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The shared `0x106e` frame now has a measured byte-count field, not an opaque extra long.
2. `IP_Data` is becoming a concrete field map rather than a vague transport blob.
3. The remaining sender-side semantic unknowns are now narrower: mode byte and nullable
   context long.

## 2026-04-21: MESA II Nonzero Sender Context Is the Ctor-Seeded `+0x0e3c` Root

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Narrow the remaining nullable-context ambiguity in the shared `0x106e` sender frame
without overclaiming what that context means on the wire.

### Accomplished
- Reused the constructor-side and post-send/report evidence already recovered for
  `CSCSIPlug+0x0e3c`
- Verified the three connected facts:
  - `CSCSIPlug::__ct__` allocates `0x8000` bytes into `+0x0e38` and copies the first
    longword of that allocation into `+0x0e3c`
  - the measured `0x106e` caller families only ever pass `arg4 = +0x0e3c` or `arg4 = 0`
  - the shared post-send/report block later stores `+0x0e3c` into its local report
    block and dereferences its first byte to choose `SYSX` versus `SRAW`
- Updated parity docs to record the nonzero sender-context case as a specific
  constructor-seeded plug-local root, not an unbounded mystery long

### Didn't Work
- This still does not prove whether `+0x0e3c` is a prebuilt transport buffer, a framing
  template root, or some other plug-local state anchor
- It also does not yet decode what semantic difference `arg4 = 0` causes inside or
  beyond the shared sender

### Course Corrections
- **[EVIDENCE]** The right claim here is identity restriction, not semantic naming:
  nonzero context is exactly `+0x0e3c`, not just “some context pointer.”
- **[PROCESS]** This keeps the boundary honest while still shrinking the space Claude
  and Codex need to consider in the outbound path.

### Quantitative
- New stable parity findings added: 1
  `Finding 130`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. The nullable sender-context slot is now narrowed to one concrete nonzero value.
2. `CSCSIPlug+0x0e3c` participates in both send setup and post-send protocol labeling.
3. The remaining sender-side semantic unknowns are now essentially mode byte and the
   `arg4 = 0` versus `arg4 = +0x0e3c` distinction.

## 2026-04-21: MESA II Zero-Context Sends Are a Narrow Mode-`#0` Subcase

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Constrain the remaining mode/context ambiguity without claiming more than the current
caller-family evidence supports.

### Accomplished
- Re-aligned all measured direct `0x106e` caller sites against mode byte and context long
- Verified the full matrix:
  - `0x0f60`: mode `#1`, context `+0x0e3c`
  - `0x0fbc`: mode `#0`, context `+0x0e3c`
  - `0x102c`: mode `#0`, context `0`
  - `0x10b2`: mode `#1`, context `+0x0e3c`
  - `0x10f8`: mode `#0`, context `+0x0e3c`
  - `0x1144`: mode `#0`, context `0`
- Verified that the zero-context sites are also the branches with extra branch-local
  work around the send:
  - `0x102c` does derived-length reconstruction and doubles the returned out-length
  - `0x1144` is wrapped by `0x0ca2` gating before and after the send
- Updated parity docs to record the resulting restriction:
  mode `#1` currently implies nonzero context, while `arg4 = 0` is a narrower subcase
  within mode `#0`

### Didn't Work
- This still does not decode the exact semantic meaning of mode `#1` vs `#0`
- It also does not yet explain whether the extra branch-local work is cause, effect, or
  merely correlated with `arg4 = 0`

### Course Corrections
- **[EVIDENCE]** The useful result here is a restricted matrix, not a named protocol
  meaning. That is enough to narrow the frontier honestly.
- **[PROCESS]** This is the right endgame move for the static sender contract: tighten
  admissible combinations before trying to assign semantic names.

### Quantitative
- New stable parity findings added: 1
  `Finding 131`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. Mode `#1` is not a free-standing toggle; it is currently only seen with nonzero context.
2. Zero-context sends are real, but only inside a narrower subset of mode-`#0` paths.
3. The remaining sender-side unknown is now a very small matrix: mode meaning and why
   some mode-`#0` paths null out the context long.

## 2026-04-21: MESA II `+0x0e40` Gates Wrapper vs Direct Sender Families

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Identify whether any earlier plug-local state decides which sender-family surface is
entered before the already-measured mode/context split around the shared `0x106e`
contract.

### Accomplished
- Re-decoded the `SendData` front half around `0x0e9e-0x0ec4`
- Verified that `SendData`:
  - tests `CSCSIPlug+0x0e40`
  - if zero, calls `0x0ca2(self, target, 1, 1)`
  - stores the returned byte back into `+0x0e40`
  - if `+0x0e40` is still zero, branches directly to `0x1072`
  - only when `+0x0e40` is nonzero continues into the later direct `%d6`/`SRAW` family
- Also rechecked the earlier cold arm at `0x0e82-0x0e96`, where `0x0ca2(self, target, 0, 0)`
  is followed by clearing `+0x0e40`
- Updated parity docs to record `+0x0e40` as a measured pre-send routing flag

### Didn't Work
- This still does not reveal the exact semantic meaning of `+0x0e40`
- It also does not settle whether `0x0ca2` is testing capability, mode availability, or
  some other transport-state predicate

### Course Corrections
- **[EVIDENCE]** The remaining sender-side split is not just the `0x106e` frame. There is
  one earlier gate: `+0x0e40` decides which sender-family surface is even reachable.
- **[PROCESS]** This is the right upstream narrowing step before trying to name the mode
  byte, because it separates family selection from in-family call-frame semantics.

### Quantitative
- New stable parity findings added: 1
  `Finding 132`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `+0x0e40` is a real pre-send router, not just another incidental flag byte.
2. The wrapper path at `0x1072` is selected before the shared sender-frame matrix matters.
3. The remaining unknowns are now layered cleanly: `+0x0e40` chooses family, then mode/
   context refine behavior inside the shared `0x106e` contract.

## 2026-04-21: MESA II `+0x0e40` Looks Like a Sticky Cached Send-State Byte

### Feature: mesa-ii-codex-parity
### Worktree: audiocontrol-mesa-ii-codex-parity

### Goal
Decide whether `+0x0e40` still looks broad and unconstrained, or whether its write
surface is tight enough to support a narrower role.

### Accomplished
- Performed a direct raw-byte search for every in-binary touch of `CSCSIPlug+0x0e40`
- Verified only five touch points:
  - constructor clear at `0x0c56`
  - send-path tests at `0x0e9e` and `0x0ec0`
  - `0x0ca2`-fed store at `0x0eb8`
  - cold-arm clear at `0x0e92`
- Rechecked that the constructor clear sits beside other persistent send-state resets
  (`+0x0e46`, `+0x0e47`) and timeout seed `+0x0e42`
- Updated parity docs to record the tighter current read:
  `+0x0e40` is likely a sticky cached pre-send capability/state byte, not a general
  plug mode or broad configuration field

### Didn't Work
- This still does not identify what concrete capability or readiness condition
  `0x0ca2` computes into `+0x0e40`
- It also does not yet prove whether the byte is transport-specific, target-specific, or
  some higher-level send-family readiness state

### Course Corrections
- **[EVIDENCE]** The write-surface result matters because it sharply reduces the role
  `+0x0e40` can plausibly play.
- **[PROCESS]** This is the right kind of late-stage static progress: narrow the state
  byte from “mystery flag” to “cached send-state gate” without overnaming it.

### Quantitative
- New stable parity findings added: 1
  `Finding 133`
- Feature docs updated: 2
  `codex-findings.md`, `comparison-record.md`

### Insights
1. `+0x0e40` does not sprawl across the plug. Its lifecycle is very tight.
2. That makes it much more likely to be a cached send-state/capability result.
3. The remaining unknown is now mostly what `0x0ca2` is actually testing or enabling.
