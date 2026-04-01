# SCSI MIDI Bridge - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Build a network bridge between audiocontrol (browser) and the SCSI bus, allowing the existing SDS protocol layer to operate over SCSI instead of a MIDI cable. The architecture has three parts:

1. **Pi bridge daemon (Rust)** -- HTTP/WebSocket server running on the Raspberry Pi. It receives SysEx data from audiocontrol over WiFi and forwards it to the S3000XL over the SCSI bus by shelling out to `s2pexec`. It also receives SCSI data from the sampler and streams it back to audiocontrol via WebSocket.

2. **`ScsiMidiTransport` (TypeScript)** -- A new `SysexTransport` implementation in `sampler-devices` (or `midi-core`) that talks to the Pi bridge over HTTP/WebSocket. Because it implements the same interface as the MIDI cable transport, the existing `SdsClient` works without modification.

3. **Capture session** -- Before implementing the write/read paths, we must capture a live MIDI-via-SCSI conversation between two Akai devices (or between SCSI2Pi and the S3000XL) to determine the exact CDB format, framing, and message boundary behavior. This is the critical unknown.

**Key architectural decisions:**

- **Same `SysexTransport` interface** -- The SCSI bridge is a transport-layer concern only. The SDS protocol, S3000XL client, and editor UI are unchanged.
- **Rust for the Pi daemon** -- Low overhead, no runtime, suitable for a headless systemd service on a Pi. Shells out to `s2pexec` rather than reimplementing SCSI initiator logic.
- **HTTP for one-shot, WebSocket for streaming** -- `POST /sds/send` for simple fire-and-forget sends; `WS /sds/stream` for closed-loop handshaking where latency matters.
- **Capture before code** -- Phase 3 (capture session) is the critical path. The write and read path implementations depend entirely on what the capture reveals about CDB format and message framing.

## Implementation Phases

Phase 1 (SDS over MIDI cable) is complete. See [midi-sds workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/midi-sds/workplan.md) for details. Phases below continue the numbering from that workplan.

### Phase 2: SCSI Bus Connectivity

Stand up the Pi bridge daemon with status and discovery endpoints. Confirm audiocontrol can reach the Pi and enumerate SCSI devices over WiFi.

#### 2.1 Pi Bridge Daemon Scaffold

Create the Rust project for the bridge daemon. Implement `GET /status` and `GET /scsi/scan`.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 1 | Scaffold Rust project with HTTP server (axum or actix-web) | TBD |
| 2 | Implement `GET /status` (version, SCSI2Pi version, board ID) | TBD |
| 3 | Implement `GET /scsi/scan` (shell out to `s2pexec --scan` or equivalent) | TBD |
| 4 | Add sampler reachability check to `/status` (SCSI INQUIRY) | TBD |
| 5 | Create systemd unit file, install alongside `s2p` | TBD |

**Acceptance criteria:**
- `curl http://s3k:PORT/status` returns JSON with version, SCSI2Pi version, board ID, and `samplerReachable: true`
- `curl http://s3k:PORT/scsi/scan` returns JSON array with S3000XL identified by vendor/product/revision
- Daemon starts on boot via systemd, does not interfere with `s2p`

#### 2.2 ScsiMidiTransport Scaffold

Create the TypeScript transport class. Wire it to the bridge daemon status endpoint for connection verification.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 6 | Create `ScsiMidiTransport` implementing `SysexTransport` interface | TBD |
| 7 | Implement `connect()` -- verify bridge reachable via `GET /status` | TBD |
| 8 | Implement `disconnect()` -- close WebSocket, clear state | TBD |
| 9 | Add SCSI device enumeration method (calls `GET /scsi/scan`) | TBD |
| 10 | Unit tests for transport connection/disconnection lifecycle | TBD |

**Acceptance criteria:**
- `ScsiMidiTransport.connect()` succeeds when bridge daemon is running, throws when unreachable
- Device enumeration returns parsed SCSI device list from bridge
- Transport implements full `SysexTransport` interface (send/onMessage stubbed for Phase 4/5)

### Phase 3: Capture Session (CRITICAL PATH)

Capture a live MIDI-via-SCSI dump from the S3000XL to determine the exact protocol details. This phase is research, not code -- the output is documentation that unblocks Phases 4 and 5.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 11 | Configure SCSI2Pi trace logging for SCSI bus traffic | TBD |
| 12 | Trigger a MIDI-via-SCSI sample dump from S3000XL (device-initiated) | TBD |
| 13 | Capture and analyze CDB bytes, data phase content, message framing | TBD |
| 14 | Determine: one SCSI WRITE per SysEx message vs. continuous stream | TBD |
| 15 | Document findings in `docs/1.0/scsi-midi-bridge/capture-notes.md` | TBD |

**Acceptance criteria:**
- Exact CDB format documented (command byte, LBA fields, transfer length)
- Message framing behavior documented (per-message or streaming)
- Data phase content confirmed to be byte-for-byte standard MIDI SysEx
- Findings sufficient to implement Phases 4 and 5

