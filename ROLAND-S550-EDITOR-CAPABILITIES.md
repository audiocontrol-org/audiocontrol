---
deskwork:
  id: 6b7fc78b-5954-4b34-9d0c-6d5e6ef2596c
mothballed: 2026-05-17
---

> **⚠ MOTHBALLED 2026-05-17.** This document and its companion [`ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`](ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md) are no longer the working source of truth for editor capabilities. The capability-inventory / four-tier coverage / sign-off process built around them is paused. Operator decision: post-redesign regressions will be fixed directly, in real time, without routing through this inventory or its coverage manifest. The content below is preserved for reference only; do not treat any row, ID, or status here as binding on current work. The Phase 9 Remediation Plan (9R-A / 9R-B / 9R-C / 9R-D) in [`docs/1.0/001-IN-PROGRESS/s550-support/workplan.md`](docs/1.0/001-IN-PROGRESS/s550-support/workplan.md) is mothballed in the same decision.

---

# Roland S-330/S-550 Editor — Canonical Capabilities

**This document is the source of truth for what the editor UI MUST afford.**
Visual presentation, layout, component composition, and styling can change.
Capabilities cannot vanish without a corresponding strikethrough here and a
PR explaining why.

Each capability has:

- **ID** — stable, never reused (`C-<AREA>-<NN>`).
- **Statement** — the user-facing affordance, layout-independent.
- **User need** — why the user wants this; the goal removed by regression.
- **Status** — `covered` (the capability's evidence in the detailed inventory's `Coverage` column is `confident` or `partial`) / `partial` (the capability has multiple D-rows and some are confident while others are `none`) / `not yet covered` (every D-row mapping to this capability is `coverage: none`) / `n/a` (the capability is hardware-only and lives in `test/e2e/`).

Tests are decoupled from layout via the testing-and-inventory reform's tier discipline (see [reform spec §2](docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md)):

1. **Tier 1 — wiring** (`modules/<editor>/test/wiring/`) — outbound-byte assertions go through the SimulatedAdapter strict match. The spec mounts a fixture that encodes the expected SysEx for the capability action, drives the underlying input value programmatically, and the simulated transport's strict matcher passes iff the editor emits the same bytes. Protocol contract is locked in.
2. **Tier 2 / Tier 3 — UI contract / in-context** (`modules/<editor>/test/ui/contract/` + `modules/<editor>/test/ui/in-context/`) — selectors prefer accessible queries (`getByRole`, `getByLabel`, `getByText`) named by user-visible content; events originate from the browser's pointer engine, not synthetic `dispatchEvent`. Layout changes are invisible; user-facing interaction is locked in.

Read [`docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`](docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md) for the four-tier model and the broken-variant credibility check.

Read [TESTING-FIXTURES.md](TESTING-FIXTURES.md) for the harness chain. Read
[TESTING.md](TESTING.md) for the overall test architecture.

For the **drill-down inventory** of every individual editor affordance —
each `C-XX-NN` decomposed into specific itemized parameters, dialogs,
lists, and actions, with each tagged `native` / `client-derived` /
`editor-derived` — see
[ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md](ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md).

---

## Adding or changing capabilities

A redesign that changes how the UI looks is fine. A redesign that loses a
capability is a regression — the corresponding test fails and the PR is
blocked.

To add a capability: append a new entry with the next `C-<AREA>-<NN>` ID,
write the spec, mark `covered`. To remove a capability: explain in a PR
why the user need no longer applies, mark the entry `removed (<reason>)`,
and the corresponding test stays in the suite as a `test.skip` with a
comment linking the removal PR (so the audit trail is durable).

Capabilities are NOT closed when they ship — they remain assertions that
the next redesign must respect.

---

## Connection (C-CONN)

### C-CONN-01 — User can connect to a device

**Statement:** From a fresh-load state, the user can establish a working
session against a connected device (real or simulated) without writing
URL parameters by hand.

**User need:** Without connection, no other capability is reachable.

**Status:** covered

### C-CONN-02 — User can see connection status

**Statement:** The current connection state (disconnected / connecting / connected / error) is visible to the user at all times.

**User need:** Users must know whether their actions will reach the device.

**Status:** covered

### C-CONN-03 — User can disconnect from the device

**Statement:** An affordance exists to release the active connection without leaving the page.

**User need:** Switching devices, freeing the MIDI port for another tool.

**Status:** covered

### C-CONN-04 — User can navigate to each editor section

**Statement:** From the Home/landing state, the user can navigate to Patches, Tones, Library, Play, and (when implemented) Workflows.

**User need:** Each section exposes a different set of capabilities; the user must reach them.

**Status:** covered (Patches/Tones/Library/Play); n/a (Workflows — not in scope)

---

## Patches (C-PATCH)

