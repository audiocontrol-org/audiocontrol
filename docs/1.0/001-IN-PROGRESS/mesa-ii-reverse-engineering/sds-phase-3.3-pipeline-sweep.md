# Phase 3.3: Pipeline-Depth Sweep (Negative Result — Triggers #315 Reassessment)

**Date:** 2026-04-18
**Task:** #26
**Test:** `modules/e2e-infra/src/node/lib/test-sds-pipeline-sweep.ts`
**Bridge change:** added `pipeline_depth` JSON field to `sample-upload` WebSocket message, plumbed through `ScsiWork::SdsUpload` → `upload_sample` → `upload_sample_inner`. Default 1 (synchronous send→read, equivalent to previous behavior). depth=N keeps N batches sent-but-not-yet-ACK-read.

## Hypothesis (post Phase 3.2)

Phase 3.2 showed batch size doesn't help — bottleneck appears to be per-packet round-trip, not per-CDB overhead. Pipelining ACK reads should overlap bridge-side send/read with device-side processing, attacking the actual bottleneck.

## Measured

| pipeline_depth | total_ms | KB/s | ms/packet | speedup |
|---|---|---|---|---|
| 1 | 10826 | 2.89 | 27.07 | **1.00x** (baseline) |
| 2 | 15440 | 2.02 | 38.60 | 0.70x |
| 3 | 15759 | 1.98 | 39.40 | 0.69x |
| 4 | 18486 | 1.69 | 46.21 | 0.59x |
| 6 | 17597 | 1.78 | 43.99 | 0.62x |
| 8 | 17516 | 1.78 | 43.79 | 0.62x |

(16000-sample upload to slots 70-75, batch_size=20 throughout, all measurements through production /sds/stream WebSocket path.)

## Result

**Pipelining makes things WORSE.** depth=1 is the local optimum. Any higher depth degrades throughput by 30-40%.

## Diagnosis

Combined with Phase 3.2's finding (batch size also bottoms at 20), the picture is now clear:

**The 2.89 KB/s throughput at batch=20, depth=1 IS the device's natural SDS processing rate.**

Per-packet math:
- 27ms/packet × 80 audio bytes/packet = 2.96 KB/s effective audio throughput
- Wire bytes: 27ms × 125 wire bytes/packet = 4.63 KB/s wire (SDS encodes each 16-bit sample as 3 wire bytes — 50% overhead)

The device processes each SDS packet in ~27ms regardless of how many we send simultaneously or how aggressively we read ACKs. Sending more in flight just causes the device to fall behind, drop packets, or stall — all of which degrade throughput further.

## Implication for the Phase 3 plan

**Both Phase 3.2 and Phase 3.3 produced no throughput improvement.** The remaining Phase 3.4 (skip per-packet ACK validation) is unlikely to help because:
- The bottleneck is device processing time, not ACK transmission
- We already verified ACKs in batch (current code reads `batch_size * 6` bytes after each batch, then validates) — there's no per-ACK overhead to reduce
- Skipping validation entirely just gambles on silent corruption for no expected speedup

**This result triggers the #315 stop criterion: "plateau below 4 KB/s after reasonable optimization → reopen strategic conversation."**

## What's still possible (none of which helps the SLNGTH bug fix)

1. **Accept 2.9 KB/s as the SDS limit.** Ship Option 1 anyway. A 1MB sample takes ~6 min — painful but works. Documentation needs to set user expectations clearly.
2. **Try Phase 3.4 anyway** for completeness. Expected outcome: no improvement, maybe slight regression from skipped validation overhead.
3. **Try larger SDS data packets** if the SDS protocol permits. The current 120-byte payload (40 samples) is the standard. Some implementations allow larger; the S3000XL might or might not. Untested.
4. **Investigate the existing ASPACK path** — `upload_sample_aspack` is documented as "10x faster than SDS" (~16-23 KB/s) but doesn't update SLNGTH (which is the whole reason we pivoted to SDS). Could a HYBRID work? Theory C from earlier sessions said no — device waits for the full SDS transfer to commit. But worth re-examining whether some device-side commit trigger exists.
5. **Pivot to Option 2** per the #315 decision tree — expand harness to drive `SendAudioBufferToSampler` end-to-end. The MESA reference shows the device CAN process samples faster than SDS, just not via SDS.

## Verdict against #315 stop criteria

- Best throughput: 2.89 KB/s — UNCHANGED from baseline after both Phase 3.2 and 3.3
- Below 4 KB/s plateau threshold? **YES.**
- Stop criterion triggered: **reopen the strategic conversation per #315.**

The eng team should weigh in on whether to:
- (a) Accept 2.9 KB/s and ship as-is
- (b) Accept 2.9 KB/s but expand the throughput band (e.g., revise target to 3 KB/s minimum, document the limit)
- (c) Re-evaluate Option 2 (harness end-to-end) given that Option 1 plateaued
- (d) Re-evaluate Option 3 (Akai opcode scan) — though firmware risk still applies

## Bridge change kept

The `pipeline_depth` field is left in place as a tuning knob for any future investigation. Default remains 1 (synchronous, the optimum). The `batch_size` knob from Phase 3.2 is also left in place.
