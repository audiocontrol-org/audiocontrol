# Roland S-550 Editor Support - Workplan

**GitHub Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)
**GitHub Issues:**

- [Parent: Roland S-550 Editor Support (#53)](https://github.com/audiocontrol-org/audiocontrol/issues/53)
- [Research S-550 SysEx protocol (#54)](https://github.com/audiocontrol-org/audiocontrol/issues/54)
- [Implement S-550 device module (#55)](https://github.com/audiocontrol-org/audiocontrol/issues/55)
- [Implement S-550 converters (#56)](https://github.com/audiocontrol-org/audiocontrol/issues/56)
- [Create s550-editor module (#57)](https://github.com/audiocontrol-org/audiocontrol/issues/57)
- [Evaluate shared code extraction (#58)](https://github.com/audiocontrol-org/audiocontrol/issues/58)

---

## Phase 1: Research & Protocol Verification

### Tasks

1. **Obtain S-550 documentation**
   - Locate S-550 Owner's Manual with MIDI Implementation
   - Document SysEx model ID, memory addresses, parameter layout
   - Compare against S-330 implementation

2. **Create protocol comparison document**
   - Side-by-side comparison of S-330 vs S-550 SysEx
   - Identify identical, similar, and different elements
   - Document memory layout differences

3. **Verify with hardware** (if available)
   - Confirm SysEx communication works
   - Test parameter reads/writes
   - Validate assumptions from documentation

### Acceptance Criteria

- [ ] S-550 model ID confirmed
- [ ] Memory address differences documented
- [ ] Parameter differences documented
- [ ] Protocol comparison document complete

### Deliverables

- `modules/sampler-devices/docs/1.0/s550-protocol.md`
- `modules/sampler-devices/docs/1.0/s330-s550-comparison.md`

---

## Phase 2: Device Module (sampler-devices/s550)

### Tasks

1. **Create S-550 device directory structure**
   ```
   modules/sampler-devices/src/devices/s550/
   ├── index.ts
   ├── s550-addresses.ts
   ├── s550-types.ts
   ├── s550-params.ts
   ├── s550-client.ts
   ├── s550-messages.ts
   └── s550-wave-format.ts (if different from S-330)
   ```

2. **Implement S-550 addresses**
   - Model ID constant
   - Memory addresses (patches, tones, waves)
   - Address calculation functions

3. **Implement S-550 types**
   - `S550Tone` interface
   - `S550Patch` interface
   - Device-specific enums (key modes, outputs, etc.)

4. **Implement S-550 parameters**
   - Parameter encoding/decoding
   - Nibblization helpers
   - Default value factories

5. **Implement S-550 client**
   - SysEx communication (RQD/WSD/DAT/ACK/EOD)
   - Bulk dump operations
   - Parameter read/write

6. **Add package exports**
   - Update `sampler-devices/package.json` exports
   - Export as `@audiocontrol/sampler-devices/s550`

7. **Write unit tests**
   - Parameter encoding tests
   - Address calculation tests
   - Type factory tests

### Acceptance Criteria

- [ ] All device files created
- [ ] S550Client can communicate with hardware
- [ ] Package exports work correctly
- [ ] Unit tests pass with 80%+ coverage

### Code Reuse Strategy

If S-330 and S-550 are nearly identical:

**Option A: Shared base with device-specific constants**
```typescript
// shared/roland-s-series-base.ts
export function createSSeriesClient(config: { modelId: number; ... }) { ... }

// s550/s550-client.ts
import { createSSeriesClient } from '../shared/roland-s-series-base';
export const s550Client = createSSeriesClient({ modelId: S550_MODEL_ID, ... });
```

**Option B: Device-specific implementations (current pattern)**
- Copy S-330 implementation
- Modify device-specific constants
- Keep implementations separate for clarity

Decision depends on Phase 1 findings. If >90% identical, use Option A. If significant differences, use Option B.

---

## Phase 3: Library Converters (sampler-library/converters/s550)

### Tasks

1. **Create S-550 converter directory**
   ```
   modules/sampler-library/src/converters/s550/
   ├── index.ts
   ├── tone-converter.ts
   ├── patch-converter.ts
   └── set-converter.ts
   ```

2. **Implement tone converter**
   - `S550Tone` ↔ `ToneYaml` conversion
   - Implement `ToneConverter<S550Tone>` interface
   - Handle any S-550-specific tone fields

3. **Implement patch converter**
   - `S550Patch` ↔ `PatchYaml` conversion
   - Implement `PatchConverter<S550Patch>` interface
   - Handle any S-550-specific patch fields

4. **Implement set converter**
   - Full device state ↔ library format
   - Sample references
   - Metadata handling

5. **Register converters**
   - Add to converter registry
   - Update `DeviceType` union to include `'s550'`

6. **Write unit tests**
   - Round-trip conversion tests
   - Edge case handling
   - Compatibility with library storage

### Acceptance Criteria

- [ ] All converters implemented
- [ ] Converters registered in registry
- [ ] `DeviceType` includes `'s550'`
- [ ] Unit tests pass with 80%+ coverage

---

## Phase 4: Editor Application (s550-editor)

### Tasks

1. **Create s550-editor module**
   ```
   modules/s550-editor/
   ├── package.json
   ├── tsconfig.json
   ├── vite.config.ts
   ├── index.html
   └── src/
       ├── App.tsx
       ├── main.tsx
       ├── pages/
       ├── components/
       ├── stores/
       ├── core/
       └── types/
   ```

2. **Configure build and dependencies**
   - Extend `editor-core`
   - Depend on `@audiocontrol/sampler-devices/s550`
   - Depend on `@audiocontrol/sampler-library`
   - Configure Vite for `@/` imports

3. **Implement stores**
   - `midiStore.ts` - Using `createMidiStore` from editor-core
   - `s550Store.ts` - Device-specific UI state
   - `deviceDataStore.ts` - Patch/tone caching
   - `libraryStore.ts` - Library operations

4. **Implement pages**
   - `HomePage.tsx` - Device connection, overview
   - `PatchesPage.tsx` - Patch list and editor
   - `TonesPage.tsx` - Tone list and editor
   - `LibraryPage.tsx` - Library browser
   - `PlayPage.tsx` - Performance view (if applicable)

5. **Implement components**
   - Patch editor (bound to S550Patch)
   - Tone editor (bound to S550Tone)
   - Parameter controls (reuse from editor-core)
   - Virtual front panel (S-550-specific layout)

6. **Implement MIDI client integration**
   - `S550Client.ts` wrapper for editor use
   - Connection management
   - Parameter sync

7. **Write integration tests**
   - Store behavior tests
   - Component rendering tests
   - MIDI mock tests

### Acceptance Criteria

- [ ] Editor builds and runs
- [ ] MIDI connection works
- [ ] Patch editing functional
- [ ] Tone editing functional
- [ ] Library integration works
- [ ] URL: `audiocontrol.org/roland/s550/editor`

---

## Phase 5: Shared Code Extraction (Optional/Future)

Based on implementation experience, evaluate opportunities to extract shared code.

### Candidates for Extraction

| Component | Currently | Potential Shared Location |
|-----------|-----------|--------------------------|
| Roland SysEx base | s330-client.ts | sampler-devices/shared/roland-sysex.ts |
| Envelope editor | s330-editor | editor-core or shared-sampler-ui |
| Tone zone editor | s330-editor | shared-sampler-ui |
| Library browser | s330-editor | editor-core |

### Decision Criteria

Extract if:
- Same code exists in 3+ editors
- Code is stable (not actively changing)
- Clear interface boundary exists

Do not extract if:
- Only 2 implementations exist (wait for third)
- Device-specific behavior is intertwined
- Extraction would complicate the code

---

## Dependencies

```
Phase 1 (Research)
    ↓
Phase 2 (Device Module) ──→ Phase 3 (Converters)
    ↓                           ↓
    └───────────────────────────┘
                ↓
        Phase 4 (Editor)
                ↓
        Phase 5 (Extraction - optional)
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| S-550 protocol significantly different | Low | High | Phase 1 research before coding |
| No S-550 hardware for testing | Medium | Medium | Use emulator or community tester |
| Code duplication grows tech debt | Medium | Low | Track duplication, extract in Phase 5 |
| editor-core changes break both editors | Low | Medium | Pin versions, test both editors |

---

## Future Considerations

### Non-Roland Sampler Support

This implementation establishes patterns for:
- Device module structure (`sampler-devices/<device>/`)
- Converter registration (`sampler-library/converters/<device>/`)
- Editor module structure (`<device>-editor/`)

Future devices (Akai, E-mu, etc.) will follow the same patterns but may require:
- New base abstractions if protocol families differ significantly
- Different UI patterns for different device paradigms
- Extended type system for device families

### S-550 HD Support

The S-550 HD (hard disk version) has additional features:
- Larger sample storage
- SCSI-based sample transfer
- Additional system parameters

This could be a separate device (`s550hd`) or a variant configuration of S-550 support. Decision deferred until S-550 editor is complete.
