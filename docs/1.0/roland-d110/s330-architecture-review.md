# S-330 Editor Architecture Review

This document analyzes the S-330 editor architecture for reuse in the D-110 editor.

## Project Structure

```
modules/s330-editor/
├── src/
│   ├── core/
│   │   └── midi/              # MIDI communication layer
│   │       ├── S330Client.ts    # Client re-exports from @audiocontrol/sampler-devices
│   │       ├── WebMidiAdapter.ts # Web MIDI API wrapper
│   │       ├── types.ts         # TypeScript interfaces for MIDI
│   │       └── index.ts
│   ├── stores/                # Zustand state management
│   │   ├── midiStore.ts       # MIDI connection state
│   │   ├── s330Store.ts       # Device data state
│   │   └── index.ts
│   ├── hooks/                 # React hooks
│   │   ├── useMidi.ts         # MIDI connection hook
│   │   ├── useS330.ts         # Device operations hook
│   │   └── index.ts
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── ParameterSlider.tsx
│   │   │   ├── EnvelopeEditor.tsx
│   │   │   ├── EnvelopeDisplay.tsx
│   │   │   └── index.ts
│   │   ├── midi/              # MIDI-specific components
│   │   │   ├── MidiPortSelector.tsx
│   │   │   ├── MidiStatus.tsx
│   │   │   └── index.ts
│   │   ├── patches/           # Patch editing components
│   │   ├── tones/             # Tone editing components
│   │   └── layout/            # App layout
│   ├── pages/                 # Route pages
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Key Dependencies

- React 18.2 + React Router 6
- Zustand 4.4.7 (state management)
- Radix UI (accessible components)
- Tailwind CSS (styling)
- @audiocontrol/sampler-devices (shared device layer)
- Vitest + Playwright (testing)

## MIDI Layer Architecture

### WebMidiAdapter.ts

Handles Web MIDI API's behavior of splitting large SysEx messages into chunks:

```typescript
createWebMidiAdapter(input: MIDIInput, output: MIDIOutput): S330MidiIO
```

- Implements S330MidiIO interface
- Buffers incomplete SysEx messages
- Handles 4 cases:
  1. Complete SysEx (0xF0...0xF7 in single message)
  2. SysEx start (0xF0, missing 0xF7)
  3. SysEx middle/end chunks
  4. Regular MIDI (non-SysEx) - ignored

### Types

```typescript
interface S330MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}

interface MidiConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  inputPort: MidiPortInfo | null;
  outputPort: MidiPortInfo | null;
  sysExEnabled: boolean;
  error: string | null;
}
```

## State Management (Two-Store Architecture)

### midiStore.ts

Manages MIDI connection state and lifecycle:

```typescript
interface MidiState {
  isSupported: boolean;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  status: ConnectionStatus;
  selectedInputId: string | null;
  selectedOutputId: string | null;
  adapter: S330MidiIO | null;
  deviceId: number;
}

interface MidiActions {
  initialize: () => Promise<void>;
  connect: (inputId: string, outputId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  setDeviceId: (id: number) => void;
  sendPanic: () => void;
}
```

### s330Store.ts

Manages device data with two-tier loading:

```typescript
interface S330State {
  patchNames: PatchNameInfo[];       // Lightweight for browsing
  toneNames: ToneNameInfo[];         // Lightweight for browsing
  patches: Map<number, S330Patch>;   // Full data on-demand
  tones: Map<number, S330Tone>;      // Full data on-demand
  selectedPatchIndex: number | null;
  selectedToneIndex: number | null;
  isLoading: boolean;
  error: string | null;
}
```

## UI Components

### ParameterSlider

```typescript
interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;  // Called on drag end for device send
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
}
```

- Separation: onChange = immediate UI, onCommit = device sync

### EnvelopeEditor

- 8-point multi-segment envelope
- Interactive SVG with draggable points
- Supports D-110's multi-stage envelopes

## Patterns to Reuse for D-110

1. **MIDI Layer:** WebMidiAdapter pattern for chunked SysEx
2. **Stores:** Two-store architecture (connection + device data)
3. **Hooks:** useDevice pattern (takes adapter, returns client + methods)
4. **UI Components:** ParameterSlider, EnvelopeEditor are generic
5. **Error Handling:** No fallbacks - throw errors to surface issues

## Key Architectural Decisions

1. **Dependency Injection:** Client created from adapter, not singleton
2. **Separation of Concerns:** MIDI layer → Device protocol → React UI
3. **Two-Tier Data Loading:** Names for browsing, full data on-demand
4. **Immediate UI + Async Device Sync:** onChange updates UI, onCommit sends to device
5. **No Fallbacks:** Errors surface missing functionality
