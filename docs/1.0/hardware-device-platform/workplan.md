# Standalone Hardware Device Platform - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

---

## PRD Amendment: Transport Strategy

The PRD proposes a `NodeMidiTransport` backed by `node-midi` (RtMidi bindings). After codebase analysis, this workplan recommends a different approach.

### Why Not `node-midi`

The `midi-server` repository (`audiocontrol-org/midi-server`) already exists as a C++/JUCE HTTP-to-MIDI bridge *specifically because Node.js MIDI libraries have unreliable SysEx handling*. From the midi-server PRD:

> "Node.js MIDI libraries have unreliable SysEx (System Exclusive) message handling. This makes it difficult to build TypeScript applications that communicate with MIDI hardware requiring SysEx."

The midi-server already provides:
- Reliable SysEx via JUCE (CoreMIDI/ALSA/WinMM)
- Thread-safe port management with fragment buffering
- HTTP/JSON REST API for port enumeration, open, send, receive
- Virtual MIDI port creation
- Cross-server MIDI routing
- Runs on Linux ARM64 (RPi)

### Recommended: `HttpMidiTransport`

Instead of introducing a second MIDI backend with known SysEx reliability issues, implement `HttpMidiTransport` — a `MidiTransport` implementation that talks to the already-running midi-server over HTTP.

```
Browser flow:    sampler-editor → WebMidiTransport → Web MIDI API → USB → Hardware
Hardware flow:   sampler-editor → HttpMidiTransport → midi-server HTTP API → JUCE → USB → Hardware
```

