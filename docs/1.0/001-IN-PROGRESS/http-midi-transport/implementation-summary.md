# HTTP MIDI Transport — Implementation Summary

**Status:** Complete
**Completed:** 2026-03-29

## Summary

The HTTP MIDI Transport feature enables hardware E2E tests to run in Playwright by bypassing the Web MIDI API crash ([Playwright #29686](https://github.com/microsoft/playwright/issues/29686)). Tests now run fully automated via `midi-server` and HTTP/SSE communication.

## What Was Built

### midi-server Changes

The midi-server (separate C++ repository) was updated with:
- `GET /port/:id/events` SSE endpoint for real-time MIDI streaming
- Dynamic port assignment (`--port 0`)
- JSON startup output: `{"port": N, "status": "ready"}`
- Health check endpoint: `GET /health`
- Port management: `POST /port/:id`, `DELETE /port/:id`
- Message sending: `POST /port/:id/send`

### audiocontrol Changes

**New Transport Implementation:**
- `editor-core/src/transports/httpMidiTransport.ts` - HTTP transport with SSE
- Implements `MidiTransport` interface
- Full SysEx support via JSON payloads

**Runtime Integration:**
- Updated `runtimeTransport.ts` with:
  - `isHttpMidiMode()` - Check URL params for HTTP mode
  - `getHttpMidiServerUrl()` - Extract server URL from params
  - `getActiveTransportMode()` - Get current mode (web/http/mock)
  - `getSavedTransportConfig()` / `saveTransportConfig()` - localStorage persistence

**Transport Selection UI:**
- `editor-core/src/components/TransportSelector.tsx` - Dropdown selector
- Integrated into MidiConnectionPage as "Advanced Settings"
- Persists selection to localStorage
- Reloads page on transport change

**E2E Infrastructure:**
```
scripts/
├── run-http-midi-e2e.sh    # Main orchestrator
├── validate-device.ts       # Device discovery
└── watchdog.ts              # Stuck test detection

e2e/
├── hardware-device.spec.ts  # HTTP MIDI transport tests
├── hardware-connected.spec.ts # App UI tests (transport-agnostic)
└── reporters/
    └── heartbeat-reporter.ts # Test heartbeat for watchdog

playwright.http-midi.config.ts  # Playwright configuration
```

**Test IDs Added:**
- `data-testid="tone-item-{N}"` on ToneList
- `data-testid="patch-item-{N}"` on PatchList
- `data-testid="tone-detail"` on ToneEditor
- `data-testid="param-{label}"` on ParameterSlider

## Key Decisions

1. **URL params for transport selection** - Using `?midi=http&midiServerPort=XXX` allows test runner to configure transport without modifying app code.

2. **localStorage persistence** - Transport selection remembered so users don't need to reconfigure on page reload.

3. **Device validation before tests** - `validate-device.ts` runs first and fails fast if no device connected. Discovered ports passed to tests via environment variables.

4. **Heartbeat/watchdog architecture** - Custom Playwright reporter emits heartbeats; separate watchdog process kills stuck tests after 5 seconds of inactivity.

5. **Transport-agnostic tests** - `hardware-connected.spec.ts` works with both Web MIDI and HTTP MIDI, determined by URL parameters.

## Testing

### Test Results
- **17 tests passing**
- **2 tests skipped** (sample playback - features not yet implemented)

### Test Categories
| Category | Tests | Status |
|----------|-------|--------|
| HTTP MIDI Transport | 4 | ✅ Passing |
| Device Connection Flow | 5 | ✅ Passing |
| Device State Reading | 5 | ✅ Passing |
| Sample Playback | 2 | ⚠️ Skipped |
| Error Handling | 2 | ✅ Passing |

### Running Tests
```bash
cd modules/roland-sxx0-editor
./scripts/run-http-midi-e2e.sh
```

## Known Limitations

1. **midi-server required** - Must build from https://github.com/audiocontrol-org/midi-server
2. **Local only** - HTTP transport requires midi-server on same machine
3. **Single device** - Tests assume one Roland S-series device connected
4. **Chromium only** - HTTP MIDI tests only run in Chromium (SSE limitation)

## Future Improvements

1. **Cross-repo automation** - Full devenv integration for automatic midi-server rebuild
2. **CI hardware testing** - Remote hardware lab integration
3. **Multi-device support** - Test with multiple devices simultaneously
4. **WebSocket transport** - Replace SSE with WebSockets for bidirectional communication
