# Workplan: Program-Based Slicing

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | [#223](https://github.com/audiocontrol-org/audiocontrol/issues/223) |
| Milestone | TBD |
| Phase 1 Issue | [#224](https://github.com/audiocontrol-org/audiocontrol/issues/224) |
| Phase 2 Issue | [#225](https://github.com/audiocontrol-org/audiocontrol/issues/225) |

## Technical Approach

### Modules Affected

| Module | Change Summary |
|--------|---------------|
| `sampler-library` | New program schema, program CRUD operations, update sample schema to drop slice/drumKit fields |
| `editor-core` | Program item type plugin, program preview panel, "Send to Device" for programs |
| `akai-s3k-editor` | Register program item type, update chopper save flow, update drum kit editor |
| `roland-sxx0-editor` | Register program item type, update chopper save flow, update drum kit editor |
| `sample-chopper` | Output a program directory (program.yaml + WAV copy) instead of modifying sample.yaml |

### Strategy

The core change is a new storage object: the **program directory**. A program directory contains a `program.yaml` file and a copy of the WAV file. The `program.yaml` schema holds slice definitions, key/pad mappings, a type label, and metadata. The `sample.yaml` schema is narrowed to remove slice and drum kit fields.

Implementation proceeds bottom-up: schema and storage first, then chopper output, then library integration, then editor integration. Each phase is independently testable.

### Dependencies

- Phase 1 has no external dependencies.
- Phase 2 depends on Phase 1 (program schema must exist before chopper can produce programs).
- Phase 3 depends on Phase 2 (library scanner needs program directories to exist) and coordinates with `feature/library-ux` for the item type plugin pattern.
- Phase 4 depends on Phase 3 (editors need program item type registered before they can open programs).

---

## Phase 1: Schema and Storage

Define the program data model and implement persistence in sampler-library.

### Tasks

- [x] Define `ProgramSchema` interface in sampler-library (pre-existing)
- [x] Define `program.yaml` file format and directory structure (pre-existing)
- [x] Implement `saveProgram()` in sampler-library
- [x] Implement `loadProgram()` in sampler-library
- [x] Add `SourceInfoSchema` to ProgramYaml for provenance tracking
- [x] Unit tests: program save/load round trip (38 tests passing)
- [x] Unit tests: program directory contains both program.yaml and WAV file after save
- [ ] Update `sample.yaml` schema to remove `slices` and `drumKit` fields (deferred — blast radius spans chopper, scanner, UI; needs migration path)
- [ ] Update `SampleSchema` interface to remove slice/drumKit types (deferred)

### Acceptance Criteria

- [x] `ProgramSchema` interface is defined and exported from sampler-library
- [x] `saveProgram()` creates a program directory with program.yaml and WAV copy
- [x] `loadProgram()` reconstructs the program object from disk
- [x] Round-trip test passes: save then load produces identical program data
- [ ] `sample.yaml` schema no longer accepts or produces slice/drumKit fields (deferred)
- [x] All existing sampler-library unit tests still pass

---

## Phase 2: Chopper Output

Update the sample chopper to produce program directories instead of modifying sample.yaml.

### Tasks

- [x] Update `handleChopperSave()` to call `saveProgram()` instead of writing slices into sample.yaml
- [x] Chopper produces a program directory with: program.yaml (zones, key mappings) + full WAV copy
- [x] Update Akai S3K editor chopper save flow with `transformChopperProgram`
- [x] Roland SXX0 editor chopper save flow updated (uses shared handleChopperSave)
- [x] Chopper sets sourceInfo from origin sample name

### Acceptance Criteria

- [x] Chopping a sample produces a new program directory, not a modified sample.yaml
- [x] Source sample is unchanged after chopping
- [x] Both Akai and Roland editor chopper flows produce programs
- [x] All chopper unit tests pass

---

## Phase 3: Library Integration

Make programs visible and actionable in the library browser.

### Tasks

- [x] Program item type plugin exists in editor-core (pre-existing)
- [x] Library scanner discovers program directories (pre-existing detectProgram)
- [x] Program preview panel shows zones, key mappings, source info (pre-existing in both editors)
- [x] Program icon visually distinct from samples (pre-existing ProgramIcon)
- [x] Register program item type in akai-s3k-editor (pre-existing)
- [x] Register program item type in roland-sxx0-editor (pre-existing)
- [x] Zone count badge on program items in library tree

### Acceptance Criteria

- [x] Programs appear in the library browser as a distinct item type
- [x] Programs have a visually distinct icon
- [x] Program preview shows zone list and key mapping summary
- [x] Both editors register and display the program item type
- [x] Library scanner correctly discovers program directories

---

## Phase 4: Editor Integration

Connect the chopper and drum kit editors to program objects.

### Tasks

- [x] loadWavData handles 'program' nodeType via loadProgram()
- [x] Chopper opens programs: loads WAV, preserves zone labels
- [x] DrumKitEditorDialog loads/saves zones for programs, slices for samples
- [x] Re-chop and Edit Kit buttons on program preview panel
- [x] handleOpenDrumKitEditor takes nodeType to distinguish programs vs samples
- [x] "Chopped Sample" label updated to "Sliced Sample" in S3K preview
- [x] "Instrument" label updated to "Program" in common program preview

### Acceptance Criteria

- [x] Existing programs can be opened in the chopper for re-editing
- [x] Drum kit editor operates on program zones
- [x] Multiple programs from the same source sample are independent
- [x] Program edit round trip works: open, modify, save, reload produces correct data

---

## Deferred Work

- **SampleSchema field removal:** Removing `slices`, `drumKit`, `triggers`, `playback` from `SampleYaml` has a large blast radius (saveChoppedSample, loadChoppedSample, library scanner sliceCount/hasDrumKit, UI components). Needs a migration path for existing chopped samples stored in the old format. Should be a separate feature or follow-up PR.
