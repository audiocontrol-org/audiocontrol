# S-330 Editor - Workplan

**GitHub Milestone:** [Week of Feb 3-7](https://github.com/audiocontrol-org/audiocontrol/milestone/1)
**GitHub Issues:**

- [Parent: Reconcile ol_dsp feature work with audiocontrol (#8)](https://github.com/audiocontrol-org/audiocontrol/issues/8)

## Technical Approach

Reconcile the diverged ol_dsp `feature/roland-s330-support` branch with audiocontrol's `deploy/s330-editor` branch. Port unique feature work from ol_dsp into the audiocontrol architecture, adapting to `@audiocontrol/` namespace and the existing stateless client API.

**Source of truth for porting:** `ol_dsp` repo at `~/work/ol_dsp-work/ol_dsp`, branch `feature/roland-s330-support`

**Path mapping:**
- ol_dsp: `modules/audio-tools/modules/s330-editor/` → audiocontrol: `modules/s330-editor/`
- ol_dsp: `modules/audio-tools/modules/sampler-devices/` → audiocontrol: `modules/sampler-devices/`
- ol_dsp: `modules/audio-tools/modules/sampler-midi/` → audiocontrol: `modules/sampler-midi/`

## Implementation Phases

### Phase 1: Port sampler-devices additions

Port the following files from ol_dsp `sampler-devices`, adapting namespace to `@audiocontrol/`:

- `src/devices/s330/s330-front-panel.ts` (283 lines) - button codes, controller factory
- `src/devices/s330/s330-parameter-listener.ts` (233 lines) - DT1 message parser
- `src/devices/s330/s330-params.ts` additions - `createEmptyPatchCommon()`
- `src/devices/s330/index.ts` - updated exports
- `test/unit/s330/s330-front-panel.test.ts` - front panel tests
- `test/unit/s330/s330-parameter-listener.test.ts` - parameter listener tests

**Keep audiocontrol's versions of:**
- `s330-addresses.ts` (empirically corrected tone addressing)
- `s330-client.ts` (stateless architecture)

### Phase 2: Port s330-editor UI additions

Port from ol_dsp `s330-editor`:

- `src/components/front-panel/` - entire directory (6 files)
  - `FrontPanelButton.tsx`
  - `FunctionButtonRow.tsx`
  - `NavigationPad.tsx`
  - `ValueButtons.tsx`
  - `VirtualFrontPanel.tsx`
  - `index.ts`
- `src/hooks/useFrontPanel.ts` - React hook for front panel control
- `src/components/video/VideoCapture.tsx` - enhanced version with front panel integration
- `public/s330-midi-setup.jpg` - static asset

Adapt these to use audiocontrol's client API instead of ol_dsp's cached client.

### Phase 3: Integrate front panel into pages

Wire the ported components into existing audiocontrol pages:
- Update `PlayPage.tsx` to include front panel controls
- Update `s330Store.ts` to support hardware parameter change events
- Integrate `useS330` and `useFrontPanel` hooks

### Phase 4: Port utility scripts and documentation

- `sampler-midi/scripts/s330-button-sender.ts`
- `sampler-midi/scripts/s330-sysex-monitor.ts`
- `modules/audio-tools/docs/s330_front_panel_sysex.md` → `modules/s330-editor/docs/`
- `s330-editor/docs/overlays.yaml`
- `s330-editor/docs/s330-web-editor-video-script.md`

### Phase 5: Test and verify

- All existing tests pass
- New front panel tests pass
- New parameter listener tests pass
- `pnpm --filter @audiocontrol/s330-editor... build` succeeds
- Manual verification of front panel in browser

## Success Criteria Per Phase

| Phase | Criteria |
|-------|----------|
| Phase 1 | `pnpm --filter @audiocontrol/sampler-devices test` passes |
| Phase 2 | Components compile, no type errors |
| Phase 3 | Front panel renders in PlayPage, sends SysEx commands |
| Phase 4 | Scripts run, docs in place |
| Phase 5 | Full build clean, all tests pass |
