# Common-Area Chopping - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Common-Area Output Converter | Not Started | `slicesToCommonArea()` function |
| Phase 2: Common-Area Input Loading | Not Started | Load SampleYaml + WAV into chopper |
| Phase 3: Program Bundle Creation | Not Started | Zone mapping → ProgramYaml |
| Phase 4: UI Integration | Not Started | Save target and input source in chopper UI |
| Phase 5: Editor Integration | Not Started | Common-area browse → chop → save workflow |

---

## Phase 1: Common-Area Output Converter

### Goal

Convert `ChopperResult` slices into common-area `SampleYaml` objects with WAV file bytes.

### Tasks

1. **Implement `slicesToCommonArea()` in `sample-chopper/src/`**
   ```typescript
   interface CommonAreaConfig {
     namePrefix: string;        // e.g., "drum-kit" → "drum-kit-01", "drum-kit-02"
     sampleRate: number;
     rootKey?: number;          // Default root key for slices (C4 = 60)
     tags?: string[];           // Tags applied to all slices
   }

   function slicesToCommonArea(
     result: ChopperResult,
     config: CommonAreaConfig
   ): CommonAreaChopResult
   ```

2. **Generate `SampleYaml` metadata per slice**
   - Name: `${namePrefix}-${padded index}` (e.g., "kick-01")
   - File: `${name}.wav`
   - Sample rate from chopper result
   - Loop mode: `'oneShot'` (default for chopped slices)
   - Tags from config

3. **Generate WAV bytes per slice**
   - Encode each `Slice.samples` (Int16Array) as 16-bit mono WAV
   - Reuse existing WAV encoder or write minimal encoder

4. **Write tests**
   - Round-trip: chop → convert → verify SampleYaml metadata
   - WAV encoding: verify headers and sample data
   - Naming: verify sequential naming with zero-padding

### Acceptance Criteria

- [ ] `slicesToCommonArea()` produces valid `SampleYaml` + WAV for each slice
- [ ] WAV files are valid 16-bit mono with correct sample rate
- [ ] Naming follows convention with zero-padded indices
- [ ] No device dependencies in converter code

---

## Phase 2: Common-Area Input Loading

### Goal

Load a common-area `SampleYaml` and its WAV file into the chopper as input.

### Tasks

1. **Implement common-area loader**
   - Read `SampleYaml` from common area
   - Load associated WAV file as `Int16Array`
   - Return data in format expected by chopper (`{ samples, sampleRate, name }`)

2. **Handle format variations**
   - 16-bit and 24-bit WAV input
   - Mono and stereo (convert stereo to mono by averaging channels)
   - Different sample rates (pass through — chopper handles any rate)

3. **Write tests**
   - Load sample from mock common-area storage
   - Verify samples and metadata extracted correctly

### Acceptance Criteria

- [ ] Common-area samples load into chopper without format errors
- [ ] Stereo-to-mono conversion works
- [ ] Sample metadata (name, tags) preserved through load

---

## Phase 3: Program Bundle Creation

### Goal

Optionally bundle chopped slices into a `ProgramYaml` with zone mappings.

### Tasks

1. **Implement `createProgram()` function**
   ```typescript
   interface ProgramConfig {
     name: string;
     baseKey?: number;          // Starting MIDI note (default: 36 = C2)
     keySpread?: 'chromatic' | 'octave';  // How to spread across keys
     velocityRange?: [number, number];     // Default: [1, 127]
   }

   function createProgram(
     samples: SampleYaml[],
     config: ProgramConfig
   ): ProgramYaml
   ```

2. **Zone mapping strategies**
   - `chromatic`: each slice gets one key, starting at `baseKey`
   - `octave`: each slice gets 12 keys (one octave), starting at `baseKey`
   - Each zone references its slice's sample name

3. **Write tests**
   - Chromatic mapping: 8 slices → 8 zones at C2-G2
   - Octave mapping: 4 slices → 4 zones spanning C2-B5
   - Verify ProgramYaml validates against schema

### Acceptance Criteria

- [ ] `createProgram()` produces valid `ProgramYaml`
- [ ] Zone mappings cover the correct key ranges
- [ ] Program references slice sample names correctly

---

## Phase 4: UI Integration

### Goal

Add common-area input/output options to the chopper UI.

### Tasks

1. **Add "Load from Library" option to chopper input**
   - Browse common-area samples via existing library tree
   - Select sample → load into chopper

2. **Add "Save to Common Area" option to chopper output**
   - Name prefix input
   - Optional: "Create Program Bundle" checkbox
   - Key mapping configuration (base key, spread mode)
   - Save individual `SampleYaml` files + optional `ProgramYaml`

3. **Update dev harness**
   - Dev harness includes common-area browse/save flow
   - Uses `FileIO` for WAV read/write

### Acceptance Criteria

- [ ] Chopper can load from file picker OR common-area browser
- [ ] Chopper can save to device tones OR common area
- [ ] Program bundle creation is optional
- [ ] Dev harness demonstrates full common-area workflow

---

## Phase 5: Editor Integration

### Goal

Wire common-area chopping into the sampler-editor.

### Tasks

1. **Add "Chop" action to common-area sample context**
   - Right-click or action button on common-area sample → opens chopper
   - Chopper pre-loaded with selected sample

2. **Save flow writes to common area**
   - Slices saved to common area via library storage
   - Program bundle saved if requested
   - Library tree refreshes to show new items

3. **Test end-to-end**
   - Select common-area sample → chop → save slices → verify in library

### Acceptance Criteria

- [ ] "Chop" action available on common-area samples in editor
- [ ] Chopped output appears in common-area library tree
- [ ] Existing device-bound chopping workflow unaffected

---

## Dependencies

```
Phase 1 (Output Converter) → Phase 2 (Input Loader) → Phase 3 (Program Bundle)
                                                            ↓
Phase 4 (UI Integration) ←─────────────────────────────────┘
    ↓
Phase 5 (Editor Integration)
```

Phases 1-3 are algorithm work; Phase 4-5 are UI/integration.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WAV encoding differences from existing encoder | Low | Medium | Reuse existing encoder if possible; test with sampler hardware |
| Program zone mapping doesn't fit all use cases | Medium | Low | Start with chromatic/octave; add template-based mapping later |
| Chopper UI too crowded with additional save options | Low | Low | Use tabs or dropdown for save target selection |
| Breaking existing device-bound chopping | Low | High | Existing flow untouched; new flow is additive |
