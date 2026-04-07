# SCSI Transport Optimization - Product Requirements Document

**Created:** 2026-04-05
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The SCSI-over-network transport chain for communicating with the Akai S3000XL has a median round-trip latency of ~865ms per RPDATA request, but only ~112ms of that is actual SCSI bus time. The remaining 87% is overhead from two sources: fixed polling intervals (3 x 100ms sleeps = 302ms) and per-command TCP reconnection to s2p's protobuf API (447ms in connect/disconnect cycles).

These numbers come from request tracing instrumentation added during the scsi-write-validation feature, which measured per-hop timing across the full transport chain:

```
Browser <--WebSocket--> Bridge (Rust/Axum) <--TCP--> s2p (SCSI2Pi) <--SCSI--> Akai S3000XL
```

| Component | Time | % of Total |
|-----------|------|------------|
| MIDI_SEND (SCSI bus) | 112ms | 13% |
| Poll sleep (3 x 100ms) | 302ms | 35% |
| s2p I/O overhead (TCP connect/disconnect) | 447ms | 52% |
| **Total** | **865ms** | **100%** |

At 865ms per operation, browsing a 64-program memory bank takes over 55 seconds for header reads alone. Sample transfers and multi-field edits compound this into multi-minute waits. The transport overhead makes the web editor feel sluggish in a way that has nothing to do with the SCSI bus or the sampler.

The overhead has two root causes, both architectural:

1. **Polling model** -- The bridge sends a MIDI_SEND command to s2p, then polls for a response with MIDI_POLL at fixed intervals (100ms). Each poll is a separate TCP connection. If data isn't ready on the first poll, the bridge sleeps and reconnects. This is how s2p's existing protobuf API works: it was designed for low-frequency CLI queries, not interactive editor traffic.

2. **Per-command TCP reconnection** -- Every protobuf call (MIDI_SEND, MIDI_POLL, MIDI_READ) opens a new TCP connection to s2p port 6868, sends one command, reads one response, and closes the socket. For a single RPDATA round-trip, this means 4-6 TCP connections.

Both causes are addressable without modifying the existing s2p protobuf API or the SCSI bus layer.

## User Stories

- As a musician using the web editor, I want sample and program browsing to feel responsive so that navigating my S3000XL's memory doesn't require waiting several seconds per item
- As a musician, I want parameter edits to reflect on the sampler with minimal delay so that sound design feels interactive rather than batch-oriented
- As a developer, I want the transport to push responses when they are ready instead of polling so that latency is bounded by SCSI bus time, not sleep intervals
- As a developer, I want persistent connections between bridge and s2p so that TCP overhead doesn't dominate every round-trip
- As a developer, I want the existing protobuf API to remain untouched so that other s2p consumers (CLI tools, third-party integrations) continue working

## Success Criteria

- [ ] Median RPDATA round-trip latency under 150ms (currently 865ms)
- [ ] Response delivery is event-based (push), not polling-based
- [ ] Bridge maintains a persistent TCP connection to s2p (no per-command reconnect)
- [ ] Browser communicates over a single bidirectional WebSocket for SysEx send and receive
- [ ] Existing s2p protobuf API (port 6868) is untouched and continues to function
- [ ] Backward compatibility: bridge can fall back to protobuf API if streaming server is unavailable
- [ ] Latency tests (from scsi-write-validation) updated to measure the optimized path

## Scope

### In Scope

**Phase 1: MIDI Streaming Server in scsi2pi fork**

A new, optional TCP server inside the scsi2pi fork that provides persistent connections and event-based push for MIDI-over-SCSI traffic. Key design constraints:

- Runs on a separate port (6870) alongside the existing protobuf API (6868)
- Shares the s2p SCSI bus engine internally -- does not create a second SCSI initiator
- Binary message framing over persistent TCP (length-prefixed, not protobuf)
- Pushes SCSI responses to the client as soon as they arrive (no polling)
- Designed as a self-contained module so it can be proposed upstream without rearchitecting s2p

**Phase 2: Bridge persistent client**

Modify the scsi-midi-bridge (Rust/Axum) to connect to the streaming server instead of the protobuf API:

- Persistent TCP connection with automatic reconnection
- Event-driven receive loop replaces poll-sleep-read cycle
- Fallback to existing protobuf path if streaming server is not running
- Request correlation (match responses to outstanding requests)

**Phase 3: Bidirectional WebSocket**

Upgrade the browser-to-bridge communication from HTTP request/response to a single persistent WebSocket:

