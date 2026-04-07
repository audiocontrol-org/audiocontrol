# SCSI MIDI Bridge - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Built a network bridge between audiocontrol (browser) and the SCSI bus, allowing the existing SDS protocol layer and Akai SysEx commands to operate over SCSI instead of a MIDI cable. The architecture has three parts:

1. **Pi bridge daemon (Rust)** -- HTTP/WebSocket server running on the Raspberry Pi (`services/scsi-midi-bridge/`). It receives SysEx data from audiocontrol over WiFi and forwards it to the S3000XL over the SCSI bus via the s2p protobuf API. Responses are read back and dispatched to the browser via HTTP response body and WebSocket broadcast.

2. **`ScsiMidiTransport` (TypeScript)** -- A `MidiIO` implementation in `midi-core` (`src/transports/scsi-midi-transport.ts`) that talks to the Pi bridge over HTTP/WebSocket. Because it implements the same `MidiIO` interface as Web MIDI and HTTP MIDI transports, the existing S3000XL client and SDS layer work without modification.

3. **Capture session** -- Captured live MIDI-via-SCSI traffic using SCSI2Pi trace mode. Fully decoded the 4-step CDB protocol (INIT, SEND, POLL, READ). Also reverse-engineered MESA II's SCSI Plug binary to understand Akai's own implementation.

**Key architectural decisions:**

- **Same `MidiIO` interface** -- The SCSI bridge is a transport-layer concern only. The SDS protocol, S3000XL client, and editor UI are unchanged.
- **Rust for the Pi daemon** -- Low overhead, no runtime, suitable for a headless systemd service on a Pi.
- **s2p protobuf API, not s2pexec** -- s2pexec and s2p cannot coexist (both need exclusive GPIO access). The bridge daemon communicates with the running s2p process via its protobuf API on port 6868, with hand-encoded protobuf messages (no protoc dependency).
- **HTTP for sends, polling for receives** -- `POST /sds/send` sends SysEx and returns the response. `GET /sds/poll` checks for pending incoming data. WebSocket (`WS /sds/stream`) provides real-time receive when available, with HTTP polling as fallback (every 50ms).
- **Capture before code** -- Phase 3 (capture session) was the critical path and is now complete.

## Implementation Phases

Phase 1 (SDS over MIDI cable) is complete. See [midi-sds workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/midi-sds/workplan.md) for details. Phases below continue the numbering from that workplan.

### Phase 2: SCSI Bus Connectivity — COMPLETE

Stood up the Pi bridge daemon with status, discovery, and SysEx relay endpoints. Confirmed audiocontrol can reach the Pi and enumerate SCSI devices over WiFi.

#### 2.1 Pi Bridge Daemon — COMPLETE

**Implementation:** `services/scsi-midi-bridge/` (Rust, Axum 0.7, Tokio)

- `src/main.rs` — HTTP server on port 7033 with CORS, shared s2p client state
- `src/routes.rs` — All endpoints: `/health`, `/status`, `/scsi/scan`, `/sds/send`, `/sds/poll`, `/sds/stream`
- `src/s2p_client.rs` — Hand-encoded protobuf client for s2p API (port 6868). Operations: MIDI_INIT (200), MIDI_SEND (201), MIDI_POLL (202), MIDI_READ (203). Multi-chunk response handling with 30-retry polling loop.
- `src/config.rs` — CLI args: `--port`, `--s2p-host`, `--s2p-port`, `--target-id`

#### 2.2 ScsiMidiTransport — COMPLETE

**Implementation:** `modules/midi-core/src/transports/scsi-midi-transport.ts` (247 lines)

- Factory: `createScsiMidiTransport(options)` returns `{ adapter: MidiIO, connect, disconnect, scanDevices }`
- Send: serialized queue → `POST /sds/send` → dispatch response to listeners
- Receive: WebSocket `/sds/stream` (primary) with HTTP polling `/sds/poll` every 50ms (fallback)
- 22 unit tests in `__tests__/scsi-midi-transport.test.ts`

### Phase 3: Capture Session — COMPLETE

