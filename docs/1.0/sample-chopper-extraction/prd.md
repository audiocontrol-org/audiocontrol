# Sample Chopper Extraction - Product Requirements Document

**Created:** 2026-03-15
**Status:** In Progress
**Owner:** Orion Letizi

## Problem Statement

The sample slicing workflow (load audio, detect slices, edit boundaries, export) is currently embedded across two modules:

- **sampler-library** — slicing algorithms (`sample-chopper/` subdirectory)
- **sampler-editor** — React UI (`SampleChopperDialog`, `WaveformEditor`, hooks)

Both are coupled to Roland S-330/S-550 types (`S330WaveSampleRate`, `ResolvedDrumKitBundle`). When the Akai sampler editor arrives, it will need the same slicing UI without the Roland coupling.

### Current State

| Module | Coupling | Impact |
|--------|----------|--------|
| `sampler-library/sample-chopper/types.ts` | `DrumKitOutputConfig` uses `S330WaveSampleRate` | Algorithm types tied to Roland |
| `sampler-library/sample-chopper/chopper.ts` | `slicesToDrumKit()` returns `ResolvedDrumKitBundle` | Orchestrator tied to Roland drum kit format |
| `sampler-editor/SampleChopperDialog.tsx` | Hardcoded S-330 kit config UI (15/30kHz sample rate, S-330 CSS classes) | UI tied to one device |
| `sampler-editor/useSampleChopper.ts` | `sampleRate: 15000 \| 30000` type | Hook tied to S-330 rates |

### Key Issues

1. **Device coupling in algorithms** — Pure audio analysis functions are in a module that depends on `@audiocontrol/sampler-devices`
2. **UI not reusable** — `SampleChopperDialog` hardcodes Roland-specific output config
3. **CSS coupling** — `s330-*` Tailwind classes baked into generic components
4. **No clean boundary** — No way for a new editor to use slicing without importing sampler-library

## User Stories

- As an editor developer, I want to import a sample chopper dialog without depending on Roland-specific modules
- As an editor developer, I want to inject my device-specific output configuration into the chopper dialog via render props
- As a user, I want the same slicing experience regardless of which sampler editor I'm using

## Success Criteria

- [ ] `@audiocontrol/sample-chopper` module builds independently (`pnpm --filter sample-chopper build`)
- [ ] Module has zero imports from `sampler-devices` or `sampler-library`
- [ ] All existing algorithm tests pass in the new module
- [ ] `sampler-library` re-exports chopper functions for backward compatibility
- [ ] `SampleChopperDialog` accepts `renderOutputConfig` render prop for device-specific UI
- [ ] `sampler-editor` builds and functions identically after extraction
- [ ] Generic components use design tokens instead of `s330-*` CSS classes

## Scope

### In Scope

- Extract pure slicing algorithms to `@audiocontrol/sample-chopper`
- Extract React UI components (WaveformEditor, SampleChopperDialog, hooks)
- Refactor dialog to render prop pattern for device-specific config
- Replace S-330 CSS classes with design tokens in extracted components
- Create `S330KitOutputConfig` component in sampler-editor
- Backward-compatible re-exports from sampler-library

### Out of Scope

- Akai editor implementation (uses the new module later)
- New slicing algorithms or features
- Changes to Node.js-only `chopSampleToDrumKit` (stays in sampler-library)
- Changes to `chopper-node.ts` (stays in sampler-library)

## Dependencies

- `@audiocontrol/editor-core` — design token CSS variables
- React 18, Radix UI — peer dependencies for UI layer
