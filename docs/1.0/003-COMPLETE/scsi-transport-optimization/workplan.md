# SCSI Transport Optimization - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Eliminate the two dominant sources of transport overhead -- polling sleep (302ms) and per-command TCP reconnection (447ms) -- by introducing a persistent, event-driven communication path between the bridge and s2p, then extending that pattern through to the browser.

The optimization is structured in three phases that build on each other. Each phase is independently testable against live hardware using the latency measurement infrastructure from scsi-write-validation.

**Key architectural decisions:**

- **New streaming server, not modified protobuf API** -- The existing s2p protobuf API (port 6868) is untouched. The streaming server is a separate TCP listener on port 6870 that shares the same internal SCSI bus engine. This means zero risk to existing consumers and a clean separation for upstreaming.
- **Persistent connections at every hop** -- TCP connections are established once and reused. The bridge keeps a long-lived connection to the streaming server. The browser keeps a long-lived WebSocket to the bridge.
- **Event push replaces polling** -- When the SCSI bus engine completes a response, the streaming server pushes it to the connected client immediately. No sleep intervals, no poll requests.
- **Graceful fallback** -- The bridge detects whether the streaming server is available at startup. If not, it falls back to the existing protobuf path with no behavior change.

## Implementation Phases

### Phase 1: MIDI Streaming Server (scsi2pi fork)

Add an optional TCP streaming server to the scsi2pi fork that provides persistent connections and event-based response delivery.

**Repository:** scsi2pi fork, branch `feature/midi-processor`
**Language:** C++

#### 1.1 Streaming Server Skeleton

**What:** Create a new TCP listener on port 6870 that accepts a single client connection and keeps it open.

**Details:**
- New source files: `midi_streaming_server.h`, `midi_streaming_server.cpp`
- Configurable port (default 6870), enabled via command-line flag
- Single-client model (sufficient for one bridge instance)
- Connection lifecycle: accept, read loop, reconnect on disconnect

**Acceptance criteria:**
- Server starts alongside s2p when flag is present
- Client can connect and stay connected
- Server logs connection/disconnection events

#### 1.2 Binary Message Framing

**What:** Define the wire protocol for the streaming connection.

**Details:**
- Length-prefixed binary frames: 4-byte big-endian length + payload
- Message types: SEND (0x01), RESPONSE (0x02), ERROR (0x03), PING (0x04), PONG (0x05)
- Payload for SEND/RESPONSE: raw MIDI bytes (SysEx, including F0/F7)
- Payload for ERROR: error code (1 byte) + UTF-8 description

**Acceptance criteria:**
- Messages can be serialized and deserialized correctly
- Round-trip encoding/decoding test passes
- Frame boundary handling works for partial reads

#### 1.3 SCSI Bus Integration

**What:** Hook the streaming server into s2p's internal SCSI bus engine so that SEND messages trigger SCSI operations and responses are pushed back to the client.

**Details:**
- SEND messages are forwarded to the same SCSI MIDI handler that the protobuf API uses
- When the SCSI handler produces a response, it is pushed to the streaming client as a RESPONSE message
- If no client is connected, responses are discarded (same as protobuf API when no one polls)
- Thread safety: the SCSI bus engine is single-threaded; the streaming server must serialize access

**Acceptance criteria:**
- A SEND containing an RPLIST SysEx produces a RESPONSE containing the PLIST reply
- Timing from SEND to RESPONSE reflects only SCSI bus time (no poll sleep)
- Existing protobuf API continues to work simultaneously

#### 1.4 Cross-Compilation and Deployment

**What:** Ensure the streaming server compiles for ARM64 (Raspberry Pi) and integrates into the e2e provisioning pipeline.

**Details:**
- Docker cross-compilation already exists for s2p; verify streaming server is included
- New command-line flag documented and passed through provisioning scripts
- e2e-infra runner scripts updated to start s2p with streaming enabled

**Acceptance criteria:**
- ARM64 binary includes streaming server
- `make test-e2e-s3k-scsi` starts s2p with streaming enabled
- Streaming server reachable from bridge on Pi

### Phase 2: Bridge Persistent Client

Modify the scsi-midi-bridge to connect to the streaming server instead of issuing per-command protobuf calls.

**Repository:** scsi-midi-bridge, Rust
**Language:** Rust

#### 2.1 MidiStreamClient

**What:** New Rust module that maintains a persistent TCP connection to the streaming server and provides async send/receive.

**Details:**
- Connects to streaming server (default `localhost:6870`)
- Implements the binary framing protocol from Phase 1
- Async receive loop (tokio) that deserializes incoming RESPONSE frames
- Send method that serializes SEND frames and writes to the connection
- Automatic reconnection on disconnect with backoff

**Acceptance criteria:**
- Client connects and stays connected
- Send/receive round-trip works for a single SysEx exchange
- Reconnection works after server restart

#### 2.2 Request Correlation

**What:** Match incoming RESPONSE messages to outstanding requests so the bridge can return the correct response to the correct HTTP/WebSocket caller.

**Details:**
- The SCSI bus is single-threaded, so requests are inherently serial
- Simple FIFO correlation: the response to the oldest outstanding SEND is the next RESPONSE
- Timeout handling: if no RESPONSE arrives within a configurable window, return an error
- Correlation IDs from the existing `X-Request-Id` tracing can be attached at the bridge level

**Acceptance criteria:**
- Multiple sequential requests each receive the correct response
- Timeout fires if device does not respond
- Tracing output includes correlation between request and response

