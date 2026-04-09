# SCSI Bridge: Eliminate duplicate MIDI code paths, fix MIDI mode lifecycle

## Problem

When sending multiple SDS samples in sequence (e.g., drum kit import with 4 slices), the bridge failed with `MIDI_SEND failed` or silent timeouts on SysEx commands sent between SDS uploads.

## Root causes (two bugs)

### 1. Duplicate MIDI send paths with contradictory error handling

The bridge had two code paths for sending MIDI data over SCSI:

- **`scsi_midi_send`** (raw CDB `0x0C` via `execute_scsi`) — Correctly ignores CHECK CONDITION status because the S3000XL returns CHECK CONDITION on MIDI sends but accepts the data anyway.
- **`send_sysex`** (protobuf `MIDI_SEND` via `send_command`) — Incorrectly treated CHECK CONDITION as fatal error.

Similarly, `poll()` and `read()` duplicated `scsi_midi_poll()` and `scsi_midi_read()` with the same status-checking bug.

These were written at different times for different purposes (protobuf API rewrite vs SDS SCSI_EXEC implementation) but ultimately did the same thing.

### 2. SDS transfers disable MIDI mode, SysEx never re-enables it

SDS upload/download functions call `scsi_midi_enable` before transfer and `scsi_midi_disable` after. After an SDS transfer, the device ignores all SysEx because MIDI-over-SCSI is disabled. The protobuf path had `ensure_init` (MIDI_INIT) that happened to re-enable it, but only on first call — subsequent calls were no-ops due to an `initialized` flag.

## Fix

1. **Deleted `send_sysex`, `poll()`, `read()`, `ensure_init`** and all supporting protobuf MIDI infrastructure (`MIDI_INIT`, `MIDI_SEND`, `MIDI_POLL`, `MIDI_READ` constants, `build_midi_*` functions, `status()` method, `initialized` field).

2. **All MIDI operations now go through the raw CDB functions**: `scsi_midi_send`, `scsi_midi_poll`, `scsi_midi_read`. One code path, one set of device-quirk knowledge.

3. **`send_and_receive` now manages MIDI mode lifecycle**: enables before sending, disables after receiving (or on error). This ensures serial MIDI ports remain functional between SCSI operations.

### Files modified

| File | Change |
|------|--------|
| `services/scsi-midi-bridge/src/s2p_client.rs` | Delete protobuf MIDI layer, add enable/disable in `send_and_receive` |
| `services/scsi-midi-bridge/src/worker.rs` | Replace `send_sysex`/`poll`/`read` calls with `scsi_midi_*` |

## Verification

```bash
# Multi-sample SDS (the failing case)
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test multi-sds --verbose'

# SDS round trip with rename
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'

# SysEx writes
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test writes --verbose'
```
