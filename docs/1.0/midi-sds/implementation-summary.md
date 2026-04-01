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
- **Send-to-device sample number mapping is unresolved** — sending a sample via SDS with a given sample number does NOT overwrite the existing sample at that slot index. The S3000XL ACKs all packets (transfer appears successful) but the original sample remains unchanged when read back via dump request. The SDS sample number in the dump header may not correspond to the internal sample slot index returned by RSLIST. Further investigation needed (see Known Limitations).

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

- **Send-to-device round-trip not yet working** — the S3000XL ACKs all sent packets but does not appear to store the sample at the expected slot. When the same slot is read back via dump request, the original sample is returned unchanged. Root cause under investigation — possibilities: (1) SDS sample numbers don't map to RSLIST indices, (2) the S3000XL stores SDS-received samples in a separate staging area, (3) additional proprietary commands are needed to commit the sample to a slot.
- SDS extensions (Sample Name, Header Extension) not implemented — not needed for S3000XL
- Transfer speed is limited by MIDI bandwidth (~25s for 1 second of 22kHz audio)
- No sample rate conversion during transfer
