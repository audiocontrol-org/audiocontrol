# Brief: closing the SCSI Plug `0x106e` patcher question

**Date:** 2026-04-21
**Audience:** eng team review
**Decision:** which next step to take after Path A.11's Outcome B
**Author asks for:** ack on a recommended next move (pick one of three)

## Background (one paragraph)

The MESA II SCSI Plug binary contains a `BRA.W +0xf0` at file `0x106e` (MEASURED). That BRA is reached by multiple caller families across `CSCSIPlug::SendData` and targets `0x1160` — code which in our binary functions as a "no send happened" exit gate. Path A.9 showed the SRAW handler's 7-arg stack frame matches `SMSendData`'s (file `0x160c`) calling convention exactly, making SMSendData a strong CANDIDATE for the intended target. Path A.11 then went looking for the code that patches the 2-byte displacement at file `0x1070-0x1071` at load/init time. Result: no such code exists in either binary we have. MESA II demonstrably works on real hardware, so our mental model is missing something.

## Where we stand (claim grades)

- **MEASURED:** extracted binary has `BRA.W +0xf0` at file `0x106e`, targeting the `0x1160` exit-gate code. Multiple caller families in `SendData` feed this shared sender slot. No code in either binary writes to file `0x1070-0x1071`.
- **MEASURED:** with the binary as-extracted, the SRAW caller path specifically leaves D3 at the `0xd505` sentinel before `JSR 0x106e`; the gate at `0x1160` tests D3 and exits. So — for that one caller family in this binary — the shared slot's current BRA produces a no-op.
- **CANDIDATE:** `SMSendData` (file `0x160c`) is the intended target of the shared slot. Evidence: exact calling-convention match against the SRAW handler's 7-arg push. Not settled — it is a structural fit, not a proven patch.
- **CANDIDATE (strongest for "why it works in production"):** the `scsi-plug-rsrc.bin` we extracted is a pre-shipped/development variant; the production resource has a different displacement baked in.
- **OPEN:** a separate installer resource (not in either binary we have) writes the displacement at load time. OR: another mechanism we haven't considered explains production behavior.
- **ELIMINATED:** Mac OS Code Resource Manager relocation (A.11 exhaustive negative scan).

**Note on the Phase 3 question:** the CDB construction inside `SMSendData` body (file `0x160c` onwards) is MEASURED — `MOVE.B #$0C, (-6,A6)` at `0x163c`, raw 24-bit big-endian byte count, JSR to bus emission at `0x169a`. But whether those bytes actually go out on the SCSI bus depends on whether `SMSendData` is reached at all, which depends on the CANDIDATE patch identity. So "SRAW outbound CDB wire bytes = `0C 00 ...`" is MEASURED-conditional-on-CANDIDATE, not unconditionally MEASURED. (Calibration correction per Codex parity review of the first brief draft.)

## The three proposed next moves

### Option 1 — Spot-check `macbin` vs `rsrc.bin` for displacement differences

What it does: byte-compare the MacBinary-wrapped version against our extracted resource at the displacement bytes; check whether the extraction step lost anything.

Cost: ~5 min.

Why it's worth doing: cheapest confirmation/refutation of the "extraction artifact" sub-hypothesis. If the macbin has different bytes at the right offset, B1 collapses to "extraction bug, fix the extractor."

Why it might not move us: if both are identical (likely), we learn nothing new.

### Option 2 — Check whether BULK is also broken or only SRAW

What it does: decode the D3 initialization for the BULK path's JSR-0x106e call site (file `0x0fbc`); compare to SRAW's D3=sentinel pattern at file `0x0ec8`.

Cost: ~10 min, single targeted decode.

Why it's worth doing: BULK upload is known to work end-to-end on real hardware (Phase 2 testing). If BULK also routes through `0x106e` with D3=sentinel and is also a no-op in our binary, that's strong evidence the binary is uniformly pre-patch (B1). If BULK has a different code path that doesn't depend on `0x106e`, it tells us SRAW alone is broken in our binary.

Why it might not move us: doesn't directly find the patcher, only narrows the hypothesis space.

### Option 3 — Defer; post #315 sync; pick up next session

What it does: document Outcome B + the hypothesis matrix on issue #315; let the team weigh in on which of B1 / B2 to pursue; come back fresh.

Cost: ~5 min for the comment.

Why it's worth doing: we've done 5 chained agent decode rounds today (A → A.5 → A.6 → A.7 → A.8 → A.9 → A.11). Diminishing returns are real. The decisive next steps may not be more decode at all — they may be (a) re-extracting the binary from a different source, or (b) checking whether Akai shipped a separate installer file we missed.

Why it might not move us: pause on momentum.

## Recommendation (revised per Codex parity review)

**Option 3** (post #315 sync; defer the decisive next step to team input).

Rationale:
- `0x106e` is now understood as a shared central send engine fed by multiple caller families, not a one-off SRAW/BULK mystery. A single-branch D3 check (Option 2) is a narrow clue, not a decisive discriminator between B1 / B2 / B3.
- The hypothesis matrix (extraction artifact vs external installer vs other) is most efficiently sharpened by broader team input — one of the B1/B2 paths may be obvious to someone with more context on the Akai distribution format.
- Option 2 is still fine as a cheap additional clue if we want it, but framed as narrowing not closure.
- Option 1 (macbin vs rsrc.bin spot-check) is a sanity check, not load-bearing — likely confirms the rsrc.bin IS the macbin minus the MacBinary header.

## Practical implication (calibrated)

**If** the CANDIDATE patch-target identity (SMSendData) holds, the harness can reproduce the intended behavior by writing a 2-byte displacement that retargets the shared slot to SMSendData (displacement `05 9c` from `0x1070`, derived from `0x160c - 0x1070 = 0x059c`). This is MEASURED-conditional-on-CANDIDATE: safe to try; worth validating end-to-end on hardware before treating as proved.

If the CANDIDATE doesn't hold (e.g., the production patch target is a different function we haven't identified), the same structural fact still applies — the shared slot needs a retarget; only the destination changes. The harness approach generalizes.

Either way, the Phase 3 CDB-wire-bytes finding is **a statically derived candidate wire format, not a hardware-verified one.** Hardware verification (task #28) is what promotes it from CANDIDATE to MEASURED-on-the-wire.

## Decision needed

Pick one:
- [ ] Option 1 (spot-check macbin vs rsrc.bin) — sanity check, not load-bearing
- [ ] Option 2 (BULK D3 check) — cheap narrowing clue, not decisive
- [ ] Option 3 (post #315 sync, await team input) — **recommended per Codex parity review**
- [ ] Option 2 + 3 — if you want the narrowing clue bundled with the sync
- [ ] Skip the patcher question entirely; start P1 harness terrain with the CANDIDATE patch-target identity as the working assumption

## Revision history

- 2026-04-21 v1: initial brief recommending Option 2 + 3
- 2026-04-21 v2 (this version): recalibrated claim grades per Codex parity review (#315 comment 4292145006); recommendation changed to Option 3; "write `05 9c`" prescription reframed as MEASURED-conditional-on-CANDIDATE, not unconditional
