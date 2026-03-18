# HttpMidiTransport - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

The audiocontrol editor suite communicates with vintage samplers (Roland S-330, S-550, Akai S3000XL) over MIDI SysEx. In the browser, the `WebMidiTransport` implementation handles this via the Web MIDI API. However, in non-browser environments --- specifically the hardware platform (Raspberry Pi + touchscreen running Electron) and developer tooling (Node.js scripts, integration tests) --- Web MIDI is unavailable.

Node.js MIDI libraries (`node-midi`, `easymidi`) have **unreliable SysEx handling**. This is a known, documented problem that led to the creation of [midi-server](https://github.com/audiocontrol-org/midi-server), a C++/JUCE HTTP-to-MIDI bridge that provides reliable SysEx communication via a REST API. midi-server already runs on Linux ARM64 (RPi) and is a required dependency for any hardware deployment.

The project needs an `HttpMidiTransport` implementation of the existing [`MidiTransport`](https://github.com/audiocontrol-org/audiocontrol/blob/main/modules/editor-core/src/transports/types.ts) interface that communicates with midi-server over HTTP. Because it implements the same interface, it is a drop-in replacement for `WebMidiTransport` --- device-layer code (`SSeriesClient`, `SSeriesMidiAdapter`) requires zero changes.

```
Browser:   sampler-editor --> WebMidiTransport --> Web MIDI API --> USB --> Hardware
Hardware:  sampler-editor --> HttpMidiTransport --> midi-server HTTP API --> JUCE --> USB --> Hardware
```

---

## User Stories

- As a **hardware platform user**, I want the audiocontrol editor on my RPi to communicate with my Roland S-550 via midi-server so that SysEx operations (patch load/save, wave transfer) are reliable
- As a **developer**, I want to run integration tests and Node.js scripts that communicate with real hardware via midi-server so that I can test device communication without opening a browser
- As a **developer**, I want to test HttpMidiTransport in the browser by adding `?midi=http&server=localhost:7777` to the editor URL so that I can verify the transport works before deploying to hardware
- As any **environment where WebMidi is unavailable** (Electron, Node.js CLI, server-side), I want a MidiTransport implementation that reaches hardware through midi-server so that the full device communication stack works outside the browser

---

## Success Criteria

- [ ] `HttpMidiTransport` implements the [`MidiTransport`](https://github.com/audiocontrol-org/audiocontrol/blob/main/modules/editor-core/src/transports/types.ts) interface completely
- [ ] Send SysEx messages via `POST /port/:id/send` to midi-server
- [ ] Receive SysEx messages via polling `GET /port/:id/messages` from midi-server
- [ ] Port enumeration via `GET /ports` from midi-server, mapped to `MidiTransportPorts`
- [ ] Port connection via `POST /port/:id` (open) and `DELETE /port/:id` (close)
- [ ] Passes the same interface contract tests as `WebMidiTransport` and `MockMidiTransport`
- [ ] S-550 patch load and save works end-to-end via midi-server (integration test against real hardware)
- [ ] Polling latency under 50ms for SysEx receive (configurable poll interval, starting at 10ms)
- [ ] Clean lifecycle management: connect/disconnect, polling start/stop, no leaked intervals or pending requests
- [ ] `RuntimeMidiTransport` extended with `http` mode (`?midi=http&server=<url>` query param)
- [ ] Unit tests with mocked HTTP responses achieve 80%+ coverage
- [ ] Integration tests against running midi-server (skipped in CI, runnable locally)

---

## Scope

### In Scope

- **`HttpMidiTransport`** --- `MidiTransport` implementation backed by HTTP calls to midi-server REST API
- **`HttpMidiAdapter`** --- `MidiIO` implementation that sends via HTTP POST and receives via HTTP polling (analogous to `WebMidiAdapter`)
- **Port mapper** --- translates midi-server port JSON format to `MidiPortInfo` as defined in `@audiocontrol/shared-midi`
- **Polling-based SysEx receive** --- configurable interval, dispatches to registered `SysExCallback` listeners
- **`RuntimeMidiTransport` extension** --- add `http` mode alongside existing `web` and `mock` modes
- **Configuration types** --- `HttpMidiTransportConfig` with `serverUrl`, `pollIntervalMs`, timeout settings
- **Unit tests** --- mocked HTTP responses, no real midi-server required
- **Integration tests** --- against running midi-server instance, skipped in CI
- **Module location** --- `modules/http-midi-transport/` as a standalone package in the audiocontrol monorepo
- **Package exports** --- `@audiocontrol/http-midi-transport` exporting the transport factory and types

### Out of Scope

- **WebSocket upgrade** --- Phase 2 enhancement to midi-server for real-time push instead of polling. If polling latency proves unacceptable (>50ms), this becomes the mitigation path
- **Auto-discovery / mDNS** --- hardware device finding midi-server on LAN automatically. Phase 2+
- **Changes to midi-server** --- the REST API already has the required endpoints; no server-side work needed
- **Electron integration** --- that is the `electron-shell` feature; this feature provides the transport it will use
- **HardwareBootConfig** --- that is a separate feature (`hardware-boot-config`) that depends on this one
- **Node-midi / RtMidi bindings** --- explicitly rejected in favor of the midi-server approach due to SysEx reliability issues
- **Non-SysEx MIDI messages** --- the transport handles SysEx; standard MIDI messages (note on/off, CC) are not in scope for the sampler communication use case

---

## Technical Context

### MidiTransport Interface

The transport interface is defined in [`modules/editor-core/src/transports/types.ts`](https://github.com/audiocontrol-org/audiocontrol/blob/main/modules/editor-core/src/transports/types.ts):

```typescript
interface MidiTransport {
  kind: string;
  isSupported: () => boolean;
  getBrowserInfo: () => MidiTransportBrowserInfo;
  initialize: () => Promise<MidiTransportPorts>;
  refresh: () => Promise<MidiTransportPorts>;
  onStateChange: (handler: (() => void) | null) => void;
  connect: (inputId: string, outputId: string) => Promise<MidiTransportConnection>;
  getNativeAccess?: () => MIDIAccess | null;
}
```

`MidiTransportConnection.adapter` satisfies the `MidiIO` interface:

```typescript
interface MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}
```

The `SSeriesMidiAdapter` interface (used by all S-series device clients) is structurally identical to `MidiIO` --- `send(data: number[]): void`, `onSysEx(callback): void`, `removeSysExListener(callback): void`. No adapter layer is needed between the transport connection and the device client.

### Interface-to-Endpoint Mapping

| MidiTransport method | midi-server endpoint | Notes |
|---------------------|---------------------|-------|
| `isSupported()` | `GET /health` | Returns `true` if midi-server is reachable |
| `initialize()` | `GET /ports` | Map to `MidiTransportPorts` |
| `refresh()` | `GET /ports` | Same as initialize |
| `connect(inputId, outputId)` | `POST /port/:id` (open) | Open both input and output ports |
| `connection.adapter.send(data)` | `POST /port/:id/send` | JSON body with message bytes |
| `connection.adapter.onSysEx(cb)` | `GET /port/:id/messages` | Polling at configurable interval |
| `connection.disconnect()` | `DELETE /port/:id` | Close both ports, stop polling |
| `onStateChange(handler)` | Poll `GET /ports` | Diff port list, notify on change |
| `getBrowserInfo()` | N/A | Returns static info about HTTP transport capability |
| `getNativeAccess()` | N/A | Returns `null` (not applicable for HTTP transport) |

### Existing Transport Implementations

Three implementations exist as reference:

1. **`WebMidiTransport`** (`modules/editor-core/src/transports/webMidiTransport.ts`) --- browser-only, uses `navigator.requestMIDIAccess()`. The reference for a real transport implementation.
2. **`MockMidiTransport`** (`modules/editor-core/src/transports/mockMidiTransport.ts`) --- in-memory fake for tests. Demonstrates the minimal interface contract.
3. **`RuntimeMidiTransport`** (`modules/editor-core/src/transports/runtimeTransport.ts`) --- selector that chooses between `web` and `mock` based on query params. Will be extended to support `http` mode.

### Consumer Chain

```
SSeriesClient (device logic)
    --> SSeriesMidiAdapter (interface: send/onSysEx/removeSysExListener)
        --> MidiTransportConnection.adapter (MidiIO, structurally identical)
            --> HttpMidiAdapter (new: HTTP POST for send, HTTP polling for receive)
                --> midi-server REST API
                    --> JUCE CoreMIDI/ALSA
                        --> USB MIDI --> Hardware
```

The device client and adapter interface are completely unchanged. Only the transport layer underneath is different.

### Module Structure

```
modules/http-midi-transport/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                        # Public exports
│   ├── http-midi-transport.ts          # MidiTransport implementation
│   ├── http-midi-adapter.ts            # MidiIO implementation (send/receive via HTTP)
│   ├── http-midi-transport-config.ts   # Configuration types
│   └── port-mapper.ts                  # midi-server port format --> MidiPortInfo
└── test/
    ├── unit/
    │   ├── http-midi-transport.test.ts
    │   ├── http-midi-adapter.test.ts
    │   └── port-mapper.test.ts
    └── integration/
        └── http-midi-transport.integration.test.ts
```

---

## Dependencies

- **midi-server** (`audiocontrol-org/midi-server`) --- must be running and accessible at the configured URL. Already exists, already provides the required REST endpoints, already builds for Linux ARM64
- **`MidiTransport` interface** --- defined in `@audiocontrol/editor-core`, already stable
- **`MidiIO` and `MidiPortInfo`** --- defined in `@audiocontrol/shared-midi`, already stable
- **HTTP client** --- `fetch` API (available in browsers and Node.js 18+). No additional HTTP library required
- **No native addons** --- unlike `node-midi`, this implementation is pure TypeScript/JavaScript with no native compilation step

---

## Open Questions

- [ ] **Polling interval tuning** --- Start at 10ms, measure actual round-trip latency against hardware. If >50ms is unacceptable for real-time SysEx editing (parameter changes while playing), escalate WebSocket upgrade to midi-server as a Phase 2 enhancement
- [ ] **Module location confirmation** --- `modules/http-midi-transport/` as a standalone package, or should it live inside `modules/editor-core/src/transports/`? Standalone package is cleaner for dependency management (avoids editor-core depending on HTTP client concerns) but adds a package to the workspace
- [ ] **HTTP client choice** --- `fetch` is available in Node.js 18+ and all modern browsers. Is there a reason to use a specific library (e.g., `undici` for better streaming support in Node.js)? `fetch` is the simplest option with no additional dependency
- [ ] **midi-server connection failure handling** --- When midi-server is unreachable, `isSupported()` returns `false` and `initialize()` throws. Should there be retry logic with backoff, or is fail-fast the right behavior? The project convention is no fallbacks --- throw errors with descriptive messages
- [ ] **Port ID format** --- midi-server uses its own port ID scheme. Confirm the exact format and whether it can be passed through as-is to `MidiTransportPorts`, or if a stable ID derivation is needed
- [ ] **State change polling** --- `onStateChange` needs to detect port connect/disconnect. Polling `GET /ports` on an interval and diffing is the simplest approach. What interval? Should this be the same as the message polling interval or independent?
- [ ] **Concurrent connections** --- Can `HttpMidiTransport` support multiple simultaneous connections (different port pairs)? `WebMidiTransport` can. midi-server supports multiple open ports. The implementation should support this but it needs verification

---

## Appendix

### midi-server REST API (Reference)

Based on the midi-server repository documentation:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ports` | GET | List available MIDI ports |
| `/port/:id` | POST | Open a MIDI port |
| `/port/:id` | DELETE | Close a MIDI port |
| `/port/:id/send` | POST | Send a MIDI message |
| `/port/:id/messages` | GET | Retrieve received MIDI messages (polling) |
| `/virtual/:id` | POST | Create a virtual MIDI port |

### Why Not node-midi

The midi-server workplan explicitly documents this decision:

> "Node.js MIDI libraries have unreliable SysEx (System Exclusive) message handling."

SysEx messages are the primary communication mechanism for vintage sampler control (patch read/write, wave data transfer, parameter editing). Unreliable SysEx handling means data corruption, dropped messages, and failed transfers. midi-server was built specifically to solve this problem using JUCE's proven CoreMIDI/ALSA/WinMM backends. Introducing `node-midi` as a parallel path would reintroduce the exact problem midi-server exists to solve.

### Relationship to Hardware Platform

This feature is Phase H1 of the [hardware platform track](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/ROADMAP.md). It is the root dependency for the entire hardware track:

```
http-midi-transport (this feature)
    --> hardware-boot-config
        --> kiosk-display-profiles
            --> electron-shell
                --> gpio-input-bridge
                --> standalone-chopper-app
```

The full hardware platform PRD and workplan are in [`docs/1.0/hardware-device-platform/`](https://github.com/audiocontrol-org/audiocontrol-hardware-device-platform/tree/main/docs/1.0/hardware-device-platform).
