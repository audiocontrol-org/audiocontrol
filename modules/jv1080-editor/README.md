# @audiocontrol/jv1080-editor

Web editor for Roland JV-1080, built on top of `@audiocontrol/sampler-devices` and `@audiocontrol/shared-midi`.

## Status

Phase 3-5 implementation is complete:
- App scaffold and routing
- MIDI connection flow (Web MIDI input/output selection, connect/disconnect)
- System parameter controls
- FX type + FX parameter controls

Hardware validation remains pending.

## Architecture

- Transport and browser MIDI:
  - `@audiocontrol/shared-midi`
- Device protocol client:
  - `@audiocontrol/sampler-devices/jv1080`
- UI state:
  - Zustand store in `src/stores/midiStore.ts`
- Feature UI:
  - System controls: `src/components/system/SystemControls.tsx`
  - FX controls: `src/components/system/FxControls.tsx`

## Routes

- `/` Home: MIDI connection and device ID setup
- `/editor` Editor: system and FX write controls

## Development

```bash
pnpm --filter @audiocontrol/jv1080-editor dev
pnpm --filter @audiocontrol/jv1080-editor test
pnpm --filter @audiocontrol/jv1080-editor build
```

## Current Limitations

- No readback for most system parameters (UI is optimistic for local edits).
- Hardware validation has not yet been completed for system and FX writes.
- No patch name editor or deep per-FX-type parameter labeling yet (parameters are generic `Param 1..12`).

## Protocol Notes

- Device writes use Roland DT1 messages through `Jv1080Client`.
- System writes call client methods:
  - `panelModePerformance/patch/gm`
  - `setPerformanceNumber`
  - `patchGroupUser/patchGroupPcm`
  - `setPatchGroupId`, `setPatchNumber`
  - `setInsertFx`, `setChorusFx`, `setReverbFx`
  - `setPatchRemain`
  - `setClockInternal`, `setClockMidi`
- FX writes call:
  - `setFx`
  - `setFxParam(index, value)`
- Inbound FX updates are subscribed via:
  - `Jv1080Event.FxType`
  - `Jv1080Event.FxParam`
