# JV-1080 Editor - Validation Notes

## Date

2026-02-16

## Scope

Phase 1 through Phase 5 deliverables:
- JV-1080 protocol client extraction
- JV-1080 protocol unit coverage
- `jv1080-editor` module scaffold
- System parameter controls
- FX controls (type + 12 parameters)

## Automated Verification

- `pnpm --filter @audiocontrol/sampler-devices test` passed
- `pnpm --filter @audiocontrol/jv1080-editor test` passed
- `pnpm --filter @audiocontrol/jv1080-editor build` passed

## Functional Notes

- Home route can enumerate MIDI ports and connect/disconnect.
- Editor route can send DT1 writes for system parameters.
- Editor route can send DT1 writes for FX type and FX params.
- FX inbound events update UI state via `Jv1080Event.FxType` and `Jv1080Event.FxParam`.

## Known Limitations

- Hardware-in-the-loop validation is pending.
- System parameter readback is limited; UI currently reflects local control state.
- FX params are currently generic `Param 1..12` controls; per-FX semantic labels are not implemented yet.

## Pending Hardware Checklist

- [ ] Verify panel mode writes on real JV-1080
- [ ] Verify performance/patch selection writes on real JV-1080
- [ ] Verify insert/chorus/reverb/patch remain/clock writes on real JV-1080
- [ ] Verify FX type selection write on real JV-1080
- [ ] Verify representative FX param writes on real JV-1080
