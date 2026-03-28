# Sample Editor Module - Product Requirements Document

**Created:** 2026-03-22
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol project has editors for loop points (loop-editor) and slicing (sample-chopper), but no general-purpose sample editor for common operations like trimming, normalizing, applying fades, or reversing audio. Users must use external tools (Audacity, etc.) for basic sample preparation before importing into the library.

These operations are fundamental to any sample-based workflow:
- **Trim**: Remove unwanted audio from start/end (heads, tails, silence)
- **Normalize**: Scale amplitude to a target level
- **Fade in/out**: Apply amplitude ramps to avoid clicks
- **Reverse**: Flip sample for reverse cymbal/FX effects
- **Gain**: Adjust overall volume

The building blocks exist scattered across the codebase (RMS analysis, silence detection, crossfade curves, WAV parsing), but there's no editor UI that composes them.

## User Stories

- As a sound designer, I want to trim silence from the start and end of a sample without leaving the library page.
- As a sound designer, I want to normalize a quiet sample so it uses the full dynamic range.
- As a sound designer, I want to apply a fade-in/fade-out to eliminate clicks at sample boundaries.
- As a sound designer, I want to reverse a sample for creative effects.
- As a developer, I want a reusable sample editor module following the same patterns as loop-editor and sample-chopper.

## Solution

Create a new `sample-editor` module (distinct from `sampler-editor`) providing a `SampleEditorDialog` React component. It follows the same dual-surface architecture as loop-editor and sample-chopper: standalone dev harness with mock library, production integration via the library page, and E2E tests on both surfaces.

### Core Operations

| Operation | Input | Output | Existing Code |
|-----------|-------|--------|---------------|
| **Trim** | Start/end sample indices | Shortened sample | Manual — array slice |
| **Trim Silence** | Threshold (dB) | Auto-trimmed sample | `findOnsetAboveThreshold`, `findSilenceStart` in sample-chopper |
| **Normalize** | Target peak (dB) | Scaled sample | `calculatePeak` exists; scaling is new |
| **Fade In** | Duration (ms), curve | Ramped start | Crossfade curves exist in splice-smoother |
| **Fade Out** | Duration (ms), curve | Ramped end | Same infrastructure |
| **Reverse** | — | Flipped sample | New (trivial: `Array.reverse()`) |
| **Gain** | Amount (dB) | Scaled sample | `dbToAmplitude` exists; scaling is new |

### Architecture

```
modules/sample-editor/
├── src/
│   ├── index.ts                      # Non-UI exports (operations)
│   ├── operations/
│   │   ├── trim.ts                   # Trim and trim-silence
│   │   ├── normalize.ts              # Peak normalize and gain
│   │   ├── fade.ts                   # Fade in/out with curve options
│   │   └── reverse.ts                # Reverse samples
│   ├── ui/
│   │   ├── index.ts                  # React exports
│   │   ├── SampleEditorDialog.tsx    # Main dialog
│   │   ├── WaveformDisplay.tsx       # Non-interactive waveform view
│   │   ├── OperationPanel.tsx        # Operation controls
│   │   └── hooks/
│   │       └── useSampleEditor.ts    # State management
│   └── types.ts
├── dev/
│   ├── main.tsx                      # Dev harness
│   ├── vite.config.ts
│   └── index.html
├── test/
├── package.json
├── tsup.config.ts
└── tsconfig.json
```

### Dialog Interface

```typescript
interface SampleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  samples: Int16Array | null;
  sampleRate: number;
  sampleName: string;
  onSave?: (samples: Int16Array, sampleRate: number) => void;
}
```

### Non-Destructive Editing Model

Operations produce a new `Int16Array` — the original is never modified. The editor maintains an undo/redo history stack. Each operation is a pure function:

```typescript
type SampleOperation = (samples: Int16Array, sampleRate: number) => Int16Array;
```

### Waveform Display

A read-only waveform visualization (no drag handles like the loop editor). Shows:
- Full waveform overview
- Selection region for trim operations
- Before/after preview when an operation is pending

### MIDI Playback

Uses `useSamplePlayer` from synth-core for auditioning the sample at different pitches while editing.

## Success Criteria

- [ ] All operations produce correct audio output (unit tested)
- [ ] Dialog opens from library page via context menu and preview panel
- [ ] Waveform displays and updates after each operation
- [ ] Undo/redo works across all operations
- [ ] Save writes modified sample back to library
- [ ] Dev harness with mock library works independently
- [ ] E2E tests pass on both surfaces

## Scope

### In Scope

- Trim (manual + silence-based), normalize, fade in/out, reverse, gain
- Non-destructive editing with undo/redo
- Waveform display with selection
- MIDI playback via synth-core
- Dev harness with mock library
- Context menu + preview panel integration in library page
- E2E tests on both surfaces

### Out of Scope

- Time-stretch / pitch-shift (complex DSP, future)
- Multi-channel editing (mono only for now)
- Real-time effects preview (operations apply immediately)
- Spectral editing
- Recording from microphone/input

## Dependencies

- `@audiocontrol/synth-core` — MIDI playback
- `@audiocontrol/sampler-library` — WAV parsing, library storage
- `@audiocontrol/editor-core` — UI components, library connection
- `@radix-ui/react-dialog` — Dialog primitive
- React ^18.2.0 (peer)
