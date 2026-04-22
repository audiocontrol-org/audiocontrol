# Test plan: validate MESA II's MEASURED CDB[5]=0x80 shape on real S3000XL

**Date:** 2026-04-21
**Audience:** Codex parity review
**Asks:** review of the test design before execution; flag confounders / blind spots / better discriminators

## Question being tested

Does the S3000XL accept the SCSI MIDI Send CDB shape that MESA II's static decode shows it MEASUREDLY emits?

```
CDB:    0C 00 [len_hi] [len_mid] [len_lo] 80
Data:   raw bytes per the caller's payload pointer
Driver: _SCSIWrite trap $A981 (old Mac SCSI Manager)
```

Specifically: the byte 5 = `0x80` (mode=0x01 in MESA's parameterization), used by MESA for SRAW audio AND for BULK-via-SCSI-fallthrough (BULK handler at scsi-plug 0x0e9e tests SCSI-mode flag and BNE.S to SRAW handler at 0x0ec0).

## Going in: what's MEASURED, what's CANDIDATE, what's OPEN

**MEASURED on the static side (this session, A.9 + A.12 + A.13):**
- SMSendData at scsi-plug file 0x160c builds CDB `0C 00 [len_hi] [len_mid] [len_lo] [flag5]` where flag5 = 0x80 if mode_byte != 0, else 0x00 (formula at file 0x1670).
- Mode byte values across all 6 `JSR 0x106e` caller families: only 0x00 (SYSX/MIDI sites) and 0x01 (SRAW + BULK-via-SCSI-fallthrough sites).
- Audio buffer passes raw to bus emission (no nibble or 7-bit encoding in any code path between SRAW handler and `_SCSIWrite`).

**MEASURED on the hardware side (test run earlier in this session):**
- INQUIRY, MIDI enable, RMDATA SysEx with flag=0x00, poll, read all work end-to-end. Sampler reports `S3000XL SAMPLER` and returns 210-byte RMDATA reply.
- Same RMDATA SysEx with flag=0x80 → SCSI status=2 (CHECK CONDITION), no sense data, no reply.

**CANDIDATE:** the runtime patch at scsi-plug 0x1070 retargets to `SMSendData`. (B1/B2 hypothesis matrix from A.11; not on critical path for this test plan.)

**OPEN:** whether MESA's actual SRAW/BULK-with-flag=0x80 shape is accepted by the sampler. The earlier test failed but with the wrong SysEx context (RMDATA is a SYSX-family opcode that MESA itself never sends with flag=0x80; testing it that way doesn't validate or refute MESA's design).

**Test-design lesson from earlier run:** the bridge's `execute_scsi` does not auto-fetch sense data on CHECK CONDITION. Empty sense fields mean we can't see why the sampler rejected. Diagnostic capability needs upgrading before any rejection can be properly interpreted.

## Test-design discipline

Per user instruction: the design must make it impossible to misconstrue connectivity issues as protocol rejection. That means:

1. **Positive controls run first.** If they fail, abort — do not interpret subsequent results.
2. **Side-by-side comparisons.** Same payload sent two ways (only the variable under test changes).
3. **Diagnostic capture.** Every rejection captures sense data so we know WHY.
4. **State isolation.** Each test phase drains queues + resets MIDI mode to known state.
5. **Multiple opcode families.** Single-opcode tests can be confounded by opcode-specific rules.

## Pre-work: bridge enhancement

**P0:** add automatic REQUEST SENSE follow-up to `s2p_client::execute_scsi` (or as an opt-in flag on `/scsi/exec`) so any non-zero status response is enriched with the sense data for `KEY/ASC/ASCQ` interpretation.

Without this, a rejection like the one we just saw is uninterpretable: we know the sampler said "no" but not "no, because…".

Estimated cost: small Rust change (15-30 min including deploy + smoke test).

## Phase plan

### Phase A: Connectivity proof (positive control, gate-step)

Same as the earlier test's Phase 1, but now with sense capture available.

| Step | Action | Pass criterion |
|---|---|---|
| A1 | INQUIRY | status=0; product contains "S3000" |
| A2 | MIDI enable (CDB 0x09) | no exception |
| A3 | Drain stale MIDI buffer (poll-and-read loop until poll=0) | terminates within 10 iterations |
| A4 | RMDATA `F0 47 cc 0E 48 F7` flag=0x00 | status=0 |
| A5 | Poll → read | reply ≥ 1 byte starts with `F0` |

If any A-step fails, abort. The sampler is in a state we can't reason about.

### Phase B: Sense-data sanity (calibration)

Confirm REQUEST SENSE works at all. Send a deliberately invalid CDB and confirm sense data is returned with a reasonable KEY/ASC/ASCQ.

| Step | Action | Pass criterion |
|---|---|---|
| B1 | Invalid opcode `0x99 00 00 00 00 00` | status != 0; sense.key = ILLEGAL_REQUEST (0x05); sense.asc = INVALID_OPCODE (0x20) |

If B1 fails, REQUEST SENSE plumbing is broken; abort and fix.

### Phase C: BULK-family opcode comparison (the actual question)

Use BULK-family SysEx (opcode `0x0A` = RSDATA, read sample header; well-known to work and produces a known reply for a known sample slot). MESA routes `0x0A` through the BULK handler, which under SCSI-mode falls through into the SRAW handler at 0x0ec0 → CDB[5]=0x80.

Two sub-tests, each in fresh state (drain + cycle MIDI mode between).

| Step | Action | Pass criterion |
|---|---|---|
| C1a | RSDATA for sample 0 with flag=0x00 (baseline) | status=0; reply via poll ≥ ~192 bytes; reply starts `F0 47 cc 0A 48` |
| C1b | Same RSDATA with flag=0x80 | record status, sense (KEY/ASC/ASCQ), data_in length, poll-result-after |

Compare C1a vs C1b. Three meaningful outcomes:

| C1b result | Interpretation |
|---|---|
| status=0; reply via poll ≥ ~192 bytes | MESA's flag=0x80 is accepted in BULK context; existing bridge comment is too strong; bridge can adopt 0x80 for BULK |
| status=0; reply inline in `data_in` of the send CDB | MESA's flag=0x80 changes reply mechanism (data_in carries reply directly, bypassing poll/read) — different protocol pattern |
| status != 0; sense KEY=0x05 ASC=0x20 INVALID_OPCODE | sampler rejects BULK-family + flag=0x80 outright. MEASURED MESA shape doesn't run on this device as-is. Strong signal something's missing in our model. |
| status != 0; sense indicates state precondition (e.g., COMMAND_SEQUENCE_ERROR 0x2C) | MESA flag=0x80 needs a state setup we're not doing. Identify what setup MESA does first. |
| status != 0; sense data still empty even after REQUEST SENSE | sampler doesn't surface failure reason via standard sense — protocol is non-standard. Falls back to MESA bus-capture. |

### Phase D (only if Phase C passes): BULK SDATA write probe

If RSDATA-with-flag=0x80 succeeds in Phase C, attempt a BULK SDATA WRITE (opcode `0x0B`) with a tiny payload (2-byte sample-index + minimal data) targeting a known-empty sample slot.

| Step | Action | Pass criterion |
|---|---|---|
| D1a | Read current sample slot N's header (positive control: confirms slot exists, captures original) | status=0; reply received |
| D1b | BULK SDATA write to slot N with flag=0x80, payload = original header bytes (no actual change) | status=0; ack reply received |
| D1c | Re-read slot N's header | matches D1a (no corruption) |

Skipped if Phase C fails — D requires C to be valid.

## What this plan does NOT cover (out of scope)

- **Actual SRAW audio transfer** (no SysEx framing, raw audio bytes) — that requires established BULK upload session (sample slot + header committed), which is multi-step. Defer until Phases A-D complete.
- **Throughput comparison** (CDB[5]=0x80 vs 0x00 for the same operation) — premature. First confirm acceptance.
- **Full MESA flow replication** — explicitly out of scope. This plan tests one CDB-byte variation, not the full editor protocol.
- **The patcher question (A.11 / B1 / B2)** — independent of this plan.

## What we want from Codex

1. **Blind spots in the test design.** Anything that could let us conclude "MESA shape doesn't work" when actually our test setup was wrong?
2. **Better discriminators.** Is there a sub-test that would more cleanly distinguish "wrong opcode context" from "missing state setup" from "actually rejected"?
3. **Phase D risk.** Is there a known-safe sample slot to write to without potentially corrupting the user's working device state? (Slot 0 is conventional for tests but may have user data.)
4. **Sense-data interpretation.** Akai-specific extensions to standard SCSI sense beyond the generic KEY/ASC/ASCQ? Worth planning for non-standard fields?
5. **State preconditions we may be missing.** MESA's actual flow before the first BULK-with-flag=0x80 call: does it issue any setup commands (channel select, mode set, etc.) we should replicate?

## Execution mechanics (already proven this session)

- Bridge deployed via `make deploy-scsi-bridge` (verified `samplerReachable: true`)
- Bridge accessed via SSH local-forward tunnel (`ssh -fNL 7034:localhost:7033 orion@s3k.local`) due to a node-fetch-vs-direct-IPv4 quirk on this Mac
- Test script lives at `modules/e2e-infra/src/node/lib/test-mesa-cdb-flag.ts` (already drafted; needs Phase B + Phase C + sense-capture additions)
- Output captured to timestamped logs under `/tmp/mesa-cdb-flag-run-N.log`

## Open question for the user (Orion)

Phase D writes to a sample slot. Which slot is safe to use? Is slot 0 always available, or should I read the disk catalog and pick an empty one?
