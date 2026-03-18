# Standalone Hardware Device Platform - Product Requirements Document

**Created:** 2026-03-16
**Updated:** 2026-03-16
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

The audiocontrol ecosystem is a web-based editor suite for vintage samplers — tools that live in a browser and communicate with hardware over MIDI. But the samplers these tools serve (Roland S-330, S-550, Akai S3000XL, EMU ESI-32) are standalone hardware devices: boxes with knobs, buttons, displays, and dedicated audio I/O. Users who own them work in a physical studio, not in front of a laptop.

The long-term vision for audiocontrol goes beyond a web-editing companion. The goal is a **standalone hardware device** — a dedicated controller with the form factor and feel of an MPC or Digitakt — that can operate in two modes:

1. **Controller mode** — a tactile front panel for vintage samplers, sending SysEx over MIDI, replacing the hardware's limited built-in controls
2. **Standalone mode** — a self-contained sampler and sample-chopper with its own audio I/O, library management, and MIDI I/O, not requiring any external sampler

Today the software stack is not structured to run in this context. The `MidiTransport` interface only has browser (Web MIDI) and mock implementations. The editor apps are built to run in a browser against a desktop OS. There is no concept of a device-native boot configuration, a hardware layout profile, or a GPIO input source. Running the stack on a Raspberry Pi or microcontroller requires none of these things to be invented — only surfaced, formalized, and assembled.

---

## User Stories

- As a studio musician, I want a dedicated hardware controller for my Roland S-550 so that I can edit patches and tones without switching to a laptop
- As a producer, I want to chop samples and manage a sample library on a standalone device so that my workflow stays in the hardware domain
- As a developer, I want a `NodeMidiTransport` implementation so that the existing editor stack runs on RPi without changes to device-layer code
- As a developer, I want a `HardwareBootConfig` so that the editor resolves device and transport from a config file rather than from a URL
- As a hardware builder, I want a GPIO input bridge so that physical encoders and buttons generate the same `InputEvent`s as web UI interactions
- As a developer, I want a hardware layout profile system so that the React UI adapts to a small touchscreen without maintaining a separate codebase

---

## Success Criteria

- [ ] `NodeMidiTransport` implements `MidiTransport` interface, passes the same integration tests as `WebMidiTransport`
- [ ] `sampler-editor` boots on Raspberry Pi 4/5 in Chromium kiosk mode and successfully communicates with a physical S-550 via node-midi
- [ ] `HardwareBootConfig` resolves device type and transport without a URL — device config injected at startup from a JSON file
- [ ] Hardware layout CSS profile renders the editor usably on an 800×480 or 1024×600 touchscreen (no mouse, no hover states, large hit targets)
- [ ] GPIO input bridge translates rotary encoder and button events into synthetic MIDI CC or direct store actions
- [ ] `@audiocontrol/sample-chopper` standalone app (separate from `sampler-editor`) runs on RPi and operates as a self-contained chopper with library
- [ ] Proof-of-concept hardware build documented: RPi 4/5 + 7" touchscreen + USB MIDI interface + USB audio interface

---

## Scope

### In Scope

- `NodeMidiTransport` — new `MidiTransport` implementation backed by `node-midi`
- `HardwareBootConfig` — JSON config schema and loader for non-browser device startup
- `HardwareConfigProvider` — React context provider that reads from `HardwareBootConfig` instead of URL params
- Hardware layout Tailwind preset — touch-optimized sizing, no hover states, RPi display resolutions
- GPIO input bridge service — Node.js process translating GPIO events to MIDI CC or HTTP
- `sampler-editor` Electron target — packages the editor as an Electron app for RPi deployment
- Standalone sample-chopper app — `@audiocontrol/sample-chopper` wrapped as a minimal standalone Electron/kiosk app
- Hardware build documentation — bill of materials, wiring, boot configuration, OS setup

### Out of Scope

