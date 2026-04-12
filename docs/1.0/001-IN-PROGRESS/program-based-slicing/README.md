# program-based-slicing

Chopping a sample creates a program (with slices, key mappings, and a WAV copy) instead of modifying the source sample. One sample can be sliced multiple ways.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Schema and Storage | Complete | saveProgram/loadProgram + SourceInfoSchema + 38 tests |
| Phase 2: Chopper Output | Complete | handleChopperSave produces programs, S3K strategy adds key mappings |
| Phase 3: Library Integration | Complete | Pre-existing program support verified, zone count badge added |
| Phase 4: Editor Integration | Complete | Re-chop, drum kit editor, preview actions all work with programs |

## Deferred

- SampleSchema field removal (slices/drumKit/triggers/playback) — needs migration path for existing data

## Links

| Item | Link |
|------|------|
| Branch | `feature/program-based-slicing` |
| Worktree | `~/work/audiocontrol-work/audiocontrol-program-based-slicing` |
| PRD | [prd.md](./prd.md) |
| Workplan | [workplan.md](./workplan.md) |
| Parent Issue | [#223](https://github.com/audiocontrol-org/audiocontrol/issues/223) |
