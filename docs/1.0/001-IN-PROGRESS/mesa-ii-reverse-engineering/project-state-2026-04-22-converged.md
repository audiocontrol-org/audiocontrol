# MESA II reverse engineering — project state at convergence

**Date:** 2026-04-22
**Status:** Investigation converged for product purposes (per Codex parity #315 comment 4293361xxx). Decision: accept current bridge behavior; promote state-precondition to strongest *residual* hypothesis (not active blocker).

---

## What this project set out to answer

The bridge implementation showed that uploading samples to S3000XL via SDS hits a 2.91 KB/s ceiling — the device's natural per-packet rate. The MESA II reverse engineering effort sought to understand whether MESA II (Akai's official Mac OS 9 editor) achieves higher throughput via a different protocol shape, and if so, replicate that shape in the bridge.

## What we learned

### The static-decode arc (Path A → A.18)

Eighteen agent-driven decode rounds (with Codex parity branch as independent reviewer) traced MESA II's sample-data send chain through both available binaries:

- **`scsi-plug-rsrc.bin`** (12,053 bytes; the SCSI Plug 2.1.2 PLUG resource)
- **`sampler-editor-rsrc.bin`** (506,909 bytes; the Sampler Editor 2.3 EDIT resource)
- **`MESA-II.dataonly`** (413,689 bytes; the main MESA II app, extracted from the Mac OS 9 SheepShaver disk image)

Key MEASURED findings:

| Question | Answer (with grade) |
|---|---|
| What CDB does the candidate `SMSendData` body emit? | `0C 00 [len_hi] [len_mid] [len_lo] 80` (MIDI Send opcode; 24-bit big-endian byte count; CDB[5]=0x80 for SRAW/BULK-via-SCSI) — **MEASURED inside the candidate body** (A.9+A.12+A.13) |
| Is the audio buffer encoded? | No — raw bytes; no nibble, no 7-bit, no transformation — **MEASURED** by exhaustive negative scan (A.13) |
| What SCSI driver does it use? | Old Mac SCSI Manager `_SCSIWrite` trap `$A981` at scsi-plug file 0x224e — **MEASURED** (A.13; A.9 had originally guessed `_SCSIDispatch $A089` — corrected) |
| Does the candidate body deterministically emit `CDB[5]=0x80` for mode=0x01? | Yes — MEASURED (A.14): no mutation between SMSendData entry (0x160c) and CDB-construction (0x1670) nullifies the mode byte |
| Does the production sampler-editor binary patch scsi-plug at runtime to retarget the dispatch slot? | **MEASURED-clean across all 7 decode rounds** — A.11/A.15 (no direct stores), A.16 (loader doesn't patch), A.17 (plug INIT path no writes via any addressing mode), A.18 + Codex parallel (callback at $1E5A is `SendCommandToEditor`, an inline tag-dispatcher routing 122 editor commands; doesn't patch plug) |

### The hardware-verification arc (Phases A-D)

Real S3000XL hardware testing via the existing bridge with a custom test harness (`modules/e2e-infra/src/node/lib/test-mesa-cdb-flag.ts`) and bridge-side REQUEST SENSE auto-fetch (added to `services/scsi-midi-bridge/src/s2p_client.rs`):

| Phase | Result |
|---|---|
| A: connectivity proof | RMDATA SysEx with flag=0x00 → 210-byte reply via poll/read; PASS |
| B: sense plumbing sanity | Invalid opcode 0x99 → status=2, sense `02 00 00 00` (non-standard 4-byte format); PASS with caveat |
| C: RSDATA flag=0x00 vs 0x80 | flag=0x00 PASS (210-byte reply); flag=0x80 status=2, sense `03 00 00 00` |
| D: SDATA WRITE flag=0x00 vs 0x80 | flag=0x00 PASS; flag=0x80 status=2, sense `03 00 00 00` |

**Cross-phase pattern:** the sampler distinguishes `02` (invalid command class) from `03` (recognized command rejected for specific reason). flag=0x80 is universally rejected across opcode families (refuting the READ-vs-WRITE direction hypothesis). flag=0x00 is universally accepted.

## Hypothesis ranking at convergence

| Hypothesis | Status |
|---|---|
| Direct patch by MESA II / sampler-editor | **CLOSED** — exhaustively negative across 7 static decode rounds + cross-verified by Codex parity |
| Self-patch by scsi-plug | **CLOSED** — A.17 PC-relative LEA scan in plug code returned 3 hits, all targeting PLUG base; zero in 0x1060-0x1080 range |
| Patch via runtime-resolved callback | **CLOSED** — callback identified as `SendCommandToEditor` (service-shape, not transport); A.18 + Codex independent confirmation |
| State-precondition makes flag=0x80 acceptable | **STRONGEST RESIDUAL** (not active blocker) — production reaches the same body but in a sampler state where flag=0x80 is accepted; no concrete visible mechanism to target |
| Deeply-indirect downstream via `DispatchCommandFromModule` | **THEORETICAL OPEN** — one of 122 editor commands dispatched by `SendCommandToEditor`; nothing transport-shaped in any visible code along the chain |

## Bridge behavior decision

**Ship the current bridge behavior** (`CDB[5]=0x00` for all SCSI MIDI Send operations).

Justification:
- `CDB[5]=0x00` is universally accepted by hardware (Phase A-D MEASURED)
- All currently-tested operations work end-to-end (RMDATA SysEx round-trip, RSDATA, SDATA WRITE)
- The candidate `CDB[5]=0x80` shape was rejected by hardware in every test
- The remaining unknown (state-precondition that makes 0x80 acceptable) is a deep indirect possibility, not a concrete actionable mechanism
- Continued investigation is now research, not product work

If a future regression or missing operation surfaces:
- Reopen from `DispatchCommandFromModule` / runtime-state terrain
- NOT from the old patch hypothesis (which is closed)

## Investment summary

- **Sessions:** ~13 (mid-April 2026)
- **Decode rounds:** 18 (A through A.18)
- **Hardware test phases:** 4 (A-D)
- **Independent parallel review:** Codex parity branch (independent decode + cross-verification at every key inflection)
- **Process lessons saved as feedback memories:** 5 new (`feedback_check_sync_source_before_posting`, `feedback_interpretation_vs_semantics`, `feedback_restate_goal_at_delegation`, `feedback_xxd_grep_unreliable`, `feedback_mesa_disk_image_location`)
- **External artifacts acquired and inventoried:** 2 disk images (Mac OS 9 with MESA II v1.2 install; Mac OS 7 with MESA 1.3 install for lineage comparison)

## Community writeup

This investigation is significant vintage-computing reverse engineering work. The full A.* arc + cross-parity protocol + hardware-verification methodology is worth packaging as a long-form writeup for vintage sampler / classic-Mac RE community. Deferred until the bridge ship is complete.

## What's next (product-side)

1. Confirm bridge implementation already uses `CDB[5]=0x00` (it does, per `services/scsi-midi-bridge/src/s2p_client.rs:291`)
2. Verify SLNGTH bug status (the original Phase 3 motivation) — separate question; may already be resolved by other work
3. Close GitHub issue #315 once decision is documented and bridge is verified shipping
4. Optional: extract MESA 1.3 binaries for archive (currently disk-image-only on local machine; binaries-large/ gitignored)
