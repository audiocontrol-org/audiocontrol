# Common-Area Chopping - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

The sample chopper (`@audiocontrol/sample-chopper`) is a fully functional slicing engine with transient detection, silence detection, fixed intervals, and manual regions. It has a standalone dev harness and a two-part export. But it currently operates in a closed loop: load a WAV file → chop → output slices as `ChoppedSampleSchema` objects bound to a device context.

Common-area samples (`SampleYaml`) cannot be chopped. The chopper doesn't know about common-area storage, and chopped output doesn't produce common-area programs (`ProgramYaml`). Users must manually import WAVs, chop them, and then assign slices to device tones — a workflow that bypasses the common area entirely.

This feature connects the existing chopper to common-area samples: load from common area, chop, save slices as `SampleYaml` objects and optionally bundle as a `ProgramYaml` program.

## User Stories

- As a producer, I want to chop a common-area sample into slices so that I can build drum kits or multi-sample instruments from a single recording
- As a library curator, I want chopped slices saved back to the common area so that they're available for any device, not just the one I'm currently editing
- As a developer, I want the chopper's output to produce `ProgramYaml` (with zones) instead of device-specific `ChoppedSampleSchema` so that chopped kits are device-agnostic

## Success Criteria

- [ ] Common-area samples can be loaded into the chopper
- [ ] Chopped slices are saved as individual `SampleYaml` files in the common area
- [ ] Optionally, slices are bundled as a `ProgramYaml` with key-mapped zones
- [ ] Existing device-bound chopping workflow remains functional
- [ ] Chopper module has no new device dependencies
- [ ] Uses `FileIO` and `AudioPlayback` from environment capability interfaces

## Scope

### In Scope

- Load common-area `SampleYaml` into chopper (read WAV + metadata)
- Save chopped slices as `SampleYaml` objects to common area
- Bundle slices as `ProgramYaml` with zone mappings (key range, velocity range, root key)
- Update chopper's save/export flow to support common-area output
- Integration with sampler-editor common-area library browser

### Out of Scope

- Changes to chopping algorithms (they work fine)
- Chopper UI redesign (existing UI is functional)
- Automatic key mapping (user assigns keys manually or via template)
- Velocity layer detection from chopped slices (Phase 3 — velocity-layer-editor)

## Technical Context

### Current Chopper Output

The chopper currently produces `ChopperResult`:
```typescript
interface ChopperResult {
  slices: Slice[];           // Int16Array per slice
  sampleRate: number;
  triggerMappings?: TriggerMapping[];
  playbackConfig?: PlaybackConfig;
}
```

This is consumed by `sampler-editor` which writes `ChoppedSampleSchema` objects — a legacy format now being migrated to `SampleYaml` + `ProgramYaml` (via `chopped-sample-migration.ts` converter from the library-common-area feature).

### Target Output

For common-area chopping, the chopper should produce output that the common-area storage layer can persist directly:

```typescript
interface CommonAreaChopResult {
  samples: Array<{
    yaml: SampleYaml;       // Metadata for each slice
    wav: Uint8Array;         // WAV file bytes
  }>;
  program?: ProgramYaml;     // Optional bundle with zone mappings
}
```

### Integration Points

| Component | Current | After |
|-----------|---------|-------|
| Chopper input | File picker (WAV) | File picker OR common-area sample browser |
| Chopper output | `ChopperResult` | `ChopperResult` + `CommonAreaChopResult` |
| Save target | Device tones via editor | Common area via library storage |
| Bundle format | `ChoppedSampleSchema` | `ProgramYaml` |

### What Already Exists

| Component | Location | Reuse |
|-----------|----------|-------|
| Chopping algorithms | `sample-chopper/src/` | 100% — no changes needed |
| Chopper UI | `sample-chopper/src/ui/` | Reuse with additional save target |
| `SampleYaml` schema | `sampler-library/src/schemas/sample-schema.ts` | Direct use |
| `ProgramYaml` schema | `sampler-library/src/schemas/program-schema.ts` | Direct use |
| Common-area scanner | `sampler-library/src/common-area/` | Browse and load |
| WAV encode/decode | `sampler-devices/src/devices/roland-s-series/s-series-wave-format.ts` | Reuse `createWav` |
| Library file storage | `sampler-library/src/library-fs.ts` | Write common-area files |
| `ChoppedSample` → `SampleYaml` migration | `sampler-library/src/converters/chopped-sample-migration.ts` | Reference implementation |

### Module Changes

This feature does NOT create a new module. It extends the existing `sample-chopper` module with:

1. **New converter function** in `sample-chopper/src/`:
   - `slicesToCommonArea(result: ChopperResult, config: CommonAreaConfig): CommonAreaChopResult`

2. **UI extension** in `sample-chopper/src/ui/`:
   - "Save to Common Area" option in save flow
   - Zone mapping UI for program bundle creation

3. **Integration hook** in `sampler-editor`:
   - Common-area browser → "Chop" action → chopper with common-area input/output

## Dependencies

- `@audiocontrol/sampler-library` — `SampleYaml`, `ProgramYaml` schemas, common-area storage
- `@audiocontrol/editor-core` — environment capability interfaces
- `@audiocontrol/sample-chopper` — existing chopping engine (extended, not replaced)

## Open Questions

- [ ] Should the chopper's "Save to Common Area" create a program bundle by default, or only when the user explicitly requests it?
- [ ] How should zone key mappings default? (Chromatic starting at C1? Template-based?)
- [ ] Should the chopper produce individual `SampleYaml` files plus a separate `ProgramYaml`, or a single program bundle directory containing both?