- Browser sends SysEx messages over WebSocket
- Bridge pushes responses over the same WebSocket as they arrive from the streaming server
- Eliminates the browser-side poll loop (currently in `ScsiMidiTransport`)
- TypeScript transport implementation in `midi-core`

### Out of Scope

- **TLS** -- The web editor requires HTTPS, which means the browser-facing WebSocket needs WSS. This is a deployment concern (TLS termination at the bridge or via reverse proxy), not a protocol concern. Deferred to a separate infrastructure task.
- **Modifying the existing protobuf API** -- Port 6868 stays as-is.
- **Roland device support** -- This optimization targets the SCSI-over-network path used by the S3000XL. Roland S-series devices use a different transport (HTTP MIDI via midi-server).
- **SDS streaming** -- SDS transfers (large sample data) may benefit from the persistent connection but have additional complexities (flow control, packet sequencing). SDS optimization is a follow-up if the base transport optimization succeeds.

## Dependencies

- **scsi2pi fork** (`feature/midi-processor` branch) -- Phase 1 builds the streaming server here. This is our fork of SCSI2Pi; upstream changes require a PR.
- **scsi-midi-bridge** -- Phase 2 modifies the Rust bridge daemon. Currently deployed on the Pi via the e2e provisioning pipeline.
- **midi-core** -- Phase 3 adds a new `WebSocketMidiTransport` (or modifies `ScsiMidiTransport`) in this TypeScript module.
- **e2e-infra** -- The SCSI e2e provisioning pipeline (build ARM64 binaries, deploy to Pi, start daemons) needs to handle the new streaming server binary/config.

## Open Questions

- [ ] What is the actual poll interval inside s2p's SCSI response handling? The 112ms MIDI_SEND time may include internal polling that could also be optimized, or it may be pure bus time.
- [ ] How does the SCSI bus engine surface completed responses internally? If it uses a callback or queue, the streaming server can hook in directly. If it uses synchronous blocking, a dedicated thread may be needed.
- [ ] Does SDS streaming (multi-packet transfers with ACK/NAK flow control) work cleanly with the event push model, or does it need a separate code path?
- [ ] What binary framing format for the streaming protocol? Options include length-prefixed raw bytes, a minimal TLV (type-length-value) scheme, or Cap'n Proto for zero-copy.
- [ ] Should the streaming server accept multiple simultaneous clients, or is a single-client model sufficient for the bridge?

## Appendix

### Target Architecture

```
                        Browser (Web Editor)
                             |
                        WebSocket (bidirectional)
                             |
                   +---------+---------+
                   |  scsi-midi-bridge |
                   |   (Rust / Axum)   |
                   +----+---------+----+
                        |         |
           persistent TCP    (fallback) protobuf TCP
              port 6870          port 6868
                        |         |
                   +----+---------+----+
                   |       s2p         |
                   |  MIDI Streaming   |  <-- Phase 1: new module
                   |     Server        |
                   |                   |
                   |  SCSI bus engine  |  <-- existing, shared
                   +--------+----------+
                            |
                        SCSI bus
                            |
                   +--------+----------+
                   |   Akai S3000XL    |
                   |   (SCSI ID 6)     |
                   +-------------------+
```

### Latency Breakdown: Before and After

| Metric | Before (protobuf + poll) | After (streaming) | Reduction |
|--------|--------------------------|-------------------|-----------|
| SCSI bus time | 112ms | 112ms | -- |
| Poll sleep | 302ms | 0ms | -302ms |
| TCP overhead | 447ms | ~5ms (persistent) | -442ms |
| **Total** | **865ms** | **~120ms** | **~86%** |

"After" numbers are estimates based on eliminating the known overhead. Actual measurements will come from Phase 1 + Phase 2 integration testing against live hardware.

### Message Types (Streaming Protocol)

The streaming server needs to handle at minimum:

| Direction | Message | Description |
|-----------|---------|-------------|
| Client -> Server | SEND | SysEx bytes to transmit on SCSI bus |
| Server -> Client | RESPONSE | SysEx bytes received from device |
| Server -> Client | ERROR | Error from SCSI bus or internal failure |
| Client -> Server | PING | Keepalive |
| Server -> Client | PONG | Keepalive response |

Exact framing TBD (see Open Questions).

### Related Features

- [SCSI Write Validation](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-write-validation/docs/1.0/scsi-write-validation/README.md) -- Produced the tracing data that identified this optimization opportunity
- [SCSI MIDI Bridge](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/scsi-midi-bridge/README.md) -- The existing bridge architecture being optimized
