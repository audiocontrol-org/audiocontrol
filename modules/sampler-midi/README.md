# @audiocontrol/sampler-midi

**Interface-first MIDI communication library for hardware samplers with explicit dependency injection.**

## Purpose

The `sampler-midi` package provides programmatic MIDI control of hardware samplers, particularly Akai S3000XL devices. It enables applications to send/receive MIDI messages, communicate via SysEx protocol, and manage multi-channel instrument configurations without manual MIDI port management or hardware-specific protocol knowledge.

Musicians and developers can build MIDI sequencers, hardware controllers, and sampler automation tools that work across platforms and testing environments. The interface-first architecture ensures code works with real hardware, mock backends for testing, or alternative MIDI implementations (Web MIDI API, custom protocols) without modification.

## Philosophy

**Explicit dependencies over hidden coupling.** Traditional MIDI libraries couple applications to specific backends (easymidi, node-midi, Web MIDI) through module-level imports and singleton patterns. This makes testing difficult and limits flexibility.

This library inverts the dependency:

- **Backend as constructor parameter**: Applications inject MIDI backend implementations
- **Interface contracts**: `MidiBackend`, `MidiInput`, `MidiOutput` define what, not how
- **Testing without hardware**: Mock backends provide predictable, repeatable test environments
- **Platform flexibility**: Swap backends (Node.js, Web, custom) without application changes

The result: applications that compile once and run in development (with mocks), CI (with mocks), and production (with real hardware).

## Design Approach

### Backend Abstraction Layer

The `MidiBackend` interface separates MIDI port discovery and creation from the implementation:

```typescript
interface MidiBackend {
  getInputs(): MidiPortInfo[];
  getOutputs(): MidiPortInfo[];
  createInput(name: string, virtual?: boolean): RawMidiInput;
  createOutput(name: string, virtual?: boolean): RawMidiOutput;
}
```

Applications depend on `MidiBackend`, not `easymidi` or `WebMIDI`. Testing injects `MockMidiBackend`. Production injects `EasyMidiBackend`. Code remains identical.

### Channel-Based Instrument Abstraction

MIDI channels (0-15) enable multi-timbral operation, but managing them manually clutters code:

```typescript
// Without abstraction
output.sendNoteOn(60, 100, 0);  // Channel 0
output.sendNoteOn(64, 100, 0);  // Same channel
output.sendNoteOn(67, 100, 1);  // Different channel

// With MidiInstrument abstraction
const bass = createMidiInstrument(midiSystem, 0);
const piano = createMidiInstrument(midiSystem, 1);
bass.noteOn(60, 100);   // Automatically uses channel 0
piano.noteOn(67, 100);  // Automatically uses channel 1
```

Instruments encapsulate channel management, reducing cognitive load and errors.

### Akai S3000XL Protocol Layer

The S3000XL uses proprietary MIDI SysEx messages for program/sample manipulation. The `Device` interface provides:

- **Program management**: Fetch names, headers, complete programs
- **Sample operations**: Fetch sample information and metadata
- **SysEx abstraction**: High-level methods hide message construction
- **Async communication**: Promise-based API handles request/response flow

Applications call `device.fetchProgramNames()` instead of constructing SysEx messages manually.

## Architecture

```
┌─────────────────────────────────────┐
│       Application Code              │
└──────────────┬──────────────────────┘
               │ uses
       ┌───────▼────────┐
       │  MidiSystem    │  Orchestrates ports, messages
       └───────┬────────┘
               │ depends on (injected)
       ┌───────▼────────┐
       │  MidiBackend   │  Interface (platform abstraction)
       └───────┬────────┘
               │ implemented by
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐    ┌───────▼────────┐
│ EasyMidi   │    │  MockMidi      │
│ Backend    │    │  Backend       │
│ (prod)     │    │  (testing)     │
└────────────┘    └────────────────┘
```

Instrument abstraction:

```
MidiSystem → MidiInstrument(channel=0) → output.sendNoteOn(note, vel, 0)
          → MidiInstrument(channel=1) → output.sendNoteOn(note, vel, 1)
```

## Version 1.0

Version 1.0 provides MIDI communication with interface-first dependency injection and comprehensive S3000XL support.

**Key Features:**
- Interface-first architecture (backend injection required)
- EasyMidi backend for Node.js (easymidi library)
- Mock backend support for testing
- Channel-based instrument abstraction
- Akai S3000XL MIDI SysEx protocol
- Virtual MIDI port support (macOS/Linux)
- Full TypeScript strict mode compliance

**Breaking Changes from v6.x:**
- Removed legacy `Midi` class
- Removed `createMidiSystem()` factory
- Backend injection now **required** (not optional)
- See migration guide in [API Reference](./docs/1.0/api-reference.md)

**Supported Platforms:**
- macOS (darwin-arm64, darwin-x64)
- Linux (x64, ARM64)
- Windows (Node.js native or WSL2)

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 🔄 [Migration Guide (v6 → v7)](./docs/1.0/migration-guide.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-midi
pnpm install
pnpm run build
pnpm test
```

**Testing with Mock Backend:**
```typescript
import { MidiSystem, MockMidiBackend } from '@audiocontrol/sampler-midi';

const mockBackend = new MockMidiBackend();
const midiSystem = new MidiSystem(mockBackend);
// Test without hardware
```

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@audiocontrol/sampler-devices](https://www.npmjs.com/package/@audiocontrol/sampler-devices) - Akai device abstractions (uses this package)
- [@audiocontrol/sampler-lib](https://www.npmjs.com/package/@audiocontrol/sampler-lib) - Core utilities

**External Dependencies:**
- [easymidi](https://www.npmjs.com/package/easymidi) - Cross-platform MIDI support for Node.js

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