- Custom PCB or enclosure design (Phase 2)
- Dedicated MCU front panel (Teensy/RP2040) — architecture supports it but not implemented here
- Audio engine (`audio-server` C++/JUCE) RPi port — audio playback handled by USB audio interface and OS audio in Phase 1
- Custom DSP or audio processing on-device beyond what the existing `audio-server` already provides
- Multi-device concurrent control (one device at a time)
- Wireless MIDI (USB only in Phase 1)

---

## Technical Context

### Why the Existing Architecture Is Already Mostly There

The current stack is better positioned for this than it might appear:

**`MidiTransport` interface** (`editor-core/src/transports/types.ts`) is already a dependency-injected abstraction. `WebMidiTransport`, `MockMidiTransport`, and `RuntimeMidiTransport` all implement it. Adding `NodeMidiTransport` is additive — zero changes to device-layer code (`s-series-client.ts`, `jv1080-client.ts`, etc.), which depend only on the injected `SSeriesMidiAdapter`, not on any transport.

**`SSeriesMidiAdapter`** is already a pure interface (`send(data: number[]): void` + `onSysEx(callback): void`). The shared S-series client is fully parameterized by it. A `NodeMidiTransport`'s `connect()` method returns a `MidiTransportConnection` whose `adapter` field satisfies this interface directly.

**`DeviceConfigContext`** already abstracts device type from URL path. `DeviceConfigProvider` reads `params.device` from React Router. A `HardwareConfigProvider` variant can bypass the router entirely and read from a boot config file loaded at startup — same `DeviceConfig` type, different source.

**`sampler-library` browser/node split** is already established. The `browser.ts` entry point excludes filesystem operations; the main `index.ts` includes them. The Node.js path (`file-storage.ts`, `library-paths.ts`) is already usable on RPi without modification.

**`@audiocontrol/sample-chopper`** (currently in extraction — see sample-chopper-extraction workplan) will be fully decoupled from device types and sampler-library by the time this work begins. It is the natural core of the standalone chopper app.

### Transport Layer Gap

The only missing transport implementation is Node.js-native MIDI:

```
Current transports:
  web-midi     → navigator.requestMIDIAccess() — browser only
  mock         → in-memory fake — testing only
  runtime      → selects web-midi or mock at startup

Missing:
  node-midi    → node-midi (RtMidi bindings) — RPi / Electron / CLI
```

`node-midi` (npm: `midi`) wraps RtMidi and works on Linux ARM64 (RPi OS), macOS, and Windows. It is a native addon and requires rebuild for the target Node.js version, which Electron's `electron-rebuild` handles automatically.

### Hardware Boot Config

In a browser, device type comes from the URL (`/roland/s550/editor`). On hardware there is no browser navigation — the device boots directly into a fixed configuration. The `HardwareBootConfig` schema captures what the URL currently encodes, plus transport and display configuration:

```typescript
interface HardwareBootConfig {
  device: {
    type: 's330' | 's550' | 'jv1080';   // Resolved by getDeviceConfig()
    midiInputName: string;               // Matched against node-midi port list
    midiOutputName: string;
  };
  display: {
    profile: 'desktop' | 'kiosk-800x480' | 'kiosk-1024x600';
    fullscreen: boolean;
  };
  library: {
    path: string;                        // Absolute path to library root
  };
  gpio?: {
    enabled: boolean;
    encoders: GpioEncoderConfig[];
    buttons: GpioButtonConfig[];
  };
}
```

### Hardware Layout Profiles

The existing Tailwind preset (`editor-core/src/tailwind.preset.ts`) defines the `ac-*` design token classes. A hardware layout profile extends it with:

- Minimum touch target size: 44px (Apple HIG) — larger for encoder-adjacent controls
- Font sizes scaled up ~20% for readability at arm's length
- Removal of hover-state styles (`:hover` is meaningless on touchscreens without pointer devices)
- Scrollbar suppression (kiosk mode)
- Viewport lock to prevent scroll/zoom gestures interfering with the editor

### GPIO Input Bridge

Physical encoders and buttons on the hardware front panel need to control the editor. In Phase 1 (RPi without a dedicated MCU), GPIO is accessed directly from Node.js via `onoff` or `rpio`. The GPIO bridge translates hardware events into one of two forms:

