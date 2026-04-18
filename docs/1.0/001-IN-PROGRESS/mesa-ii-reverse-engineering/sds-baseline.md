# SDS Upload Baseline (Phase 3.1, task #24)

**Date:** 2026-04-18
**Bridge build:** `53c3dc44@1776395615`
**Test:** `modules/e2e-infra/src/node/lib/test-sds-baseline.ts`
**Path:** Bridge WebSocket `/sds/stream` (production code path used by web app)
**Hardware:** Live S3000XL via SCSI on `s3k.local:7033`, scsi2pi 6.2.1

## Measured baseline

| Size | Total ms | First progress | Last progress | Complete | Throughput | ms/packet |
|---|---|---|---|---|---|---|
| 1000 samples (2 KB) | 1749 | 1187 | 1248 | 1364 | 1.12 KB/s | 54.6 |
| 4000 samples (8 KB) | 3344 | 972 | 3027 | 3071 | 2.34 KB/s | 30.7 |
| 16000 samples (31 KB) | 10754 | 1029 | 10368 | 10480 | **2.91 KB/s** | **26.2** |

## Observations

1. **Steady-state throughput: ~2.9 KB/s** (larger run, startup amortized). Slightly better than the "remembered" 2.2 KB/s from earlier sessions.
2. **Startup overhead is ~1 second**, fairly constant across sample sizes. Likely MIDI session enable + SDS dump header send + initial ACK wait. Dominates small-sample throughput.
3. **Per-packet time floors at ~26 ms** at steady state. SDS data packet is 120 bytes wire + framing (~125 bytes total) per 26 ms = ~4.8 KB/s wire, ~2.9 KB/s audio (each 16-bit sample encoded as 3 wire bytes).
4. **Throughput scales with size** as startup amortizes. A 100 KB sample would take ~34s at current rate; 1 MB would take ~6 min.

## Targets (per #315)

| Threshold | Throughput | Need vs baseline |
|---|---|---|
| Current steady-state | 2.91 KB/s | (measured) |
| Ship minimum | 8 KB/s | 2.8x improvement needed |
| Aspirational | 15 KB/s | 5.2x improvement needed |
| Reassessment trigger | <4 KB/s after optimization | 1.4x improvement floor |

## Where the bottleneck likely lives

- **Per-packet round-trip**, not raw wire bandwidth. ~26 ms per 125-byte packet = ~4.8 KB/s instantaneous wire rate, but the audio-bytes-per-second figure is lower because SDS framing adds 50% overhead.
- **CDB overhead amortizes well at scale** — there's a per-CDB cost that dominates small batches (current batch size: 20 packets/CDB). Larger batches should reduce the per-packet share of CDB overhead.
- **ACK round-trip is per-packet** in the current implementation. Pipelining ACK validation should reduce wait time.

## Optimization plan (Phase 3.2-3.5)

The baseline above is the "1.0x" against which all subsequent runs will be compared. Re-run `test-sds-baseline.ts` after each optimization step:

1. **Phase 3.2 (task #25):** larger CDB batches (40, 60, 100 packets/CDB). Expected: 2-5x.
2. **Phase 3.3 (task #26):** pipeline ACK validation. Expected: another 1.5-2x.
3. **Phase 3.4 (task #27):** skip per-packet ACK; rely on end-of-transfer + readback. Risky, validate carefully.
4. **Phase 3.5 (task #28):** hardware-verify final implementation, add atomic round-trip E2E test.

## Stop criteria

- Hit 8 KB/s steady-state on the 16000-sample test → ship Option 1
- Plateau below 4 KB/s after exhausting Phase 3.2-3.4 → reopen strategic conversation per #315
