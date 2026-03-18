# HttpMidiTransport - Workplan

**GitHub Milestone:** [Week of Mar 16-20](https://github.com/audiocontrol-org/audiocontrol/milestone/5)
**GitHub Issues:**

- [Parent: HttpMidiTransport (#62)](https://github.com/audiocontrol-org/audiocontrol/issues/62)
- [Scaffold module and implement port mapper (#68)](https://github.com/audiocontrol-org/audiocontrol/issues/68)
- [Implement HttpMidiAdapter (#69)](https://github.com/audiocontrol-org/audiocontrol/issues/69)
- [Implement HttpMidiTransport (#70)](https://github.com/audiocontrol-org/audiocontrol/issues/70)
- [Integrate into RuntimeMidiTransport (#71)](https://github.com/audiocontrol-org/audiocontrol/issues/71)
- [Integration tests against midi-server (#72)](https://github.com/audiocontrol-org/audiocontrol/issues/72)

---

## Overview

This workplan covers the implementation of `HttpMidiTransport`, a `MidiTransport` implementation that communicates with [midi-server](https://github.com/audiocontrol-org/midi-server) over HTTP. It is Phase H1 of the hardware platform track and has no dependencies on other in-progress features.

**PRD:** [`docs/1.0/http-midi-transport/prd.md`](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/http-midi-transport/prd.md)

---

## Phase 1: Module Scaffolding and Port Mapper

### Goal

Create the `modules/http-midi-transport/` package with build configuration and implement the port mapper (simplest piece, validates the package setup).

### Tasks

- [ ] Create `modules/http-midi-transport/` with `package.json`, `tsconfig.json`, `vitest.config.ts`
- [ ] Add workspace dependency on `@audiocontrol/shared-midi` (for `MidiPortInfo`, `MidiIO`, `SysExCallback` types)
- [ ] Add workspace dependency on `@audiocontrol/editor-core` (for `MidiTransport` types)
- [ ] Implement `port-mapper.ts` --- map midi-server port JSON to `MidiPortInfo[]`
- [ ] Implement `http-midi-transport-config.ts` --- configuration types (`HttpMidiTransportConfig`)
- [ ] Write unit tests for port mapper
- [ ] Verify `pnpm build` and `pnpm test` pass for the new module

### Acceptance Criteria

- [ ] Module builds cleanly in the monorepo
- [ ] Port mapper correctly translates midi-server port format to `MidiPortInfo`
- [ ] Configuration types exported from package

### GitHub Issues

See issue list in header.

---

## Phase 2: HttpMidiAdapter (Send and Receive)

### Goal

Implement the `MidiIO` adapter that sends SysEx via HTTP POST and receives via HTTP polling.

### Tasks

- [ ] Implement `http-midi-adapter.ts` with `MidiIO` interface
- [ ] `send(message)`: `POST /port/:id/send` with JSON body containing message bytes
- [ ] `onSysEx(callback)`: register listener, start polling `GET /port/:id/messages` if not already polling
- [ ] `removeSysExListener(callback)`: remove listener, stop polling if no listeners remain
- [ ] Implement polling lifecycle: start on first listener, stop on last listener removal or disconnect
- [ ] Handle HTTP errors: throw descriptive errors on network failure, non-200 responses, timeout
- [ ] Write unit tests with mocked `fetch` responses
- [ ] Test polling start/stop lifecycle (no leaked intervals)
- [ ] Test concurrent listener registration and removal

### Acceptance Criteria

- [ ] `send()` makes correct HTTP POST to midi-server
- [ ] `onSysEx()` receives SysEx messages from polling endpoint
- [ ] Polling stops cleanly when all listeners are removed
- [ ] No leaked intervals or pending HTTP requests after disconnect
- [ ] Error cases throw with descriptive messages (not fallbacks)

### GitHub Issues

See issue list in header.

---

## Phase 3: HttpMidiTransport (Full Interface)

### Goal

Implement the complete `MidiTransport` interface using `HttpMidiAdapter` for connections.

### Tasks

- [ ] Implement `http-midi-transport.ts` with `MidiTransport` interface
- [ ] `kind: 'http-midi'`
- [ ] `isSupported()`: `GET /health`, return `true` if reachable within timeout
- [ ] `getBrowserInfo()`: return static info describing HTTP transport capability
- [ ] `initialize()`: `GET /ports`, map via port-mapper to `MidiTransportPorts`
- [ ] `refresh()`: same as `initialize()`
- [ ] `connect(inputId, outputId)`: `POST /port/:id` for both ports, create `HttpMidiAdapter`, return `MidiTransportConnection`
- [ ] `disconnect()`: stop polling, `DELETE /port/:id` for both ports
- [ ] `onStateChange(handler)`: poll `/ports` on interval, diff against last known state, invoke handler on change
- [ ] `getNativeAccess()`: return `null`
- [ ] Export factory function `createHttpMidiTransport(config: HttpMidiTransportConfig): MidiTransport`
- [ ] Write unit tests for full transport lifecycle
- [ ] Write contract tests that validate the same behavioral expectations as other transports

### Acceptance Criteria

- [ ] `HttpMidiTransport` passes interface contract tests
- [ ] Connection lifecycle (connect, send, receive, disconnect) works end-to-end with mocked HTTP
- [ ] State change detection fires handler when ports change
- [ ] All resources cleaned up on disconnect

### GitHub Issues

See issue list in header.

---

## Phase 4: RuntimeMidiTransport Integration

### Goal

Extend `RuntimeMidiTransport` to support `http` mode alongside `web` and `mock`.

### Tasks

- [ ] Add `http` config option to `RuntimeMidiTransportConfig`
- [ ] Detect `?midi=http&server=<url>` query parameters
- [ ] Fall-through order: `http` (if configured) --> `web` --> `mock`
- [ ] Update `RuntimeMidiTransportResult` type to include `'http'` mode
- [ ] Write tests for mode selection logic
- [ ] Verify browser-based testing works with `?midi=http&server=localhost:7777`

### Acceptance Criteria

- [ ] `RuntimeMidiTransport` creates `HttpMidiTransport` when `?midi=http` is set
- [ ] Existing `web` and `mock` modes unchanged
- [ ] Mode selection logic is testable without browser environment

### GitHub Issues

See issue list in header.

---

## Phase 5: Integration Testing

### Goal

Validate the transport against a running midi-server instance with real hardware.

### Tasks

- [ ] Write integration test: enumerate ports from midi-server
- [ ] Write integration test: connect to input/output ports
- [ ] Write integration test: send SysEx and receive response (loopback or real device)
- [ ] Write integration test: S-550 patch load via `SSeriesClient` --> `HttpMidiTransport` --> midi-server
- [ ] Measure and document polling latency (target: <50ms)
- [ ] Mark integration tests as skipped in CI (require running midi-server)
- [ ] Document how to run integration tests locally (midi-server setup instructions)

### Acceptance Criteria

- [ ] Integration tests pass against running midi-server
- [ ] S-550 patch load/save works end-to-end
- [ ] Measured polling latency documented (with recommendation on whether WebSocket upgrade is needed)
- [ ] Tests skipped in CI, runnable locally with clear instructions

### GitHub Issues

See issue list in header.

---

## Phase Dependencies

```
Phase 1 (Scaffolding + Port Mapper)
    |
Phase 2 (HttpMidiAdapter)
    |
Phase 3 (HttpMidiTransport)
    |
    +-- Phase 4 (RuntimeMidiTransport Integration)
    |
    +-- Phase 5 (Integration Testing)
```

Phases 4 and 5 are independent of each other and can be worked in parallel after Phase 3.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Polling latency >50ms for SysEx receive | Medium | High | Measure in Phase 5; escalate WebSocket upgrade to midi-server if needed |
| midi-server port ID format incompatible with `MidiPortInfo.id` | Low | Medium | Port mapper in Phase 1 handles translation; verify format early |
| `fetch` behavior differences between browser and Node.js 18+ | Low | Low | Test in both environments; consider `undici` if issues arise |
| midi-server REST API undocumented edge cases | Medium | Medium | Integration tests in Phase 5 will surface these; fix in port mapper or adapter |

---

## Downstream Features

Completion of this feature unblocks:

- [`hardware-boot-config`](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/ROADMAP.md) --- boot config specifies `transport.kind: 'http-midi'`
- Any non-browser environment needing reliable SysEx communication
- Developer tooling for hardware integration testing