1. **Synthetic MIDI CC** — the bridge sends CC messages to a virtual MIDI loopback port; the editor receives them via the normal MIDI input path (useful for parameter control)
2. **HTTP calls to a local bridge API** — for navigation and UI actions that have no MIDI equivalent (page changes, dialog open/close)

In Phase 2, a dedicated MCU (Teensy 4.1 or RP2040) handles all physical I/O and presents as USB MIDI + HID, eliminating the GPIO bridge entirely. The editor sees it as a MIDI device.

### Deployment Model

**Phase 1 (this work):** Raspberry Pi 4/5 running Raspberry Pi OS Lite, Chromium in kiosk mode, `sampler-editor` served by a local Vite/Express server or packaged as Electron.

**Phase 2 (future):** Electron app on RPi, dedicated MCU front panel, custom enclosure. The software architecture established here is unchanged.

### Module Dependency Map (New)

```
@audiocontrol/hardware-platform (new)
├── HardwareBootConfig (schema + loader)
├── HardwareConfigProvider (React context)
├── NodeMidiTransport (MidiTransport impl)
└── GpioBridge (optional, RPi only)
    ↓ depends on
@audiocontrol/editor-core (existing)
    MidiTransport interface
    DeviceConfig / DeviceConfigContext
    tailwind.preset.ts
    ↓ depends on
@audiocontrol/sampler-devices (existing)
    SSeriesClient (unchanged)
    SSeriesMidiAdapter interface (unchanged)
```

---

## Dependencies

- `node-midi` npm package — RtMidi Node.js bindings, MIT license
- `electron` + `electron-vite` — already in use for desktop build target
- `electron-rebuild` — native addon rebuild for Electron's Node.js version
- `onoff` or `rpio` — GPIO access on RPi (Phase 1 GPIO bridge only)
- Raspberry Pi 4 or 5 (4GB RAM minimum for Chromium + audio)
- 7" RPi Official touchscreen (800×480) or HDMI panel (1024×600)
- USB MIDI interface (class-compliant — Roland UM-ONE, MOTU M2, etc.)
- USB audio interface (class-compliant — for standalone audio playback in standalone mode)

---

## Open Questions

- [ ] Electron vs Chromium kiosk: Electron gives native Node.js access in the renderer process (enabling `node-midi` without IPC), while kiosk mode requires a local server as the MIDI bridge. Which deployment model for Phase 1?
- [ ] GPIO bridge architecture: synthetic MIDI CC vs HTTP API — or both? Encoders naturally map to MIDI CC; navigation buttons do not
- [ ] Audio in standalone mode: route through `audio-server` (C++/JUCE, already exists) via HTTP/WebSocket, or use Web Audio API directly in the browser for a simpler Phase 1?
- [ ] Library path on hardware: fixed path (e.g., `/home/audiocontrol/library`) or user-configurable via a setup wizard?
- [ ] Physical button layout for Phase 1: what minimum set of controls (encoders, buttons, pads) constitutes a usable hardware device without a full MCU front panel?

---

## Appendix

### MidiTransport Interface (Existing, from `editor-core/src/transports/types.ts`)

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

`NodeMidiTransport` implements this interface fully. `getNativeAccess` is omitted (browser-only concept).

### Supported Device Matrix

| Device | Controller Mode | Standalone Mode | Notes |
|--------|-----------------|-----------------|-------|
| Roland S-330 | ✓ | — | Full patch/tone/wave editor |
| Roland S-550 | ✓ | — | Full patch/tone/wave editor |
| Roland JV-1080 | ✓ | — | Patch editor |
| Standalone chopper | — | ✓ | No external sampler required |

### Phase 2 Preview (MCU Front Panel)

A Teensy 4.1 or RP2040 microcontroller handles all physical I/O — rotary encoders, buttons, pads, OLED status display, LED feedback. It presents to the RPi as USB MIDI (for parameter control) and USB HID (for navigation). The RPi sees it as a standard MIDI device. No GPIO bridge needed. No driver code in the software stack. This is the architecture used by commercial hardware (Digitakt, Octatrack, etc.) and is the target end-state for the hardware platform.