#### 2.3 Fallback to Protobuf

**What:** If the streaming server is not available, fall back to the existing protobuf path transparently.

**Details:**
- At startup, bridge attempts to connect to streaming server port
- If connection fails, bridge uses existing protobuf client (no behavior change)
- Health check endpoint reports which path is active
- If streaming connection drops mid-operation, bridge can retry via protobuf or reconnect

**Acceptance criteria:**
- Bridge starts and works correctly when streaming server is not running
- Bridge starts and uses streaming path when streaming server is running
- `/status` endpoint indicates active transport path

#### 2.4 Latency Validation

**What:** Run the scsi-write-validation latency tests against the streaming path and compare to baseline.

**Details:**
- Use existing `make test-scsi-write-validation ARGS="--test latency"` infrastructure
- Add streaming-vs-protobuf comparison to output
- Document measured latency in implementation summary

**Acceptance criteria:**
- Measured RPDATA round-trip under 200ms (target: 150ms)
- Poll sleep component is 0ms
- TCP overhead component is under 10ms

### Phase 3: Bidirectional WebSocket

Replace the browser's HTTP request/response SysEx transport with a persistent WebSocket.

**Repository:** audiocontrol monorepo
**Language:** Rust (bridge), TypeScript (browser)

#### 3.1 WebSocket Endpoint in Bridge

**What:** Add a WebSocket endpoint to the bridge that accepts SysEx messages and pushes responses.

**Details:**
- New route: `ws://host:7033/ws/midi` (or similar)
- Accepts binary WebSocket frames containing SysEx bytes
- Pushes response SysEx bytes as binary WebSocket frames
- Supports multiple concurrent WebSocket clients (bridge fans out responses)

**Acceptance criteria:**
- WebSocket connection establishes and stays open
- SysEx sent over WebSocket produces a response over the same WebSocket
- Connection survives idle periods (ping/pong keepalive)

#### 3.2 TypeScript WebSocket Transport

**What:** New or modified transport in `midi-core` that communicates over WebSocket instead of HTTP fetch.

**Details:**
- Implements the `MidiIO` interface (same contract as existing `ScsiMidiTransport`)
- Opens a single WebSocket to the bridge on instantiation
- `send()` writes SysEx to the WebSocket
- Response delivery via the existing callback/event mechanism in MidiIO
- Reconnection logic with exponential backoff

**Acceptance criteria:**
- Drop-in replacement for `ScsiMidiTransport` in the editor
- Program browsing, parameter editing, and sample transfer work through WebSocket
- Reconnects automatically if connection drops

#### 3.3 End-to-End Latency Validation

**What:** Measure full browser-to-device-to-browser latency with the complete optimized stack.

**Details:**
- Use Playwright-based timing tests or browser dev tools
- Compare against baseline HTTP transport measurements
- Document results

**Acceptance criteria:**
- Full round-trip (browser to S3000XL and back) under 200ms for RPDATA
- No regressions in existing editor functionality
- SDS transfers work over WebSocket path

## Task Breakdown

| # | Task | Phase | Est. | Depends On |
|---|------|-------|------|------------|
| 1 | Streaming server skeleton (TCP listener, connection management) | 1.1 | 1d | -- |
| 2 | Binary message framing (protocol definition, serialization) | 1.2 | 0.5d | -- |
| 3 | SCSI bus integration (hook into s2p engine) | 1.3 | 2d | 1, 2 |
| 4 | Cross-compilation and e2e provisioning | 1.4 | 0.5d | 3 |
| 5 | MidiStreamClient (persistent TCP, async send/recv) | 2.1 | 1d | 2 |
| 6 | Request correlation (FIFO matching, timeouts) | 2.2 | 0.5d | 5 |
| 7 | Fallback to protobuf (detection, health reporting) | 2.3 | 0.5d | 5 |
| 8 | Latency validation (Phase 2, streaming vs protobuf) | 2.4 | 0.5d | 4, 6 |
| 9 | WebSocket endpoint in bridge | 3.1 | 1d | 6 |
| 10 | TypeScript WebSocket transport | 3.2 | 1d | 9 |
| 11 | End-to-end latency validation (browser to device) | 3.3 | 0.5d | 10 |

## Dependencies Between Phases

```
Phase 1 (scsi2pi C++)
  |
  ├── 1.1 Server skeleton ──┐
  ├── 1.2 Message framing ──┤
  │                          ├── 1.3 SCSI integration ── 1.4 Cross-compile
  │                          │
Phase 2 (bridge Rust)        │
  │                          │
  ├── 2.1 Stream client ─────┘ (needs framing protocol)
  ├── 2.2 Correlation ── 2.3 Fallback
  │                          │
  └── 2.4 Latency test ─────┘ (needs Phase 1 deployed + Phase 2 client)
  │
Phase 3 (bridge Rust + TypeScript)
  │
  ├── 3.1 WS endpoint ── 3.2 TS transport ── 3.3 E2E validation
  └── (needs Phase 2 working)
```

- Phase 1 and the framing protocol definition (1.2) can start immediately
- Phase 2 bridge client (2.1) can start once the framing protocol is defined, in parallel with Phase 1 SCSI integration (1.3)
- Phase 2 latency validation (2.4) requires both Phase 1 deployed on Pi and Phase 2 client working
- Phase 3 depends on Phase 2 being functional end-to-end
