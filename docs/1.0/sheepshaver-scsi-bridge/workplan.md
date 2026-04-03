# SheepShaver SCSI Network Bridge - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Bridge SheepShaver's SCSI interface to scsi2pi over TCP. Two components:

1. **SCSI_EXEC operation in s2p** — expose the existing InitiatorExecutor over the protobuf API for arbitrary CDB execution
2. **Network SCSI backend for SheepShaver** — new `scsi_s2p.cpp` that forwards SCSI commands to s2p over TCP

The s2p protobuf API already uses a simple wire format (RASCSI magic + LE length + protobuf). The SheepShaver backend will speak this protocol directly.

## Implementation Phases

### Phase 1: SCSI_EXEC in s2p

Add a generic SCSI command execution operation to the protobuf API.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 1 | Add SCSI_EXEC operation, PbScsiRequest, PbScsiResponse to s2p_interface.proto | TBD |
| 2 | Add ScsiCommand struct and execution queue to command_dispatcher | TBD |
| 3 | Implement SCSI_EXEC handler following the MIDI command pattern | TBD |
| 4 | Write TypeScript test script to verify SCSI_EXEC (INQUIRY to S3000XL) | TBD |
| 5 | Cross-compile and deploy to Pi, validate with hardware | TBD |

**Acceptance criteria:**
- SCSI_EXEC accepts any CDB, target ID, LUN, data direction, data buffer
- Returns SCSI status, sense data, and response data
- Works for INQUIRY, TEST UNIT READY, READ, WRITE, and vendor commands
- Logs every command for debugging

### Phase 2: SheepShaver Network Backend

Create `scsi_s2p.cpp` implementing the 5-function SCSI backend interface.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 6 | Create scsi_s2p.cpp with TCP connection to s2p | TBD |
| 7 | Implement scsi_set_cmd, scsi_set_target (local state) | TBD |
| 8 | Implement scsi_is_target_present via INQUIRY | TBD |
| 9 | Implement scsi_send_cmd with S/G table flattening | TBD |
| 10 | Add SCSI command logging to stderr | TBD |
| 11 | Update configure.ac with --enable-scsi-s2p | TBD |
| 12 | Build SheepShaver with new backend on macOS | TBD |

**Acceptance criteria:**
- SheepShaver discovers SCSI devices on the remote Pi
- Mac OS 9 System Profiler shows the S3000XL
- MESA II can connect to and communicate with the S3000XL
- All SCSI commands are logged with CDB hex, data direction, and response status

### Phase 3: MESA II Validation

Run MESA II through the bridge and capture traffic.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 13 | Boot Mac OS 9 in SheepShaver, configure SCSI bridge | TBD |
| 14 | Run MESA II, verify device discovery | TBD |
| 15 | Test program/keygroup/sample header read/write | TBD |
| 16 | Test sample waveform data export (capture CDBs) | TBD |
| 17 | Document captured protocol for sample data transfer | TBD |

**Acceptance criteria:**
- Complete SCSI traffic capture from MESA II sample export operation
- Protocol documentation updated with actual CDB sequences for sample data
- Comparison with our SCSI MIDI bridge approach to identify gaps

## Repos

| Component | Repo | Branch |
|-----------|------|--------|
| SCSI_EXEC in s2p | audiocontrol-org/scsi2pi | feature/scsi-exec |
| SheepShaver backend | fork of kanjitalk755/macemu | feature/scsi-s2p |
| Feature docs | audiocontrol-org/audiocontrol | feature/sheepshaver-scsi-bridge |