### C-PATCH-01 — User can see the list of patches resident in device memory

**Statement:** A list affordance enumerates every patch slot in the device's address space (16 for S-330, 32 for S-550).

**User need:** Edit decisions require visibility into what's loaded.

**Status:** covered

### C-PATCH-02 — User can see each patch's name, slot identifier, and load state

**Statement:** Each patch entry surfaces (a) the slot identifier (e.g., "P11"), (b) the patch name as decoded from the device, (c) whether the slot is loaded or empty.

**User need:** Without these three pieces of info per slot, the user can't pick a patch to edit.

**Status:** covered

### C-PATCH-03 — User can identify empty patch slots

**Statement:** A loaded vs not-loaded patch is visually and programmatically distinguishable.

**User need:** Avoid editing or copying nonsense data.

**Status:** covered

### C-PATCH-04 — User can select a specific patch to view its details

**Statement:** Activating a loaded patch opens that patch's editor surface.

**User need:** Drill from the list into per-patch parameters.

**Status:** covered

### C-PATCH-05 — User can refresh patches from the device

**Statement:** An affordance triggers a fresh `loadPatchRange` from the device, overwriting any cached UI state.

**User need:** When the device's state has changed externally (front panel, MIDI in), the user must be able to resync.

**Status:** not yet covered

### C-PATCH-06 — User can navigate between patch banks

**Statement:** S-330 has 2 banks of 8, S-550 has 4 banks of 8. The user can switch which bank's slots are visible/loaded.

**User need:** All patches are reachable, not just bank 0.

**Status:** not yet covered

### C-PATCH-07 — User can edit a patch's name

**Statement:** An affordance lets the user rename a loaded patch and the rename is sent to the device.

**User need:** Patch organization, identification.

**Status:** not yet covered

### C-PATCH-08 — User can adjust a patch-level parameter

**Statement:** At least one patch-level numeric/enum parameter (e.g., octave shift, output assignment) is adjustable, and the adjustment is sent to the device.

**User need:** Patches are containers for tones plus patch-level routing/transposition; that routing must be editable.

**Status:** not yet covered

### C-PATCH-09 — User can see the tone references within a patch's zones

**Statement:** A loaded patch's zone list is visible, showing which tone is assigned to each zone.

**User need:** Patches are key/velocity-mapped collections of tones; the mapping is the patch's identity.

**Status:** not yet covered

### C-PATCH-10 — User can adjust a zone's key range

**Statement:** A zone's key range (low/high MIDI note) is editable and writes to the device.

**User need:** Multi-zone patches require key splits.

**Status:** not yet covered

### C-PATCH-11 — User can adjust a zone's velocity range

**Statement:** A zone's velocity range (low/high) is editable and writes to the device.

**User need:** Velocity-switched layers.

**Status:** not yet covered

---

## Tones (C-TONE)

### C-TONE-01 — User can see the list of tones resident in device memory

**Statement:** A list affordance enumerates every tone slot (32 for S-330, 64 for S-550).

**User need:** Edit decisions require visibility.

**Status:** covered

### C-TONE-02 — User can see each tone's name, slot id, and load state

**Statement:** Each tone entry surfaces slot identifier, decoded name, and load state.

**User need:** Pick a tone to edit.

**Status:** covered

### C-TONE-03 — User can identify empty tone slots

**Statement:** Loaded vs not-loaded distinguishable.

**Status:** covered

### C-TONE-04 — User can select a specific tone to view its details

**Statement:** Activating a loaded tone opens its editor surface.

**Status:** covered

### C-TONE-05 — User can refresh tones from the device

**Statement:** Affordance to force-reload tones from the device.

**Status:** not yet covered

### C-TONE-06 — User can edit a tone's name

**Statement:** Rename affordance writes the new name to the device.

**Status:** not yet covered

### C-TONE-07 — User can adjust a tone wave-section parameter

**Statement:** At least one wave-section parameter (sample rate, original key, loop mode) is adjustable; adjustment writes to the device.

**User need:** The wave section anchors a tone to its source sample.

**Status:** not yet covered

### C-TONE-08 — User can adjust a tone pitch parameter

**Statement:** At least one pitch parameter (coarse, fine, key follow) is adjustable; writes to the device.

**Status:** not yet covered

### C-TONE-09 — User can adjust a tone TVF (filter) parameter

**Statement:** At least one TVF parameter (cutoff, resonance, key follow, envelope depth) is adjustable; writes to the device.

**Status:** not yet covered

### C-TONE-10 — User can adjust a tone TVA (amp) parameter

**Statement:** At least one TVA parameter (level, velocity sensitivity) is adjustable; writes to the device.

**Status:** not yet covered

### C-TONE-11 — User can adjust a tone LFO parameter

