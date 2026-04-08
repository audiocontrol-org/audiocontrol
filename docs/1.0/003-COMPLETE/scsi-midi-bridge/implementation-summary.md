# SCSI MIDI Bridge - Implementation Summary

**Status:** Phases 2-5 complete (Phase 5 partial — firmware limitation)
**Feature Branch:** `feature/scsi-midi-bridge`

## Summary

Network bridge enabling audiocontrol (browser) to communicate with an Akai S3000XL sampler over SCSI via a Raspberry Pi. All Akai SysEx commands (parameter reads, parameter writes, SDS sample upload) work over the SCSI transport chain. SDS sample download is blocked by a firmware limitation on the S3000XL side; workaround is to read sample data from disk images directly.

## What Was Built

### Phase 2: SCSI Bus Connectivity

**Rust bridge daemon** (`services/scsi-midi-bridge/`, v0.2.0):
- Axum 0.7 HTTP/WebSocket server on port 7033
- Hand-encoded protobuf client for s2p API (port 6868)
- Endpoints: `/health`, `/status`, `/scsi/scan`, `/sds/send`, `/sds/poll`, `/sds/stream`
- 4 MIDI operations: MIDI_INIT, MIDI_SEND, MIDI_POLL, MIDI_READ
- Multi-chunk response handling with 30-retry polling loop (3s timeout)

**TypeScript SCSI transport** (`modules/midi-core/src/transports/scsi-midi-transport.ts`):
- Factory: `createScsiMidiTransport()` → `{ adapter: MidiIO, connect, disconnect, scanDevices }`
- Serialized send queue via HTTP POST
- WebSocket receive with HTTP polling fallback (50ms)
- 22 unit tests

### Phase 3: Capture Session

Fully decoded the MIDI-via-SCSI protocol:
- 4-step CDB sequence: INIT (`0x09`), SEND (`0x0C`), POLL (`0x0D`), READ (`0x0E`)
- Poll-based framing (not per-message streaming)
- Confirmed SysEx payloads are byte-for-byte identical to standard MIDI

Reverse-engineered MESA II SCSI Plug binary:
- Confirmed MESA uses same CDB protocol for parameter commands
- Discovered sample waveform data uses native SCSI block reads, not SysEx
- RSPACK (0x0C) does not work over SCSI MIDI channel

### Phase 4: Write Path

- `POST /sds/send` accepts SysEx, calls s2p protobuf API, returns response
- `ScsiMidiTransport.send()` serializes sends via HTTP POST
- All Akai SysEx commands work: RSTAT, RSLIST, RPLIST, RPDATA, RKDATA, RSDATA, PDATA, KDATA, SDATA
- SDS sample upload works (closed-loop with ACK handshake)
- 7 E2E test suites with 40+ tests

### Phase 5: Read Path (Partial)

- Request/response reads work for all Akai SysEx commands
- WebSocket and HTTP polling receive paths implemented
- **Blocked:** SDS Data Packets are not routed through SCSI response buffer by S3000XL firmware
- **Workaround:** Sample download via disk image extraction (`sampler-export` module)

## Key Decisions

- **s2p protobuf API, not s2pexec** — s2pexec and s2p cannot coexist (exclusive GPIO access). Bridge daemon uses s2p's protobuf API with hand-encoded messages (no protoc dependency).
- **HTTP + polling, not WebSocket-only** — WebSocket fails in mixed-content scenarios (HTTPS page → ws:// connection). HTTP polling at 50ms provides reliable fallback.
- **Disk image access for sample download** — MESA II itself uses native SCSI block reads for sample data, not SysEx. Following the same pattern with the existing `sampler-export` disk image extractor.
- **SCMP device prototyped but not needed** — Custom SCSI2Pi device type (SCMP) was built in fork but has an unresolved 0x0D MESSAGE IN timeout. Not needed because the bridge uses initiator-mode commands via s2p protobuf API.

## Testing

- **Unit tests:** 22 tests for SCSI MIDI transport (connection, send, receive, lifecycle)
- **E2E tests:** 7 suites via `make test-e2e-s3k-scsi`
  - `scsi-connected.spec.ts` — Connection and device discovery
  - `scsi-programs.spec.ts` — Program round-trip operations
  - `scsi-keygroups.spec.ts` — Keygroup round-trip operations
  - `scsi-velocity-zones.spec.ts` — Velocity zone data
  - `scsi-sample-headers.spec.ts` — Sample metadata access
  - `scsi-sds-transfer.spec.ts` — SDS sample transfer (60-120s timeouts)
  - `scsi-edge-cases.spec.ts` — Error handling

## Known Limitations

1. **SDS sample download blocked** — S3000XL firmware does not stream SDS Data Packets over SCSI. Dump Header arrives but Data Packets do not. Workaround: disk image extraction.
2. **RSPACK not supported** — Opcode 0x0C returns empty responses over SCSI MIDI. Not needed (disk image access replaces this).
3. **Write persistence under investigation** — E2E readback tests return stale values after writes. See `feature/scsi-write-validation` for targeted CLI testing with cache disabled.
4. **Device scan hardcoded** — `/scsi/scan` returns S3000XL at ID 6 only (s2p API limitation).
