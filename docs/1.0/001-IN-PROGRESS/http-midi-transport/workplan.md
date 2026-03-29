# HTTP MIDI Transport — Workplan

**Feature:** HTTP MIDI Transport
**PRD:** [prd.md](./prd.md)
**GitHub Issues:** TBD

## Overview

This feature enables hardware e2e tests to run in Playwright by bypassing the Web MIDI API crash ([Playwright #29686](https://github.com/microsoft/playwright/issues/29686)). The solution uses an external midi-server process that communicates with the browser via HTTP and Server-Sent Events (SSE).

## Implementation Phases

### Phase 1: midi-server SSE Support

**Repository:** https://github.com/audiocontrol-org/midi-server

Add Server-Sent Events endpoint for real-time MIDI message streaming.

**Deliverables:**
- `GET /port/:id/events` SSE endpoint
- Dynamic port assignment (`--port 0`)
- Machine-readable startup output (JSON with assigned port)
- Update README with new endpoint documentation

**Technical Approach:**

cpp-httplib supports SSE via chunked transfer encoding. The implementation:

1. Register route handler for `/port/:id/events`
2. Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
3. Hold connection open
4. On MIDI input callback, format and write SSE event
5. Handle client disconnect gracefully

```cpp
// Pseudocode
server.Get("/port/:id/events", [](const Request& req, Response& res) {
    res.set_header("Content-Type", "text/event-stream");
    res.set_header("Cache-Control", "no-cache");
    res.set_header("Connection", "keep-alive");

    // Set up MIDI callback to write to this response
    auto portId = req.path_params.at("id");
    setMidiCallback(portId, [&res](const MidiMessage& msg) {
        std::string event = formatSSEEvent(msg);
        res.write(event.c_str(), event.size());
    });

    // Block until client disconnects
    waitForDisconnect(res);
});
```

**Dynamic Port Assignment:**

```cpp
int port = 0;  // OS assigns
server.listen("localhost", port);
int assignedPort = server.getLocalPort();
std::cout << "{\"port\":" << assignedPort << ",\"status\":\"ready\"}" << std::endl;
```

### Phase 2: HttpMidiTransport Implementation

**Repository:** audiocontrol (this repo)
**Module:** `editor-core`

Create HTTP transport implementing `MidiTransport` and `MidiIO` interfaces.

**Deliverables:**
- `modules/editor-core/src/transports/httpMidiTransport.ts`
- Unit tests for transport logic

**Files to Create:**

```
modules/editor-core/src/transports/
└── httpMidiTransport.ts      # HTTP transport implementation
```

**Implementation:**

```typescript
// httpMidiTransport.ts

interface HttpMidiTransportConfig {
  serverUrl: string;
}

export function createHttpMidiTransport(
  config: HttpMidiTransportConfig
): MidiTransport {
  let eventSource: EventSource | null = null;
  let stateHandler: (() => void) | null = null;

  const fetchJson = async <T>(path: string, options?: RequestInit): Promise<T> => {
    const res = await fetch(`${config.serverUrl}${path}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  };

  return {
    kind: 'http-midi',

    isSupported: () => true,

    getBrowserInfo: () => ({
      supported: true,
      browser: 'HTTP MIDI',
      notes: 'MIDI via external midi-server process.',
    }),

    initialize: async () => {
      const ports = await fetchJson<{ inputs: MidiPortInfo[]; outputs: MidiPortInfo[] }>('/ports');
      return { ...ports, sysExEnabled: true };
    },

    refresh: async () => {
      const ports = await fetchJson<{ inputs: MidiPortInfo[]; outputs: MidiPortInfo[] }>('/ports');
      return { ...ports, sysExEnabled: true };
    },

    onStateChange: (handler) => {
      stateHandler = handler;
    },

    connect: async (inputId: string, outputId: string): Promise<MidiTransportConnection> => {
      // Open ports on server
      await fetchJson(`/port/${inputId}`, { method: 'POST', body: JSON.stringify({ type: 'input' }) });
      await fetchJson(`/port/${outputId}`, { method: 'POST', body: JSON.stringify({ type: 'output' }) });

      const listeners = new Set<SysExCallback>();

      // Connect SSE for incoming messages
      eventSource = new EventSource(`${config.serverUrl}/port/${inputId}/events`);
      eventSource.addEventListener('midi', (e) => {
        const { bytes } = JSON.parse(e.data);
        if (bytes[0] === 0xF0) {  // SysEx
          listeners.forEach(cb => cb(bytes));
        }
      });

      const adapter: MidiIO = {
        send: (message: number[]) => {
          fetch(`${config.serverUrl}/port/${outputId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytes: message }),
          });
        },
        onSysEx: (callback) => listeners.add(callback),
        removeSysExListener: (callback) => listeners.delete(callback),
      };

      return {
        adapter,
        inputInfo: { id: inputId, name: inputId, state: 'connected' },
        outputInfo: { id: outputId, name: outputId, state: 'connected' },
        disconnect: async () => {
          eventSource?.close();
          await fetchJson(`/port/${inputId}`, { method: 'DELETE' });
          await fetchJson(`/port/${outputId}`, { method: 'DELETE' });
        },
      };
    },
  };
}
```

### Phase 3: Runtime Transport Integration

**Module:** `editor-core`

Update `runtimeTransport.ts` to support HTTP mode.

**Deliverables:**
- Add `isHttpMidiMode()` function
- Add `http` config option to `RuntimeMidiTransportConfig`
- Update `createRuntimeMidiTransport()` to return HTTP transport when configured

**Changes to `runtimeTransport.ts`:**

```typescript
export interface RuntimeHttpMidiConfig {
  serverUrl: string;
}

export interface RuntimeMidiTransportConfig {
  deviceName: string;
  mock?: RuntimeMockMidiConfig;
  http?: RuntimeHttpMidiConfig;  // NEW
}

export interface RuntimeMidiTransportResult {
  mode: 'web' | 'mock' | 'http';  // UPDATED
  transport: MidiTransport;
  controls?: MockMidiTransportControls;
}

export function isHttpMidiMode(): boolean {
  return getQueryParam('midi') === 'http';
}

export function getHttpMidiServerUrl(): string | null {
  const port = getQueryParam('midiServerPort');
  if (!port) return null;
  return `http://localhost:${port}`;
}

export function createRuntimeMidiTransport(
  config: RuntimeMidiTransportConfig
): RuntimeMidiTransportResult {
  // HTTP mode takes precedence (for e2e testing)
  if (isHttpMidiMode()) {
    const serverUrl = config.http?.serverUrl ?? getHttpMidiServerUrl();
    if (!serverUrl) {
      throw new Error('HTTP MIDI mode requires midiServerPort URL parameter or http.serverUrl config');
    }
    return {
      mode: 'http',
      transport: createHttpMidiTransport({ serverUrl }),
    };
  }

  // Mock mode
  const useMockMidi = Boolean(config.mock) && (config.mock?.enabled ?? isMockMidiMode());
  if (useMockMidi) {
    // ... existing mock logic
  }

  // Default to web
  return { mode: 'web', transport: createWebMidiTransport() };
}
```

### Phase 4: E2E Infrastructure

**Module:** `roland-sxx0-editor`

Create runner script and Playwright config for HTTP MIDI tests.

**Deliverables:**
- `scripts/run-http-midi-e2e.sh` — Orchestrates midi-server + Playwright
- `playwright.http-midi.config.ts` — Playwright config for HTTP tests
- Update `package.json` with new script

**run-http-midi-e2e.sh:**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(dirname "$SCRIPT_DIR")"

# Start midi-server and capture port
MIDI_SERVER_OUTPUT=$(mktemp)
midi-server --port 0 > "$MIDI_SERVER_OUTPUT" 2>&1 &
MIDI_SERVER_PID=$!

# Wait for server to output port
for i in {1..30}; do
  if grep -q '"status":"ready"' "$MIDI_SERVER_OUTPUT" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

MIDI_SERVER_PORT=$(grep -o '"port":[0-9]*' "$MIDI_SERVER_OUTPUT" | grep -o '[0-9]*')
if [[ -z "$MIDI_SERVER_PORT" ]]; then
  echo "Failed to get midi-server port"
  kill "$MIDI_SERVER_PID" 2>/dev/null || true
  exit 1
fi

echo "midi-server running on port $MIDI_SERVER_PORT"

# Cleanup function
cleanup() {
  kill "$MIDI_SERVER_PID" 2>/dev/null || true
  rm -f "$MIDI_SERVER_OUTPUT"
}
trap cleanup EXIT

# Start Vite and run Playwright (following existing port 0 pattern)
cd "$MODULE_DIR"

VITE_OUTPUT=$(mktemp)
pnpm vite --port 0 > "$VITE_OUTPUT" 2>&1 &
VITE_PID=$!

# Wait for Vite port
for i in {1..60}; do
  VITE_PORT=$(grep -o 'localhost:[0-9]*' "$VITE_OUTPUT" 2>/dev/null | head -1 | cut -d: -f2)
  if [[ -n "$VITE_PORT" ]]; then
    break
  fi
  sleep 0.1
done

if [[ -z "$VITE_PORT" ]]; then
  echo "Failed to get Vite port"
  kill "$VITE_PID" 2>/dev/null || true
  exit 1
fi

echo "Vite running on port $VITE_PORT"

# Export for Playwright
export E2E_VITE_PORT="$VITE_PORT"
export E2E_MIDI_SERVER_PORT="$MIDI_SERVER_PORT"

# Run Playwright
pnpm playwright test --config=playwright.http-midi.config.ts "$@"
EXIT_CODE=$?

# Cleanup Vite
kill "$VITE_PID" 2>/dev/null || true
rm -f "$VITE_OUTPUT"

exit $EXIT_CODE
```

**playwright.http-midi.config.ts:**

```typescript
import { defineConfig, devices } from '@playwright/test';

const vitePort = process.env.E2E_VITE_PORT;
const midiServerPort = process.env.E2E_MIDI_SERVER_PORT;

if (!vitePort || !midiServerPort) {
  throw new Error('E2E_VITE_PORT and E2E_MIDI_SERVER_PORT must be set');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'http-midi-hardware.spec.ts',
  fullyParallel: false,  // Serial execution for hardware tests
  workers: 1,
  timeout: 60000,

  use: {
    baseURL: `http://localhost:${vitePort}`,
    // Note: NO midi-sysex permission — that's the whole point
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--app=http://localhost:${vitePort}?midi=http&midiServerPort=${midiServerPort}`,
          ],
        },
      },
    },
  ],
});
```

### Phase 5: Port Hardware Tests

**Module:** `roland-sxx0-editor`

Create HTTP MIDI versions of hardware e2e tests.

**Deliverables:**
- `e2e/http-midi-hardware.spec.ts`

The tests are identical to `hardware-connected.spec.ts` except they navigate with the HTTP MIDI URL parameters.

```typescript
// e2e/http-midi-hardware.spec.ts
import { test, expect } from '@playwright/test';