**Statement:** At least one LFO parameter (rate, depth, waveform) is adjustable; writes to the device.

**Status:** not yet covered

### C-TONE-12 — User can adjust an envelope segment

**Statement:** The S-series 8-segment envelope (level + rate per segment) is editable; segment edits write to the device.

**User need:** Envelope shape is the soul of a sound; without per-segment editing the editor is incomplete.

**Status:** not yet covered

### C-TONE-13 — User can see and modify tone loop settings

**Statement:** Loop start, loop end, loop mode are visible and editable.

**Status:** not yet covered

---

## Library (C-LIB)

The library implements the four-zone storage model: project library, device memory, set archive, and import staging. See [SAMPLER-LIBRARY.md](SAMPLER-LIBRARY.md).

### C-LIB-01 — User can see the project library tree

**Statement:** A tree affordance shows the persistent project library (samples, tones, patches, sets) stored in OPFS or backing store.

**Status:** partial — tree presence asserted; node enumeration not yet asserted

### C-LIB-02 — User can see what's in device memory from the library page

**Statement:** Device memory contents (patches, tones, samples) are visible from the library page without leaving it.

**Status:** not yet covered

### C-LIB-03 — User can move data from library → device

**Statement:** An affordance imports a library item into device memory; corresponding write SysEx is emitted.

**User need:** Loading custom samples / patches onto the device is the primary library use case.

**Status:** not yet covered

### C-LIB-04 — User can move data from device → library

**Statement:** An affordance exports device memory into the project library.

**Status:** not yet covered

### C-LIB-05 — User can save the device's full state as a "set"

**Statement:** Affordance captures the current device state (all patches + tones + samples) into a set archive.

**Status:** not yet covered

### C-LIB-06 — User can load a saved set back to the device

**Statement:** Affordance loads a previously saved set archive and writes it to the device.

**Status:** not yet covered

### C-LIB-07 — User can import samples into a tone

**Statement:** Affordance lets the user pick a sample (WAV file or library sample) and import it into a tone slot.

**Status:** not yet covered

### C-LIB-08 — User can export samples from a tone

**Statement:** Affordance exports a tone's wave data to a WAV file.

**Status:** not yet covered

### C-LIB-09 — User can rename library items

**Statement:** Library items (samples, tones, patches, sets) can be renamed in place.

**Status:** not yet covered

### C-LIB-10 — User can see the device's memory map

**Statement:** A memory-map affordance shows used/free space for samples on the device.

**User need:** Sample memory is finite; users must see headroom before importing.

**Status:** not yet covered

---

## Play (Multi-mode) (C-PLAY)

### C-PLAY-01 — User can see all multi-mode parts

**Statement:** All 8 multi-mode parts (A-H) are visible.

**Status:** covered

### C-PLAY-02 — User can see each part's MIDI channel

**Statement:** Each part's assigned MIDI channel is visible.

**Status:** covered

### C-PLAY-03 — User can see each part's assigned patch

**Statement:** Each part's assigned patch (or "none") is visible.

**Status:** covered

### C-PLAY-04 — User can adjust a part's MIDI channel

**Statement:** An affordance changes a part's MIDI channel; change writes to the device via `setMultiChannel`.

**Status:** not yet covered

### C-PLAY-05 — User can adjust a part's assigned patch

**Statement:** Affordance changes a part's patch index; writes via `setMultiPatch`.

**Status:** not yet covered

### C-PLAY-06 — User can adjust a part's output assignment

**Statement:** Affordance changes a part's output (Mix/Direct A/B); writes via `setMultiOutput`.

**Status:** not yet covered

### C-PLAY-07 — User can adjust a part's level

**Statement:** Affordance changes a part's level; writes via `setMultiLevel`.

**Status:** not yet covered

---

## Cross-cutting (C-XX)

### C-XX-01 — Edits stream live to the device

**Statement:** Per project memory `feedback_live_editing_no_save`, parameter edits stream live to the device — there is NO save/cancel/undo. The footer shows live status; commits are implicit.

**User need:** S-series workflow is "tweak and listen"; round-tripping through a save dialog defeats the purpose.

**Status:** asserted indirectly by every parameter-edit capability test (each writes immediately, no separate save).

### C-XX-02 — User sees progress feedback during long operations

**Statement:** Long operations (loadPatchRange, set save/load, sample import) show a progress indicator (bytes transferred, elapsed, ETA per project rule `feedback_demo_video_pacing` and `progress indicators`).

**Status:** partial — progress component exists; specs that exercise long operations and assert the indicator are deferred.

### C-XX-03 — User sees actionable error messages on operation failure

**Statement:** Failed operations surface a user-readable error, not a raw stack trace. Per project rule `error messages are actionable`.

**Status:** not yet covered

### C-XX-04 — User can use the virtual front panel

