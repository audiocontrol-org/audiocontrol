# Phase 3.2: Batch-Size Sweep (Negative Result)

**Date:** 2026-04-18
**Task:** #25
**Test:** `modules/e2e-infra/src/node/lib/test-sds-batch-sweep.ts`
**Bridge change:** added `batch_size` JSON field to `sample-upload` WebSocket message; plumbed through `ScsiWork::SdsUpload` → `upload_sample` → `upload_sample_inner`. Default remains 20.

## Hypothesis (per #315 plan)

Larger CDB batches should amortize per-CDB overhead (claimed ~113-213ms in the original code comment). Expected 1.5-2x throughput improvement at batch=100, possibly more.

## Measured

| batch_size | total_ms | KB/s | ms/packet | speedup |
|---|---|---|---|---|
| 20 | 10787 | 2.90 | 26.97 | **1.00x** (baseline) |
| 40 | 14211 | 2.20 | 35.53 | 0.76x |
| 60 | 26278 | 1.19 | 65.69 | 0.41x |
| 100 | 25887 | 1.21 | 64.72 | 0.42x |
| 150 | 25891 | 1.21 | 64.73 | 0.42x |
| 200 | 25694 | 1.22 | 64.23 | 0.42x |

(16000-sample upload to slot 80-85, all measurements through production /sds/stream WebSocket path.)

## Result

**batch_size=20 is the local optimum.** Larger batches make things worse:
- batch=40 → 24% slower than baseline
- batch=60+ → 58% slower, plateau at ~1.2 KB/s
- The plateau at ≥60 takes ~26s regardless of batch size — a fixed cost per upload

## Diagnosis

Per-batch time at large sizes scales roughly linearly with batch size:
- batch=60: 400/60 = 6.67 batches × ~3.85s/batch = ~26s
- batch=100: 4 batches × ~6.5s/batch = ~26s
- batch=200: 2 batches × ~12.85s/batch = ~26s

So each packet in a large batch costs ~64ms — much higher than the ~27ms/packet at batch=20.

**Most likely cause:** the S3000XL processes incoming MIDI packets serially internally, regardless of how many we send in one CDB. With small batches, the device can interleave packet processing with bridge-side per-CDB overhead. With large batches, the device receives packets faster than it can process them, fills its MIDI receive buffer, and the SCSI handshake stalls until the device can drain.

The original code comment (`batch of 20 gives ~9x speedup`) was true relative to `batch=1` (~227ms/packet) but did NOT extrapolate beyond 20. Whoever set 20 had likely already found this curve experimentally.

## Implication for the Phase 3 plan

**Phase 3.2 yields no improvement.** batch_size=20 stays as the production value.

The bottleneck is now confirmed as **per-packet device round-trip (~27ms at batch=20)**, not per-CDB overhead as the original comment suggested. To reduce per-packet round-trip we need to stop *waiting* for each packet's ACK before sending the next.

Path forward updated:
- ~~Phase 3.2 (larger batches)~~ — done, no improvement
- **Phase 3.3 (pipeline ACK validation)** — the real lever now. If we can stream packets without waiting for ACKs and only validate at the end, per-packet time could drop dramatically. Expected payoff much higher than the original "1.5-2x" estimate since this attacks the actual bottleneck.
- **Phase 3.4 (skip per-packet ACK)** — same idea, more aggressive. Risk: silent corruption.

## Verdict against #315 stop criteria

- Best throughput from batch sweep: 2.90 KB/s — same as baseline, not above
- Above the 4 KB/s plateau threshold? **No.** But Phase 3.2 was the wrong knob to turn — Phase 3.3 directly addresses the actual bottleneck. Continuing per the plan, NOT yet triggering reassessment.

## Bridge change committed

The `batch_size` field is left in place as a tuning knob for future investigations. Default remains 20. Test scripts (`test-sds-baseline.ts`, `test-sds-batch-sweep.ts`) use it.
