# SCSI Write Validation - Implementation Summary

**Status:** Complete
**Feature Branch:** `feature/scsi-write-validation`
**Completed:** 2026-04-05

## Summary

CLI test harness that bypasses the browser editor to test whether writes to the Akai S3000XL persist through the SCSI-over-network transport chain. Found and fixed three client bugs that prevented all writes from working. Confirmed that the SCSI transport is fully functional — the issues were in the SysEx client code, not the transport.

## What Was Built

### S3000XL Client Fixes

**Double-framing bug:** `writeProgramHeader`, `writeKeygroupHeader`, and `writeSampleHeader` passed the full SysEx response (including F0/F7 envelope) to `buildAkaiSysEx`, which wrapped it again. Device rejected all writes with error code 0. Fixed by stripping the 5-byte header and F7 before sending.

**REPLY error detection:** `isErrorResponse` treated any REPLY opcode (0x16) as an error. Per the Akai spec, REPLY with data byte 0x00 means success (OK). Fixed to only flag non-zero error codes.

**Multi-byte write generator bug:** The code generator (`gen-s3000xl-device.ts`) only wrote a single byte for multi-byte fields (size 2, 4, 6, 12 bytes). Fixed `genSetters` to write all bytes using nibble-pair encoding.

### New Client Capabilities

- `noCache` option on `S3000xlClientOptions` — bypasses all caching for debugging
- `deleteProgram(programNumber)` — DELP opcode, confirmed working
- `createProgram(programNumber, template?)` — PDATA with new index. Works on S1000 per spec; S3000XL accepts the write but does not create new RPLIST entries.
- `fetchMiscData()` / `writeMiscData()` — RMDATA/MDATA for miscellaneous (global/multi) data
- `MiscellaneousData` type with 48 fields generated from YAML spec (6 S1000-standard + 42 S3000XL extensions)

### CLI Test Harness

Located in `modules/e2e-infra/src/node/` — runs via `make test-scsi-write-validation`. Uses the shared SCSI e2e provisioning pipeline (build ARM64 binaries, deploy to Pi, start daemons, validate, run tests, cleanup).

Test groups:
- **connection** — Bridge status, SCSI bus scan
- **reads** — Program/sample/keygroup header reads with cache disabled
- **writes** — Basic write-readback tests (4 fields)
- **all-fields** — 248 field write-readback tests across all data types
- **structure** — Keygroup create/delete round-trip
- **multi** — MiscellaneousData read/write
- **latency** — Per-hop timing characterization
- **sds** — SDS sample transfer (send works, receive blocked by firmware)

### Request Tracing

Added `tracing` + `tracing-subscriber` to the Rust bridge daemon with:
- `X-Request-Id` correlation headers
- Per-s2p-command timing (tcp_connect, send, recv, total)
- Aggregate breakdown per request (send_ms, poll_sleep_ms, s2p_io_ms)

## Test Results

**Full field coverage (248 fields tested):**
- 218 PASS, 0 FAIL, 0 ERROR, 30 SKIP (internal/device-managed fields)
- Program header: 79/83 tested, all pass
- Keygroup header: 109/130 tested, all pass
- Sample header: 30/35 tested, all pass

**Structural operations:**
- Keygroup create/delete round-trip: PASS
- Program delete (DELP): PASS
- Program create (PDATA): S3000XL does not support — documented limitation

**MiscellaneousData:**
- Read: PASS (48 bytes, 6 S1000 fields decoded correctly)
- Write PSELEN: PASS
- Write SELPNM: PASS
- EXCHAN writes affect device communication channel — documented as dangerous

**SDS:**
- Send: PASS
- Receive: Blocked by firmware (SDS Data Packets not routed through SCSI response buffer)

## Key Decisions

- **CLI-only, no browser** — Eliminated React/Playwright as variables. Used `tsx` running in Node.js with the same client code as the editor.
- **noCache as first-class option** — Not a test hack. Added to client options for any consumer to use.
- **Shared e2e provisioning** — Tests use `run-scsi-node-e2e.sh` which handles full Pi deployment lifecycle, consistent with the Playwright-based SCSI e2e tests.
- **Data-driven field tests** — Field specs defined as arrays, generic runner iterates. Avoids 248 individual test functions.

## Latency Findings

Request tracing revealed the transport overhead that motivated the `scsi-transport-optimization` follow-up feature:

| Operation | Total | MIDI_SEND | Poll Sleep | s2p I/O |
|-----------|-------|-----------|------------|---------|
| Write (7B reply) | 865ms | 112ms | 302ms | 447ms |
| Read (392B data) | 1196ms | 112ms | 403ms | 673ms |

87% of round-trip time is overhead (polling sleep + per-command TCP reconnection). The actual SCSI bus operation is ~112ms.

## Known Limitations

1. **Program creation** — S3000XL does not create new programs via SysEx PDATA. Programs are created via front panel or disk load only.
2. **SDS receive over SCSI** — Device firmware does not route SDS Data Packets through the SCSI MIDI response buffer. Workaround: disk image extraction.
3. **KFXCHAN/KFXSLEV** — Keygroup effects override fields do not persist writes and cause device timeouts. Skipped in tests.
4. **EXCHAN writes** — Changing the SysEx exclusive channel via MDATA breaks communication on the original channel. Must restore immediately.
5. **42 unknown MiscellaneousData bytes** — S3000XL extension fields (MDATA07-MDATA47) not yet reverse engineered.