The midi-server is already a dependency on any hardware deployment (it's needed for MIDI routing). Using it as the transport eliminates `node-midi`, its native addon build complexity, and its SysEx reliability problems.

### Interface Fit

The `MidiTransport` interface maps cleanly to midi-server endpoints:

| MidiTransport method | midi-server endpoint |
|---------------------|---------------------|
| `initialize()` → `MidiTransportPorts` | `GET /ports` |
| `refresh()` → `MidiTransportPorts` | `GET /ports` |
| `connect(inputId, outputId)` | `POST /port/:id` (open input + output) |
| `connection.adapter.send(data)` | `POST /port/:id/send` |
| `connection.adapter.onSysEx(cb)` | `GET /port/:id/messages` (polling or WebSocket upgrade) |
| `connection.disconnect()` | `DELETE /port/:id` |

The one gap is real-time SysEx receive — midi-server currently uses polling (`GET /port/:id/messages`). Phase 1 uses polling with a short interval; a WebSocket upgrade to midi-server is a Phase 2 improvement.

---

## Repository Organization

### Approach: Hybrid (library code in monorepo, deployment in separate repo)

**In `audiocontrol` monorepo** — code that implements interfaces defined there:

| Module | Contents |
|--------|----------|
| `modules/http-midi-transport/` | `HttpMidiTransport` implementing `MidiTransport` from editor-core |
| `modules/hardware-config/` | `HardwareBootConfig` schema, `HardwareConfigProvider` React context |
| Extension to `editor-core/` | Kiosk Tailwind preset, touch-optimized design tokens |

**In `audiocontrol-org/midi-server`** — server-side enhancements:

| Enhancement | Purpose |
|-------------|---------|
| WebSocket upgrade for SysEx receive | Real-time message push (Phase 2) |
| Auto-discovery / mDNS | Hardware device finds midi-server on LAN |

**In new `audiocontrol-org/hardware-deploy` repo** — deployment artifacts:

| Directory | Contents |
|-----------|----------|
| `electron/` | Electron shell wrapping sampler-editor |
| `gpio-bridge/` | Standalone Node.js process: GPIO → MIDI CC / HTTP |
| `rpi-setup/` | OS config, systemd units, boot scripts |
| `docs/` | Hardware build guide, BOM, wiring |

### Why This Split

1. **`HttpMidiTransport` implements `MidiTransport` from `editor-core`** — it needs workspace access to the interface types. Cross-repo type sharing would add friction for no benefit.

2. **`HardwareBootConfig` resolves to the same `DeviceConfig` type** used by `DeviceConfigContext` in `sampler-editor`. It belongs in the same workspace.

3. **The GPIO bridge is a standalone process** — it sends MIDI CC or HTTP calls. It imports nothing from audiocontrol. It belongs with deployment tooling.

4. **Electron packaging is build tooling, not library code** — it wraps sampler-editor without modifying it.

5. **midi-server already has its own repo, build system (CMake/JUCE), and release cycle** — enhancements to it belong there.

---

## Phase 1: HttpMidiTransport (audiocontrol monorepo)

### Goal

sampler-editor can connect to hardware via midi-server instead of Web MIDI API.

### Tasks

1. **Create `modules/http-midi-transport/` package**
   ```
   modules/http-midi-transport/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts
   │   ├── http-midi-transport.ts    # MidiTransport implementation
   │   ├── http-midi-adapter.ts      # MidiIO implementation (send/receive)
   │   ├── types.ts                  # Config types (server URL, poll interval)
   │   └── port-mapper.ts            # Map midi-server port format to MidiPortInfo
   └── test/
       └── unit/
           └── http-midi-transport.test.ts
   ```

2. **Implement `HttpMidiTransport`**
   - `kind: 'http-midi'`
   - Constructor takes `{ serverUrl: string; pollIntervalMs?: number }`
   - `initialize()`: `GET /ports` → map to `MidiTransportPorts`
   - `connect()`: `POST /port/:id` for input and output → return `MidiTransportConnection`
   - `onStateChange()`: poll `/ports` on interval, diff and notify
   - `isSupported()`: ping `/health`, return true if reachable

3. **Implement `HttpMidiAdapter`** (satisfies `MidiIO` interface)
   - `send(message: number[])`: `POST /port/:outputId/send` with JSON body
   - `onSysEx(callback)`: poll `GET /port/:inputId/messages` on interval, dispatch matching callbacks
   - `removeSysExListener(callback)`: remove from listener set

4. **Extend `RuntimeMidiTransport`** to support HTTP mode
   - New config option: `http?: { serverUrl: string }`
   - Query param `?midi=http&server=localhost:7777` for browser testing
   - Falls through: http → web → mock

5. **Write tests**
   - Unit tests with mocked HTTP responses
   - Integration test against running midi-server (skipped in CI, runnable locally)

### Acceptance Criteria

- [ ] `HttpMidiTransport` passes same interface contract tests as `WebMidiTransport`
- [ ] sampler-editor can load patches from S-550 via midi-server when launched with `?midi=http`
- [ ] Polling receives SysEx responses within 50ms (configurable)
- [ ] Connection/disconnection lifecycle works cleanly

### Dependencies

- midi-server running and accessible on the network
- No changes to midi-server needed for Phase 1 (polling is sufficient)

---

## Phase 2: HardwareBootConfig (audiocontrol monorepo)

### Goal

sampler-editor can boot into a fixed device configuration from a JSON file instead of URL routing.

### Tasks

1. **Create `modules/hardware-config/` package**
   ```
   modules/hardware-config/
   ├── package.json
   ├── tsconfig.json
   ├── src/
   │   ├── index.ts
   │   ├── boot-config.ts           # Schema definition + validation
   │   ├── boot-config-loader.ts    # File loader (Node.js) + env var resolution
   │   └── HardwareConfigProvider.tsx  # React context provider
   └── test/
       └── unit/
           └── boot-config.test.ts
   ```

2. **Define `HardwareBootConfig` schema**
   ```typescript
   interface HardwareBootConfig {
     device: {
       type: SamplerDeviceType;       // 's330' | 's550' | 'jv1080'
       midiInputName: string;         // Matched against port list
       midiOutputName: string;
     };
     transport: {
       kind: 'http-midi';
       serverUrl: string;             // midi-server URL
       pollIntervalMs?: number;
     };
     display: {
       profile: 'desktop' | 'kiosk-800x480' | 'kiosk-1024x600';
       fullscreen: boolean;
     };
     library: {
       path: string;                  // Absolute path to library root
     };
   }
   ```

3. **Implement `HardwareConfigProvider`**
   - Reads boot config from a JSON file path (environment variable `AUDIOCONTROL_BOOT_CONFIG`)
   - Resolves `DeviceConfig` via existing `getDeviceConfig(config.device.type)`
   - Creates `HttpMidiTransport` from `config.transport`
   - Auto-connects to MIDI ports matching `midiInputName` / `midiOutputName`
   - Provides `DeviceConfig` via existing `DeviceConfigContext`

4. **Modify `sampler-editor/src/main.tsx`**
   - Detect hardware mode: check for `AUDIOCONTROL_BOOT_CONFIG` env var or `window.__BOOT_CONFIG__`
   - If present: use `HardwareConfigProvider` instead of URL-based `DeviceConfigProvider`
   - If absent: existing URL-based flow unchanged

### Acceptance Criteria

- [ ] sampler-editor boots from boot config JSON without URL routing
- [ ] Device type, transport, and library path all resolved from config
- [ ] Auto-connects to named MIDI ports on startup
- [ ] Existing browser-based flow unchanged when no boot config present

### Dependencies

- Phase 1 (HttpMidiTransport)
- `getDeviceConfig()` registry in sampler-editor (already exists)

---

## Phase 3: Kiosk Display Profiles (audiocontrol monorepo)

### Goal

sampler-editor renders usably on small touchscreens without hover states or tiny hit targets.

### Tasks

1. **Extend `editor-core/src/tailwind.preset.ts`**
   - Add `kiosk` variant that activates via CSS class on `<html>` element
   - Minimum touch target: 44px (48px for encoder-adjacent controls)
   - Font sizes scaled +20% under kiosk variant
   - Suppress `:hover` styles (add `@media (hover: none)` and explicit class)
   - Suppress scrollbars, disable pinch-zoom

2. **Add `kiosk-800x480` and `kiosk-1024x600` CSS profiles**
   - Viewport-locked layouts for RPi displays
   - Adjusted grid columns and panel sizes
   - Larger slider hit areas for touch

3. **Wire display profile to `HardwareBootConfig`**
   - `HardwareConfigProvider` sets CSS class on `<html>` based on `config.display.profile`
   - `config.display.fullscreen` triggers `document.documentElement.requestFullscreen()`

4. **Test on target resolutions**
   - Playwright viewport tests at 800x480 and 1024x600
   - Visual regression baselines for kiosk layouts

### Acceptance Criteria

- [ ] All interactive elements meet 44px minimum touch target in kiosk mode
- [ ] No `:hover` styles active when `display.profile` is kiosk
- [ ] Layout renders without scroll at 800x480 and 1024x600
- [ ] Desktop mode unchanged

### Dependencies

- Phase 2 (HardwareBootConfig for profile selection)
- Existing Tailwind preset in editor-core

---

## Phase 4: Electron Shell (hardware-deploy repo)

### Goal

sampler-editor runs as a native Electron app on RPi, with boot config injected at startup.

### Tasks

1. **Create `audiocontrol-org/hardware-deploy` repository**
   ```
   hardware-deploy/
   ├── electron/
   │   ├── package.json
   │   ├── electron-builder.yml
   │   ├── src/
   │   │   ├── main.ts              # Main process: load boot config, start app
   │   │   ├── preload.ts           # Expose boot config to renderer
   │   │   └── config-loader.ts     # Read /etc/audiocontrol/boot.json
   │   └── build/                   # Icons, entitlements
   ├── rpi-setup/
   │   ├── install.sh               # OS setup script
   │   ├── audiocontrol.service     # systemd unit
   │   └── boot.json.example        # Example boot config
   └── docs/
       └── hardware-build-guide.md
   ```

2. **Implement Electron main process**
   - Load boot config from `/etc/audiocontrol/boot.json`
   - Inject into renderer as `window.__BOOT_CONFIG__`
   - Create BrowserWindow with `kiosk: true` for hardware profile
   - Serve sampler-editor build via `file://` protocol

3. **RPi deployment scripts**
   - systemd unit to auto-start Electron on boot
   - Script to install dependencies (Chromium, midi-server, audio-server)
   - Network configuration for midi-server auto-discovery

4. **Build pipeline**
   - `electron-builder` targeting `linux-arm64`
   - Build sampler-editor as static assets, bundle into Electron
   - midi-server binary bundled or installed separately

### Acceptance Criteria

- [ ] Electron app boots on RPi 4/5 and shows sampler-editor
- [ ] Boot config resolved from `/etc/audiocontrol/boot.json`
- [ ] Communicates with S-550 via midi-server (HttpMidiTransport)
- [ ] Kiosk display profile active on 7" touchscreen

### Dependencies

- Phases 1-3 (transport, boot config, display profiles)
- midi-server compiled for ARM64
- RPi 4/5 with touchscreen

---

## Phase 5: GPIO Input Bridge (hardware-deploy repo)

### Goal

Physical encoders and buttons on the hardware front panel control the editor.

### Tasks

1. **Create `hardware-deploy/gpio-bridge/`**
   ```
   gpio-bridge/
   ├── package.json
   ├── src/
   │   ├── index.ts                 # Main entry, config loader
   │   ├── gpio-reader.ts           # Read encoders/buttons via onoff or rpio
   │   ├── midi-cc-emitter.ts       # Send MIDI CC to midi-server virtual port
   │   └── http-action-emitter.ts   # Send navigation actions to editor API
   └── config/
       └── gpio-map.json            # Pin → action mapping
   ```

2. **Implement GPIO reader**
   - Rotary encoder decoding (A/B phase, with acceleration)
   - Button debouncing
   - Configurable pin mapping via `gpio-map.json`

3. **Implement MIDI CC emitter**
   - Creates a virtual MIDI port via midi-server (`POST /virtual/:id`)
   - Maps encoder rotation to CC messages
   - Maps buttons to CC toggle or note-on/off
   - Editor receives via normal MIDI input path

4. **Implement HTTP action emitter**
   - For navigation (page changes, dialog open/close) that have no MIDI equivalent
   - Calls sampler-editor's local API or uses keyboard event injection

### Acceptance Criteria

- [ ] Rotary encoder controls parameter value in editor
- [ ] Button press triggers page navigation
- [ ] GPIO bridge runs as separate systemd service
- [ ] Configuration changeable without code modification

### Dependencies

- Phase 4 (Electron shell running on RPi)
- midi-server virtual port support (already implemented)
- Physical encoder/button hardware wired to GPIO

---

## Phase 6: Standalone Sample Chopper App (hardware-deploy repo)

### Goal

Self-contained chopper app running on RPi with local audio I/O, no external sampler required.

### Tasks

1. **Create `hardware-deploy/electron/chopper-app/`**
   - Wraps `@audiocontrol/sample-chopper` module
   - Own boot config (no device type, just library path + audio config)
   - Kiosk display profile

2. **Audio routing**
   - audio-server running locally on RPi for playback
   - Chopper app sends audio preview requests to audio-server
   - USB audio interface for output

3. **Library management**
   - sampler-library Node.js path for local filesystem access
   - Library stored at configurable path (default `/home/audiocontrol/library`)

### Acceptance Criteria

- [ ] Chopper app boots on RPi without any external sampler
- [ ] Can load, chop, and save samples to library
- [ ] Audio preview works through USB audio interface
- [ ] Touch-optimized UI at target resolutions

### Dependencies

- Phases 3-4 (display profiles, Electron shell)
- `@audiocontrol/sample-chopper` extraction complete
- audio-server compiled for ARM64

---

## Phase Dependencies

```
Phase 1 (HttpMidiTransport)
    ↓
Phase 2 (HardwareBootConfig)
    ↓
Phase 3 (Kiosk Display Profiles)
    ↓
Phase 4 (Electron Shell) ──────────→ Phase 5 (GPIO Bridge)
    ↓
Phase 6 (Standalone Chopper)
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| midi-server polling latency too high for SysEx | Medium | High | Measure in Phase 1; add WebSocket to midi-server if needed |
| Electron + Chromium too heavy for RPi 4 (4GB) | Low | High | RPi 5 as fallback; Chromium kiosk mode as lighter alternative to Electron |
| JUCE/midi-server ARM64 build issues | Low | Medium | midi-server already targets Linux; test cross-compile early |
| GPIO libraries (`onoff`/`rpio`) stale or broken on modern RPi OS | Medium | Low | GPIO bridge is Phase 5 and isolated; can use alternative libraries or direct /dev/gpio |
| audio-server ARM64 performance insufficient | Low | Medium | Phase 6 only; USB audio class-compliant devices offload DSP |

---

## Open Decisions

1. **Polling interval for HttpMidiTransport** — Start at 10ms, measure actual latency against hardware. If >50ms round-trip is unacceptable for real-time editing, escalate WebSocket upgrade to midi-server.

2. **Electron vs Chromium kiosk** — Electron gives `window.__BOOT_CONFIG__` injection natively. Chromium kiosk requires a local Express server to serve the boot config. Workplan assumes Electron; pivot to kiosk if Electron is too heavy on RPi 4.

3. **Library path on hardware** — Default to `/home/audiocontrol/library`, configurable in boot config. No setup wizard in Phase 1.

4. **midi-server deployment** — Bundle as sidecar in Electron app, or install as separate systemd service? Separate service is simpler and allows midi-server to run independently.
