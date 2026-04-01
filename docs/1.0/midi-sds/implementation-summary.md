# MIDI Sample Dump Standard (SDS) Support - Implementation Summary

**Status:** Phase 1-3 complete, hardware validated
**Feature Branch:** `feature/midi-sds`

## Summary

Generic MIDI SDS protocol implementation in `midi-core` (renamed from `shared-midi`), integrated into the Akai S3000XL client and editor. Validated against real S3000XL hardware with successful closed-loop transfers.

## What Was Built

### Phase 1: SDS Protocol Layer (`modules/midi-core/src/sds/`)

- **sds-types.ts** — Interfaces for all 7 SDS message types, transfer progress, sender/receiver options
- **sds-constants.ts** — Protocol constants (command bytes, limits, timing defaults)
- **sds-messages.ts** — Builders for all 7 message types, unified parser, checksum calculation/validation
- **sds-encoding.ts** — 7-bit MIDI sample data encoding/decoding for 8-28 bit depths, packet splitting/reassembly
- **sds-sender.ts** — Open-loop and closed-loop sender state machines with timeout/retry/progress
- **sds-receiver.ts** — Closed-loop receiver with checksum validation and ACK/NAK handshaking
- **sds-transfer.ts** — Re-exports + `requestSample()` convenience function
- **77 unit tests** covering messages, encoding, checksums

### Phase 2: S3000XL Integration (`modules/sampler-devices/src/devices/s3000xl/`)

- `sendSampleViaSds()` and `receiveSampleViaSds()` on `S3000xlClientInterface`
- Wired through the existing request serialization queue
- S3000XL hardcoded to 16-bit sample format

### Phase 3: Editor UI (`modules/akai-s3k-editor/`)

- Samples page at `/akai/s3000xl/editor/samples`
- `SampleTransferPanel` with sample dropdown, Receive button, progress bar, error display
- `useSampleTransfer` hook for transfer state management
- Send-to-device button stubbed for future file picker phase

## Key Decisions

- **Module rename:** `shared-midi` → `midi-core` for consistency with `editor-core` naming convention
- **Generic in midi-core:** SDS is device-agnostic, lives in shared MIDI layer, not device-specific
- **Pure functions for protocol:** Message builders, parsers, and encoding are stateless (easy to test)
- **Composition for transfers:** Sender/receiver are factory functions returning `{ start, cancel }`, not classes
- **Closed-loop default:** S3000XL client uses closed-loop mode for reliable transfers

## Hardware Testing Results

Validated against a real Akai S3000XL via MIDI (828mk3 interface).

### Findings

| Test | Result |
|------|--------|
| Open-loop receive (small sample, 256 samples) | All 7 packets received without ACKs |
| Dump request (`F0 7E 00 03`) | S3000XL responds with full dump — remote requests work |
| Closed-loop receive (large sample, 22,051 samples) | 552/552 packets, 0 checksum errors, 25.7s |

### S3000XL SDS Behavior

- **Closed-loop for large transfers** — sends bursts of ~50 packets, waits for ACKs, continues
- **Open-loop for small transfers** — sends all packets without waiting (fits in device buffer)
- **Standard SDS only** — "OPEN" protocol on device; "S3000" protocol is proprietary superset
- **Channel is 0-indexed** — "logical channel 1" on device = byte `0x00` on wire
- **Dump requests supported** — device responds to `F0 7E cc 03 sl sh F7` automatically (no front-panel interaction needed)
- **Packet counter wraps at 128** — confirmed in 552-packet transfer
- **No proprietary handshake needed** — standard SDS works directly
- **SDS send always creates a new sample** — the S3000XL appends incoming SDS samples to the end of its RSLIST regardless of the SDS sample number. The SDS sample number is metadata, not a storage address. To "replace" a sample: delete old via DELS, send new via SDS, new sample appears at end of list. Confirmed via hardware testing (sample count 6→7→8 with different SDS numbers).

## Testing

- 96 unit tests (messages, encoding, transfer state machines) — `cd modules/midi-core && npx vitest run`
- E2E tests (requires S3000XL hardware):
  - `make test-e2e-s3k-device ARGS="--grep 'SDS'"` — 4/5 passing
  - Passing: navigation, button states, receive from device, send to device
  - Failing: round-trip comparison (send then receive back) — see Known Limitations
- Hardware test script:
  - `tsx scripts/sds-hardware-test.ts request [sampleNumber] [channel]` — automated dump request + receive
  - `tsx scripts/sds-hardware-test.ts listen [channel]` — wait for device-initiated dump

## Known Limitations

- **SDS sample number ≠ RSLIST index** — the SDS sample number in the dump header is independent of the device's internal sample list order. Send always appends; to replace, delete first then send. The new sample will be at the end of RSLIST, not at the original position. Deleting a sample shifts indices of subsequent samples, which may break program keygroup references.
- SDS extensions (Sample Name, Header Extension) not implemented — not needed for S3000XL
- Transfer speed is limited by MIDI bandwidth (~25s for 1 second of 22kHz audio)
- No sample rate conversion during transfer