Captured live MIDI-via-SCSI traffic from the S3000XL and fully decoded the protocol. Also reverse-engineered MESA II's SCSI Plug binary for additional confirmation.

**Findings documented in:**
- [capture-notes.md](capture-notes.md) — Full CDB protocol decode, SCMP device implementation attempts, raw traces
- [mesa-ii-analysis.md](mesa-ii-analysis.md) — MESA II binary analysis, sample data transfer discovery
- [findings-phase2.md](findings-phase2.md) — s2pexec/s2p bus contention constraint

**Protocol decoded:**

| Step | CDB | Direction | Purpose |
|------|-----|-----------|---------|
| 1. Init | `09:00:01:01:00:00` | No data | Activate MIDI-via-SCSI session |
| 2. Send | `0C:00:00:00:LL:00` | DATA OUT (LL bytes) | Send SysEx to S3000XL |
| 3. Poll | `0D:00:00:00:00:00` | DATA IN (3 bytes) | Read pending response byte count (`00 HH LL`) |
| 4. Read | `0E:00:00:00:LL:00` | DATA IN (LL bytes) | Read buffered SysEx response |

**Key discovery:** MESA II transfers sample waveform data via direct SCSI disk image access, NOT via SysEx-over-SCSI. The "Sample data can only be transferred using SCSI" message in MESA refers to native SCSI block reads, not the MIDI-via-SCSI channel. RSPACK (0x0C) does not work over the SCSI MIDI channel.

### Phase 4: Write Path (Laptop to Sampler) — COMPLETE

Implemented the send direction. All Akai SysEx commands (parameter reads/writes) and SDS sample uploads work over SCSI.

**Implementation:**
- `POST /sds/send` on bridge: accepts SysEx bytes, calls `s2p_client.send_and_receive()`, returns response
- `ScsiMidiTransport.send()`: serialized HTTP POST queue, dispatches responses to listeners
- S3000XL client works identically with SCSI transport or Web MIDI transport (same `MidiIO` interface)
- 7 E2E test suites (`modules/akai-s3k-editor/e2e/scsi-*.spec.ts`) covering programs, keygroups, velocity zones, sample headers, SDS transfer

**Open investigation:** Write-readback tests return stale values. Under investigation in `feature/scsi-write-validation` to determine whether writes genuinely don't persist or the E2E test infrastructure (caching, browser state) is the issue.

### Phase 5: Read Path (Sampler to Laptop) — PARTIAL (resolved in Phase 6)

Request/response reads work (all Akai SysEx read commands). Autonomous device-initiated streaming (SDS Data Packets) does NOT work due to S3000XL firmware limitation.

**What works:**
- `WS /sds/stream` on bridge: bidirectional WebSocket relay (implemented)
- `GET /sds/poll` on bridge: HTTP polling for pending SysEx (implemented, 50ms interval)
- `ScsiMidiTransport.onSysEx()`: listener callback with WebSocket + polling fallback (implemented)
- All request/response Akai SysEx commands: RPLIST, RSLIST, RPDATA, RKDATA, RSDATA
- SDS Dump Header arrives when device initiates a dump

**What does NOT work:**
- SDS Data Packets do not arrive after the Dump Header — the S3000XL firmware does not route autonomous SDS Data Packets through the SCSI response buffer. Over a MIDI cable, Data Packets go to the MIDI OUT port; the firmware has no equivalent path for SCSI streaming.
- RSPACK (request sample waveform data, opcode 0x0C) returns empty responses over SCSI MIDI

**Workaround:** Sample waveform data download uses the existing `sampler-export` disk image extractor. The S3000XL's SCSI disks are served as `.hds` images by s2p on the Pi filesystem, and `sampler-export` can read them directly. This is also how MESA II transfers sample data (confirmed via binary analysis).

### Phase 6: SDS Sample Transfer via SCSI_EXEC — COMPLETE