const midiServerPort = process.env.E2E_MIDI_SERVER_PORT;

test.describe('Hardware tests via HTTP MIDI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?midi=http&midiServerPort=${midiServerPort}`);
    // Wait for MIDI initialization
    await expect(page.getByTestId('midi-status')).toHaveText('Connected');
  });

  test('connects to device', async ({ page }) => {
    // ... test implementation
  });

  // ... more tests
});
```

## Task Breakdown

### Phase 1: midi-server (separate repo)
1. [ ] Add `--port 0` support for dynamic port assignment
2. [ ] Add JSON startup output with assigned port
3. [ ] Implement SSE endpoint `/port/:id/events`
4. [ ] Add SSE event formatting for MIDI messages
5. [ ] Handle SSE client disconnect gracefully
6. [ ] Update README documentation
7. [ ] Test with curl/httpie to verify SSE streaming

### Phase 2: HttpMidiTransport
8. [ ] Create `httpMidiTransport.ts` with `MidiTransport` implementation
9. [ ] Implement SSE connection for incoming messages
10. [ ] Implement HTTP POST for outgoing messages
11. [ ] Add error handling for network failures
12. [ ] Write unit tests

### Phase 3: Runtime Integration
13. [ ] Add `isHttpMidiMode()` and `getHttpMidiServerUrl()` functions
14. [ ] Update `RuntimeMidiTransportConfig` interface
15. [ ] Update `createRuntimeMidiTransport()` to support HTTP mode
16. [ ] Export new functions from module

### Phase 4: E2E Infrastructure
17. [ ] Create `run-http-midi-e2e.sh` runner script
18. [ ] Create `playwright.http-midi.config.ts`
19. [ ] Add `test:e2e:http-midi` script to package.json
20. [ ] Test runner script works end-to-end

### Phase 5: Hardware Tests
21. [ ] Create `http-midi-hardware.spec.ts`
22. [ ] Verify tests pass with HTTP transport
23. [ ] Document any differences from Web MIDI behavior

## Verification

1. Build midi-server with SSE support
2. Run `./scripts/run-http-midi-e2e.sh`
3. Tests should:
   - Start midi-server on dynamic port
   - Start Vite on dynamic port
   - Navigate browser with HTTP MIDI parameters
   - Connect to device via HTTP transport
   - Send/receive SysEx successfully
   - Pass all hardware tests

## Risk Mitigation

**Risk:** SSE connection drops unexpectedly
**Mitigation:** EventSource auto-reconnects; add connection status monitoring

**Risk:** midi-server binary not in PATH
**Mitigation:** Check for binary at script start; provide helpful error message

**Risk:** Port conflicts between concurrent test runs
**Mitigation:** Dynamic port assignment ensures no conflicts

## Dependencies

- midi-server SSE support (Phase 1 must complete before Phase 4/5)
- Existing e2e infrastructure (port 0 patterns, watchdog)
