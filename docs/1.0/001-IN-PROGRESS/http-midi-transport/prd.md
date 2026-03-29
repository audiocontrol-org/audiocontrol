# HTTP MIDI Transport - Product Requirements Document

**Created:** 2026-03-28
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Playwright's auto-granted MIDI SysEx permissions cause Chrome to crash ([Playwright Bug #29686](https://github.com/microsoft/playwright/issues/29686)). This blocks hardware e2e tests that require SysEx communication with Roland S-series samplers.

The root cause is a Chromium bug triggered when Playwright grants `midi-sysex` permission programmatically. Manual permission grants work fine, but automated testing requires programmatic grants.

## User Stories

- As a developer, I want to run hardware e2e tests in Playwright without Chrome crashing so I can validate MIDI communication flows.
- As a developer, I want the HTTP transport to be event-driven (not polling) so tests have the same timing characteristics as the Web MIDI API.
- As a developer, I want the midi-server port to be dynamically assigned so multiple test runs don't conflict.

## Success Criteria

- [ ] Hardware e2e tests run in Playwright without Chrome crashes
- [ ] midi-server supports Server-Sent Events (SSE) for real-time MIDI message delivery
- [ ] HTTP transport implements the same `MidiTransport` interface as Web MIDI
- [ ] Port assignment is dynamic (OS-assigned) and propagated to browser
- [ ] Existing hardware tests pass when run with HTTP transport

## Scope

### In Scope

- Add SSE endpoint to midi-server for real-time MIDI message streaming
- Create `HttpMidiTransport` in editor-core implementing `MidiTransport` interface
- Create HTTP MIDI adapter implementing `MidiIO` interface
- Update `runtimeTransport.ts` to support HTTP mode via URL parameter
- E2E runner script that orchestrates midi-server + Playwright
- Dynamic port assignment for midi-server

### Out of Scope

- Changes to Web MIDI transport (continues to work when SysEx permission issue is resolved)
- Non-SysEx MIDI operations (these already work with Playwright)
- Support for multiple simultaneous MIDI ports (single input/output pair sufficient)
- Mock transport changes

## Dependencies

### External

- **midi-server**: https://github.com/audiocontrol-org/midi-server
  - Built with JUCE and cpp-httplib
  - Requires adding SSE streaming capability

### Technical Constraints

- midi-server must support `--port 0` for OS-assigned port
- midi-server must output assigned port in machine-readable format
- Browser must be able to maintain long-lived SSE connection
- EventSource API handles reconnection automatically

## Architecture

```
Browser (Playwright)              MIDI Server (JUCE)           Hardware
┌─────────────────────┐          ┌─────────────────┐          ┌────────┐
│  roland-sxx0-editor │          │   midi-server   │          │ S-330  │
│                     │   HTTP   │                 │   MIDI   │        │
│  HttpMidiTransport ─┼──────────┼─► Port N       ─┼──────────┼─►      │
│  (SSE /events)      │          │  (dynamic)      │          │        │
└─────────────────────┘          └─────────────────┘          └────────┘
```

### Message Flow

**Outbound (Browser → Device):**
1. Browser calls `adapter.send([0xF0, ...])`
2. HttpMidiTransport POSTs to `/port/:id/send`
3. midi-server forwards to MIDI output
4. Device receives SysEx

**Inbound (Device → Browser):**
1. Device sends SysEx
2. midi-server receives on MIDI input
3. midi-server pushes event via SSE stream
4. Browser EventSource receives message
5. HttpMidiTransport invokes `onSysEx` callbacks

## midi-server API

### Existing Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Server health check |
| GET | `/ports` | List available MIDI ports |
| POST | `/port/:id` | Open a MIDI port |
| POST | `/port/:id/send` | Send MIDI message |
| GET | `/port/:id/messages` | Get queued messages (polling) |
| DELETE | `/port/:id` | Close port |

### New SSE Endpoint

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/port/:id/events` | SSE stream of incoming MIDI messages |

**SSE Event Format:**
```
event: midi
data: {"bytes":[240,65,16,0,...,247],"timestamp":1234567890}

event: midi
data: {"bytes":[240,65,16,0,...,247],"timestamp":1234567891}
```

### Startup Configuration

```bash
# Dynamic port assignment
midi-server --port 0

# Output on startup (machine-readable)
{"port": 7842, "status": "ready"}
```

## Implementation Notes

### HttpMidiTransport

```typescript
interface HttpMidiTransportConfig {
  serverUrl: string;  // e.g., "http://localhost:7842"
}

function createHttpMidiTransport(config: HttpMidiTransportConfig): MidiTransport {
  // Implements MidiTransport interface
  // Uses fetch() for port listing and opening
  // Uses EventSource for SSE streaming
}
```

### URL Parameter

```
?midi=http&midiServerPort=7842
```

- `midi=http` - Selects HTTP transport
- `midiServerPort=7842` - Server port (required for http mode)

### E2E Runner

The runner script orchestrates startup:

1. Start midi-server with `--port 0`
2. Parse assigned port from stdout
3. Start Vite dev server
4. Start Playwright with `midiServerPort` in URL
5. Wait for tests to complete
6. Clean up processes

## Open Questions

- [x] Should midi-server support multiple concurrent SSE connections? → No, single connection sufficient for testing
- [x] Should we support WebSocket as alternative to SSE? → No, SSE is simpler and sufficient

## Decisions Made

1. **SSE over polling** — Event-driven architecture matches Web MIDI API behavior and eliminates polling overhead.

2. **Dynamic port assignment** — OS assigns port to avoid conflicts between concurrent test runs.

3. **Single transport mode** — Runtime selects one transport (web, mock, or http). No fallback between transports.

4. **URL parameter configuration** — Follows existing pattern for `?midi=mock`. Simple, explicit, testable.