**Breakthrough (issue #141):** SDS sample download over SCSI works when using `SCSI_EXEC` (op 210) with raw vendor-specific CDBs instead of the `MIDI_*` abstraction layer (ops 200-203). Working C++ implementation at `audiocontrol-org/mesa-plug-harness`.

The key findings that unblocked this:
1. **Use SCSI_EXEC with raw CDBs** (0x09/0x0C/0x0D/0x0E) — not `MIDI_SEND`/`MIDI_POLL`/`MIDI_READ`
2. **Read ALL available bytes per poll** — don't stop at F7 boundaries during CDB 0x0E reads. Parse multiple SDS messages from the buffer afterward.
3. **CDB byte 5 = 0x00** — device rejects 0x80 with CHECK CONDITION
4. **RSPACK works** with 7-bit encoding (not nibble encoding)

**Architecture: Bridge-local SDS dance with WebSocket streaming to browser**

The bridge performs the entire SDS protocol (RSPACK, poll, read, ACK loop) locally on the Pi using localhost TCP to s2p. PCM audio data streams to/from the browser via WebSocket chunks — no full-sample buffering in the bridge since large samples can exceed available RAM.

```
Download (device → browser):
  Browser sends WS: sample-request {targetId, sampleNumber}
  Bridge: SCSI_EXEC MIDI init → RSDATA (get header) → RSPACK (trigger SDS)
  Bridge: poll+read loop → decode SDS → ACK each packet → stream PCM chunks to WS
  Browser receives: sample-header (name, rate, count, estimated time)
                    sample-data chunks (with progress: transferred/total)
                    sample-complete

Upload (browser → device):
  Browser sends WS: sample-upload {targetId, sampleNumber, sampleRate, sampleCount}
  Browser streams WS: sample-data chunks
  Bridge: SCSI_EXEC MIDI init → encode PCM to SDS → send packets → wait for ACK
  Browser receives: progress updates, upload-complete
```

**Progress reporting** — the client must be able to show:
- Total sample size and estimated transfer time (from header, before transfer starts)
- Transfer progress (samples transferred / total, elapsed / remaining)
- That transfer is active and not stuck (continuous progress updates)

**Implementation:**

6.1 **SCSI MIDI transport in bridge S2pClient** — DONE
- `s2p_client.rs`: `scsi_midi_enable/disable/send/poll/read` methods using `execute_scsi()` with raw CDBs
- Akai character encoding table (0-66 → ASCII), nibble encode/decode helpers

6.2 **WebSocket sample transfer handlers** — DONE
- `scsi_midi.rs`: `download_sample()` — RSDATA header fetch, RSPACK trigger, poll/read/decode/ACK loop, streams decoded PCM via callback
- `scsi_midi.rs`: `upload_sample()` — SDS Dump Header + Data Packet encoding (40 samples/packet), per-packet ACK handshake, 3s device commit wait
- `routes.rs`: WebSocket handlers for `sample-download` and `sample-upload` messages with mpsc channel forwarding to WebSocket

6.3 **TypeScript client** — DONE
- `scsi-disk-client.ts`: `downloadSample()` and `uploadSample()` on `ScsiDiskClient` interface with streaming callbacks (`onHeader`, `onData`, `onProgress`, `onComplete`)
- Shared `sampleTransfer()` WebSocket helper handles both directions
- Types exported: `SampleTransferHeader`, `SampleTransferProgress`, `SampleDownloadCallbacks`, `SampleUploadCallbacks`

**Key bugs fixed during implementation:**
- Akai char table was off by 1 (space=10, letters start at 11, not 10)
- RSDATA nibble offsets: name at offset 6 (not 0), SLNGTH at 52 (not 24), SSRATE at 276
- RSPACK count encoding: 7-bit per byte (`cnt >> 7`, not mixed bit-shifts)

**E2E tests:** `make test-scsi-sds-transfer` — hardware-verified download + upload round-trip (256-sample sine wave upload → download → verify count)

**Build/deploy:** `make deploy-scsi-bridge` — cross-compile via Docker volume mount, deploy to Pi, deterministic daemon shutdown with exponential backoff. Bridge `/status` includes `buildId` (git hash + timestamp) for deployment verification.

**Reference implementation:** `~/work/scsi2pi-work/mesa-plug-harness/src/s3k_client.cpp`

### Phase 7: Akai Extended Protocol (Deferred)

Extend the bridge for Akai-specific SysEx messages beyond SDS: programs, loops, keygroups, and full program transfer including loop points. This phase uses the Akai "S3000" protocol (proprietary superset of SDS).

This phase is deferred and will be planned separately once Phases 2-6 are validated.

## Task Breakdown

| # | Task | Phase | Status |
|---|------|-------|--------|
| 1 | Scaffold Rust bridge daemon project | 2.1 | DONE |
| 2 | Implement `GET /status` | 2.1 | DONE |
| 3 | Implement `GET /scsi/scan` | 2.1 | DONE (hardcoded to S3000XL at ID 6) |
| 4 | Add sampler reachability to `/status` | 2.1 | DONE |
| 5 | Create systemd unit file | 2.1 | DONE (deployed to Pi, not version-controlled) |
| 6 | Create `ScsiMidiTransport` class | 2.2 | DONE |
| 7 | Implement `connect()` | 2.2 | DONE |
| 8 | Implement `disconnect()` | 2.2 | DONE |
| 9 | Add SCSI device enumeration | 2.2 | DONE |
| 10 | Unit tests for transport lifecycle | 2.2 | DONE (22 tests) |
| 11 | Configure SCSI2Pi trace logging | 3 | DONE |
| 12 | Trigger MIDI-via-SCSI dump from S3000XL | 3 | DONE |
| 13 | Analyze CDB and data phase content | 3 | DONE |
| 14 | Determine message framing behavior | 3 | DONE (poll-based, not streaming) |
| 15 | Document capture findings | 3 | DONE (capture-notes.md, mesa-ii-analysis.md) |
| 16 | Implement `POST /sds/send` on bridge | 4 | DONE |
| 17 | Implement `ScsiMidiTransport.send()` | 4 | DONE |
| 18 | Wire S3000XL client to SCSI transport | 4 | DONE |
| 19 | E2E tests: SCSI MIDI bridge | 4 | DONE (7 suites, 40+ tests) |
| 20 | Implement `WS /sds/stream` on bridge | 5 | DONE |
| 21 | Implement `ScsiMidiTransport.onSysEx()` | 5 | DONE (WebSocket + polling fallback) |
| 22 | Handle SCSI target-mode receive on Pi | 5 | RESOLVED via SCSI_EXEC in Phase 6 |
| 23 | E2E test: receive dump via SCSI bridge | 5 | RESOLVED via SCSI_EXEC in Phase 6 |
| 24 | Add SCSI MIDI transport methods (raw CDBs via SCSI_EXEC) | 6.1 | DONE |
| 25 | WebSocket streaming sample download handler | 6.2 | DONE |
| 26 | WebSocket streaming sample upload handler | 6.2 | DONE |
| 27 | TypeScript downloadSample/uploadSample with progress | 6.3 | DONE |
| 28 | E2E test: SDS download + upload round-trip | 6 | DONE |
| 29 | Deploy target (`make deploy-scsi-bridge`) | 6 | DONE |
| 30 | Build ID in bridge `/status` response | 6 | DONE |

## Known Limitations

1. ~~**SDS Data Packet streaming over SCSI**~~ — **RESOLVED.** SDS Data Packets DO arrive when using `SCSI_EXEC` with raw CDBs. The earlier failure was due to using s2p's `MIDI_*` abstraction layer which has buffering/timing issues. See Phase 6.

2. ~~**RSPACK over SCSI MIDI**~~ — **RESOLVED.** RSPACK works when sent via `SCSI_EXEC` (raw CDB 0x0C) with 7-bit encoding and flag byte 0x00. The earlier failure was due to incorrect encoding (nibble vs 7-bit) and using the MIDI abstraction layer.

3. **SCSI device scan is hardcoded** — `/scsi/scan` returns a hardcoded entry for S3000XL at ID 6. The s2p protobuf API does not expose full SCSI bus scanning. The SCSI Disk Browser feature adds `GET /scsi/inquiry/:id` for per-target discovery.

4. ~~**Write persistence under investigation**~~ — **RESOLVED** in `feature/scsi-write-validation`. Three client bugs fixed (double-framing, REPLY error detection, multi-byte writes). All 248 writable fields pass hardware validation.
