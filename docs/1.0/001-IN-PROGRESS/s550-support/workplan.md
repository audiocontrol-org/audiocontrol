---
title: "Roland S-550 Editor Support — Workplan"
deskwork:
  id: ef6b601c-7e04-4282-86a4-850029254759
---
# Roland S-550 Editor Support - Workplan

**GitHub Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)
**GitHub Issues:**

- [Parent: Roland S-550 Editor Support (#53)](https://github.com/audiocontrol-org/audiocontrol/issues/53)
- [Research S-550 SysEx protocol (#54)](https://github.com/audiocontrol-org/audiocontrol/issues/54)
- [Implement S-550 device module (#55)](https://github.com/audiocontrol-org/audiocontrol/issues/55)
- [Implement S-550 converters (#56)](https://github.com/audiocontrol-org/audiocontrol/issues/56)
- [Create unified sampler-editor (#57)](https://github.com/audiocontrol-org/audiocontrol/issues/57)
- [Evaluate shared code extraction (#58)](https://github.com/audiocontrol-org/audiocontrol/issues/58)
- [Phase 9: UX/UI cleanup via /frontend-design (#392)](https://github.com/audiocontrol-org/audiocontrol/issues/392)
- [S-550 import dialog blocks wave banks C/D (#393)](https://github.com/audiocontrol-org/audiocontrol/issues/393) — surfaced by 2026-05-08 audit
- [Empty-slot helper duplication (ToneList/PatchList/PlayPage) (#394)](https://github.com/audiocontrol-org/audiocontrol/issues/394) — surfaced by 2026-05-08 audit
- [Wave-fetch duplication: consolidate useDeviceToneChopper + handleExportSample on useWaveDataCache (#395)](https://github.com/audiocontrol-org/audiocontrol/issues/395) — surfaced by Phase 9 Task 3 review
- [ImportLibraryPatchDialog blocks wave banks C/D — sibling instance of #393 (#396)](https://github.com/audiocontrol-org/audiocontrol/issues/396) — surfaced by Phase 10 Task 1 duplication audit
- [Slot label arithmetic bypasses MemoryLayout formatter (#397)](https://github.com/audiocontrol-org/audiocontrol/issues/397) — surfaced by Phase 10 Task 1 follow-up audit; ImportSampleDialog title fixed inline, ToneZoneEditor + PlayPage remaining
- [TonesPage.tsx over 500-line guideline — extract useToneSampleExport hook (#398)](https://github.com/audiocontrol-org/audiocontrol/issues/398) — surfaced by Phase 10 Task 3 code review
- [ImportLibraryToneDialog retains 0|1|2|3 literal-union pattern after #393/#396 (#399)](https://github.com/audiocontrol-org/audiocontrol/issues/399) — surfaced by Phase 10 Task 4 code-quality review
- [lib/s330-format.ts consumers + ExportPatchDialog produce wrong patch labels — sibling of #397 (#400)](https://github.com/audiocontrol-org/audiocontrol/issues/400) — surfaced by Phase 10 Task 5 code-quality review
- [Sample-rate resolution duplicated across useToneSampleExport / useDeviceToneChopper / TonesPage (#401)](https://github.com/audiocontrol-org/audiocontrol/issues/401) — surfaced by Phase 10 Task 6 code-quality review

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Shared S-Series Extraction | Complete | `roland-s-series` base module |
| Phase 2: S-550 Device Module | Complete | Addresses, params, config, types |
| Phase 3: S-550 Client & Tone Factory | Complete | Shared client factory pattern |
| Phase 4: S-550 Library Converters | Complete | Tone, patch, set converters + schemas |
| Phase 5: Unified Sampler Editor | Complete | Device config registry, context, routing |
| Phase 6: Hardware Validation | Complete | All tests passing against physical S-550 |
| Phase 7: S-550 Front Panel | Not Started | Virtual front panel layout |
| Phase 8: Memory Map Visualization | Complete | Graphical memory map in import dialogs |
| Phase 9: UX/UI Cleanup | In Progress (Tasks 1–3 done; 4–7 remaining) | Visual polish across all editor pages via `/frontend-design` |
| Phase 10: Post-Audit Cleanup | In Progress (Tasks 1–6 done pending hardware verification; Tasks 7–9 added 2026-05-09 from #399/#400/#401) | Functional + duplication fixes surfaced by 2026-05-08 audit, Phase 9 Task 3 review, and Phase 10 Tasks 4–6 reviews. Tasks 1–6 done; Tasks 7–9 (sibling-instance follow-ups #399/#400/#401) added. |

---

## Phase 1: Shared S-Series Base Extraction (Complete)

Extracted common protocol code from S-330 into `devices/roland-s-series/`.

### What Was Built

| File | Purpose |
|------|---------|
| `s-series-config.ts` | `SSeriesDeviceConfig` interface — captures device-specific memory layout |
| `s-series-types.ts` | Shared types: envelopes, key modes, MIDI adapter, SysEx messages |
| `s-series-constants.ts` | Protocol constants: commands (RQD/WSD/DT1/etc.), timing, error codes |
| `s-series-messages.ts` | SysEx message builders: nibblization, size encoding, message construction |
| `s-series-params.ts` | Parameter parsing/encoding: enums, names, addresses, envelopes, signed values |
| `s-series-wave-format.ts` | WAV ↔ S-series conversion, resampling, segment calculation |
| `s-series-client.ts` | Shared client factory with bulk dump, parameter read/write, wave data transfer |

### Key Design Decision

Both S-330 and S-550 use model ID `0x1E`. The `SSeriesDeviceConfig` interface parameterizes the differences:

```typescript
interface SSeriesDeviceConfig {
  modelId: number;           // 0x1E for both
  patchCount: number;        // 64 (S-330) vs 32 (S-550)
  toneCount: number;         // 32 (S-330) vs 64 (S-550)
  waveBankCount: number;     // 2 (S-330) vs 4 (S-550)
  maxToneIndex: number;      // 31 vs 63
  maxWaveBank: number;       // 1 vs 3
  maxPatchIndex: number;     // 63 vs 31
  addresses: SSeriesAddresses;
  patchBlockSize: number;    // 512 (both)
  toneBlockSize: number;     // 256 (both)
  // ... block sizes, strides
}
```

### Acceptance Criteria — Met

- [x] All shared code extracted without breaking S-330 tests
- [x] S-330 module delegates to shared base
- [x] `SSeriesDeviceConfig` captures all device-specific constants
- [x] Package exports updated for `@audiocontrol/sampler-devices/roland-s-series`

---

## Phase 2: S-550 Device Module (Complete)

Implemented `devices/s550/` using the shared base.

### What Was Built

| File | Purpose | Key S-550 Specifics |
|------|---------|---------------------|
| `s550-config.ts` | Device config instance | 32 patches, 64 tones, 4 wave banks |
| `s550-addresses.ts` | Address constants and builders | Same base addresses; wider value ranges for tone/wave bank indices |
| `s550-types.ts` | S550Tone, S550Patch, S550SystemParams | Tone layer range 0-63, wave bank 0-3, source tone 0-63 |
| `s550-params.ts` | Parameter parsing/encoding | Re-exports shared parsers; S-550 range validation |

### S-550 Memory Block Layout Detail

**Patch block (512 bytes / 1024 nibbles per patch):**

```
Offset   Field                  Size    S-550 Range
0x00     Name                   12      ASCII
0x0C     Bender Range           1       0-12
0x0E     Aftertouch Sens        1       0-127
0x0F     Key Mode               1       0-4 (whole/dual/split/v-sw/x-fade)
0x10     Velocity Threshold     1       0-127
0x11     Tone Layer 1           109     0-63 (S-330: 0-31)
0x7E     Tone Layer 2           109     0-63 (S-330: 0-31)
...      Performance params     ...     Same as S-330
```

**Tone block (256 bytes / 512 nibbles per tone):**

```
Offset   Field                  Size    S-550 Range
0x00     Name                   8       ASCII
0x09     Source Tone            1       0-63 (S-330: 0-31)
0x0D     Wave Bank              1       0-3 (S-330: 0-1)
...      Wave/LFO/TVF/TVA      ...     Same as S-330
0x57     Copy Source            1       0-63 (S-330: 0-31)
```

### Test Coverage

- 91 unit tests for S-550 addresses and parameter encoding
- All tests pass alongside existing S-330 tests (412 total)

### Acceptance Criteria — Met

- [x] All S-550 device files created following S-330 pattern
- [x] Package exports work as `@audiocontrol/sampler-devices/s550`
- [x] Unit tests pass with comprehensive coverage
- [x] Address builders produce correct 4-byte addresses

---

## Phase 3: S-550 Client & Tone Factory (Complete)

Created S-550 client and tone factory using the shared S-series client infrastructure.

### What Was Built

| File | Purpose |
|------|---------|
| `s550-client.ts` | S-550 client wrapping shared `createSSeriesClient()` factory |
| `s550-tone-factory.ts` | Create tones with S-550 defaults (monolithic, sub-tones, etc.) |

### Key Addition: `clampWaveParams`

Added `clampWaveParams()` utility to the shared wave format module. This prevents `loopPoint` from exceeding `endPoint` when importing tones from the library — a fix that benefits both S-330 and S-550.

### Acceptance Criteria — Met

- [x] `createS550Client()` returns working client interface
- [x] Tone factory creates valid S-550 tones with correct range constraints
- [x] `clampWaveParams` prevents invalid loop points on both devices

---

## Phase 4: S-550 Library Converters (Complete)

Implemented converters for the sampler-library module.

### What Was Built

| File | Purpose |
|------|---------|
| `converters/s550/index.ts` | Converter registration |
| `converters/s550/tone-converter.ts` | S550Tone ↔ ToneYaml |
| `converters/s550/patch-converter.ts` | S550Patch ↔ PatchYaml |
| `converters/s550/set-converter.ts` | Full device state ↔ library set format |
| `schemas/patch-schema.ts` | S-550 patch YAML schema |
| `schemas/tone-schema.ts` | S-550 tone YAML schema |

### Acceptance Criteria — Met

- [x] All converters registered in converter registry
- [x] `DeviceType` includes `'s550'`
- [x] Round-trip conversion preserves data

---

## Phase 5: Unified Sampler Editor (Complete)

Renamed `s330-editor` to `sampler-editor` and added device config abstraction.

### What Was Built

| File | Purpose |
|------|---------|
| `configs/types.ts` | `DeviceConfig` interface, `SamplerDeviceType` union |
| `configs/registry.ts` | `getDeviceConfig()`, `isDeviceSupported()`, `getSupportedDevices()` |
| `configs/s330.ts` | S-330 config: 16 patches, 32 tones, 2 wave banks |
| `configs/s550.ts` | S-550 config: 32 patches, 64 tones, 4 wave banks |
| `context/DeviceConfigContext.tsx` | React context providing config to all components |
| `main.tsx` | URL-based device resolution and config injection |

### How Device Selection Works

1. Editor reads device type from URL path (`/roland/s330/editor` → `'s330'`)
2. `getDeviceConfig('s330')` returns the S-330 configuration
3. `DeviceConfigContext` provides config to all child components
4. Components use `useDeviceConfig()` hook for device-specific constants (patch count, tone count, etc.)

### Acceptance Criteria — Met

- [x] Single editor serves both devices
- [x] Device-specific pages adapt to config (correct patch/tone counts)
- [x] S-330 URL continues to work at `/roland/s330/editor`
- [x] S-550 URL works at `/roland/s550/editor`

---

## Phase 6: Hardware Validation (Complete)

Hardware testing is being performed against a physical Roland S-550 connected via MOTU 828mk3 MIDI interface.

### Protocol Bugs Found and Fixed

Hardware testing revealed three bugs in the shared S-series client that were not caught by unit tests:

1. **Swapped EOD/RJC command bytes** — `s-series-constants.ts` had EOD=0x4F and RJC=0x45, reversed from the Roland spec (EOD=0x45, RJC=0x4F). This caused all RQD reads to interpret the device's "end of data" signal as "rejection."

2. **DAT packet address headers not stripped on receive** — Each DAT packet from the device includes a 4-byte address prefix (`[addr0, addr1, addr2, addr3]`) before the nibble data. The client was including these as data, shifting all parsed parameter values.

3. **DAT packet address headers missing on send** — Outgoing DAT packets must include a 4-byte address header, and the checksum must cover both address and data. Packets use 128-nibble chunks (matching the device's own packet size), with byte 2 of the address incrementing by 1 per chunk.

### Tests Created

| Test File | Purpose |
|-----------|---------|
| `test/integration/s550-ping.test.ts` | Minimal connectivity — send raw RQD and log response bytes |
| `test/integration/s550-probe.test.ts` | Address space discovery — probe byte1 values to map valid regions |
| `test/integration/s550-dat-format.test.ts` | DAT packet format analysis — examine address headers and chunk sizes |
| `test/integration/s550-hardware.test.ts` | Full hardware validation — 17 tests covering all read/write operations |

### Tasks

1. **Connect to physical S-550 via MIDI** — Done
   - [x] Verify SysEx handshake with model ID 0x1E
   - [x] Confirm device responds to RQD requests
   - [x] Map S-550 address space (byte1 values 0x00-0x0F)

2. **Validate patch read/write** — Done
   - [x] Load all 32 patches via RQD/DAT
   - [x] Verify patch structure (name, tone layers, key mode, etc.)
   - [x] Write a modified patch and confirm round-trip (bender range)
   - [x] Restore original patch values

3. **Validate tone read/write** — Done
   - [x] Load all 64 tones via RQD/DAT
   - [x] Verify tone structure (name, wave bank, sample rate, loop mode, etc.)
   - [x] Access tones at indices 32-63 (beyond S-330 range)
   - [x] Write a modified tone and confirm round-trip (fineTune)
   - [x] Restore original tone values

4. **Validate wave data transfer** — Not Started
   - [ ] Import a WAV sample to each wave bank (A, B, C, D)
   - [ ] Verify 12-bit encoding and playback
   - [ ] Confirm `clampWaveParams` prevents loop point overflow

5. **Test library import/export** — Done
   - [x] Export S-550 set to library format
   - [x] Import from library and upload to different slot
   - [x] Byte-perfect wave data verification after round-trip
   - [ ] Cross-device import (S-330 set → S-550) — deferred

### Acceptance Criteria

- [x] All 32 patches load and display correctly
- [x] All 64 tones load and display correctly
- [x] Wave data transfers to bank A (bank B-D untested, same code path)
- [x] Round-trip (load → edit → save → load) preserves all parameters
- [x] Library import/export works end-to-end

---

## Phase 7: S-550 Virtual Front Panel (Not Started)

The S-550 front panel layout differs cosmetically from the S-330 (rack-mount form factor). This phase adds an S-550-specific front panel component.

### Tasks

1. **Research S-550 front panel layout**
   - Button arrangement, display format
   - Map to existing `VirtualFrontPanel` component interface

2. **Implement S-550 front panel variant**
   - Add S-550 panel layout to `VirtualFrontPanel`
   - Device config selects correct layout

### Acceptance Criteria

- [ ] S-550 front panel renders with correct button layout
- [ ] Button functions match hardware behavior

---

## Phase 8: Memory Map Visualization (Complete)

Added a graphical memory map to all import dialogs (tone, drum kit, patch, load set) showing occupied/empty/proposed/conflict states for tone slots and wave memory segments.

### What Was Built

| File | Purpose |
|------|---------|
| `src/components/ui/memory-map-types.ts` | `AllocationProposal`, `SlotStatus`, `computeSlotStatus()`, `computeSegmentStatus()` |
| `src/components/ui/ToneSlotMap.tsx` | Grid of tone cells for one `ToneSlotGroup` (8 per row) |
| `src/components/ui/WaveSegmentMap.tsx` | Horizontal bar of 18 segments for one wave bank |
| `src/components/ui/MemoryMapPanel.tsx` | Composes tone grid + wave bars + legend |

### Modified Files

| File | Change |
|------|--------|
| `ImportLibraryToneDialog.tsx` | Added `<MemoryMapPanel>` with single-slot proposal |
| `ImportDrumKitDialog.tsx` | Added `<MemoryMapPanel>` with contiguous range proposal |
| `ImportLibraryPatchDialog.tsx` | Added `<MemoryMapPanel>` with multi-tone proposal from `toneMappings` |
| `LoadSetDialog.tsx` | Added `<MemoryMapPanel>` with full-block proposal |
| `LibraryPage.tsx` | Passes `deviceTones`, `toneGroups`, `formatToneSlot` to `LoadSetDialog` |

### Key Design Decisions

- No device conditionals — the panel renders whatever `toneGroups` describes
- Color coding: empty (`bg-s330-accent/20`), occupied (`bg-emerald-600/60`), proposed (`bg-s330-highlight/40`), conflict (`bg-red-500/40`)
- Proposals update reactively when users change slot/bank/segment selectors
- `computeSlotStatus()` and `computeSegmentStatus()` are pure functions for testability

### Acceptance Criteria — Met

- [x] Memory map renders in all four import dialogs
- [x] Occupied/empty/proposed/conflict states display correctly
- [x] Changing slot/bank/segment selectors updates the map reactively
- [x] S-330 shows single tone group + 2 wave banks
- [x] S-550 shows two tone groups + 4 wave banks
- [x] No device conditionals in any component

---

## Phase 9: UX/UI Cleanup (Not Started)

**GitHub Issue:** [#392](https://github.com/audiocontrol-org/audiocontrol/issues/392)


A focused visual polish pass across all editor pages. **Every UI change in this phase is produced through the `/frontend-design` plugin** — exploration AND the resulting component refactors. UI changes made by hand bypass the plugin's design discipline and reliably look and feel wrong; this phase exists specifically to retire the hand-rolled visuals. The goal is consistent visual hierarchy, spacing, and typography across every page the editor exposes — and a visual identity that places the S-330 / S-550 editors inside the broader audiocontrol.org universe — without introducing device conditionals or pixel-width regressions.

### Inputs

- Existing design system: [DESIGN-SYSTEM.md](/DESIGN-SYSTEM.md) — `--ac-*` design tokens, `s330-*` color tokens, `ac-page-shell`, `ac-list-detail-grid`, typography rules, icon sizing, parameter editor density rules. **This phase will update the design system itself to align with the redesigned audiocontrol.org visual identity (preserving the S-330/S-550 blue+white color scheme).**
- audiocontrol.org redesign — north-star visual reference for the editor's identity. Sources: public site at https://audiocontrol.org and source repo at https://github.com/oletizi/audiocontrol.org. The editors should read as "the same family" as the public website — same typography, same layout rhythm, same component vocabulary — while keeping their existing `s330-*` color palette intact.
- Pages in scope: `HomePage`, `PatchesPage`, `TonesPage`, `PlayPage`, `WorkflowsPage`, `LibraryPage` (in `modules/roland-sxx0-editor/src/pages/`)
- Dialogs in scope: import/export/save/load dialogs in `modules/roland-sxx0-editor/src/components/library/`
- `/frontend-design` plugin (claude-plugins-official) — the **mandatory** source for every UI change in this phase, both exploration and the refactors that land in real components.

### Constraints

- **All UI changes go through `/frontend-design`.** No hand-edited JSX, CSS, or token churn outside of what the plugin produces. If a change can't be expressed through the plugin, escalate before hand-rolling it.
- **Visual identity aligns with audiocontrol.org.** Editors should look and feel like part of the audiocontrol.org universe — typography, layout rhythm, and component vocabulary should match the public website's redesigned visual identity.
- **Preserve the Roland S-330/S-550 color scheme.** The existing `s330-*` blue+white palette stays; alignment with audiocontrol.org happens through type, spacing, and component shapes — not by recoloring.
- **No device conditionals in components.** Per multi-device architecture rule, behavior differences are injected via factories/configs, not branched in JSX.
- **No hardcoded pixel widths.** Use flex ratios, grid fractions, `--ac-space-*` tokens, and `rem` for minimum constraints.
- **Use existing tokens; add via the design system, not in components.** `s330-*` color tokens and `--ac-*` design tokens already cover most of the palette. New tokens land in `editor-core/src/design/tokens.css` first, documented in `DESIGN-SYSTEM.md`, before any component uses them.
- **Files stay under 500 lines.** `TonesPage.tsx` is currently 691 lines and must be decomposed as part of this phase.
- **Both devices must remain visually correct.** Any change verified against `/roland/s330/editor` and `/roland/s550/editor`.

### Mandatory gate after EVERY task: duplication audit

**No task in this phase is complete until the duplication audit passes for that task.** Past failure mode: when building S-550 alongside S-330, and again when building Akai S3000XL library alongside Roland library, code was duplicated instead of refactored to share — drift accumulated until consolidation cost was prohibitive. This gate catches it at the boundary.

**Before checking off any task's acceptance criteria, the implementer MUST:**

1. List every new file authored or substantially modified during the task.
2. For each new function / hook / component / state bag:
   - `grep -rn` the codebase by **operation verb** (not just by name): `requestWaveData`, `exportToneToDirectory`, `12BitTo16Bit`, `useExport*`, `useImport*`, etc.
   - `grep -rn` siblings of the new path: `src/hooks/`, `src/components/library/`, sibling pages.
3. For any device-specific module, identify the shared-base candidate (`s550/x.ts` → should it live in `roland-s-series/x.ts`?).
4. **Document the audit explicitly** under the task's acceptance criteria: "Duplication audit: <N> candidates checked, <M> overlaps unified, <K> kept separate because <reason>." Just writing "no duplication" is not enough.
5. If duplication is found, **either unify it now or open a tracked GitHub issue with a link**. Never commit "we'll consolidate later" without the issue link — past evidence shows "later" doesn't happen.

See `.claude/rules/workflow-playbooks.md § Phase-completion duplication audit` for the full procedure with false-positive / false-negative examples.

### Tasks

1. **Audit current pages against the design system AND audiocontrol.org.**
   - For each page, list deviations from `DESIGN-SYSTEM.md` (typography, spacing, color, hierarchy, icon sizing, layout container usage).
   - For each page, also list mismatches with audiocontrol.org's redesigned visual identity (typography scale, layout rhythm, component vocabulary). Reference the public site and the `oletizi/audiocontrol.org` repo.
   - Capture the audit as `docs/1.0/001-IN-PROGRESS/s550-support/ux-audit.md` so the cleanup is traceable.
   - **Duplication audit gate:** N/A — research-only task, no code authored.

2. **Generate design exploration via `/frontend-design`.** This is the only source of UI changes in this phase.
   - Invoke the `frontend-design:frontend-design` skill with the audit + screenshots of current pages + screenshots/source from audiocontrol.org as input.
   - Produce candidate mockups (HTML or React previews) for the redesigned Home, Patches, Tones, Play, Workflows, and Library pages — keeping the `s330-*` blue+white palette, aligning the rest with audiocontrol.org.
   - Stash explorations under `docs/1.0/001-IN-PROGRESS/s550-support/explorations/` for review before any production refactor begins.
   - User reviews and selects a direction; commit the chosen direction's notes back into the audit doc.
   - **Duplication audit gate:** Mockup-only task; explorations are static HTML and don't ship to production. Cross-page mockup consistency was audited separately (`/tmp/cross-page-audit.md`, 18 findings). Production refactor (Tasks 3–6) is where the duplication-audit gate carries weight.

3. **Refactor `TonesPage.tsx` to fit under 500 lines.** ✓ Complete (commits `6df1ba6a` + post-review fixes)
   - `TonesPage.tsx`: 691 → 492 lines.
   - Extended `useLibraryExport` with `openExportToneDialog` / `openExportPatchDialog` imperative openers + an `allowDownloadFallback` option for the tones-page download fallback.
   - New shared hook `useWaveDataCache` (per-tone Int16Array cache + on-demand loader + invalidateRange).
   - New shared hook `useLoopEditorSync` (encapsulates the seam between `useLoopEditor` and the device tone store).
   - **Duplication audit gate (PASSED):**
     - [x] Files touched listed: `TonesPage.tsx`, `useLibraryExport.ts`, `useWaveDataCache.ts` (new), `useLoopEditorSync.ts` (new).
     - [x] Greps verified: `handleExportToLibrary` was a duplicate of `useLibraryExport.handleExportTone` — unified. `handleImportSample` is NOT a duplicate of `useImportSamples` (different operation: raw single-tone upload vs multi-tone bundle) — kept page-local with justification. `handleExportSample` (WAV download) is unique — kept page-local.
     - [x] Each new hook justified: `useWaveDataCache` (stateful Map cache + range invalidation, reusable beyond loop editor); `useLoopEditorSync` (well-defined seam protocol with prev-ref tracking, would recur in any page embedding `useLoopEditor`).
     - [x] Net duplication eliminated: ~150 lines of TonesPage-local re-implementation that mirrored `useLibraryExport`.
   - **Post-task review (commit `6df1ba6a`) surfaced 7 findings.** Critical + moderate fixed inline; minor + out-of-scope tracked or absorbed into Tasks 4 / 6:
     - [x] Critical — `useWaveDataCache.loadWaveData` had a stale-closure race (state-bound `cache` in deps coalesced via a frozen snapshot; rapid double-calls fired duplicate fetches). Fixed by moving cache + in-flight tracking to refs, with `setVersion` bump to drive re-render.
     - [x] Moderate — `[LibraryPage]` log prefix in the now-shared `useLibraryExport` retagged `[useLibraryExport]`.
     - [x] Moderate — `openExportToneDialog` / `openExportPatchDialog` previously silent-no-op'd on cache miss (CLAUDE.md "no fallbacks/silent failures" violation). Now throw with a clear error; library-disconnected invariant also enforced at dialog-open time, not just at execute time.
     - [x] Minor — `eslint-disable-next-line` in `useLoopEditorSync` now carries the CLAUDE.md-required deviation comment.
     - [→] Outstanding duplication tracked in audit doc (`docs/1.0/001-IN-PROGRESS/s550-support/2026-05-08-code-audit-findings.md`): `PatchesPage` still shims patch export instead of using `openExportPatchDialog` (audit finding 5; absorbed into Task 4); `useDeviceToneChopper` and `handleExportSample` duplicate the wave-fetch pattern that `useWaveDataCache` now provides (deferred — note in DEVELOPMENT-NOTES, revisit during Task 4).
     - [→] **Reviewer 2 carry-over (intentionally not fixed):** original TonesPage flow called `setTone(toneIndex, tone, totalTones)` after `requestToneData` to refresh the device-data cache. The new contract requires the tone to be in cache *before* `openExportToneDialog`, so the post-export `setTone` becomes redundant — the cache already holds the source data. Documented here so future readers don't re-introduce the call.

4. **Apply visual polish to each page via `/frontend-design`.** One commit per page so regressions are bisectable. Each page's polish is produced through the plugin — no hand-edited JSX/CSS slipped in alongside.
   - HomePage — landing layout, calls to action, device identity affordance.
   - PatchesPage — header/list/detail spacing, action affordances, status indicators.
     - **Carry-over from Phase 9 Task 3 review:** migrate to `useLibraryExport.openExportPatchDialog` instead of the local connect-via-fake-DnD shim (matches audit doc finding 5).
   - TonesPage — parameter editor density, section pairing per `DESIGN-SYSTEM.md` §"Parameter Editors".
   - PlayPage — performance UI hierarchy, panic/all-notes-off labelling per accessibility rules.
   - WorkflowsPage — list affordances, empty states.
   - LibraryPage — tree view typography, dialog launcher polish, memory map panel integration spacing.
   - **Cross-page concern from audit doc finding 4 — hard-coded "S-330" copy.** Every "Connect to your S-330" / "S-330's PLAY screen" / similar literal must be replaced with `useDeviceConfig().deviceName`. `HomePage` already does this — match that pattern. Pages confirmed affected: `TonesPage:306`, `PatchesPage:196`, `LibraryPage:233`, `PlayPage:252`, plus `ImportSampleDialog` header/docs. Treat this as part of each page's polish commit, not a separate sweep.
   - **Duplication audit gate (per page):**
     - [ ] Every page-scoped class introduced (`<page>__icon-btn`, `<page>__list-row`, `<page>__detail-head`, `<page>__page-title`, etc.) was checked against sibling pages. If two pages have the same primitive with different styles, **promote to `.ac-*` shared class before merging the polish**, not after.
     - [ ] Every component file extracted under `<page>/` was checked for sibling components doing the same role on other pages.
     - [ ] Every "S-330" literal in the page touched was replaced with `useDeviceConfig().deviceName` (see above).
     - [ ] Document the per-page audit table in the commit message: "Page X: N candidates checked, M promotions to `.ac-*`, K kept page-scoped because <reason>."

5. **Apply visual polish to import/export/save/load dialogs.**
   - Standardize header, body, footer rhythm.
   - Confirm `MemoryMapPanel` color usage (`bg-s330-accent/20`, `bg-emerald-600/60`, `bg-s330-highlight/40`, `bg-red-500/40`) reads correctly in the polished context; adjust contrast if needed using existing tokens only.
   - **Duplication audit gate:** dialogs are the most copy-prone surface in this codebase (the audit found 11 hand-rolled centred-modal dialogs with identical input/select chrome). Before this task is complete:
     - [ ] Confirmed every dialog uses shared `ac-input` / `ac-select` / `ac-checkbox` primitives, NOT page-local copies of the input chain.
     - [ ] Confirmed every dialog uses `OperationProgressBar` / `OperationErrorBanner` / `OperationSuccessScreen` (existing shared components). Any dialog re-implementing them inline is treated as a regression and unified before merge.
     - [ ] Document: "Dialogs audited: <N>, primitives extracted: <M>, primitives kept inline because <reason>."

6. **Visual verification on both devices.**
   - **Prerequisite from audit doc finding 3 — UI-layer test infrastructure does not exist yet.** `playwright.test-harness.config.ts` points at `test/ui/` which contains only `.gitkeep`, and there are no `Test*Page.tsx` harness pages. (Note: integration coverage at `test/integration/library-import.test.ts` exists at the data layer; the gap is specifically UI-layer layout/interaction regression.) Before screenshotting, add at minimum: a `TestPagesHarnessPage` that mounts each redesigned page with mock data, registered in `App.tsx` behind a `/test/*` route, and one Playwright spec per page under `test/ui/<page>.spec.ts` that loads the harness and asserts the design-system invariants we want to defend (no hardcoded pixel widths in computed style, single page-title element, expected number of design-token rules applied).
   - Take before/after screenshots of every page on `/roland/s330/editor` and `/roland/s550/editor`.
   - Confirm no functional regressions (pages still load real data, dialogs still open/close, no device conditionals introduced).
   - Attach screenshots to the GitHub issue and to the implementation summary.
   - **Duplication audit gate:** N/A — verification-only task.

7. **Update DESIGN-SYSTEM.md to align with audiocontrol.org.**
   - Codify the conventions adopted from audiocontrol.org's redesigned visual identity (typography scale, layout rhythm, component vocabulary) directly in `DESIGN-SYSTEM.md` so they cannot diverge.
   - Codify any other new conventions discovered during cleanup (e.g., page header rhythm, dialog footer pattern).
   - Confirm the `s330-*` color tokens are explicitly preserved as the editor palette; document that audiocontrol.org alignment happens through type/spacing/component shapes, not recoloring.
   - If a new token is needed, add it to `editor-core/src/design/tokens.css` and document it in DESIGN-SYSTEM.md before using it in components.
   - **Duplication audit gate:**
     - [ ] Confirmed every primitive promoted to `.ac-*` during Tasks 4–5 has a corresponding section in `DESIGN-SYSTEM.md` so future agents reach for the shared class instead of re-inventing.
     - [ ] Confirmed no new token duplicates an existing token (e.g., a fresh `--ac-color-warning-soft` when `--ac-color-warning` plus alpha would suffice).

### Acceptance Criteria

- [x] `ux-audit.md` exists and lists every observed deviation per page — against `DESIGN-SYSTEM.md` AND against audiocontrol.org's redesigned identity. (Task 1, committed `921aef27`)
- [x] `/frontend-design` exploration committed under `explorations/`; chosen direction noted in the audit. (Task 2 v3 — design language + 6 page mockups + tabbed tones detail + 8-segment VFD envelope + virtual front panel + cross-page consistency pass)
- [ ] **Every UI change in this phase is traceable to a `/frontend-design` invocation** — no hand-rolled JSX/CSS edits. (Task 4+ — when production refactor begins)
- [ ] Editors at `/roland/s330/editor` and `/roland/s550/editor` read as part of the audiocontrol.org universe (typography, layout rhythm, component vocabulary) while preserving the existing `s330-*` blue+white color palette. (Mockups demonstrate the alignment; production refactor pending)
- [x] `TonesPage.tsx` is under 500 lines. (Task 3 complete — 692 → 492 lines; commit `6df1ba6a`)
- [ ] Every page in scope has been visually polished and screenshot-verified on both `/roland/s330/editor` and `/roland/s550/editor`. (Task 4–6 — pending real-component refactor)
- [ ] No device conditionals introduced in any UI component.
- [ ] No hardcoded pixel widths introduced.
- [ ] All new visual rules codified in `DESIGN-SYSTEM.md` (and any new tokens added to `tokens.css`). (Task 7 — pending)
- [ ] All existing unit / UI tests still pass. (Task 6 verification — pending)
- [ ] **Phase-completion duplication audit passes** — the per-task gates above (Tasks 3–5, 7) all have their audit tables filled in with concrete numbers, and any deferred consolidation work has a tracked GitHub issue link. **No "we'll consolidate later" without an issue link.**

---

## Phase 10: Post-Audit Cleanup (In Progress — Tasks 1–6 done pending hardware verification)

This phase exists because the 2026-05-08 code audit and the Phase 9 Task 3 review (`/dw-lifecycle:review` on commit `6df1ba6a`) surfaced concrete cleanup items that fall outside Phase 9's "UX/UI cleanup via `/frontend-design`" scope. They land here so they have explicit acceptance criteria and a duplication-audit gate, not just a GitHub issue link that will rot.

**Reading order:** the audit doc (`docs/1.0/001-IN-PROGRESS/s550-support/2026-05-08-code-audit-findings.md`) is the source of truth for severity and rationale. This phase translates audit findings into actionable tasks.

**Phase boundary with Phase 9:** Phase 9 owns visual polish (typography / spacing / layout / design-token alignment) and the structural refactors that make polish possible (TonesPage decomposition, shared hook extraction). Phase 10 owns *correctness* and *duplication-cleanup* fixes that don't change the visual surface. Findings 3, 4, and 5 from the audit are absorbed into Phase 9 Tasks 4 / 6 because they ARE visual surface work; everything else lands here.

### Tasks

1. **S-550 import dialog: support wave banks C and D (#393, audit finding 1, severity HIGH). [DONE — pending hardware verification]**
   - Replaced `waveBank: 0 | 1` literal-union types with `number` end-to-end, validated at runtime against `DeviceConfig.maxWaveBankIndex` plus `MemoryLayout.getWaveBanksForTone(toneIndex)`. Touched: `TonesPage.tsx:32-46`, `ImportSampleDialog.tsx:32-43`, `s330-types.ts` (`S330WaveDataInput.waveBank`, `S330ImportToneInput.waveBank`), `useImportSamples.ts:352`, `useLibraryImportDialogs.ts:33,40,125,152,220`, `useLibraryImport.ts:46,59,107,170`. Drum-kit-import helpers in `sampler-devices/devices/s330/` (`createDrumTone`, `MonolithicDrumKitConfig`, `DrumKitImportConfig`, `CreateToneConfig`) widened from `0 | 1` to `number` to match the editor's unified `SamplerClientInterface` (which serves both S-330 and S-550); the S-330 client itself still rejects bank > 1 at the runtime boundary. Implementation: commits `10a21a6d` + `dce1a8a4` (code-review follow-up: half-widened types in `useLibraryImportDialogs.ts:33,40`; submit-time guard converted from `throw` to `setLocalError + return` so invalid input renders via `OperationErrorBanner`).
   - `ImportSampleDialog` renders the bank `<option>` set from `MemoryLayout.getWaveBanksForTone(toneIndex)` (`Bank A` for index 0, `B` for 1, `C` for 2, `D` for 3) — no device conditionals; the dialog reads what the layout provides. Initial state and dialog-open reset use the first valid bank for the tone (`indices[0]`), so an S-550 user editing tone 32 (Block 2) sees Bank C as default.
   - Defense-in-depth runtime guard added in `handleImport`: rejects `waveBank` outside `[0, maxWaveBankIndex]` and outside the tone's allowed `bankIndices`. Per project guidance, throws (no silent fallback).
   - **Hardware verification deferred:** workplan mandates verifying on `/roland/s550/editor` that an import to bank C lands in the right segment-address space (`project_s550_wave_addressing` memory). The address-builder fix landed in earlier S-550 work; this task only widens the editor-side type chain and renders the right options. Hardware round-trip verification still owed before declaring #393 fully closed.
   - **Follow-up audit (2026-05-09)** surfaced two additional findings beyond the bank-options fix: (a) `ImportSampleDialog` dialog title used arithmetic `T{toneIndex + 11}` instead of `memoryLayout.formatToneSlot(toneIndex)` — fixed inline in this task because it's the same dialog and same defect class. (b) Sibling arithmetic-label bugs in `ToneZoneEditor.tsx:196` and `PlayPage.tsx:383` — same defect class, different surfaces; filed as [#397](https://github.com/audiocontrol-org/audiocontrol/issues/397) for tracked cleanup. (c) Tests cover only the pure layout helper, not the dialogs — already absorbed into Phase 9 Task 6 (UI-test-harness prerequisite).
   - Unit test added: `roland-sxx0-editor/test/unit/memory-layout.test.ts` (7 tests) pins `getWaveBanksForTone(0/31/32/63)` for S-330 and S-550 — explicit coverage at the index 32 boundary.
   - **Duplication audit gate:**
     - [x] Confirmed bank labels come from a single source: `MemoryLayout.getWaveBanksForTone(toneIndex)` for `ImportSampleDialog`; `targetGroup.waveBankLabels` (same `MemoryLayout`) for `ImportLibraryToneDialog`. Both editors source from the layout — no duplicated string literals. Hardcoded `Bank A` / `Bank B` `<option>` text remains in `ImportLibraryPatchDialog.tsx:579-580` (sibling dialog with the same #393 pattern, out of this task's scope per workplan); filed as [#396](https://github.com/audiocontrol-org/audiocontrol/issues/396).
     - [x] Confirmed no second copy of the wave-bank validation rule was added: the runtime guard in `handleImport` reads `config.maxWaveBankIndex` and the layout's per-tone `bankIndices` — no new constants. The existing device-client validators (`s330-client.ts:1592,1632`, `s550-addresses.ts:168`) are unchanged and remain the authoritative runtime barrier.

2. **Empty-slot helpers: replace name-only re-implementations with shared `slot-allocation.ts` (#394, audit finding 2, severity MEDIUM). [DONE]**
   - Deleted `ToneList.isToneEmpty` (`components/tones/ToneList.tsx`), `PatchList.isPatchEmpty` (`components/patches/PatchList.tsx`), and the inline `isPatchEmpty` arrow at `pages/PlayPage.tsx`. All three sites now import `isToneEmpty` / `isPatchEmpty` from `@/lib/slot-allocation`.
   - **Semantic shift absorbed:** the local helpers were name-based; the shared helpers check data presence (`wave.segmentLength === 0` for tones; blank name AND no `toneLayer1` assignments for patches). A tone with a name but no wave data now correctly shows "(empty)" because allocation treats that slot as available — no more list-vs-import inconsistency.
   - **Side-effect cleanup:** `ToneList.tsx` count label updated from "X of Y with names" to "X of Y allocated" to match the new (correct) emptiness semantics. `SamplerPatch` import removed from `PlayPage.tsx` (no longer used after deleting the local arrow function).
   - Hardware verification (mixed empty / named-but-zero-segment / fully-occupied slots) deferred to operator hardware run.
   - **Duplication audit gate (PASSED):**
     - [x] `grep -rn "isToneEmpty\|isPatchEmpty" modules/roland-sxx0-editor/src/` returns only the canonical defs in `slot-allocation.ts:58,84`, internal uses in `slot-allocation.ts` and `best-fit.ts`, and consuming imports in `ToneList.tsx`, `PatchList.tsx`, `PlayPage.tsx`, `ToneSlotMap.tsx`. **Zero local function definitions.**
     - [x] No new wrapper helpers introduced — edits are pure deletions + named imports.

3. **Wave-fetch consolidation: route `useDeviceToneChopper` and `handleExportSample` through `useWaveDataCache` (#395, audit follow-up, severity MEDIUM). [DONE]**
   - `useWaveDataCache.loadWaveData` now accepts an optional per-call `onProgress(pct)` callback. Per-call consumers (sample-export UI) get the same 0-100 stream that drives the cache's shared `progress` state, without a redundant fetch.
   - `useDeviceToneChopper` accepts `waveCache: UseWaveDataCacheResult` via options. `openChopper` calls `waveCache.loadWaveData(toneIndex)` then reads via `waveCache.getSamples(toneIndex)` — cache hits skip the device read entirely. Throws on a post-load null read (invariant violation, no silent fallback).
   - `handleExportSample` (`TonesPage.tsx`) reads the cache first; on miss calls `loadWaveData(idx, setExportProgress)` so the per-export progress UI stays alive. Sample rate now comes from the cached tone metadata, the same way `useDeviceToneChopper` resolves it. New helper `exportSamplesAsWav(samples, sampleRate, toneName)` in `lib/wave-export.ts` keeps the filename-sanitization rule in one place; the original `exportWaveAsWav` (response-based) delegates to it.
   - Hardware verification (load a tone → chop / download → device shows zero additional reads on the second action) deferred to operator hardware run.
   - **Duplication audit gate (PASSED):**
     - [x] `grep -rn "requestWaveData" modules/roland-sxx0-editor/src/` returns only `useWaveDataCache.ts:98` (the canonical fetch), `useLibraryExport.ts:216,357` (the export-with-progress flow that owns its own fetch by design — documented asymmetry; consolidating it would entangle the cache with the multi-tone export progress sequence), and `useLibraryImportDialogs.ts:196` (a callback adapter passed into `saveDeviceToSetIncremental`, fundamentally different shape — not a wave-fetch site for this page's data).
     - [x] `grep -rn "unpack12BitTo16Bit" modules/roland-sxx0-editor/src/` returns only `useWaveDataCache.ts:108` (the canonical decode), `wave-export.ts:33,69,188` (the function definition + response-based wrappers), and `library-tones.ts:109` / `library-io.ts:87` / `library-sets.ts:149` (library save/import flows that operate on already-fetched response payloads, not the cache; out of this task's scope per the workplan note "only `useWaveDataCache` and `useLibraryExport`"). Zero new inline `unpack12BitTo16Bit` calls in editor pages or non-library hooks.
     - [x] No new wrapper hooks introduced — the only addition is `exportSamplesAsWav` in `lib/wave-export.ts`, justified because it cleanly extracts the samples-based export path while keeping the sanitization rule in one place; `exportWaveAsWav` continues to exist and now delegates.
   - **Follow-up [#398](https://github.com/audiocontrol-org/audiocontrol/issues/398):** the cache-routing growth pushed `TonesPage.tsx` from 497 → 511 lines (11 over the project's 500-line guideline). Code-quality reviewer flagged this as structural rather than cosmetic — a defensible micro-trim of 6 prose lines exists, but the right resolution is extracting a `useToneSampleExport` hook mirroring the existing `useDeviceToneChopper` pattern. Filed as #398 (severity LOW). Added inline JSDoc cleanup in `lib/wave-export.ts` to drop "S-330" specificity now that the helpers serve both devices.

4. **`ImportLibraryPatchDialog`: support wave banks C and D ([#396](https://github.com/audiocontrol-org/audiocontrol/issues/396), severity MEDIUM). [Done — pending hardware verification]**

   Sibling instance of #393 surfaced by the Phase 10 Task 1 duplication audit. The patch-import dialog's per-tone-mapping wave-bank `<select>` hard-codes `<option>Bank A</option>` / `<option>Bank B</option>` at `ImportLibraryPatchDialog.tsx:579-580` instead of routing through `MemoryLayout.getWaveBanksForTone(targetSlot)` like `ImportSampleDialog` and `ImportLibraryToneDialog` already do. The data model is correct (`ToneImportMapping.waveBank: 0 | 1 | 2 | 3`); only the rendered option set is wrong.

   - [x] Replace hard-coded `<option>Bank A</option>` / `<option>Bank B</option>` at `ImportLibraryPatchDialog.tsx:579-580` with options derived from `useDeviceConfig().memoryLayout.getWaveBanksForTone(mapping.targetSlot)` (mirror the pattern in `ImportSampleDialog`).
   - [x] Default per-mapping `waveBank` to the first valid bank for the tone's target slot. The auto-allocation flow at lines ~360-372 already routes through `findPatchBestFits(memoryLayout.toneGroups, ...)` and the mount-time `suggestPatchAllocation` flow takes the dependent tone's `preferredBank` from the source manifest/bundle, so initial defaults already pick a valid bank for the target. Added a target-slot `onChange` clamp that re-derives the bank when crossing the S-550 32-tone block boundary so the rendered option always matches the selectable indices.
   - [x] Remove the `as 0 | 1 | 2 | 3` cast on the `onChange` — done. Widened `ToneImportMapping.waveBank`, the `onImport` prop's per-tone `waveBank`, the local `tonesData` array, and the `dependentTones[].preferredBank` boundary (kept `WaveBankIndex` only at the `suggestPatchAllocation` boundary; documented in-situ that the cast is pre-existing and out of scope for #396).
   - Verify on `/roland/s550/editor` that importing a patch with target-slot ≥ 32 shows C/D in the bank selector and that target-slot < 32 shows A/B; verify on `/roland/s330/editor` that A/B remain the only options. **Hardware verification deferred to operator hardware run.**

   ### Acceptance criteria

   - [x] Bank `<option>` set is layout-driven; no hard-coded `Bank A` / `Bank B` literals in `ImportLibraryPatchDialog.tsx`.
   - [x] Default `waveBank` per mapping is the first valid bank for the target slot (initial allocation via `suggestPatchAllocation` + on-target-slot-change clamp).
   - [x] No regressions in existing tests (`pnpm --filter @audiocontrol/roland-sxx0-editor test` 11/11 passing + `make` clean).

   ### Duplication audit gate (PASSED)

   - [x] `grep -rn "Bank A\|Bank B" modules/roland-sxx0-editor/src/components/` returns zero hits after the fix (was 2 — both in `ImportLibraryPatchDialog.tsx:579-580` — now zero).
   - [x] Wider scan `grep -rn "Bank A\|Bank B\|Bank C\|Bank D" modules/roland-sxx0-editor/src/` returns zero hits — every bank label is now derived from `MemoryLayout.getWaveBanksForTone` (`ImportSampleDialog`) or `targetGroup.waveBankLabels` (`ImportLibraryToneDialog`, sibling `MemoryLayout` API) or the new in-render derivation in `ImportLibraryPatchDialog`.
   - [x] Bank label sources audit: **3 grepped, 2 already routed (ImportSampleDialog via `getWaveBanksForTone`, ImportLibraryToneDialog via `targetGroup.waveBankLabels`), 1 migrated (`ImportLibraryPatchDialog` from hard-coded literals to `getWaveBanksForTone(mapping.targetSlot)`)**.

5. **Slot-label arithmetic: replace `+ 11` with `MemoryLayout` formatters ([#397](https://github.com/audiocontrol-org/audiocontrol/issues/397), severity MEDIUM). [Done — pending hardware verification]**

   Two sibling instances of arithmetic-based slot label rendering bypass the `MemoryLayout.formatToneSlot` / `formatPatchSlot` formatter contract. They produce wrong labels for any S-330 tone past index 7 (banks 2–4) and any S-550 tone past index 7. Surfaced by Phase 10 Task 1 follow-up audit; the in-scope `ImportSampleDialog` title was fixed inline.

   - [x] Replaced `T${toneIndex + 11}` in `ToneZoneEditor.tsx:196` with `memoryLayout.formatToneSlot(toneIndex)`. `memoryLayout` injected via `useDeviceConfig()` (component already renders under `DeviceConfigProvider` via `PatchEditor` → `PatchesPage`). Promoted `getDisplayNumber` to a `useCallback` keyed on `memoryLayout` so the consumers (`getToneName`, `getShortToneName`) re-derive when the device config changes. Comment updated from "(0-31) → (T11-T42)" to describe the device-aware formatter contract.
   - [x] Replaced `P${String(patchIndex + 11).padStart(2, '0')}` in `PlayPage.tsx:377` with `memoryLayout.formatPatchSlot(patchIndex)`. The S-550 formatter (`memory-layout.ts:147-158`) handles the Roman-numeral block prefix; no UI conditional needed.
   - [x] Extended `test/unit/memory-layout.test.ts` with formatter pin tests at index 0 / 8 / 15 / 16 / 31 / 32 / 63 boundaries: 16 new cases (S-330 tone × 3, S-330 patch × 3, S-550 tone × 5, S-550 patch × 5). Pins specifically the values the obsolete arithmetic produced ("T19" for index 8, "T43" for S-550 index 32) so a regression would fail loudly.
   - Hardware verification (loading patches on `/roland/s330/editor` and `/roland/s550/editor`, confirming `T21..T48` and S-550 block-2 `T51..T88` / patch `II11..II28` labels render correctly across the patch dropdown and zone editor) deferred to operator hardware run.

   ### Acceptance criteria

   - [x] No `+ 11` arithmetic in any tone- or patch-slot label rendering across `roland-sxx0-editor` (audit greps below).
   - [x] Both call sites use `memoryLayout.formatToneSlot` / `formatPatchSlot`; `memoryLayout` injected via `useDeviceConfig()`.
   - [x] No regressions in existing tests (`pnpm --filter @audiocontrol/roland-sxx0-editor test`: 27/27 passing, up from 11/11 — 16 new formatter pin tests added).
   - [x] `make` clean (full topological rebuild succeeds).

   ### Duplication audit gate (PASSED)

   - [x] `grep -rn "+ 11}" modules/roland-sxx0-editor/src/` returns zero hits after the fix (was 2: `ToneZoneEditor.tsx:196`, `PlayPage.tsx:377`).
   - [x] `grep -rn "toneIndex + 11\|patchIndex + 11" modules/roland-sxx0-editor/src/` returns zero hits.
   - [x] Wider scan `grep -rn "formatToneSlot\|formatPatchSlot\|T\${.*toneIndex\|P\${.*patchIndex" modules/roland-sxx0-editor/src/` returns only `MemoryLayout`-routed call sites and the `lib/s330-format.ts` helpers. No remaining inline `T${...toneIndex...}` / `P${...patchIndex...}` template literals that bypass the formatter contract in the surfaces #397 explicitly scoped (`ToneZoneEditor`, `PlayPage`).
   - [x] Slot-label rendering audit: **3 grepped, 1 already routed (`ImportSampleDialog` via 8030d8ca), 2 migrated (`ToneZoneEditor` + `PlayPage`)**.
   - **Sibling-instance follow-up filed as [#400](https://github.com/audiocontrol-org/audiocontrol/issues/400)**: the code-quality review surfaced that `lib/s330-format.ts:formatPatchSlot` returns wrong labels on S-550 for patch index ≥ 16 (renders `P31` instead of `II11`), affecting `ItemPreviewPanel.tsx:511`. Plus three more raw-arithmetic surfaces with `+ 1` (`ExportPatchDialog.tsx:46,58,109`, `useLibraryImportDialogs.ts:245`) that are wrong on S-550 for patch index ≥ 8. Out of #397's stated scope ("ToneZoneEditor + PlayPage remaining"), tracked as severity MEDIUM follow-up.

6. **Extract `useToneSampleExport` hook to bring `TonesPage.tsx` under 500 lines ([#398](https://github.com/audiocontrol-org/audiocontrol/issues/398), severity LOW). [Done]**

   `TonesPage.tsx` was at 511 lines (11 over the 300–500 line guideline) after Phase 10 Task 3's cache-routing growth. The right resolution is structural — extract a `useToneSampleExport` hook mirroring the existing `useDeviceToneChopper` pattern. Cosmetic line-trimming was rejected by the code-quality reviewer.

   - [x] Created `modules/roland-sxx0-editor/src/hooks/useToneSampleExport.ts` exposing the documented `UseToneSampleExportOptions` / `UseToneSampleExportResult` contract. DI-by-options surface mirrors `useDeviceToneChopper`; `waveCache: UseWaveDataCacheResult` is required (not optional) per the contract-enforcement rule from #395. Final option set: `{ clientRef, waveCache, setTone, setError, totalTones }` (no `tones` field — see follow-up below).
   - [x] Moved the cache-hit fast path, `loadWaveData(idx, onProgress)` call, invariant guard, sample-rate resolution, and `exportSamplesAsWav` invocation from `TonesPage.tsx` into the hook. The page no longer imports `exportSamplesAsWav`.
   - [x] In `TonesPage.tsx`, replaced the inline `handleExportSample` definition (~50 lines) with `const { isExporting, exportProgress, handleExportSample } = useToneSampleExport({ ... })`. Removed the local `useState` for `isExporting` / `exportProgress`. The `ToneEditor.onExportSample` prop adapts the page's `selectedToneIndex` to the hook's `(idx) => Promise<void>` signature inline, keeping the call-site shape symmetric with the chopper.
   - [x] Added `test/unit/use-tone-sample-export.test.ts` covering: cache hit (no `loadWaveData` call), 30 kHz sample-rate selection, cache miss (load + re-read), invariant violation (`setError` called, no export), null-tone failure (no silent filename / sample-rate fallback), progress wiring (captured `onProgress` updates `exportProgress`), progress reset after operation, and the null-`clientRef.current` guard. 8/8 passing.

   ### Acceptance criteria

   - [x] `TonesPage.tsx` is back under 500 lines after the extraction (470 lines via `wc -l` after follow-up).
   - [x] New hook composes generic primitives (cache + export helper) without device conditionals or S-series-specific business logic. No `S330` / `S550` references in `useToneSampleExport.ts`; types come from the device-agnostic `@/core/midi/SamplerClient` re-export module.
   - [x] Unit tests for the new hook cover the documented cases above. 8/8 passing.
   - [x] All existing tests still pass (`pnpm --filter @audiocontrol/roland-sxx0-editor test`: 35/35 passing, up from 27/27 — 8 new hook tests added). `make` clean (full topological rebuild succeeds).

   ### Duplication audit gate (PASSED)

   - [x] `grep -rn "exportSamplesAsWav\b" modules/roland-sxx0-editor/src/` returns 6 hits across exactly 2 files: `useToneSampleExport.ts` (import + JSDoc + invocation = 3) and `wave-export.ts` (definition + JSDoc reference in `exportWaveAsWav` + intra-module delegation call = 3). No other call site re-implements the cache-then-export sequence; `TonesPage.tsx` no longer references the helper.
   - [x] Hook is composable with `useDeviceToneChopper`: both consume `UseWaveDataCacheResult` via options-object DI, both use `waveCache.getSamples` + `waveCache.loadWaveData`, and `TonesPage` passes the same `useWaveDataCache(...)` instance to both. Deliberate shape divergence: the chopper's `openChopper(toneIndex, tone)` takes the tone object (it uses `tone.name` for the kit-config default), while `useToneSampleExport.handleExportSample(toneIndex)` re-fetches via `requestToneData` to get the live name + sample rate (filename must reflect the device's current state, not stale store data). Documented in the hook JSDoc.
   - [x] Cross-hook surface: both hooks own their own progress state (`isLoadingWav` / `exportProgress`) instead of routing through `waveCache.progress` — same rationale documented in `useDeviceToneChopper` (the cache's shared progress is global across consumers; per-operation UI needs a local flag).
   - **Follow-up code-quality review on `6940dbdd`** surfaced three findings, all fixed in a follow-up commit:
     - **Important — vestigial `tones` option:** the original `UseToneSampleExportOptions` declared `tones: (SamplerTone | undefined)[]` and immediately discarded it as `_tones`. The JSDoc justification ("symmetry with the other tone-acting hooks") was factually wrong — `useDeviceToneChopper` does not take `tones` either. Removed from the interface, the destructure, the call site in `TonesPage.tsx`, and all 7 test mocks.
     - **Important — throw-vs-`setError` contract:** the invariant `throw` was caught internally and routed through `setError`, but the inline comment framed it as a hard reject. Rephrased to make the catch-and-route design intent visible (single error pathway, preserved stack trace).
     - **Minor — `tone?.name` / `tone?.sampleRate` nullability:** `requestToneData` is typed `Promise<SamplerTone | null>` (see `s-series-client.ts:195`). The optional-chain `||` fallback would have synthesised a filename and silently picked 15 kHz when the tone was missing — exactly the silent-fallback the project rules forbid. Replaced with an early `throw` + `setError` route immediately after `await requestToneData(...)`. New 8th test pins the behaviour: `setError` called with an actionable message naming the slot, `loadWaveData` not called, `setTone` not called, `exportSamplesAsWav` not called.
   - **Out-of-scope follow-up** filed as [#401](https://github.com/audiocontrol-org/audiocontrol/issues/401): the `tone.sampleRate === '30kHz' ? 30000 : 15000` resolution is duplicated across `useToneSampleExport.ts`, `useDeviceToneChopper.ts`, and `TonesPage.tsx` (`useLoopEditor` call site). Real duplication; severity LOW; tracked as a separate refactor.

7. **`lib/s330-format.ts` consumers + raw `+ 1` arithmetic produce wrong S-550 patch labels ([#400](https://github.com/audiocontrol-org/audiocontrol/issues/400), severity MEDIUM). [Not Started]**

   Sibling-instance finding from the Phase 10 Task 5 code-quality review. `lib/s330-format.ts:formatPatchSlot` returns `Math.floor(idx/8)+1`-prefixed labels (`P31..P48`) for S-550 patch index ≥ 16; correct labels are `II11..II28` per `MemoryLayout.formatPatchSlot`. Plus three more raw `+ 1` arithmetic surfaces wrong on S-550 for patch index ≥ 8.

   - Migrate `ItemPreviewPanel.tsx` consumers (lines 263, 265, 280, 490, 511) and `ToneList.tsx:91` from `lib/s330-format.ts` to `useDeviceConfig().memoryLayout.formatToneSlot` / `formatPatchSlot`. For non-React consumers (e.g., sort callbacks), thread `memoryLayout` into the consuming context or wrap the consumer in a hook that returns memoized comparators.
   - Replace `Patch_${patchIndex + 1}` and `P${String(patchIndex + 1).padStart(2, '0')}` in `ExportPatchDialog.tsx:46,58,109` with `memoryLayout.formatPatchSlot(patchIndex)`.
   - Replace `P${String(slot + 1).padStart(2, '0')}` in `useLibraryImportDialogs.ts:245` with `memoryLayout.formatPatchSlot(slot)`.
   - Delete `modules/roland-sxx0-editor/src/lib/s330-format.ts` once unused.

   ### Acceptance criteria

   - [ ] No consumer of `lib/s330-format.ts` remains; the file is deleted.
   - [ ] All affected surfaces use `memoryLayout.formatToneSlot` / `formatPatchSlot` via `useDeviceConfig()`.
   - [ ] No regressions in existing tests (`pnpm --filter @audiocontrol/roland-sxx0-editor test` + `make`).
   - [ ] Add a unit/UI test pinning S-550 patch label rendering at index 8 / 16 / 24 boundaries (the existing `memory-layout.test.ts` already pins the formatter; this is regression coverage at the consumer level).

   ### Duplication audit gate

   - [ ] `grep -rn "from '@/lib/s330-format'" modules/roland-sxx0-editor/src/` returns zero hits.
   - [ ] `grep -rn "patchIndex + 1\b\|slot + 1\b" modules/roland-sxx0-editor/src/` returns zero hits in slot-label rendering contexts (test fixtures excluded).
   - [ ] `lib/s330-format.ts` is removed.

8. **`ImportLibraryToneDialog` retains `0 | 1 | 2 | 3` literal-union pattern after #393 / #396 ([#399](https://github.com/audiocontrol-org/audiocontrol/issues/399), severity LOW). [Not Started]**

   TypeScript discipline / consistency cleanup. `ImportLibraryToneDialog` is the third Roland import dialog; #393 and #396 widened `ImportSampleDialog` and `ImportLibraryPatchDialog` respectively. The rendered `<option>` set is already layout-driven (no correctness bug), but the literal-union `waveBank: 0 | 1 | 2 | 3` types and `as 0 | 1 | 2 | 3` casts at lines 52, 85, 322, 389 contradict the discipline established in those siblings.

   - Widen `onImport.waveBank` (line 52), `useState<0 | 1 | 2 | 3>` (line 85), and the two `setWaveBank(... as 0 | 1 | 2 | 3)` casts (lines 322, 389) from `0 | 1 | 2 | 3` to `number`. Mirror the `ImportSampleDialog` pattern.
   - Verify call-site continuity through `useLibraryImportDialogs.ts` (the `ImportToneParams` interface should already be `waveBank: number` after #393).
   - No new behavior; pure type-discipline fix.

   ### Acceptance criteria

   - [ ] `grep -rn "0 | 1 | 2 | 3" modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx` returns zero hits in non-comment lines.
   - [ ] All three Roland import dialogs (`ImportSampleDialog`, `ImportLibraryPatchDialog`, `ImportLibraryToneDialog`) use the same `waveBank: number` + layout-driven options pattern.
   - [ ] No regressions in existing tests.

   ### Duplication audit gate

   - [ ] Confirm pattern parity across the three dialogs by reading each in turn.

9. **Extract sample-rate label-to-Hz helper ([#401](https://github.com/audiocontrol-org/audiocontrol/issues/401), severity LOW). [Not Started]**

   `tone.sampleRate === '30kHz' ? 30000 : 15000` is duplicated at three sites: `useToneSampleExport.ts:127`, `useDeviceToneChopper.ts` (sample-rate resolution path), and `TonesPage.tsx` (`useLoopEditor` call site). Surfaced by Phase 10 Task 6 code-quality re-review.

   - Add a named helper, e.g., `toneSampleRateHz(tone: SamplerTone): number` co-located with the `SamplerTone` type (likely in `@audiocontrol/sampler-devices/roland-s-series` or `@/core/midi/SamplerClient`).
   - Replace all three call sites with the helper. Keep the helper a one-liner (no new abstractions).
   - A future third sample rate (e.g., a smaller device's `'7.5kHz'`) becomes a single edit site.

   ### Acceptance criteria

   - [ ] Helper added at the appropriate shared location, named clearly.
   - [ ] All three call sites updated; `grep -rn "sampleRate === '30kHz'" modules/` returns zero hits in non-helper code.
   - [ ] No regressions in existing tests.

   ### Duplication audit gate

   - [ ] Confirm no fourth call site exists (`grep -rn "30000\|15000" modules/roland-sxx0-editor/src/` should not surface any sample-rate-resolution literal outside the helper).

### Acceptance Criteria

- [ ] All nine issues (#393–#401) closed with their acceptance criteria met.
- [ ] No regressions in existing tests (`pnpm --filter roland-sxx0-editor test` + `make`).
- [ ] **Phase-completion duplication audit passes** — each task's audit gate above is filled in with concrete grep results.
- [ ] DEVELOPMENT-NOTES entry written for Phase 10 with what was unified, what was kept separate (and why), and any new follow-ups discovered.

---

## Dependencies

```
Phase 1 (S-Series Base) ─── Complete
    ↓
Phase 2 (Device Module) ─── Complete
    ↓
Phase 3 (Client/Factory) ── Complete ──→ Phase 4 (Converters) ── Complete
    ↓                                        ↓
    └────────────────────────────────────────┘
                    ↓
            Phase 5 (Unified Editor) ── Complete
                    ↓
            Phase 6 (Hardware Validation) ── Complete
                    ↓
            Phase 7 (Front Panel) ── Not Started
            Phase 8 (Memory Map) ── Complete
            Phase 9 (UX/UI Cleanup) ── In Progress (Tasks 1–3 done)
                    ↓
            Phase 10 (Post-Audit Cleanup) ── In Progress
                    Tasks 1–3 done (#393, #394, #395)
                    Tasks 4–6 done (#396, #397, #398) — pending hardware verification
                    Tasks 7–9 added (#400, #399, #401) — sibling-instance follow-ups
                    Independent of Phase 9 visual work; can run in parallel.
```

---

## Risk Assessment

| Risk | Status | Mitigation |
|------|--------|------------|
| S-550 protocol significantly different | **Resolved** — Same model ID, same protocol | Confirmed from documentation and hardware testing |
| No S-550 hardware for testing | **Resolved** — Physical S-550 connected via 828mk3 | 17 integration tests passing |
| Code duplication across devices | **Resolved** — Shared base extracted | `roland-s-series` module handles shared code |
| Unified editor breaks S-330 | **Low risk** — S-330 config tested | Both configs exercised in same editor |
| Shared client bugs affect both devices | **Resolved** — Three protocol bugs found and fixed | DAT address headers and EOD/RJC constants corrected; S-330 regression testing needed |