**Statement:** Per project memory `feedback_virtual_front_panel`, every editor page mounts a virtual front panel mirroring the S-550's physical buttons. Pressing a virtual button emits the same DT1 SysEx the physical panel would.

**Status:** not yet covered (Phase 7 work)

### C-XX-05 — Page navigation preserves connection state

**Statement:** Switching between Patches/Tones/Library/Play does not disconnect the device.

**Status:** not yet covered

### C-XX-06 — Page mount triggers no unexpected SysEx

**Statement:** Mounting any editor page issues only the SysEx the page documents in its `loadInitialData`. No background tone preloads, no spurious system queries.

**User need:** Predictable startup sequencing is what makes fixture replay viable.

**Status:** asserted by the strict-match SimulatedAdapter — any unexpected outbound throws.

---

## Capability roll-up

| Area | Total | Covered | Partial | Not yet | Hardware-only |
|------|-------|---------|---------|---------|---------------|
| Connection | 4 | 4 | 0 | 0 | 0 |
| Patches | 11 | 4 | 0 | 7 | 0 |
| Tones | 13 | 4 | 0 | 9 | 0 |
| Library | 10 | 0 | 1 | 9 | 0 |
| Play | 7 | 3 | 0 | 4 | 0 |
| Cross-cutting | 6 | 0 | 1 | 5 | 0 |
| **Total** | **51** | **15** | **2** | **34** | **0** |

The covered + partial rows above are the Phase 0 Task 10 wave 1 deliverable
— 16 capability specs at `modules/roland-sxx0-editor/test/ui/capabilities/`,
all read/display capabilities that don't need new fixtures. Wave 2 covers
the action capabilities (parameter writes) and requires new fixture
captures per the "not yet covered" rows.

The "not yet covered" set is the open coverage gap — one fixture capture
plus one spec per parameter-edit capability. Until the gap is closed,
visual-polish or layout-redesign work on the affected surfaces is
unguarded against silent capability loss.

## Capability stability under redesign

Selectors used in capability specs MUST survive a re-skin / re-layout.
Two layers of defense:

1. **Accessible queries first.** `getByRole('button', { name: /save/i })` survives any styling change as long as the element remains a `<button>` (or has `role="button"`) with the same accessible name.
2. **`data-capability="<id>"` second.** When an element has no semantic role (e.g., a custom slider with mouse-drag handling), tag it with `data-capability="C-TONE-09"` (the capability ID, not a layout-position id like `slider-3`). The spec selects by capability id; redesigning the visual presentation doesn't change the id.

What we DO NOT do:

- **`data-testid="patch-list-item-3"`** — encodes layout position. Redesign that turns the list into a grid or carousel breaks every spec.
- **CSS-class selectors** (`.patches__icon-btn`) — changes with every design-token revision.
- **Pixel-coordinate clicks** — break on any reflow.
- **Text-content match for translatable strings** without an `aria-label` fallback — breaks on i18n.

## How to write a capability test

1. Pick a capability ID. If it doesn't exist yet, add it here first.
2. The test name should re-state the capability: `"adjusting tone filter cutoff writes to the device"` not `"clicks the filter slider"`.
3. Use accessible selectors. If the element has no role, add `data-capability="<id>"` to the component and use that.
4. For action capabilities (write to device), capture or reuse a fixture that records the expected outbound. The SimulatedAdapter's strict matcher does the assertion for you.
5. For state capabilities (display from device), assert against fixture-decoded values — never hardcoded.
6. Update this document — flip the capability's status from `not yet covered` to `covered`.

## Hardware-only capabilities (out of scope here)

Capabilities that require live hardware verification (round-trip integrity,
bit-exact wave transfer, SDS timing) live in `test/e2e/` and are tested
against real devices via the make targets in [TESTING-E2E.md](TESTING-E2E.md).
That suite is complementary, not duplicative — capability specs assert the
*contract* between the UI and the device; e2e specs assert the *device*
itself behaves as expected.

## Document maintenance

This document lives at the top level of the repository alongside `TESTING.md`,
`SAMPLER-LIBRARY.md`, etc. It is owned by the project, not by any one feature
branch. Features may add, change, or strike capabilities — but the document
itself is a long-lived contract that outlives any individual milestone.

- Each capability change is part of a PR; the PR description references the capability ID.
- The roll-up table is updated in the same PR as the capability change.
- Removed capabilities stay in the document as `removed (<reason>, <PR link>)`. History is not deleted — a removed capability is still part of the audit trail.
- New device editors (future Roland or Akai work) get their own capabilities document at the same level (e.g., `AKAI-S3000XL-EDITOR-CAPABILITIES.md`). Capabilities common across devices may be promoted to a shared `EDITOR-CAPABILITIES-COMMON.md` if the duplication grows.
