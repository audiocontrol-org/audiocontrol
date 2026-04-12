# Workplan: Program-Based Slicing

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | [#223](https://github.com/audiocontrol-org/audiocontrol/issues/223) |
| Milestone | TBD |
| Phase 1 Issue | [#224](https://github.com/audiocontrol-org/audiocontrol/issues/224) |

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

- [ ] Define `ProgramSchema` interface in sampler-library with fields: slices, keyMappings, type label (drumKit | choppedSample | instrument), sourceInfo (original sample name, optional reference), metadata
- [ ] Define `program.yaml` file format and directory structure (program dir contains `program.yaml` + WAV file)
- [ ] Implement `saveProgram()` in sampler-library -- writes program.yaml and copies WAV to program directory
- [ ] Implement `loadProgram()` in sampler-library -- reads program.yaml and resolves WAV path
- [ ] Update `sample.yaml` schema to remove `slices` and `drumKit` fields
- [ ] Update `SampleSchema` interface to remove slice/drumKit types
- [ ] Unit tests: program save/load round trip (write program, read it back, compare)
- [ ] Unit tests: sample.yaml without slice fields loads correctly
- [ ] Unit tests: program directory contains both program.yaml and WAV file after save

### Acceptance Criteria

- `ProgramSchema` interface is defined and exported from sampler-library
- `saveProgram()` creates a program directory with program.yaml and WAV copy
- `loadProgram()` reconstructs the program object from disk
- Round-trip test passes: save then load produces identical program data
- `sample.yaml` schema no longer accepts or produces slice/drumKit fields
- All existing sampler-library unit tests still pass

---

## Phase 2: Chopper Output

Update the sample chopper to produce program directories instead of modifying sample.yaml.

### Tasks

- [ ] Update `sample-chopper` output to call `saveProgram()` instead of writing slices into sample.yaml
- [ ] Chopper produces a program directory with: program.yaml (slices, key mappings, type label) + full WAV copy
- [ ] Update Akai S3K editor chopper save flow to use new program output
- [ ] Update Roland SXX0 editor chopper save flow to use new program output
- [ ] Ensure chopper assigns a default type label based on context (choppedSample for generic chops, drumKit when pad-mapped)
- [ ] Unit tests: chopper output is a valid program directory
- [ ] Unit tests: source sample.yaml is unmodified after chopping
- [ ] Unit tests: chopping the same sample twice produces two distinct program directories

### Acceptance Criteria

- Chopping a sample produces a new program directory, not a modified sample.yaml
- Source sample is unchanged after chopping
- Two chops of the same sample create two independent programs
- Both Akai and Roland editor chopper flows produce programs
- All chopper unit tests pass

---

## Phase 3: Library Integration

Make programs visible and actionable in the library browser.

### Tasks

- [ ] Create program item type plugin in editor-core following the item type plugin pattern from library-ux
- [ ] Update library scanner to discover program directories and register them as program items
- [ ] Implement program preview panel (shows slice visualization, key mapping summary, type label, WAV waveform)
- [ ] Implement "Send to Device" for program items -- creates device program + keygroups + sends sample data
- [ ] Register program item type in akai-s3k-editor
- [ ] Register program item type in roland-sxx0-editor
- [ ] Add program icon and visual distinction in library tree
- [ ] Unit tests: library scanner finds program directories
- [ ] Unit tests: program preview panel renders with correct data
- [ ] Integration test: "Send to Device" on a program creates expected device objects

### Acceptance Criteria

- Programs appear in the library browser as a distinct item type
- Programs have a visually distinct icon
- Program preview shows slice visualization and key mapping summary
- "Send to Device" on a program is unambiguous -- creates program + keygroups + sends sample
- Both editors register and display the program item type
- Library scanner correctly discovers program directories

---

## Phase 4: Editor Integration

Connect the chopper and drum kit editors to program objects.

### Tasks

- [ ] Update chopper UI to support opening an existing program for re-editing
- [ ] Update drum kit editor to work with program objects instead of sample.yaml drumKit data
- [ ] Implement "Chop Again" flow: open source sample in chopper, produce a new program
- [ ] Verify multiple programs per source sample display correctly in library
- [ ] Verify program editing round trip: open program in editor, modify slices, save, reload
- [ ] Integration tests: create program via chopper, open in drum kit editor, modify, save, verify
- [ ] Integration tests: create two programs from same source, verify independence
- [ ] Update any remaining UI text that says "chopped sample" to use "program" where appropriate

### Acceptance Criteria

- Existing programs can be opened and re-edited in the chopper
- Drum kit editor operates on program objects
- "Chop Again" creates a new program from the source sample
- Multiple programs from the same source sample are independent and display correctly
- Program edit round trip works: open, modify, save, reload produces correct data
- No UI references to the old slice-in-sample model remain
