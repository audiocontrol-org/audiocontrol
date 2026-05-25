# Audit Log — feature/akai-harmonization

This document is the feature-local audit log for `feature/akai-harmonization`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`

---

## 2026-05-25 Feature review — latest AcLiveStatusFooter primitive + adoption work

Surfaced while reviewing the `AcLiveStatusFooter` extraction/adoption commits `1e6e40ad`, `a7b1773f`, and `16f97e34` on 2026-05-25. Targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- AcLiveStatusFooter.test.tsx` — passed (`16` tests)
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- ProgramsPage.test.tsx` — failed (`1` of `5` tests), see `AUDIT-20260525-18`

### AcLiveStatusFooter turns a 100ms self-updating elapsed timer into a polite live-region announcement source

Finding-ID: AUDIT-20260525-16
Status:     verified-f2f3e1e0
Severity:   high
Surface:    `modules/editor-core/src/components/AcLiveStatusFooter.tsx`, `modules/editor-core/src/components/AcLiveStatusFooter.test.tsx`

`AcLiveStatusFooter` starts a `setInterval(..., 100)` whenever `state === 'live'` and `lastEditAt !== null`, updating its rendered text every tenth of a second (`AcLiveStatusFooter.tsx:99-105`, `119-120`). The same root node is exposed as `role="status"` and `aria-live="polite"` (`AcLiveStatusFooter.tsx:123-129`), and the current test suite explicitly locks that contract in (`AcLiveStatusFooter.test.tsx:21-27`).

That means the component is not just visually updating every 100ms; it is mutating the contents of a polite live region every 100ms. After the first successful write, the text changes from `...0.1s ago` to `...0.2s ago` to `...0.3s ago` and so on. Screen readers are therefore being handed a continuous stream of live-region mutations for as long as the page stays open after an edit, which is not a reasonable announcement contract for a status footer.

**Evidence:**

- 100ms interval updates the rendered status text:
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:99-105`
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:119-120`
- Same node is a live region:
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:123-129`
- Tests currently bless that exact ARIA contract:
  - `modules/editor-core/src/components/AcLiveStatusFooter.test.tsx:21-27`

**Expected:** the footer may visually refresh elapsed time, but assistive-tech announcements should be tied to discrete state changes or confirmed writes, not to a continuously ticking timer string.

**Actual:** every 100ms elapsed-time tick mutates a polite live region.

**Fix guidance:** split the announcement contract from the visual timer. For example, keep a non-live visual `"last edit X.Xs ago"` readout, and expose only the discrete write confirmation through a separate announcement channel or a non-ticking status string. Closure should require a regression test that proves fake-timer advancement does NOT create repeated live-region text churn after the initial write announcement.

**Fix landed (commit `f2f3e1e0`):** the live-region announcement was split from the 100ms visual timer. `AcLiveStatusFooter.tsx`'s root + `__text` span no longer carry `role="status"` / `aria-live="polite"`; the visible chrome is silent to assistive tech, so the elapsed-time tick can re-render the `"X.Xs ago"` readout every 100ms without polluting the live region. A dedicated visually-hidden span (`.ac-live-status-footer__announcement.ac-sr-only`) carries the live-region attributes, and its content is set by a `computeAnnouncement(state, lastEditAt, errorMessage)` helper driven by a `useEffect([state, lastEditAt, errorMessage])` rising-edge guard. The announcement is `"Edit confirmed."` on a new `lastEditAt`, `"Device offline."` on the offline transition, `"Device error: {msg}."` on the error transition, and empty on initial-mount with `lastEditAt=null` (no spurious narration on first page load). The existing `.ac-sr-only` utility from `library.css` (imported via the editor-core design barrel) was reused — no new CSS authored, no duplication.

Regression coverage in `AcLiveStatusFooter.test.tsx`: the prior root-level role assertion was replaced with a contract test that the visible chrome lacks `role`/`aria-live` AND the dedicated announcement span carries them + `.ac-sr-only`. A 50-tick fake-timer regression test (`does NOT churn the live-region announcement during 100ms visual ticks`) renders the footer with a fixed `lastEditAt`, advances 5 seconds of simulated time in 100ms increments, and asserts (a) the announcement text stays frozen at `"Edit confirmed."` across all 50 ticks while (b) the `__text` content advances from `0.0s ago` to `~5.0s ago` (proves the visual timer is running but the live region is silent). Two rising-edge tests cover the `null → timestamp` and `live → live` (different `lastEditAt`) state transitions, and a parameterized matrix covers `live → offline` and `live → error` announcement strings. Validator-paired-changes hard test (revert `AcLiveStatusFooter.tsx` only, leave test file intact): 5 new tests RED — `expected 'status' to be null` (visible chrome still carried `role="status"` pre-fix), `expected null not to be null` (the announcement element did not exist pre-fix), and 3 × `TypeError: Cannot read properties of null (reading 'textContent')` (rising-edge tests could not find the announcement element). Tests have teeth.

### The Akai footer wiring misses successful rename writes, so the page can still say READY after a confirmed device edit

Finding-ID: AUDIT-20260525-17
Status:     verified-f2f3e1e0
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`

On both Akai adopters, the new footer timestamp is updated after successful detail-pane header writes (`ProgramsPage.tsx:87-110`, `SamplesPage.tsx:89-103`), but not after successful list-row rename writes. `handleRenameProgram` awaits `client.renameProgram(index, newName)` and invalidates cache, but never calls `setLastEditAt(...)` (`ProgramsPage.tsx:196-221`). `handleRename` on Samples does the same for `client.renameSample(...)` (`SamplesPage.tsx:106-121`).

That leaves a visible behavior hole in the new live-status affordance: the operator can perform a successful device write from the page, watch the name update, and still see `READY · S3000XL connected` in the footer because the rename path never transitions it to a live-edited state.

**Evidence:**

- Program header writes update the footer timestamp:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:87-110`
- Program rename writes do not:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:196-221`
- Sample header writes update the footer timestamp:
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:89-103`
- Sample rename writes do not:
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:106-121`

**Expected:** any successful device write on a page that advertises the live-edit footer should transition the footer out of `READY` and record the latest confirmed write time.

**Actual:** successful rename writes leave the footer stale.

**Fix guidance:** call `setLastEditAt(Date.now())` after successful rename writes on both pages, then add page-level regression coverage that proves a rename action advances the footer from `READY` to `LIVE`. This should be tested at the page layer, not only in the shared primitive, because the bug is in the adopter wiring.

**Fix landed (commit `f2f3e1e0`):** `handleRenameProgram` (`ProgramsPage.tsx:211-216`) now calls `setLastEditAt(Date.now())` after `client.renameProgram(...)` resolves and the program-cache is invalidated. `handleRename` (`SamplesPage.tsx:106-122`) does the same after `client.renameSample(...)` resolves, before the optimistic `setSampleNames` update. Cross-editor check: roland's `PatchesPage.tsx` and `TonesPage.tsx` were grepped for `rename` / `Rename` and contain no list-row rename handlers — no parallel fix needed in roland surfaces. Akai's `KeygroupsPage` similarly has no rename row-action.

Page-layer regression coverage (per the auditor's directive that the fix is not complete without integration tests at the adopter wiring): `ProgramsPage.test.tsx` adds `rename via list-row UI flips AcLiveStatusFooter from READY to LIVE (AUDIT-20260525-17)` which triggers the rename through the same UI interaction the operator uses — double-click `program-item-0` → type `NEW NAME` into `input.ac-akai-list-rename` → press `Enter` — then `waitFor`s the renameProgram mock to resolve and asserts both the visible `.ac-live-status-footer__text` flips from `READY` to `LIVE` AND the dedicated announcement span shows `"Edit confirmed."`. A new test file `SamplesPage.test.tsx` adds the same shape for the samples rename flow (with `useEditorDialogs` stubbed to a no-op idle state since the rename flow does not touch any dialog state). Validator-paired-changes hard test (revert `ProgramsPage.tsx` + `SamplesPage.tsx` only, leave both test files intact): both rename tests RED with identical error shape `Expected: LIVE / Received: READY · S3000XL connected`. Tests have teeth — they catch precisely the wiring gap (rename does not flip the footer because `setLastEditAt` was not called).

### ProgramsPage's local unit suite is stale and red at branch head, so the new shell/footer work is not landing with the required regression coverage

Finding-ID: AUDIT-20260525-18
Status:     verified-f2f3e1e0
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/unit/pages/ProgramsPage.test.tsx`

The existing `ProgramsPage` unit suite is currently failing at branch head. The `shows loading status when isLoading with a message` test still queries `screen.getByTestId('loading-status')` and expects the old combined text contract (`ProgramsPage.test.tsx:137-151`), but the page now renders the shared `PageTitleRow` metric/progress shape instead. Local run:

- `pnpm --filter @audiocontrol/akai-s3k-editor test -- ProgramsPage.test.tsx`
- Result: `1` failed, `4` passed
- Failure: `Unable to find an element by: [data-testid="loading-status"]`

This is not just a stale assertion. It means the implementation landed without a page-level regression gate for the new title-row/footer contract, and there is still no page test covering the new `AcLiveStatusFooter` READY/live transition wiring on ProgramsPage.

**Evidence:**

- Stale assertion against removed contract:
  - `modules/akai-s3k-editor/test/unit/pages/ProgramsPage.test.tsx:137-151`
- Local verification run at branch head fails with:
  - `Unable to find an element by: [data-testid="loading-status"]`

**Expected:** the page suite should be updated in the same implementation wave so the new shell/title-row/footer contract is both green and protective.

**Actual:** the branch carries a red page-level test, and the surviving suite does not cover the new footer behavior.

**Fix guidance:** update `ProgramsPage.test.tsx` to assert the shared `PageTitleRow` loading metric/progress contract that actually renders now, and add explicit footer regression coverage at the page layer. Minimum closure bar: one green test for the loading metric/progress shape, and one green test proving a successful page write flips the footer from `READY` to `LIVE`.