**Open risks:**
- If the S3000XL requires a specific SCSI device type (e.g., processor) on the other end, the Pi may need to register as that device type. This may require SCSI2Pi configuration or patching.
- If the CDB is undocumented and the capture is ambiguous, additional experimentation may be needed.

### Phase 4: Write Path (Laptop to Sampler)

Implement the send direction: audiocontrol sends SysEx to the Pi bridge, which forwards it to the S3000XL over the SCSI bus.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 16 | Implement `POST /sds/send` on Pi bridge (accept SysEx, send via `s2pexec`) | TBD |
| 17 | Implement `ScsiMidiTransport.send()` (HTTP POST to bridge) | TBD |
| 18 | Wire `SdsClient` to use `ScsiMidiTransport` as an alternative to MIDI transport | TBD |
| 19 | End-to-end test: drag WAV into audiocontrol, verify sample loads in S3000XL RAM | TBD |

**Acceptance criteria:**
- A WAV file sent from audiocontrol via SCSI bridge loads into S3000XL RAM and plays back correctly
- `SdsClient` works identically whether using MIDI cable transport or SCSI bridge transport
- Transfer is measurably faster than MIDI cable for equivalent sample data

### Phase 5: Read Path (Sampler to Laptop)

Implement the receive direction: the S3000XL sends SysEx over SCSI, the Pi bridge streams it to audiocontrol via WebSocket.

**Tasks:**

| # | Task | GitHub Issue |
|---|------|-------------|
| 20 | Implement `WS /sds/stream` on Pi bridge (bidirectional SysEx relay) | TBD |
| 21 | Implement `ScsiMidiTransport.onMessage()` (WebSocket listener) | TBD |
| 22 | Handle SCSI target-mode receive on Pi (accept sampler-initiated writes) | TBD |
| 23 | End-to-end test: trigger dump on S3000XL, verify sample appears in audiocontrol | TBD |

**Acceptance criteria:**
- A sample dump triggered on the S3000XL front panel arrives in audiocontrol via the SCSI bridge
- WebSocket stream correctly frames individual SysEx messages
- Closed-loop handshaking works over WebSocket (ACK/NAK round-trip latency acceptable)

**Open risks:**
- Read path requires the Pi to act as a SCSI target (accepting writes from the sampler). This depends on SCSI2Pi's ability to register a custom device type or processor target. See Open Question 1 in the PRD.

### Phase 6: Akai Extended Protocol (Deferred)

Extend the bridge for Akai-specific SysEx messages beyond SDS: programs, loops, keygroups, and full program transfer including loop points. This phase uses the Akai "S3000" protocol (proprietary superset of SDS).

This phase is deferred and will be planned separately once Phases 2-5 are validated.

## Task Breakdown

| # | Task | Phase | Status |
|---|------|-------|--------|
| 1 | Scaffold Rust bridge daemon project | 2.1 | TODO |
| 2 | Implement `GET /status` | 2.1 | TODO |
| 3 | Implement `GET /scsi/scan` | 2.1 | TODO |
| 4 | Add sampler reachability to `/status` | 2.1 | TODO |
| 5 | Create systemd unit file | 2.1 | TODO |
| 6 | Create `ScsiMidiTransport` class | 2.2 | TODO |
| 7 | Implement `connect()` | 2.2 | TODO |
| 8 | Implement `disconnect()` | 2.2 | TODO |
| 9 | Add SCSI device enumeration | 2.2 | TODO |
| 10 | Unit tests for transport lifecycle | 2.2 | TODO |
| 11 | Configure SCSI2Pi trace logging | 3 | TODO |
| 12 | Trigger MIDI-via-SCSI dump from S3000XL | 3 | TODO |
| 13 | Analyze CDB and data phase content | 3 | TODO |
| 14 | Determine message framing behavior | 3 | TODO |
| 15 | Document capture findings | 3 | TODO |
| 16 | Implement `POST /sds/send` on bridge | 4 | TODO |
| 17 | Implement `ScsiMidiTransport.send()` | 4 | TODO |
| 18 | Wire `SdsClient` to SCSI transport | 4 | TODO |
| 19 | E2E test: send WAV via SCSI bridge | 4 | TODO |
| 20 | Implement `WS /sds/stream` on bridge | 5 | TODO |
| 21 | Implement `ScsiMidiTransport.onMessage()` | 5 | TODO |
| 22 | Handle SCSI target-mode receive on Pi | 5 | TODO |
| 23 | E2E test: receive dump via SCSI bridge | 5 | TODO |

## Dependencies

- Phase 2 can begin immediately (no blockers)
- Phase 3 can run in parallel with Phase 2 (only requires Pi + S3000XL hardware, not bridge code)
- Phase 4 depends on Phase 2 (bridge daemon must exist) and Phase 3 (CDB format must be known)
- Phase 5 depends on Phase 2 (transport class must exist) and Phase 3 (framing must be known)
- Phase 5 may also depend on SCSI2Pi capabilities for target-mode operation (Open Question 1)
- Phase 6 is deferred and depends on Phases 4 and 5
