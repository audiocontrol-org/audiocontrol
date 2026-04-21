# Brief: closing the SCSI Plug `0x106e` patcher question

**Date:** 2026-04-21
**Audience:** eng team review
**Decision:** which next step to take after Path A.11's Outcome B
**Author asks for:** ack on a recommended next move (pick one of three)

## Background (one paragraph)

The MESA II SCSI Plug binary contains a `BRA.W +0xf0` at file `0x106e` that, in the binary as we have it, makes `CSCSIPlug::SendData` a no-op for SRAW (the audio-upload path). Path A.9 established by calling-convention match that the slot is supposed to point at `SMSendData` (file `0x160c`), which builds the real CDB (`0C 00 [len_hi] [len_mid] [len_lo] 80` — MIDI Send opcode, raw bytes). Path A.11 then went looking for the code that patches the 2-byte displacement at file `0x1070-0x1071` from `00 f0` to `05 9c` at load/init time. Result: no such code exists in either binary we have. MESA II demonstrably works on real hardware, so our mental model is missing something.

## Where we stand (claim grades)

- **MEASURED:** SRAW outbound CDB wire bytes (Phase 3 question is technically answered).
- **MEASURED:** with the binary as-extracted, SRAW path is a no-op — D3 sentinel survives the BRA-to-epilogue, gate at 0x1160 exits SendData.
- **MEASURED:** no code in either binary writes to file 0x1070-0x1071.
- **CANDIDATE (strongest):** the `scsi-plug-rsrc.bin` we extracted is a pre-shipped/development variant; the production resource has `05 9c` baked in.
- **OPEN:** a separate installer resource (not in either binary we have) writes the displacement at load time.
- **ELIMINATED:** Mac OS Code Resource Manager relocation.

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

## Recommendation

**Option 2, then Option 3** (in that order, same session).

Rationale:
- Option 2 is the single highest-information-per-minute check available. It distinguishes "binary is uniformly pre-patch" from "only SRAW is broken in our extraction" — a meaningful narrowing.
- After Option 2 lands, post the #315 sync (Option 3) with the additional finding included. The team gets a sharper question to weigh in on.
- Option 1 is fine as a sanity check but isn't load-bearing — likely confirms what we already know (extraction looked right; the rsrc.bin IS the macbin contents minus the MacBinary header).

## Practical hard truth

Regardless of which hypothesis is correct, the **harness implication is the same**: write `05 9c` to `runtime_base + 0x0ad2` before the first SRAW call. The Phase 3 question (CDB wire bytes) is answered. The patcher question affects whether we understand the system fully, not whether we can ship a fix.

If the team prefers to defer the patcher question and start P1 harness terrain work, that's also defensible — we can apply the patch in the harness directly and revisit the "who patches it in production" question if and when it matters for the bridge implementation.

## Decision needed

Pick one:
- [ ] Option 1 (spot-check macbin vs rsrc.bin)
- [ ] Option 2 (BULK D3 check — recommended)
- [ ] Option 3 (defer, post #315, pick up next session)
- [ ] Option 2 + 3 (recommended sequence)
- [ ] Skip the patcher question entirely; start P1 harness terrain