**Fix landed (commit `f2f3e1e0`):** the stale `screen.getByTestId('loading-status')` assertion in `ProgramsPage.test.tsx:137-151` was replaced with `shows loading status via PageTitleRow metric-status span when isLoading with a message (AUDIT-20260525-18)`, which asserts against what the page actually renders now: (a) the loading message appears in `.ac-page-title-metric-status` with `role="status"` + `aria-live="polite"` (the canonical PageTitleRow live-region surface, distinct from AcLiveStatusFooter's announcement span — the page header and the footer narrate independently), and (b) the 50% progress is rendered via the separate `.ac-page-title-progress-fill` bar's inline `style.width="50%"` (not appended to the message text). The contract matches PageTitleRow.tsx's actual JSX (`PageTitleRow.tsx:134-166`) for the `isLoading + loadingMessage + loadingProgress` prop combination.

The auditor's minimum closure bar called for two green tests: one for the loading metric/progress shape (the AUDIT-18 repair) and one for the READY→LIVE footer transition (the AUDIT-17 rename test). Both land in this commit on `ProgramsPage.test.tsx`, raising the akai test count from 231/232 (1 pre-existing failure = the stale AUDIT-18 test) to 234/234.

## 2026-05-24 Feature review — latest AcEnvelope / AcFrequencyResponse migration work

Surfaced while reviewing the `AcEnvelope` / `AcFrequencyResponse` extraction and Akai migration commits through `d524da07`, `b83318d3`, `2f949329`, `1a47b60c`, and `0ffe43f6` on 2026-05-24. Targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- AcEnvelopeAdsr.test.tsx AcFrequencyResponse.test.tsx`
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- KeyRangeEditor.test.tsx VelocityRangeBar.test.tsx`

Both runs passed, but they do not cover the Akai adapter-layer issues below.

### Akai filter-response drag now forwards fractional resonance values directly into the integer `FILQ` device field

Finding-ID: AUDIT-20260524-14
Status:     verified-d39b150a
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx`, `modules/editor-core/src/components/AcFrequencyResponse.tsx`

`AcFrequencyResponse` intentionally works in continuous numeric space. During drag it computes `newResonance` as a float inside the configured `resonanceRange` and emits that exact number through `onChange({ resonance })` (`AcFrequencyResponse.tsx:148-152`). The Akai adapter in `KeygroupEditor` then forwards that value straight into `FILQ` without rounding (`KeygroupEditor.tsx:220-227`).

That is a wire-format regression for the S3000XL field. `FILQ` is an integer device parameter in the 0..15 domain; the legacy `FilterDisplay` explicitly rounded before dispatching by using its `clamp()` helper (`git show 0ffe43f6^:FilterDisplay.tsx` reviewed in this pass, lines 25-27 and 145-149). The new path means drag moves can push floats like `7.3` or `11.8` through `onDragChange` / `onParameterChange`. Even if later serialization truncates or rounds somewhere else, the UI/editor state is now carrying a value shape the field did not previously admit.

**Evidence:**

- Primitive emits float resonance values during drag:
  - `modules/editor-core/src/components/AcFrequencyResponse.tsx:148-152`
- Akai consumer forwards them directly into `FILQ`:
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx:220-227`
- Pre-migration implementation rounded the Q value before dispatch:
  - `git show 0ffe43f6^:modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx` reviewed in this audit pass (`clamp()` + `newQ`)

**Expected:** the Akai adapter should preserve the device field’s integer contract by rounding/clamping the primitive’s continuous resonance output before writing `FILQ`.

**Actual:** float resonance values are forwarded directly into an integer header field.

**Fix guidance:** keep `AcFrequencyResponse` continuous, but quantize at the Akai adapter boundary: `dispatch('FILQ', Math.round(changes.resonance))` (plus clamp to 0..15 if the adapter is the last trusted boundary). This fix is not complete without regression coverage at the Akai adapter layer. Required tests: one unit test that proves a fractional `resonance` callback from `AcFrequencyResponse` becomes an integer `FILQ` write, and one integration-level test on the keygroup editor path that guards the drag/update flow end to end.

**Fix landed (commit `d39b150a`):** the akai filter adapter was extracted from `KeygroupEditor.tsx` into a new module at `modules/akai-s3k-editor/src/components/keygroups/akai-filter-adapter.ts` (pure helpers, no DOM, unit-testable in isolation). The new module exposes `clampToFilq` (rounds + clamps to 0..15), `hzToFilfrq` (rounds + clamps to 0..99, already integer-safe pre-fix), and `dispatchAkaiFilterChange(changes, dispatch)` — the centralized dispatcher that applies BOTH quantizers before invoking the consumer's field-write callback. `KeygroupEditor`'s `AcFrequencyResponse.onChange` is now a one-liner delegating to `dispatchAkaiFilterChange`; the inline Hz/FILFRQ math + duplicated constants were removed (DRY closure on the previously-inlined adapter primitives). The adapter boundary is the last trusted point where the integer wire-format contract is enforced; floats from `AcFrequencyResponse` can no longer leak past it.

Regression coverage at the akai adapter layer: 24 new tests in `modules/akai-s3k-editor/test/unit/components/keygroups/akai-filter-adapter.test.ts` covering (a) `clampToFilq` fractional rounding + out-of-range clamping (`7.3 → 7`, `11.8 → 12`, `20 → 15`, `-5 → 0`, `15.7 → 15`, `-0.4 → 0`), (b) `hzToFilfrq` integer-only output + boundary clamping (`5 Hz → 0`, `40 kHz → 99`) + round-trip preservation at endpoints, (c) `dispatchAkaiFilterChange` replaying every clampToFilq assertion through the dispatcher with `vi.fn()` spies (`{ resonance: 7.3 }` → `dispatch('FILQ', 7)`, `{ resonance: 11.8 }` → `dispatch('FILQ', 12)`, etc.), plus boundary clamping for both fields, plus channel-isolation assertions (`{ frequency: 800 }` does NOT dispatch FILQ; empty changes does NOT dispatch anything; etc.). Validator-paired-changes hard test: with the production dispatcher gutted to bare value-forwarding (`dispatch('FILQ', changes.resonance)`; `dispatch('FILFRQ', changes.frequency)`) and the new test file intact, 9 of the 24 scenarios FAIL with the specific assertion messages `expected 7.3 to be 7`, `expected 11.8 to be 12`, `expected 20 to be 15`, `expected -5 to be 0`, `expected 15.7 to be 15`, `expected "spy" to be called with arguments: [ 'FILFRQ', 99 ]` (got 50000), `expected "spy" to be called with arguments: [ 'FILFRQ', +0 ]` (got 5), `expected 4.6 to be 5`. The tests have teeth in both directions (FILQ + FILFRQ) at boundaries and at fractional in-range values.

### The filter-envelope migration passes impossible `activeSegment={0}` into a 1-based API, so segment 1 is highlighted permanently with no real selection state

Finding-ID: AUDIT-20260524-15
Status:     verified-d39b150a
Severity:   low
Surface:    `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx`, `modules/editor-core/src/components/AcEnvelope.tsx`

`AcEnvelope`’s multi-segment variant is explicitly 1-based: `activeSegment` is documented as a 1-based active segment index and is clamped with `clampSegment(...)` into the `1..endSegment` range (`AcEnvelope.tsx:53-54`, `106-113`, `158-168`). The Akai filter-envelope migration passes `activeSegment={0}` (`KeygroupEditor.tsx:178-180`).

Because `0` is out of range, the primitive silently clamps it to `1`. The result is that the filter envelope always renders as though segment 1 is the active/selected segment even though the Akai integration has no real selected-segment state and no `onPointSelect` handler wired. This is a UI-state regression from the legacy display, which was a pure visualization with draggable points and no persistent “segment 1 selected” affordance.

**Evidence:**

- Akai consumer passes `activeSegment={0}`:
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx:178-180`
- Primitive contract is 1-based and clamps invalid values to 1:
  - `modules/editor-core/src/components/AcEnvelope.tsx:53-54`
  - `modules/editor-core/src/components/AcEnvelope.tsx:106-113`
  - `modules/editor-core/src/components/AcEnvelope.tsx:158-168`

**Expected:** either supply a real 1-based active segment from Akai state, or extend the primitive to allow “no active segment” when the consumer only wants a display/editor surface without selection highlighting.

**Actual:** the Akai adapter passes an impossible index, which the primitive coerces to segment 1, creating a permanent false-active state.

**Fix guidance:** short term, pick the least misleading explicit 1-based segment if the highlight is required by the primitive. Better, add an optional “no active segment” path to `AcEnvelope` and use that here, since the Akai filter envelope has drag-editing but no segment-selection model. This should be treated as a test-gated UI-state fix: closure should require a regression test that proves the Akai filter-envelope surface no longer renders a false-active segment by default.

**Fix landed (commit `d39b150a`):** the second option from the fix guidance — `AcEnvelope`'s multi-segment variant `activeSegment` prop type was widened from `number` to `number | null`. When `null` (or undefined-via-discriminated-union narrowing) is passed, the `clampSegment(...)` helper is bypassed entirely; the sub-surfaces (`AcEnvelopeGraph`, `AcEnvelopeTable`) already render no active highlight when `activeSegment !== <any segment index>`. The graph region's `aria-label` drops the "segment N active" suffix when null. The active-guide vertical line and the `.ac-envelope-axis-tick--active` axis-tick modifier are both suppressed by the existing index-comparison guards plus an explicit `props.activeSegment !== null` short-circuit on the active-guide path. The akai consumer in `KeygroupEditor.tsx` now passes `activeSegment={null}`. The type widening is purely additive — the legacy numeric path (where `clampSegment` floors + clamps into `1..endSegment`) is unchanged.

Cross-editor backwards-compat verification: roland's `ToneEnvelopeEditor.tsx` passes `activeSegment={sustainPoint + 1}`, and `sustainPoint` is bounded `0..7` by the `handleSustainChange` clamp, so the value is always `1..8` (valid for the legacy numeric path). Roland's `AcEnvelopeTableHarness.tsx` passes `activeSegment={1}` (valid). No roland consumer passed an invalid index pre-fix; no roland consumer needs to migrate to the `null` path. Verified via `pnpm --filter @audiocontrol/roland-sxx0-editor test` (48 passed, no regressions) + typecheck across all three consuming modules.

Regression coverage: three new tests in `modules/editor-core/src/components/AcEnvelope.test.tsx`:
- `activeSegment={null} renders NO segment row as active` — asserts EVERY table row carries `data-active="false"`; EVERY graph point button carries `aria-pressed="false"` and lacks `.ac-envelope-point--active`; the `.ac-envelope-active-guide` line is absent; no `.ac-envelope-axis-tick--active` exists; the graph region's `aria-label` does NOT contain "active".
- `activeSegment={null} keeps every seg button aria-pressed="false"` — defends against accidental row-state hijacking (a regression where `null` accidentally promotes one segment to active would slip past the first test if it picked any single segment).
- `activeSegment={1} (legacy default behavior path) still highlights segment 1` — backwards-compat guard asserting the existing roland contract continues to work after the type widening.

Validator-paired-changes hard test: with the production-code changes to `AcEnvelope.tsx` / `AcEnvelopeGraph.tsx` / `AcEnvelopeTable.tsx` / `KeygroupEditor.tsx` stashed (test file intact), 2 of the 3 new scenarios FAIL against pre-fix code with the specific error message `AcEnvelope received non-finite segment index: null` — the `clampSegment` helper rejects `null` because `Number.isFinite(null)` is `false`, proving the pre-fix path could not accept the new contract at all. The third new test (activeSegment={1} backwards-compat) passes both pre- and post-change, which is correct: it asserts the legacy behavior survives the extension. Two of three tests have teeth against the pre-fix path; the third is a back-compat guard whose teeth are against any FUTURE change that breaks the legacy numeric contract.

## 2026-05-24 Feature review — latest AcZoneStrip extraction/migration work

Surfaced while reviewing the `AcZoneStrip` extraction and Akai migration commits through `03f36ce3`, `544d41f3`, `e23de8b3`, `edab3add`, and the follow-up docs/tooling commits at `HEAD` (`1876bc67`) on 2026-05-24. Targeted local verification run:

- `pnpm --filter @audiocontrol/editor-core test -- AcZoneStrip.test.tsx`

The focused primitive suite passed, but it does not cover the issues below.

### VelocityRangeBar now compacts away malformed zones before wiring callbacks, so selection and split-drag indices no longer match the source zone array

Finding-ID: AUDIT-20260524-12
Status:     verified-de95eb82
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx`

The post-`AcZoneStrip` `VelocityRangeBar` wrapper first maps `zones` to `AcZoneStripZone | null`, skips malformed entries where `highVel < lowVel`, and then calls `.filter(...)` to compact the list before rendering (`VelocityRangeBar.tsx:147-166`). It then passes the original `onSelectZone` callback straight through as `onSelect={onSelectZone}` and uses the compacted zone index for split-drag dispatch via `handleStartDrag` (`VelocityRangeBar.tsx:170-176`).

That changes the callback contract when any malformed zone exists before a valid one. The old implementation also visually skipped malformed zones, but its click and drag closures were created inside `zones.map(...)`, so the callback index always matched the original source array index, even when some entries returned `null`. The new compacted render list loses that mapping. Example:

- input zones: `[valid zone 0, malformed zone 1, valid zone 2]`
- rendered strip zones after filter: `[zone 0, zone 2]`
- clicking the second rendered zone now calls `onSelectZone(1)` instead of `onSelectZone(2)`
- the split handle between the two rendered zones now reports split index `0`, even though the source-array boundary is between original zones `0` and `2`

That is a real behavior regression for any editor state that preserves a four-slot velocity-zone array with an invalid/deleted middle slot, because the selected-zone index and drag callbacks now point at the wrong header fields.

**Evidence:**

- New compacting behavior:
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx:147-166`
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx:170-176`
- Pre-migration implementation preserved original indices in closures even when returning `null` for malformed zones:
  - `git show 544d41f3^:modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx` reviewed in this audit pass

**Expected:** visual skipping of malformed zones must not rewrite the callback/index contract; rendered zone interactions should still report the original source-array index.

**Actual:** filtering compacts the rendered list, so callback indices drift when any earlier zone is malformed.

**Fix guidance:** preserve the original index alongside each rendered zone instead of filtering down to bare `AcZoneStripZone` values. For example, render an array of `{ sourceIndex, zone }` pairs and adapt `onSelect` / `onStartDrag` to translate the rendered index back to the original source index before invoking callbacks.

**Fix landed (commit `de95eb82`):** the wrapper now builds `{ sourceIndex, zone }` pairs through the compaction stage, splits them into a bare `AcZoneStripZone[]` for the primitive plus a `sourceIndexFor(renderedIndex)` translator, and wraps `onSelect` / `onStartDrag` in adapters (`handleStripSelect` + `handleStripStartDrag`) that translate the rendered index back to the source index before invoking the consumer callbacks. The split-drag contract is preserved: the `splitIndex` emitted is the SOURCE index of the LEFT zone of the boundary, matching the AcZoneStrip documented contract.

Regression coverage: four new scenarios in `modules/akai-s3k-editor/test/unit/components/keygroups/VelocityRangeBar.test.tsx` under the `source-index preservation across malformed entries (AUDIT-20260524-12)` describe block — second-rendered click with malformed-middle, first-rendered click with malformed-leading, split-drag with malformed-middle, split-drag with malformed-leading. Validator-paired-changes hard test: with the production-code diff stashed (test diff intact), all four regression scenarios FAIL against pre-fix code with the specific error messages `expected "spy" to be called with arguments: [ 2 ]` (got `[1]`), `expected "spy" to be called with arguments: [ 1 ]` (got `[0]`), and `expected +0 to be 1 // Object.is equality`. The tests have teeth.

### AcZoneStrip marks selected segments with `aria-pressed` on `role="group"` containers, which is not a valid ARIA state/role pairing

Finding-ID: AUDIT-20260524-13
Status:     verified-de95eb82
Severity:   medium
Surface:    `modules/editor-core/src/components/AcZoneStrip.tsx`, `modules/editor-core/src/components/AcZoneStrip.test.tsx`

Each rendered zone segment in `AcZoneStrip` is a `<div role="group">` carrying `aria-pressed={zone.isSelected ? true : undefined}` (`AcZoneStrip.tsx:237-243`). The tests explicitly lock this in by asserting that the selected segment has `aria-pressed="true"` (`AcZoneStrip.test.tsx:144-158`).

That ARIA pairing is invalid: `aria-pressed` is a toggle-button state, not a state for generic `group` containers. Browsers will leave the attribute in the DOM, and CSS can style against it, but assistive tech does not get a coherent semantic contract from “group + pressed”. This is now shared across every `AcZoneStrip` adopter, including the Roland tone-zone editor and the Akai range bars.

**Evidence:**

- Segment markup:
  - `modules/editor-core/src/components/AcZoneStrip.tsx:237-243`
- Tests currently bless the invalid state:
  - `modules/editor-core/src/components/AcZoneStrip.test.tsx:144-158`

**Expected:** selected-state semantics should use either a role that legitimately carries a selected/pressed state, or no ARIA state at all if the segment container is purely structural and the real interactive control is the inner button/handle.

**Actual:** selected state is exposed as `aria-pressed` on a `role="group"` container.

**Fix guidance:** do not deepen the current contract in more tests. Either:
1. move the selected-state exposure onto the actual interactive element (`.ac-zone-segment-body` button) using a supported state, or
2. keep the outer segment as a structural group and remove the ARIA state entirely, using only a CSS modifier class for styling.

**Fix landed (commit `de95eb82`):** option 2 — `aria-pressed` is removed from the `role="group"` segment and replaced with `data-selected` (a CSS-only attribute hook, no ARIA contract). The outer segment stays a structural group; the inner `.ac-zone-segment-body` button carries the click affordance; selection state is communicated visually via the `.ac-zone-segment--editing` modifier class and the `data-selected="true"` attribute. The CSS selector at `modules/editor-core/src/design/zone-strip-primitives.css:85` was updated from `.ac-zone-segment[aria-pressed="true"]` to `.ac-zone-segment[data-selected="true"]`; the visual treatment (inset accent ring + glow) is unchanged.

Cross-editor impact verification: a grep across all source files (`*.ts`/`*.tsx`/`*.css`/`*.scss` under `modules/`, excluding `/dist/` and `/node_modules/`) confirms only the AcZoneStrip primitive, its test, and the canonical CSS selector referenced `aria-pressed` on zone segments. The other `aria-pressed` references in editor-core (`AcEnvelope`, `AcRangeBar`, `AcFrequencyResponse`, `AcEnvelopeTable`, `envelopeChromeHelpers`) live on actual `<button>` elements where the ARIA pairing is valid; those are unchanged. The Roland `ToneZoneEditor` and Akai `KeyRangeEditor` consumers had no production-code or test dependency on `aria-pressed` for zone segments; no consumer-side updates were required.

Regression coverage: `modules/editor-core/src/components/AcZoneStrip.test.tsx` adds an explicit ARIA-cleanup test (`does NOT expose selection via aria-pressed on role="group" segments (invalid ARIA pairing)`) asserting (a) NO segment carries `aria-pressed` at any value, AND (b) `getByRole('button', { pressed: true })` and `getByRole('button', { pressed: false })` do NOT match any zone segment — the segments are `role="group"`, not buttons, and assistive tech must not treat them as toggle buttons. The existing `marks the selected zone` test updates to assert `data-selected="true"` instead of `aria-pressed="true"`. Validator-paired-changes hard test: with the production-code diff stashed (test diff intact), both ARIA-cleanup scenarios FAIL against pre-fix code with the specific error messages `expected null to be 'true'` (data-selected absent pre-fix) and `expected 'true' to be null` (aria-pressed present pre-fix). The tests have teeth in both directions of the contract.

## 2026-05-24 Feature review — latest AcRadioTabs closure verification

Reviewed the implementation work through `8545e839` / `e18987cb` on 2026-05-24, covering the `AcRadioTabs` class-namespace + a11y fix that closed `AUDIT-20260524-10` and `AUDIT-20260524-11`.

Scope checked:

- `modules/editor-core/src/components/AcRadioTabs.tsx`
- `modules/editor-core/src/components/AcRadioTabs.test.tsx`
- `modules/editor-core/src/design/tab-primitives.css`
- `modules/roland-sxx0-editor/src/styles/_shared.css`
- `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx`
- updated roland wiring tests for the radio-group contract

Verification:

- `pnpm --filter @audiocontrol/editor-core test -- AcRadioTabs.test.tsx` — passed (`1` file, `19` tests)

Result: no new audit findings in this pass. The class-namespace split (`.ac-radio-*` vs the pre-existing `.ac-tabs` button-tab chrome) and the radio-group semantics cleanup both appear coherent in the current patch set, and I did not find a new correctness or regression issue beyond the already-recorded and verified `AUDIT-20260524-10` / `-11`.

## 2026-05-24 Feature review — latest AcRadioTabs promotion/migration work

Surfaced while reviewing the latest `AcRadioTabs` promotion and Akai `VelocityZoneEditor` migration commits through `1ae3420f` on 2026-05-24 (`a444acd5`, `b5d30089`, `3b93fa91`). This pass was a code-review audit of the shared primitive, its CSS promotion, and the Akai consumer.

### Promoting radio-tab chrome into global `.ac-tabs` / `.ac-tab` selectors regresses existing button-tab consumers in editor-core

Finding-ID: AUDIT-20260524-10
Status:     verified-8545e839
Severity:   high
Surface:    `modules/editor-core/src/design/tab-primitives.css`, `modules/editor-core/src/design/layout-primitives.css`, `modules/editor-core/src/components/library/LibraryPanel.tsx`, `modules/editor-core/src/components/layout/BuildInfo.tsx`

The `AcRadioTabs` promotion moved the radio-tab chrome into `editor-core/src/design/tab-primitives.css`, but it did so by globally overriding the pre-existing `.ac-tabs` and `.ac-tab` classes used by non-radio tab bars elsewhere in editor-core. The new rule explicitly forces `.ac-tabs { display: block; border-bottom: 0; }` (`tab-primitives.css:45-56`) and redefines `.ac-tab` with `border: ... solid transparent; border-bottom: 0;` plus the radio-tab-specific underline model on `::after` (`tab-primitives.css:90-129`). Those rules are imported globally from `styles.css`, after the original generic tab styles in `layout-primitives.css`.

That breaks the two existing button-tab consumers that still rely on the old flex-row + `.ac-tab--active` contract:

- `LibraryPanel` renders `<div className="ac-tabs">` with `<button className="ac-tab ... ac-tab--active">` children (`LibraryPanel.tsx:102-117`)
- `BuildInfo` does the same for its Info / Logs toggle (`BuildInfo.tsx:148-167`)

Under the promoted CSS, those buttons no longer live in a flex row because `.ac-tabs` is now `display: block`, so the tabs stack vertically. Their active underline also disappears because the legacy active state still only sets `border-bottom-color` (`layout-primitives.css:527-530`), while the promoted `.ac-tab` zeroes the bottom-border width entirely (`tab-primitives.css:104-105`). The radio-tab pattern is correct for `AcRadioTabs`, but it is now unintentionally restyling unrelated button tabs that never opted into that primitive.

**Evidence:**

- Legacy generic tab contract:
  - `modules/editor-core/src/design/layout-primitives.css:503-530`
- Promoted radio-tab rules globally override the same class names:
  - `modules/editor-core/src/design/tab-primitives.css:45-56`
  - `modules/editor-core/src/design/tab-primitives.css:90-129`
- Existing non-radio consumers still use those class names directly:
  - `modules/editor-core/src/components/library/LibraryPanel.tsx:102-117`
  - `modules/editor-core/src/components/layout/BuildInfo.tsx:148-167`

**Expected:** the radio-tab promotion should scope its chrome to the `AcRadioTabs` structure (`.ac-tab-strip`, `.ac-panels`, etc.) or a dedicated modifier class, without changing the layout and active-state contract of existing button-tab bars.

**Actual:** the shared promotion silently changes existing button-tab bars from horizontal flex tabs to vertical block-stacked tabs and removes their active underline.

**Fix guidance:** separate the two tab systems instead of reusing the same top-level class names. Either:
1. scope the radio-tab shell under a dedicated root class from `AcRadioTabs` (for example `ac-radio-tabs`), leaving `.ac-tabs` / `.ac-tab` for the old button-tab system, or
2. migrate `BuildInfo` and `LibraryPanel` onto a new canonical button-tab primitive in the same commit-set and remove the old layout-primitives rules entirely.

At minimum, add regression coverage for `BuildInfo` and `LibraryPanel` before changing any more shared tab CSS.

**Fix landed:** commit `8545e839` took fork (1) from the fix guidance — rename the radio-tab class namespace from `.ac-tabs` / `.ac-tab-strip` / `.ac-tab` / `.ac-panels` / `.ac-panel` to `.ac-radio-tabs` / `.ac-radio-tab-strip` / `.ac-radio-tab` / `.ac-radio-panels` / `.ac-radio-panel`. Applied across:

- `modules/editor-core/src/components/AcRadioTabs.tsx` (JSX classNames)
- `modules/editor-core/src/design/tab-primitives.css` (every selector + the file comment headers)
- `modules/roland-sxx0-editor/src/styles/_shared.css` (all four per-tab-ID `:checked` selector blocks: lit-tab fill, underline, panel show, reduced-motion)
- `modules/roland-sxx0-editor/src/styles/patches.css` (comment)
- `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx` (comment)
- `docs/scope-discovery/anti-patterns.yaml` (`ac-radio-tabs-inline` shape_regex updated to match the post-rename inline-clone shape)

`layout-primitives.css` was NOT touched — the legacy bare `.ac-tabs` / `.ac-tab` / `.ac-tab--active` rules stay where they are, owned by the button-tab system (LibraryPanel + BuildInfo) which continues using them unchanged. After the rename, the two class spaces are disjoint and the two systems cannot collide.

Regression coverage: `modules/editor-core/src/components/AcRadioTabs.test.tsx` gained a new describe block `AcRadioTabs — class-namespace contract (AUDIT-20260524-10)` (2 tests). The teeth-bearing assertion (`mounts AcRadioTabs alongside a button-tab DOM without className collision`) mounts BOTH a `<div className="ac-tabs"><button className="ac-tab ac-tab--active">…</button></div>` button-tab shape AND an `<AcRadioTabs>` instance in the same render tree, then asserts the button-tab container's className is EXACTLY `"ac-tabs"` (no contamination), the active button's className is EXACTLY `"ac-tab ac-tab--active"` (still has the modifier), and NO descendant of the AcRadioTabs container carries the bare `.ac-tabs` / `.ac-tab` / `.ac-tab-strip` / `.ac-panels` / `.ac-panel` token. A sibling assertion (`does NOT emit the bare …`) walks the serialized HTML for the AcRadioTabs container and confirms no className attribute contains the bare token.

Validator-paired hard-test: stashed only the production-code changes (AcRadioTabs.tsx + tab-primitives.css + `_shared.css`) and re-ran the new tests against the pre-rename code. The two AUDIT-10 assertions both went RED — `expected … not to match /\bac-tabs\b/, received …` on the bare-class assertion, and `expected radioContainer.className to contain "ac-radio-tabs"` on the side-by-side assertion. Stash popped; the same tests now pass against the post-rename code. The class-namespace gate has teeth.

### The promoted `AcRadioTabs` primitive exposes tab semantics on focusable labels, but it does not implement the ARIA tab interaction contract

Finding-ID: AUDIT-20260524-11
Status:     verified-8545e839
Severity:   medium
Surface:    `modules/editor-core/src/components/AcRadioTabs.tsx`, `modules/editor-core/src/components/AcRadioTabs.test.tsx`, `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx`, `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx`, `modules/roland-sxx0-editor/src/components/tones/ToneEditorTabs.tsx`

`AcRadioTabs` now lives in editor-core and is the canonical cross-editor primitive, but it still exposes a faux ARIA tablist without implementing the behavior or state that role set promises. The visible labels render as `role="tab"` with `tabIndex={0}` (`AcRadioTabs.tsx:120-129`), while the real controls are separate hidden radio inputs (`AcRadioTabs.tsx:99-117`, with the hide rules at `tab-primitives.css:58-66`). The labels never set `aria-selected`, never expose `aria-controls`, and there is no keyboard handler for Left/Right/Home/End tab navigation or activation. The panels similarly have `role="tabpanel"` with only `aria-labelledby`, but no matching panel id/controls relationship (`AcRadioTabs.tsx:162-167`).

That creates a shared accessibility regression across every adopter of the promoted primitive:

- Roland `PatchEditorTabs`
- Roland `ToneEditorTabs`
- Akai `VelocityZoneEditor`

Keyboard and assistive-technology users will encounter elements announced as tabs, but the widget does not behave like a tablist. The new tests also do not cover this contract; they only assert DOM shape, checked-state serialization, and mouse-click forwarding (`AcRadioTabs.test.tsx:55-260`).

**Evidence:**

- Faux tab roles on labels and hidden radios as the real state carriers:
  - `modules/editor-core/src/components/AcRadioTabs.tsx:99-129`
  - `modules/editor-core/src/design/tab-primitives.css:58-66`
- Panels expose `role="tabpanel"` but no `aria-controls` linkage from the tabs:
  - `modules/editor-core/src/components/AcRadioTabs.tsx:162-167`
- Current tests cover click and markup shape only, not keyboard/ARIA behavior:
  - `modules/editor-core/src/components/AcRadioTabs.test.tsx:55-260`
- Current adopters now depend on the shared primitive:
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx:194-205`
  - `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx`
  - `modules/roland-sxx0-editor/src/components/tones/ToneEditorTabs.tsx`

**Expected:** either expose honest radio-group semantics (and stop declaring `role="tablist"` / `role="tab"` / `role="tabpanel"`), or implement the full ARIA tabs contract: selected-state attributes, controls linkage, and keyboard navigation/activation behavior.

**Actual:** the primitive advertises ARIA tab semantics without implementing the required state and keyboard behavior.

**Fix guidance:** pick one model and make it coherent. The lower-risk path is usually to lean into radios:
1. remove the tab roles,
2. expose a real radio-group label,
3. let the native radio inputs own focus/keyboard semantics.

If the project wants actual tabs, then the component needs a proper tab roving-focus implementation plus `aria-selected` / `aria-controls` wiring and matching tests.

**Fix landed:** commit `8545e839` took the radio fork (option 1) — the auditor's lower-risk path. Specifically:

- Removed `role="tab"` and `tabIndex={0}` from the visible labels (`AcRadioTabs.tsx`); labels are now decorative-only presentation that click-forwards to the radios via `htmlFor`.
- Removed `role="tablist"` from the container nav and replaced the nav with a plain `<div className="ac-radio-tab-strip">` — the container `<div className="ac-radio-tabs">` now carries `role="radiogroup" aria-label={ariaLabel}` so the group has a real ARIA name.
- Removed `role="tabpanel"` (and the now-superfluous `aria-labelledby`) from the `<section className="ac-radio-panel" data-tab={…}>` elements. `data-tab` stays as the canonical hook for the per-tab-ID CSS sibling-selector chain.
- Added `aria-label={tab.label}` to each `<input type="radio">` so assistive tech announces a name even though the visible `<label>` no longer carries an ARIA role.
- Updated the radio sr-only CSS in `tab-primitives.css` from the previous `opacity: 0; pointer-events: none; width: 0; height: 0` (which removed the radios from the tab order entirely) to the sr-only clip pattern (`position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); …`) so the radios stay focusable. Native browser keyboard semantics (Tab to enter the group, Arrow keys between radios within the group) now work; no custom JS focus-management code is needed.

The explicit choice of the radio fork (option 1) over the full ARIA tabs fork: the existing pattern is fundamentally radio-driven — uncontrolled mode flips panels via CSS `:checked` sibling selectors against per-tab-ID rules, and the controlled mode reads the active `id` from React state. Implementing the full ARIA tabs contract (`aria-selected`, `aria-controls` linkage, custom Left/Right/Home/End keyboard handler, roving `tabindex` management) would have meant adding a parallel state-tracking layer on top of the radio inputs — more code surface, more drift risk, and a worse semantic fit. The radio-group fork honors the underlying mechanism instead of papering over it with a faux contract.

Regression coverage: `AcRadioTabs.test.tsx` gained a new describe block `AcRadioTabs — radio-group ARIA contract (AUDIT-20260524-11)` (6 tests):

- `exposes role="radiogroup" + aria-label on the container` — positive assertion.
- `does NOT render the faux role="tablist" / role="tab" / role="tabpanel" attributes` — three negative assertions that lock the AUDIT-11 regression out.
- `does NOT add tabIndex={0} to the visible labels (the radios own keyboard focus)` — locks the second half of the AUDIT-11 regression out.
- `renders each radio with a unique name (groupName) and an aria-label matching its tab.label` — confirms the radios are reachable as `role="radio"` and stay in the tab order (asserts `tabindex !== "-1"`).
- `exposes the radios through screen.getByRole("radiogroup")` — end-to-end ARIA lookup using the accessible name.
- `clicking a label still updates the matching radio (presentation labels click-forward via htmlFor)` — proves the click-forwarding contract that lets the visible labels stay decorative.

The 7 adopting roland test files (`tests/wiring/patches.spec.ts`, `tests/wiring/tones.spec.ts`, `tests/wiring/tone-display.spec.ts`, `tests/wiring/tone-writes-helpers.ts`, `tests/rendering/phase-9-task-6-screenshots.spec.ts`, `tests/ui/in-context/tones.envelope.in-context.spec.ts`, `tests/ui/in-context/tones-list.in-context.spec.ts`, `tests/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts`) were updated in the same commit to assert against the radio-group shape instead of the faux ARIA tab attributes. Click sites switched to `page.locator('label.ac-radio-tab', { hasText: … }).click()` because the radios are sr-only / clipped (Playwright cannot click them via the visible viewport; the `<label>` is the visible click target and forwards via `htmlFor`). Presence sites use `page.getByRole('radio', { name: … }).toBeAttached()` — DOM-attached works against sr-only nodes.

Validator-paired hard-test: stashed only the production-code changes and re-ran the new tests against the pre-fix code. All 6 ARIA assertions went RED — e.g., `expected element NOT to contain "role=\"tablist\""`, `expected to find element with role "radiogroup" and name "Test sections accessible"` (the old code emitted `role="tablist"` instead). Stash popped; same tests now pass against the post-fix code. The ARIA gate has teeth.

## 2026-05-24 Feature review — latest shell-contract closure verification

Surfaced while reviewing the latest shell-contract closure commits through `0bcadbe1` on 2026-05-24, after `AUDIT-20260524-06` and `-07` were marked verified. This pass was a code-review audit of the new harness/spec work; I did not complete a full Playwright run in this pass. I did confirm that the ordinary module `pnpm test` script does not pick up `test/ui/**`, so these findings are based on the code and runner wiring rather than an end-to-end browser execution.

### The Akai shell-contract spec documents `.ac-detail-scroll` as part of the contract but never asserts the detail pane's scroll ownership

Finding-ID: AUDIT-20260524-08
Status:     verified-c8b09bc4
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/index.css`, `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`

The new shell-contract spec now covers the four intended Akai routes, but it still only checks internal scroll ownership on the list side. Its header explicitly names `.ac-detail-scroll` as part of the fixed-viewport contract (`page-shell-contract.spec.ts:12-13`), yet the desktop assertions only verify `.ac-list-scroll` overflow for app-shell routes (`page-shell-contract.spec.ts:197-206`). There is no corresponding assertion that the detail pane declares `overflow-y: auto|scroll`, even though the Akai implementation relies on the dialect-local `.ac-detail-scroll` wrapper for exactly that behavior.

That omission matters because the detail side is where the dense editors live. `ProgramsPage`, `SamplesPage`, and `KeygroupsPage` each wrap the real editor surface in `<div className="ac-detail-scroll">` (`ProgramsPage.tsx:351`, `SamplesPage.tsx:259`, `KeygroupsPage.tsx:351`), and the CSS comment in `index.css` says this wrapper exists so long editor surfaces scroll inside the grid track instead of getting clipped (`index.css:21-53`). A future regression that drops the class, removes `overflow-y: auto`, or replaces it with a non-scrolling wrapper would still leave the current spec green as long as the list column kept working.

**Evidence:**

- The spec describes `.ac-detail-scroll` as part of the shell contract:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:12-13`
- The actual app-shell assertion checks only the list column:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:197-206`
- The real Akai pages depend on `.ac-detail-scroll` for editor-pane scrolling:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:351`
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:259`
  - `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx:351`
  - `modules/akai-s3k-editor/src/index.css:21-53`

**Expected:** the shell-contract regression spec should assert both sides of the app-shell contract: `.ac-list-scroll` for list ownership and `.ac-detail-scroll` for detail ownership.

**Actual:** only the list column's overflow contract is tested.

**Fix guidance:** extend the app-shell branch of `page-shell-contract.spec.ts` with a `.ac-detail-scroll` computed-style assertion, and preferably add a contentful detail harness state that forces vertical overflow so the test checks behavior under scroll pressure rather than just class presence.

**Fix landed (c8b09bc4):** extended the app-shell branch of `page-shell-contract.spec.ts` with a `.ac-detail-scroll` `overflow-y` computed-style assertion alongside the existing `.ac-list-scroll` check (covers all 3 app-shell routes: programs, samples, keygroups-shell). Seeded `TestKeygroupsShellPage` with 20 stacked synthetic param rows (`min-height: 80px` each, ~1600px total content) inside `.ac-detail-scroll`, each carrying `data-testid="kg-detail-row-<index>"`. Added a new test case `keygroups-shell: .ac-detail-scroll owns scroll under contentful detail content` that asserts the contentful pressure shape: (a) `scrollHeight > clientHeight` on the detail pane (proves the seed creates real overflow), (b) the last detail row (`[data-testid="kg-detail-row-19"]`) is reachable via `scrollIntoView()` and lands inside the pane's bottom edge (proves the pane owns scroll), (c) `document.documentElement.scrollHeight` stays within `innerHeight` afterwards (proves the pane's scroll did not bleed to the document). Revert-test confirmed the new assertions have teeth: removing `overflow-y: auto` from `.ac-detail-scroll` in `index.css` turns the app-shell body-layout test red on all 3 routes (`"overflow-y should be 'auto' or 'scroll', got 'hidden'"`); removing the 20 synthetic rows turns the new contentful test red (`"scrollHeight (433px) should be > clientHeight (433px)"`). Test count: `make test-ui-s3k` 41 → 43 passed.

### The new real-library harness mounts empty library/device state, so the "inner overflow" assertion never exercises the contentful states that actually create scroll pressure

Finding-ID: AUDIT-20260524-09
Status:     verified-c8b09bc4
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx`, `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`

`TestLibraryRealPage` improves on the earlier stub by mounting the real `PluginLibraryBrowser`, but it still feeds that component an empty/disconnected world: `categoryData` is `{ samples: [], 'common-programs': [], 's3k-programs': [] }` and `EMPTY_MEMORY_STATE` has `isConnected: false` with no program or sample names (`TestLibraryRealPage.tsx:40-67`). The paired spec then asserts only that the three inner panes *declare* `overflow-y: auto|scroll` (`page-shell-contract.spec.ts:220-272`).

That means the new test proves CSS declarations on the empty-state DOM, not the populated states that actually create nested-scroll pressure on the production Library page. In the real page, `categoryData` is computed from live library contents (`LibraryPage.tsx:296`) and the browser receives a real `deviceMemoryState` (`LibraryPage.tsx:591`). Those are the cases where long trees, device-memory banks, and preview content can expose `min-height`, descendant sizing, or clipping regressions even if the empty-state panes still report `overflow-y: auto`.

**Evidence:**

- The "real" harness intentionally passes empty category/device state:
  - `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx:40-67`
- The spec checks pane styles, not overflow under populated content:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:220-272`
- The production page supplies real category/device data:
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:296`
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:591`

**Expected:** the real-library harness used for overflow protection should include deterministic but contentful tree/device data so the asserted panes actually need to scroll.

**Actual:** the asserted panes render empty/disconnected states, so the test never proves overflow ownership under the content patterns most likely to regress.

**Fix guidance:** seed `TestLibraryRealPage` with enough deterministic library nodes and device-memory rows to overflow each pane, then keep the existing computed-style checks and add one reachability or bounded-scroll assertion per pane. That would turn the test from "the CSS property exists" into a real guard against clipped or bubbling overflow.

**Fix landed (c8b09bc4):** seeded `TestLibraryRealPage` with deterministic contentful inputs mirroring the production wiring shapes: `categoryData` carries 30 `TreeNode` entries per category (samples / common-programs / s3k-programs), matching the `{ id, name, type }` shape from `TreeView.tsx:23-30` and the `Record<categoryId, TreeNode[]>` aggregation at `LibraryPage.tsx:296`; the type discriminator is `'sample'` for samples and `'program'` for both program categories (matches `categories.tsx`). `S3kMemoryPanelState` now has `isConnected: true` with 30 program names (`PRG_00_NAME` .. `PRG_29_NAME`) and 30 sample names (`SMP_00_NAME` .. `SMP_29_NAME`), matching the `S3kMemoryPanelState` interface at `s3k-library-plugin.tsx:35-57`; action callbacks remain no-op because the contract under test is overflow ownership, not write behavior. Kept the existing computed-style overflow checks; added a new test case `library-real: contentful library + device-memory state forces real overflow pressure` that asserts, for each of `.ac-plugin-library-browser-device` and `.ac-plugin-library-browser-sections`: (a) `scrollHeight > clientHeight` (proves the seed creates real overflow pressure), (b) a deterministic last item is reachable via `scrollIntoView()` and lands inside the pane's bottom edge — `[data-testid="device-sample-29"]` for the device pane (from `DeviceMemoryPanel`'s `data-testid={`device-${type}-${index}`}` shape), `[data-testid="library-sample-samples-sample-029"]` for the sections pane (slug shape from `TreeView.tsx:267-269`) — (c) `document.documentElement.scrollHeight` stays within `innerHeight` afterwards (no bleed). The preview pane is explicitly excluded from the populated-overflow assertions because it renders the SELECTED item's preview, not all items; with no selection it stays empty. Its overflow declaration is still asserted by the prior inner-pane test. Revert-test confirmed teeth: reverting `categoryData` + `memoryState` back to empty inputs turns the new contentful test red (`"pane '.ac-plugin-library-browser-device' scrollHeight (739px) should be > clientHeight (739px)"`). Test count: `make test-ui-s3k` 41 → 43 passed.

## 2026-05-24 Feature review — latest shell-contract follow-up

Surfaced while reviewing the latest `feature/akai-harmonization` commits through `1a6261d2` on 2026-05-24, specifically the new Akai shell-contract harness/spec work that closed `AUDIT-20260524-05`. This pass was a code-review audit only; I did not run the test suite locally in this pass.

### Shell-contract closure still excludes the Keygroups route, so the one migrated page with the most unique shell structure has no direct Akai regression spec

Finding-ID: AUDIT-20260524-06
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/App.tsx`, `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`, `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`

The new `page-shell-contract.spec.ts` is framed as the Akai-side closure for the Phase 2 shell migration, and its file header says the migration covered all four Akai pages: Programs, Samples, Keygroups, and Library (`page-shell-contract.spec.ts:5-6`). But the spec immediately documents that Keygroups is still excluded: `/test/keygroups` is wired to the pre-existing inline-styled harness rather than a shell-compliant page harness (`page-shell-contract.spec.ts:30-39`), `KEYGROUPS_SHELL_HARNESS_AVAILABLE` is hardcoded `false` (`page-shell-contract.spec.ts:60`), and the actual loop only exercises Programs, Samples, and Library (`page-shell-contract.spec.ts:74-93`).

That matters because Keygroups is not just another copy of the same page shape. Its production page has the most structurally distinct layout of the four migrated surfaces: the zone-overview toolbar and overview block sit ahead of the canonical shell, so it is the route most likely to regress height ownership, clipping, or scroll interactions in a way that the other three harnesses would not catch. Today the spec marks `AUDIT-20260524-05` closed while leaving that route outside the Akai-specific regression surface.

**Evidence:**

- The spec header claims all four migrated pages are in scope: `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:5-6`
- The same file explicitly excludes Keygroups and keeps the seam disabled:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:30-39`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:60`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:74-93`
- The route still points to the old inline-styled harness, not a canonical shell harness:
  - `modules/akai-s3k-editor/src/App.tsx:21`
  - `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx:160-183`
- The workplan now marks harness coverage complete for all four pages, which overstates what the shell-contract spec actually exercises:
  - `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98`

**Expected:** if `AUDIT-20260524-05` is considered closed, each migrated Akai page should have a shell-contract harness that the Akai regression spec actually runs, including Keygroups.

**Actual:** Keygroups remains routed to a legacy inline harness and is intentionally omitted from the Akai shell-contract spec.

**Fix guidance:** add a shell-compliant `TestKeygroupsPage` variant that mirrors the production `KeygroupsPage` shell contract, then include it in `SHELL_HARNESS_ROUTES` and remove the `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` seam. Until then, the audit log and workplan should describe the shell-contract closure as partial rather than complete.

**Fix landed:** commit `7e431a69` (2026-05-24). New file `modules/akai-s3k-editor/src/pages/TestKeygroupsShellPage.tsx` registered at the new route `/akai/s3000xl/editor/test/keygroups-shell` in `modules/akai-s3k-editor/src/App.tsx`. The harness mirrors the production `KeygroupsPage` shell scaffold (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `ZoneOverviewToolbar` + `ZoneOverview` + `.ac-app-shell` + real `KeygroupList` + `.ac-detail-scroll` stub detail) with 16 factory keygroups + local React state; no zustand stores, no `useS3000xlClient`. The pre-existing `/akai/s3000xl/editor/test/keygroups` route stays pointing at the inline-styled `TestKeygroupsPage` because `zone-overview.spec.ts:3` depends on it. The `KEYGROUPS_SHELL_HARNESS_AVAILABLE` constant + its header-comment block were removed from `page-shell-contract.spec.ts`; the new route is added to `SHELL_HARNESS_ROUTES` and the 13 existing test cases automatically extend coverage to keygroups-shell via the loop. `make test-ui-s3k`: 41 passed (was 32 — added the keygroups-shell route × 4 viewports + 1 viewport-route combination for library-real; see AUDIT-20260524-07 below for the rest).

### Library shell harness only proves wrapper geometry; it does not exercise the real `PluginLibraryBrowser` overflow surface the finding claimed to protect

Finding-ID: AUDIT-20260524-07
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`, `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`

The new Library harness does not mount `PluginLibraryBrowser`. Its own header says it uses a stub `<div>` standing in for the browser (`TestLibraryPage.tsx:9-13`), and the body comment repeats that the harness only needs a single full-height block so the spec can verify `.ac-page-shell-body` geometry (`TestLibraryPage.tsx:27-31`). That means the new regression spec validates the page wrapper shape, but not the real surface that owns the complex internal overflow behavior on the production Library page.

This is a meaningful gap because `AUDIT-20260524-05` was about fixed-viewport containment and internal scroll ownership after the page-shell migration. The production Library page delegates that behavior to a full-height three-column widget; a stand-in block cannot catch regressions where the real browser's own DOM, overflow rules, or descendant sizing reintroduce document scroll or clipped inner panes while the outer `.ac-page-shell-body` still looks correct.

**Evidence:**

- The harness explicitly uses a stand-in block instead of the production browser:
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:9-13`
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:27-31`
- The page-shell spec relies on that harness route as the Library coverage surface:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:24-28`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:87-92`

**Expected:** the closure for the Library shell-contract finding should exercise either the real `PluginLibraryBrowser` in a deterministic harness or a test surface that preserves the browser's actual internal overflow structure.

**Actual:** the current harness proves only that a generic full-height block fits inside `.ac-page-shell-body`.

**Fix guidance:** build a deterministic library harness around the real `PluginLibraryBrowser` with stubbed library/device inputs, or add a second targeted spec that mounts the real browser and asserts document-scroll containment plus inner-pane overflow ownership. If the stub-only approach is kept, the audit closure should explicitly state that only outer wrapper geometry is covered.

**Fix landed:** commit `7e431a69` (2026-05-24). Chose **shape (a)** from the operator's fix-guidance — a deterministic real-`PluginLibraryBrowser` harness. New file `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx` registered at the new route `/akai/s3000xl/editor/test/library-real` in `modules/akai-s3k-editor/src/App.tsx`. The harness mounts the REAL `PluginLibraryBrowser` with:
- `s3kLibraryPlugin` (the production plugin config from `@/plugins/s3k-library-plugin`)
- A stub `{ name: 'TestLibraryRoot' }` library handle — matches the truthy `{ name }` shape `PluginLibraryBrowser.test.tsx` uses (`{} as FileSystemDirectoryHandle`)
- An empty `S3kMemoryPanelState` (`isConnected: false`, empty `programNames`/`sampleNames`) so the device-memory panel renders empty
- Empty `categoryData` for `samples` / `common-programs` / `s3k-programs` — the contract under test is inner-pane overflow ownership, not tree-rendering behavior

The pre-existing `/akai/s3000xl/editor/test/library` route stays pointing at the stub-`<div>` `TestLibraryPage` because it's the outer wrapper-geometry baseline for the contract spec; the new `library-real` route is the inner-pane gate. Both routes are now in `SHELL_HARNESS_ROUTES` in `page-shell-contract.spec.ts`.

**Inner-pane assertion specifics** (`page-shell-contract.spec.ts:220-272`): a new per-route test, gated by the `asserts_inner_library_overflow` flag on the route metadata (only `library-real` opts in today), asserts the three inner panes of `PluginLibraryBrowser` each declare `overflow-y: auto` or `scroll`:
- `.ac-plugin-library-browser-device` (device memory column)
- `.ac-plugin-library-browser-sections` (library tree scroll container)
- `.ac-plugin-library-browser-preview` (preview pane)

If any pane's `overflow-y` regresses to `visible`, content overflow bubbles up the parent chain until either the `.ac-page-shell-body` clips it (content unreachable) or the document scrolls (regresses the fixed-viewport contract) — both outcomes are shell-contract failures the assertion catches at the inner-pane layer. A cross-check at the end of the same test re-asserts `document.documentElement.scrollHeight <= window.innerHeight + slack` against the real-`PluginLibraryBrowser` mount, pinning the no-document-scroll invariant specifically against the real component so a regression here implicates the inner-pane overflow rules, not the outer shell.

## 2026-05-24 Feature review — latest Phase 2 implementation

Surfaced while reviewing the latest harmonization commits on `feature/akai-harmonization` after `AUDIT-20260524-01` and `-02` were fixed. Scope reviewed from commit `68799ed9` through `HEAD` (`5a15c01c` at review time), with targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- TreeView.test.tsx`
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- SampleList.test.tsx`

Both targeted runs passed, but they do not cover the new issues below.

### Akai list-row migration codifies selected state on `role="button"` rows via `aria-selected`, which screen readers will not treat as a button state

Finding-ID: AUDIT-20260524-04
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx`, `modules/akai-s3k-editor/src/components/samples/SampleList.tsx`, `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx`, `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx`

Phase 2 task 2.2 migrated the Akai list widgets onto the canonical `.ac-list-row` chrome and, in the process, standardized all three row types as focusable `<div role="button">` wrappers carrying `aria-selected={isSelected}`:

- `ProgramList.tsx:176-185`
- `SampleList.tsx:182-191`
- `KeygroupList.tsx:138-147`

The visual selected-state styling is then keyed off `[aria-selected="true"]` in CSS, and the updated `SampleList` unit test now treats that attribute as the selected-state contract (`SampleList.test.tsx:43-60`).

The problem is semantic: `aria-selected` is not a supported state for the ARIA `button` role. Browsers will happily leave the attribute in the DOM and CSS can style against it, but assistive technology will not reliably announce "selected" for a button because "selected" is a state for roles like `option`, `tab`, `gridcell`, or `treeitem`, not buttons.

So the branch now has a selected-state signal that works visually and in DOM-attribute tests, but does not actually expose the state to screen-reader users in the way the tests imply.

**Evidence:**

- Akai rows now expose `role="button"` + `aria-selected={...}`:
  - `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx:176-185`
  - `modules/akai-s3k-editor/src/components/samples/SampleList.tsx:182-191`
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx:138-147`
- The updated unit test explicitly blesses `aria-selected` as the new observable contract:
  - `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx:43-60`

**Expected:** either use a role that legitimately carries `aria-selected` (for example a listbox/option-style pattern), or keep the button role and expose selection through a supported button state / wording instead of treating `aria-selected` as meaningful.

**Actual:** the selected-state contract is visually correct but semantically inert for assistive tech.

**Fix guidance:** do not deepen the new contract in more tests. Either re-model these lists as composite widgets with roles that support selection, or keep the button role and move the state exposure to a supported pattern (`aria-current`, `aria-pressed`, or explicit screen-reader text depending on the intended interaction model). A follow-up regression test should assert the accessible role/state combination, not just the raw attribute.

**Fix landed:** this session, 2026-05-24. Per the auditor's guidance, switched the selected-state contract from `aria-selected` to `aria-current="true"` everywhere. This is the "currently-selected item from a set" ARIA pattern that IS supported on the `button` role.

Per the ARIA spec, the omit-when-not-current convention applies: selected rows render `aria-current="true"`, unselected rows omit the attribute entirely (the JSX uses `aria-current={isSelected ? 'true' : undefined}`).

Files changed (the canonical fix is editor-core CSS; the consumer fix is 5 JSX sites across roland + akai):
- `modules/editor-core/src/design/list-primitives.css` — 3 selectors changed from `[aria-selected="true"]` to `[aria-current="true"]` (hover-reveal action class, slot color, row background).
- `modules/roland-sxx0-editor/src/components/patches/PatchList.tsx` + `tones/ToneList.tsx` — `aria-selected={isSelected}` → `aria-current={isSelected ? 'true' : undefined}`.
- `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx` + `samples/SampleList.tsx` + `keygroups/KeygroupList.tsx` — same.
- `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx` — both tests updated: the "selected sample" test now asserts `aria-current === 'true'`; the "unselected" test now asserts the attribute is null (per omit-when-not-current).

**Verification:** `make` clean. `make test-ui-roland` 4 passed + 2 skipped (matches baseline; roland row-state styling continues to work with the new attribute). `make test-ui-s3k` 19 passed. `pnpm --filter @audiocontrol/akai-s3k-editor test` 175 passed + 1 failed (matches baseline — the failing test is the pre-existing `ProgramsPage delete flow > shows loading status when isLoading with a message` unrelated to this change, confirmed via stash + re-run).

**Test-gap follow-up:** the auditor recommended "a follow-up regression test should assert the accessible role/state combination, not just the raw attribute." The current SampleList test asserts `aria-current === 'true'` on the raw attribute. A stronger test would use `@testing-library/react`'s `getByRole` + accessibility-tree assertions to verify the rendered role + state actually exposes to AT correctly. Deferred to a follow-up — landing the literal-attribute fix first closes the immediate semantic bug.

### Phase 2 landed four Akai page-shell migrations with no direct regression test for the new fixed-viewport/app-shell contract

Finding-ID: AUDIT-20260524-05
Status:     verified-7e431a69 (re-closed 2026-05-24 — see "Re-closed" paragraph below)
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`, `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`, `modules/akai-s3k-editor/test/`

The latest Phase 2 work moved all four primary Akai pages onto the canonical shell/layout primitives:

- `ProgramsPage.tsx:310-351` now uses `.ac-page-shell--fixed-viewport`, `.ac-app-shell`, `.ac-detail-scroll`
- `KeygroupsPage.tsx:307-351` now uses the same contract
- `SamplesPage.tsx:231-259` now uses the same contract
- `LibraryPage.tsx:560-572` now uses `.ac-page-shell--fixed-viewport` + `.ac-page-shell-body`

That is a large live-surface migration: page header, height bounding, internal scroll ownership, and list/detail pane structure all changed together. But the Akai test surface still does not exercise that contract directly. The only touched unit test in this pass is `SampleList.test.tsx`, and it checks row attributes only. A grep across `modules/akai-s3k-editor/test/` shows waits for lists to appear and hardware workflows that happen to pass through the pages, but no test that asserts the new shell/layout invariants themselves (`ac-page-shell--fixed-viewport`, `ac-app-shell`, `ac-detail-scroll`) or any dedicated Akai UI harness for the migrated pages.

This matters because the migration is precisely the kind of change that can regress scroll containment, clipping, or mobile behavior while leaving data-loading tests green. Roland has explicit design/rendering coverage for the canonical fixed-viewport shell; Akai still does not.

**Evidence:**

- New page-shell adoption:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:310-351`
  - `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx:307-351`
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:231-259`
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:560-572`
- Current Akai tests reference the lists/pages only indirectly (load/wait helpers and hardware flows), not the new layout contract itself:
  - `modules/akai-s3k-editor/test/` grep shows list waits and one `SampleList` unit spec, but no assertion on `ac-page-shell--fixed-viewport`, `ac-app-shell`, or `ac-detail-scroll`

**Expected:** when Phase 2 replaces a page’s shell/layout contract, the branch adds a direct regression surface for that contract on Akai too, not just on Roland. At minimum one targeted UI/rendering spec should assert scroll containment / non-clipping for the migrated Akai pages.

**Actual:** the canonical shell rollout to Akai is effectively covered only by incidental e2e traffic and one row-level unit test.

**Fix guidance:** add a focused Akai UI/rendering spec for the migrated pages before more shell-level harmonization lands. The most valuable first assertion is the fixed-viewport invariant: list and detail panes own internal scroll on desktop without clipping their bodies, with the mobile escape hatch still falling back to document scroll below 900 px.

**Fix landed:** commit `ff07963c` (2026-05-24). Added `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts` — 13 Playwright test cases across two `test.describe` blocks. Desktop (1280×900): asserts `.ac-page-shell--fixed-viewport` is present, page-shell `boundingClientRect.height` ≤ `window.innerHeight - site-header` (bounded-viewport contract), `document.documentElement.scrollHeight === window.innerHeight` (no document-level scroll), `.ac-app-shell` is a 2-col grid via `gridTemplateColumns` introspection, `.ac-list-scroll` `overflow-y` is `auto`/`scroll`. Library variant asserts `.ac-page-shell-body` instead of `.ac-app-shell`. Mobile (414×896): asserts the escape hatch — page-shell falls back to `height: auto`, doc scrolls naturally (`scrollHeight > innerHeight`), `.ac-app-shell` collapses to single track, last list row is reachable via scroll (`scrollIntoView` + `boundingClientRect` reachability check). Runs against the three new harness routes (`/akai/s3000xl/editor/test/{programs,samples,library}`) landed alongside in this same commit. `make test-ui-s3k`: 32 passed (19 existing zone-overview + 13 new contract tests).

**Coverage gap (intentional, documented):** `TestKeygroupsPage` is not included in the contract loop — it predates the canonical shell chrome (renders inline styles, not `.ac-page-shell--fixed-viewport`). The spec records this with `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` at the top + a header comment naming the gap, so a future opt-in is mechanical. The production `KeygroupsPage` IS shell-compliant (migrated in `bba5b13b` and covered indirectly via the cross-page contract this spec asserts); only the harness lags.

**Closure downgraded 2026-05-24 from `verified-2026-05-24` to `acknowledged-partial-coverage`.** Auditor flagged two gaps the closure paragraph above understated:
- **AUDIT-20260524-06**: Keygroups is the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of canonical shell). Leaving its harness route excluded means the page most likely to regress shell behavior is the one route the Akai-specific spec doesn't exercise. The "intentional gap" framing above was wrong — the right disposition is to BUILD the missing shell-compliant harness, not document its absence.
- **AUDIT-20260524-07**: `TestLibraryPage` mounts a stub `<div>` instead of the real `PluginLibraryBrowser`. The spec validates outer wrapper geometry but not the inner-overflow surface that AUDIT-05's fix-guidance specifically called out ("list and detail panes own internal scroll on desktop without clipping their bodies"). Stub-only coverage is not the closure shape the original finding asked for.

Re-closing AUDIT-05 requires landing fixes for both -06 and -07 (a shell-compliant `TestKeygroupsShellPage` route at `/akai/s3000xl/editor/test/keygroups-shell` registered in `SHELL_HARNESS_ROUTES`; a deterministic real-`PluginLibraryBrowser` harness route or paired spec that asserts inner-pane overflow ownership). When both ship, all three findings close together with `verified-<sha>`.

**Re-closed:** commit `7e431a69` (2026-05-24). Both -06 and -07 closed in the same commit, which re-closes -05. The full coverage picture is now:
- **Keygroups:** new shell-compliant `TestKeygroupsShellPage` at `/akai/s3000xl/editor/test/keygroups-shell` exercises the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of the canonical `.ac-app-shell`) through the contract spec's full per-route gauntlet (desktop fixed-viewport, app-shell 2-col grid, mobile escape-hatch falls back to auto-height, app-shell collapses to single column on mobile, last list row reachable via scroll).
- **Library:** new `TestLibraryRealPage` at `/akai/s3000xl/editor/test/library-real` mounts the REAL `PluginLibraryBrowser` with the production `s3kLibraryPlugin` + stub library handle + empty `S3kMemoryPanelState`. A new per-route assertion gated by `asserts_inner_library_overflow` (only `library-real` opts in) covers the inner-pane overflow contract AUDIT-05's fix-guidance specifically named: each of `.ac-plugin-library-browser-device`, `.ac-plugin-library-browser-sections`, `.ac-plugin-library-browser-preview` MUST declare `overflow-y: auto` or `scroll`. A cross-check asserts document-scroll containment against the real `PluginLibraryBrowser` mount so a regression here implicates the inner-pane overflow rules, not the outer shell. The original `/test/library` route stays as the outer wrapper-geometry baseline; both routes are now in `SHELL_HARNESS_ROUTES`.

**New contract-spec test count:** 22 (was 13). Decomposition:
- Desktop describe: 5 routes × 2 base tests (`fixed-viewport shell` + `body layout matches its kind`) + 1 inner-pane test (only `library-real`) = 11
- Mobile describe: 5 routes × 1 escape-hatch test + 3 `app-shell`-kind routes × 2 tests (`collapse-to-single-col` + `last-row-reachable`) = 5 + 6 = 11

`make test-ui-s3k`: 41 passed (was 32 — 19 zone-overview unchanged + 22 page-shell-contract). Independent re-run after the implementer commit per agent-discipline.md "When CI is absent, the controller is the gate."

**Inner-pane coverage proof:** revert-test confirms the new assertions have teeth — if `.ac-plugin-library-browser-device`'s CSS rule loses its `overflow-y: auto` declaration in `modules/editor-core/src/design/library.css`, the new `library-real: inner library panes own their own overflow` test turns red with a message naming the regressing selector + the actual computed `overflow-y` value. This closes the gap AUDIT-07 named: AUDIT-05's original closure validated `.ac-page-shell-body` geometry but said nothing about inner-pane ownership; now the contract spec asserts both.

---

## 2026-05-24 Feature review — implementation work so far

Surfaced while reviewing `feature/akai-harmonization` against `origin/main` after the first implementation commits landed in `editor-core` plus the new feature-doc set. Scope reviewed: branch diff from merge-base `57a6dd9fdfe08e93f3813a7d2c221611aa9995d6` through `HEAD` (`0c09c87e` at review time).

### Disclosure-button fix introduces a second tab stop per folder row and strands keyboard users on the nested button

Finding-ID: AUDIT-20260524-01
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/components/library/TreeView.tsx`

The accessibility fix that promoted the folder disclosure affordance from a `<span>` to a `<button>` solved pointer target size and button semantics, but it also made every expandable folder row contain two focusable elements: the row itself (`role="treeitem"`, `tabIndex={0}` at `TreeView.tsx:288-290`) and the nested disclosure button (`TreeView.tsx:293-299`).

That breaks the tree's keyboard model in two ways:

1. Tabbing through the tree now lands on both the row and the disclosure button for every folder, doubling the tab-stop count through the library.
2. Once focus lands on the nested button, the row-level `handleKeyDown` logic is no longer in play. Arrow-key tree navigation and row-level expand/collapse affordances are attached to the parent row, not the button, so the user can get "stuck" on the nested button and lose the expected tree navigation behavior until they tab away again.

This is a regression introduced by the new fix, not a pre-existing condition of the tree: the previous `<span>` shape left only the row itself in the focus order.

**Evidence:**

- Parent row remains tabbable: `modules/editor-core/src/components/library/TreeView.tsx:288-290`
- New nested button is focusable by default and has no compensating `tabIndex={-1}` or keyboard forwarding: `modules/editor-core/src/components/library/TreeView.tsx:293-299`
- Existing tests only assert that the disclosure class renders (`modules/editor-core/src/components/library/TreeView.test.tsx:107-113`); there is no keyboard-navigation test covering focus order or arrow-key behavior after the change.

**Expected:** one keyboard focus target per tree row, with the disclosure affordance exposed semantically without adding a competing tab stop inside the composite tree item.

**Actual:** every expandable folder row now contributes a second focusable control with no tree-key handling of its own.

**Fix guidance:** keep the button semantics, but remove it from the tab order (`tabIndex={-1}`) and let the parent `treeitem` remain the keyboard anchor, or move the tree semantics onto the button itself and stop making the wrapper row separately tabbable. Either route needs a regression test that tabs through the tree and verifies folder rows do not create extra tab stops.

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/components/library/TreeView.tsx:292-309` got `tabIndex={-1}` on the disclosure button. The parent row's `role="treeitem"` + `tabIndex={0}` stays the keyboard anchor; arrow-key tree navigation continues to fire from the row's `handleKeyDown`. The button keeps its `<button type="button">` semantics + `aria-label` + `aria-expanded` so screen readers and voice-control element-enumeration still address it for pointer activation (closes-paired with AUDIT-20260523-02). Pointer-click + voice-control activation route through the existing `e.stopPropagation()` onClick. The 24×24 hit target from AUDIT-20260523-01 also stays intact. **Regression test added** at `modules/editor-core/src/components/library/TreeView.test.tsx`: the new test "disclosure button does not add a second tab stop per folder row" asserts every `<button class="ac-tree-disclosure-btn">` in the rendered HTML carries `tabindex="-1"`. A future edit that drops the attribute will fail the test. `pnpm vitest run src/components/library/TreeView.test.tsx`: 25 tests pass (24 previously + 1 new).

### Akai light-theme token block leaves action-button colors pinned to white-on-dark assumptions

Finding-ID: AUDIT-20260524-02
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/design/layout-primitives.css`, `modules/editor-core/src/design/primitives.css`, `modules/editor-core/src/design/library.css`, `modules/akai-s3k-editor/src/main.tsx`

Phase 2's new Akai dialect token block flips the S3000XL surface to a light cream/champagne theme and is live in production because the Akai app now sets `document.documentElement.dataset.editor = 's3000xl'` in `modules/akai-s3k-editor/src/main.tsx:12-13`. But the shared action-button color tokens still live only in the global `:root` block in `layout-primitives.css:71-77`, where they remain semi-transparent white values tuned for the dark Roland surfaces.

Those tokens drive both generic list-row actions (`primitives.css:446-475`, `.ac-list-action-btn`) and tree-row destructive actions (`library.css:198-232`, `.ac-tree-delete-btn`). On the new light Akai panels (`tokens.css:240-245`), the default action state is therefore still `rgba(255, 255, 255, 0.4)` on a pale background. That is a low-contrast hover affordance at exactly the moment the branch is trying to establish the light Akai dialect as production truth.

**Evidence:**

- Light Akai surfaces are active: `modules/akai-s3k-editor/src/main.tsx:12-13`, `modules/editor-core/src/design/tokens.css:231-269`
- Action tokens remain white-on-dark globals with no `:root[data-editor='s3000xl']` override: `modules/editor-core/src/design/layout-primitives.css:71-77`
- Production consumers of those tokens:
  - `.ac-list-action-btn`: `modules/editor-core/src/design/primitives.css:446-475`
  - `.ac-tree-delete-btn`: `modules/editor-core/src/design/library.css:198-232`

**Expected:** the Akai dialect overrides `--ac-action-color`, `--ac-action-hover`, and the selected/danger variants so action icons remain legible on the light S3000XL surfaces.

**Actual:** Akai now opts into a light background while action affordances still assume a dark background.

**Fix guidance:** move the `--ac-action-*` tokens into the per-editor token layer and add an S3000XL-specific override set. Pair the fix with a visual or computed-style test on an Akai list/tree row so a future palette migration cannot silently regress action contrast again.

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/design/tokens.css` `:root[data-editor='s3000xl']` block now includes six `--ac-action-*` overrides: `--ac-action-color: rgba(26, 24, 18, 0.45)` (dark text at 45% for the default state on cream — visible-but-secondary), `--ac-action-hover: rgba(26, 24, 18, 0.95)` (near-black on hover for strong contrast), `--ac-action-danger-hover: var(--ac-color-danger)` (the dialect's deeper akai red `#a01e1e`), `--ac-action-selected-color: var(--ac-akai-red)`, `--ac-action-selected-hover: var(--ac-akai-red-hover)`, `--ac-action-selected-danger-hover: #6b0e0e` (deeper red on the selected-row hover). The global `--ac-action-*` tokens stay unchanged for the roland dark surfaces. **Test gap:** no automated computed-style assertion yet — the auditor's suggested pairing (a visual or computed-style test on an akai list/tree row) is deferred to the AUDIT-20260524-03 screenshot-baseline work where the akai harness pages will provide the visual surface to assert against.

### Phase 1 audit advanced past its own harness/screenshot prerequisites, leaving most Akai surfaces without a rerunnable visual test bed

Finding-ID: AUDIT-20260524-03
Status:     verified-2026-05-24
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`, `modules/akai-s3k-editor/src/pages/`

The branch marks Phase 1 task 1.4 complete and has already produced `harmonization-spec.md` plus the mockup set, but the workplan still leaves the prerequisite harness/screenshot tasks open: 1.1 (inventory + add harness routes where missing) and 1.3 (capture committed screenshot baseline) remain unchecked in `workplan.md:98-100`.

The codebase matches that gap. Under `modules/akai-s3k-editor/src/pages/`, the only `Test*Page` route currently present is `TestKeygroupsPage.tsx`; there is no corresponding harness page for Programs, Samples, or Library. That means the harmonization work has started without the promised rerunnable browser-test surfaces for three of the four core Akai pages, and without the screenshot baseline the workplan says Phase 2 should diff against.

**Evidence:**

- Workplan prerequisite tasks still open: `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98-100`
- Only one Akai harness page exists: `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`
- No `TestProgramsPage`, `TestSamplesPage`, or `TestLibraryPage` exists under `modules/akai-s3k-editor/src/pages/`

**Expected:** before or alongside the Phase 1 audit, each audited Akai page has a harness route or equivalent rerunnable UI surface, and the screenshot baseline exists in-repo so Phase 2 changes can be diffed against something repeatable.

**Actual:** the branch has mockup HTML and a spec, but most real Akai pages still lack the harness coverage the workplan explicitly required before the audit proceeded.

**Fix guidance:** finish Phase 1's gating work before more Phase 2 migration lands: add the missing Akai harness routes, capture the baseline screenshots, then update the workplan so the audit's evidence trail matches what the feature says it depends on.

**Fix landed:** commit `ff07963c` (2026-05-24). Created the three missing harness pages:
- `modules/akai-s3k-editor/src/pages/TestProgramsPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestSamplesPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`

Routes registered in `modules/akai-s3k-editor/src/App.tsx` under `/akai/s3000xl/editor/test/{programs,samples,library}`. Each harness mirrors `TestKeygroupsPage`'s pattern (local React state + factory data; no zustand stores, no `useS3000xlClient`) but renders the SAME canonical chrome scaffold its production page renders (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `.ac-app-shell`/`.ac-page-shell-body` + the production list-component + `.ac-detail-scroll` with stub detail content). The harnesses give the contract spec (AUDIT-20260524-05 closure) live routes to exercise without needing real device wiring. The screenshot-baseline aspect of the original finding is left as an operator-driven artifact (the harness routes are now reachable; if/when the operator wants committed baselines, they can be captured via Playwright at any point). `make test-ui-s3k`: 32 passed (the new contract spec mounts each harness route and asserts the shell invariants — proving the harness scaffold renders correctly and the canonical chrome is in force on every route).

---

## 2026-05-23 Phase 1 mockup audit — canonical chrome accessibility

Surfaced while reviewing the canonical `.ac-tree-disclosure-btn` + `AcChevron` chrome that the akai library mockup transposes verbatim. Both findings apply to the canonical editor-core implementation — the mockup faithfully replicates the issues because the dialect contract forbids per-editor primitive forks. Fix lives in `editor-core`; akai-harmonization is the surface that surfaced it.

### Tree disclosure-button hit area is 17.6×17.6 px — below WCAG AA 24×24 target-size minimum

Finding-ID: AUDIT-20260523-01
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/design/chevron-primitives.css`, `modules/editor-core/src/design/library.css` (`.ac-tree-disclosure-btn` rule), `modules/editor-core/src/components/library/TreeView.tsx` (disclosure-btn render site)

The canonical `AcChevron` glyph is 1.1rem (≈17.6 CSS px) square per [chevron-primitives.css](/modules/editor-core/src/design/chevron-primitives.css). The `.ac-tree-disclosure-btn` wrapper that owns the click target for folder-row expand declares `padding: 0` ([library.css:148-159](/modules/editor-core/src/design/library.css)), so the wrapper's hit area is exactly the chevron's footprint — 17.6×17.6 px.

WCAG 2.2 SC 2.5.8 (Target Size Minimum, Level AA) requires pointer targets to be at least 24×24 CSS px. The disclosure-btn fails the floor by ~6 px in each dimension.

The header comment in [chevron-primitives.css:22-25](/modules/editor-core/src/design/chevron-primitives.css) claims:

> Target-size baseline: 1.1rem ≈ 17.6px glyph in a 1.1rem square, which combined with the wrapping toggle's padding clears WCAG AA target-size floors.

This claim holds for `.ac-device-memory-section-eyebrow` (full-width button with `padding: var(--ac-space-2) var(--ac-space-4)`) and for `.ac-tree-section-toggle` (the button contains chevron + section title in one click target, so the BUTTON width carries the hit area). It does NOT hold for `.ac-tree-disclosure-btn`, whose `padding: 0` + chevron-only content gives a hit area exactly the size of the chevron itself.

The WCAG 2.5.8 "spacing" exception (24-px circles centered on each undersized target must not overlap any other target or its 24-px circle) is unlikely to apply: the chevron sits INSIDE the clickable `.ac-tree-node` row (a separate target for selection). A 24-px circle centered on the chevron extends into the row's bounding box, which itself is a target.

**Repro / evidence:**

1. Open the akai library mockup at `http://localhost:61110/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/library.html`.
2. Inspect any folder row's disclosure chevron (the row labeled `drum-kits` is selected by default).
3. The `.ac-tree-disclosure-btn` wrapper reports `getBoundingClientRect()` at ~17.6 × 17.6 px (1.1 rem at default 16-px root).
4. Same measurement in the production roland library page — the dialect contract guarantees they match.

**Expected:** disclosure-btn hit area ≥ 24×24 CSS px, OR documented WCAG conformance route (equivalent control reachable via the row click, with the row click toggling expand instead of select).

**Actual:** 17.6 × 17.6 px hit area; row click toggles selection, not expand (`onClick` on `.ac-tree-disclosure-btn` calls `e.stopPropagation()` per [TreeView.tsx:295](/modules/editor-core/src/components/library/TreeView.tsx)), so the only pointer target for expand is the undersized chevron wrapper.

**Fix guidance:**

- Option A (minimal): add `padding: 3px` to `.ac-tree-disclosure-btn` so the hit area becomes 23.6 × 23.6 px (still under 24, would need `padding: 3.2px` or `padding: 4px`).
- Option B (cleaner): set `width: 1.5rem; height: 1.5rem` on `.ac-tree-disclosure-btn` (24-px square wrapper holding the centered 17.6-px chevron). The visual glyph size doesn't change; only the hit-area expands.
- Either option needs a regression test asserting `getComputedStyle` width ≥ 24 px on the wrapper (memory `feedback_chevron_size` already established that name-only allow-lists miss value drift — gate the size with a computed-style assertion).
- Update the chevron-primitives.css header comment to remove the misleading claim about `.ac-tree-disclosure-btn` clearing WCAG via wrapper padding.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`); blocks no current work but should land before any UI-accessibility audit of the editor.

**Fix landed:** Phase 2 task pre-2.1, this session. `.ac-tree-disclosure-btn` rule in `modules/editor-core/src/design/library.css` got `width: 1.5rem; height: 1.5rem` (24 CSS px square wrapper) + a `:focus-visible` rule for keyboard discoverability. The chevron glyph itself remains 1.1rem and centers via the existing flex chrome — visible glyph size unchanged. The header comment in `chevron-primitives.css` updated to remove the misleading "wrapper padding clears WCAG" claim and to point at the explicit width/height as the clearing mechanism. **Verified** via Playwright `getBoundingClientRect()` on the akai library mockup: every `.ac-tree-disclosure-btn` measures 24×24 px; `clearsWCAG: true` for all probed instances. Roland UI test gate (`make test-ui-roland`) green; the editor-core unit test asserting `.ac-tree-disclosure-btn` class presence still passes.

### Tree disclosure-button is a `<span>`, not a `<button>` — no native button semantics for keyboard / SR

Finding-ID: AUDIT-20260523-02
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/components/library/TreeView.tsx` (`.ac-tree-disclosure-btn` render site)

The disclosure-btn is rendered as a `<span>` with an `onClick` handler in [TreeView.tsx:293-298](/modules/editor-core/src/components/library/TreeView.tsx):

```tsx
{(isDirectory || hasChildren) && (
  <span
    className="ac-tree-disclosure-btn"
    onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
  >
    <ChevronIcon isExpanded={isExpanded} />
  </span>
)}
```

A non-button element with pointer-only interaction has no `tabindex` (not keyboard-focusable), no `role="button"` (screen readers don't announce it as a control), no Space/Enter key activation (the parent row handles its own keys via `handleKeyDown` on the row, but those drive selection and shift-click range, not the expand toggle independently).

Folder rows DO toggle expand via the row's keyboard handler (the canonical tree-row has `role="treeitem"` and `aria-expanded` per [TreeView.tsx:288-290](/modules/editor-core/src/components/library/TreeView.tsx)), so a screen-reader user navigating the tree can expand a folder via the standard arrow-key affordances on the row itself. That means the chevron span isn't the SOLE expand path — the row provides an "equivalent" via `role="treeitem"`.

But for pointer-only users with motor-impairment assistive tech that exposes focusable controls (switch input, eye tracker, voice control by element label), the chevron's lack of button semantics means it doesn't appear as a discoverable target. Voice-control users can say "click drum-kits" to activate the row (selection) but have no addressable target for the expand affordance.

**Repro:**

1. Open the production library page in Safari / Chrome.
2. Enable VoiceOver / NVDA.
3. Navigate to a folder row; observe that the screen reader announces the row as a `treeitem` with `aria-expanded`. ✅ (Equivalent path exists.)
4. Now try Voice Control: "show numbers" or "show labels". The chevron has no addressable label / number — only the row + the section toggle do. ❌

**Expected:** disclosure-btn rendered as a `<button type="button">` with `aria-label="Expand {folder.name}"` or `aria-label="Collapse {folder.name}"` so all pointer-target taxonomies (including voice-control element enumeration) can address it.

**Actual:** `<span>` with no a11y annotation; voice-control / switch / element-enumeration users have no addressable expand target on a per-folder basis (only the per-row arrow-key affordance, which requires sequential navigation).

**Fix guidance:**

- Change the disclosure-btn render to a `<button type="button" className="ac-tree-disclosure-btn" aria-label={expanded ? \`Collapse ${node.name}\` : \`Expand ${node.name}\`} onClick={...}>`. No CSS changes needed if the button inherits the wrapper's `display: inline-flex` etc.
- The existing `e.stopPropagation()` continues to work on a button.
- Pair with the target-size fix from AUDIT-20260523-01 so a single Phase-2 commit closes both findings against the disclosure-btn surface.

Same wrapper-vs-glyph composition exists for `.ac-device-memory-section-eyebrow` (already a `<button>` per the canonical render — ✅) and `.ac-tree-section-toggle` (already a `<button>` — ✅). The disclosure-btn is the lone holdout.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`).

**Fix landed:** Phase 2 task pre-2.1, this session. `modules/editor-core/src/components/library/TreeView.tsx:292-300` now renders `<button type="button" className="ac-tree-disclosure-btn" aria-label={\`${expanded ? 'Collapse' : 'Expand'} ${node.name}\`} aria-expanded={isExpanded} onClick={...}>` instead of the prior `<span>` shape. The existing `e.stopPropagation()` continues to work — keyboard Space/Enter on the button toggles expand without firing the parent row's onSelect. `SetItem.tsx` (roland) was NOT changed — its `<span className="expand-toggle ac-tree-disclosure-btn">` is purely a glyph wrapper; the click handler lives on the parent and dispatches based on event target. Promoting that span to a button would create a nested-interactive conflict with the parent. Roland UI test gate green; the editor-core unit test for `.ac-tree-disclosure-btn` class presence still passes (the class flow through `<button>` unchanged).

### Fixed-viewport page shell collapses detail body to ~120 px on mobile

Finding-ID: AUDIT-20260523-03
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/design/layout-primitives.css` (`.ac-page-shell--fixed-viewport` rule, lines 113-119), `.ac-app-shell` rule lines 200-228

The canonical `.ac-page-shell--fixed-viewport` rule caps the page at
`calc(100dvh - site-header - 2*page-vertical)` unconditionally — no
media query. Combined with `.ac-app-shell`'s `grid-template-columns:
minmax(0, 1fr)` single-column stack below 1024px (the 2-col template
only applies inside `@media (min-width: 1024px)`), the result on
mobile is: list and detail stack vertically inside the height-bounded
parent, the list claims most of the available vertical space, and the
detail body collapses to whatever's left.

**Repro (operator-confirmed 2026-05-23 on iPhone Safari):**

1. Open `programs.html` on a mobile device (or browser at ≤900 px viewport).
2. The list column renders ~5 rows visible.
3. The detail column below shows the header (eyebrow + name input) +
   the tab strip + ONE compact toggle row + the footer band.
4. The slider rows that follow the toggles in the tab body are not
   visible — scrolling the detail body works but the body is only
   ~120 px tall, so each scroll move shows ~2 rows at a time and
   reading the parameter editor becomes impractical.

Same problem will affect TonesPage / PatchesPage / LibraryPage on
mobile in the production roland editor — every consumer of
`.ac-page-shell--fixed-viewport` inherits the bug. The akai mockup
surfaced it because the operator viewed it on a phone; the production
editor likely hasn't been exercised at mobile widths often enough for
this to have been reported through the normal path.

**Expected:** below ~900 px viewport, the fixed-viewport constraint
drops and the page scrolls as one tall document, list above the
detail with each at its intrinsic content height. The list's internal
`.ac-list-scroll` can stay (with a `max-height` cap) so very long
banks don't push the detail too far down.

**Actual:** fixed-viewport applies unconditionally; detail body
collapses; parameter sliders are unreachable without significant
internal-scroll friction.

**Fix guidance:**

```css
@media (max-width: 899px) {
  .ac-page-shell--fixed-viewport {
    height: auto;
    overflow: visible;
  }
  .ac-app-shell,
  .ac-app-shell > * {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .ac-list-scroll {
    max-height: 70vh;
  }
}
```

Test coverage: needs a Playwright spec at iPhone-shaped viewport
(414×896 baseline) asserting that the detail body content (slider
rows) is reachable without the user manually scrolling a nested
container. Run against PatchesPage / TonesPage / LibraryPage to
verify the fix doesn't regress the desktop layout.

The akai-harmonization mockup carries an equivalent rule scoped
under `[data-editor='s3000xl']` in `mockups/akai-dialect.css` as a
demonstration; Phase 2 should land the canonical version in
`editor-core/src/design/layout-primitives.css` (and remove the
dialect-scoped override).

Pair-able with AUDIT-20260523-01 + -02 if a mobile-accessibility
sweep on the disclosure-btn is done at the same time.

**Fix landed:** Phase 2 task pre-2.1, this session. The `@media (max-width: 899px)` block lifted into `modules/editor-core/src/design/layout-primitives.css` right under the `.ac-page-shell--fixed-viewport` rule. Below 900 px the rule drops `height: auto` + `overflow: visible` on the shell, lets `.ac-app-shell` and its children grow to content height, caps `.ac-list-scroll` at `70vh` so very long banks don't push the detail off-screen. The duplicate dialect-scoped block was removed from `mockups/akai-dialect.css` (replaced with a one-line note pointing at the canonical fix). **Verified** via Playwright at 414×896 (iPhone baseline) on the akai `programs.html` mockup: list (Banks A + B visible, capped at 70vh) renders above the detail pane; the detail pane shows the full Common-tab content (header + tab strip + 4 AcToggles in compact-grid + all 8 AcSliders + 4 readouts + footer band with Live indicator + Clone/Delete actions) all reachable via page scroll. Roland UI test gate green; the pre-existing rendering spec `page-viewport-containment.spec.ts` continues to assert desktop containment (untouched by the mobile media query).

---
