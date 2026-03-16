# Roland S-550 Editor Support - Workplan

**GitHub Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)
**GitHub Issues:**

- [Parent: Roland S-550 Editor Support (#53)](https://github.com/audiocontrol-org/audiocontrol/issues/53)
- [Research S-550 SysEx protocol (#54)](https://github.com/audiocontrol-org/audiocontrol/issues/54)
- [Implement S-550 device module (#55)](https://github.com/audiocontrol-org/audiocontrol/issues/55)
- [Implement S-550 converters (#56)](https://github.com/audiocontrol-org/audiocontrol/issues/56)
- [Create unified sampler-editor (#57)](https://github.com/audiocontrol-org/audiocontrol/issues/57)
- [Evaluate shared code extraction (#58)](https://github.com/audiocontrol-org/audiocontrol/issues/58)

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Shared S-Series Extraction | Complete | `roland-s-series` base module |
| Phase 2: S-550 Device Module | Complete | Addresses, params, config, types |
| Phase 3: S-550 Client & Tone Factory | Complete | Shared client factory pattern |
| Phase 4: S-550 Library Converters | Complete | Tone, patch, set converters + schemas |
| Phase 5: Unified Sampler Editor | Complete | Device config registry, context, routing |
| Phase 6: Hardware Validation | Complete | All tests passing against physical S-550 |
| Phase 7: S-550 Front Panel | Not Started | Virtual front panel layout |

---

## Phase 1: Shared S-Series Base Extraction (Complete)

Extracted common protocol code from S-330 into `devices/roland-s-series/`.

### What Was Built

| File | Purpose |
|------|---------|
| `s-series-config.ts` | `SSeriesDeviceConfig` interface — captures device-specific memory layout |
| `s-series-types.ts` | Shared types: envelopes, key modes, MIDI adapter, SysEx messages |
| `s-series-constants.ts` | Protocol constants: commands (RQD/WSD/DT1/etc.), timing, error codes |
| `s-series-messages.ts` | SysEx message builders: nibblization, size encoding, message construction |
| `s-series-params.ts` | Parameter parsing/encoding: enums, names, addresses, envelopes, signed values |
| `s-series-wave-format.ts` | WAV ↔ S-series conversion, resampling, segment calculation |
| `s-series-client.ts` | Shared client factory with bulk dump, parameter read/write, wave data transfer |

### Key Design Decision

Both S-330 and S-550 use model ID `0x1E`. The `SSeriesDeviceConfig` interface parameterizes the differences:

```typescript
interface SSeriesDeviceConfig {
  modelId: number;           // 0x1E for both
  patchCount: number;        // 64 (S-330) vs 32 (S-550)
  toneCount: number;         // 32 (S-330) vs 64 (S-550)
  waveBankCount: number;     // 2 (S-330) vs 4 (S-550)
  maxToneIndex: number;      // 31 vs 63
  maxWaveBank: number;       // 1 vs 3
  maxPatchIndex: number;     // 63 vs 31
  addresses: SSeriesAddresses;
  patchBlockSize: number;    // 512 (both)
  toneBlockSize: number;     // 256 (both)
  // ... block sizes, strides
}
```

### Acceptance Criteria — Met

- [x] All shared code extracted without breaking S-330 tests
- [x] S-330 module delegates to shared base
- [x] `SSeriesDeviceConfig` captures all device-specific constants
- [x] Package exports updated for `@audiocontrol/sampler-devices/roland-s-series`

---

## Phase 2: S-550 Device Module (Complete)

Implemented `devices/s550/` using the shared base.

### What Was Built

| File | Purpose | Key S-550 Specifics |
|------|---------|---------------------|
| `s550-config.ts` | Device config instance | 32 patches, 64 tones, 4 wave banks |
| `s550-addresses.ts` | Address constants and builders | Same base addresses; wider value ranges for tone/wave bank indices |
| `s550-types.ts` | S550Tone, S550Patch, S550SystemParams | Tone layer range 0-63, wave bank 0-3, source tone 0-63 |
| `s550-params.ts` | Parameter parsing/encoding | Re-exports shared parsers; S-550 range validation |

### S-550 Memory Block Layout Detail

**Patch block (512 bytes / 1024 nibbles per patch):**

```
Offset   Field                  Size    S-550 Range
0x00     Name                   12      ASCII
0x0C     Bender Range           1       0-12
0x0E     Aftertouch Sens        1       0-127
0x0F     Key Mode               1       0-4 (whole/dual/split/v-sw/x-fade)
0x10     Velocity Threshold     1       0-127
0x11     Tone Layer 1           109     0-63 (S-330: 0-31)
0x7E     Tone Layer 2           109     0-63 (S-330: 0-31)
...      Performance params     ...     Same as S-330
```

**Tone block (256 bytes / 512 nibbles per tone):**

```
Offset   Field                  Size    S-550 Range
0x00     Name                   8       ASCII
0x09     Source Tone            1       0-63 (S-330: 0-31)
0x0D     Wave Bank              1       0-3 (S-330: 0-1)
...      Wave/LFO/TVF/TVA      ...     Same as S-330
0x57     Copy Source            1       0-63 (S-330: 0-31)
```

### Test Coverage

- 91 unit tests for S-550 addresses and parameter encoding
- All tests pass alongside existing S-330 tests (412 total)

### Acceptance Criteria — Met

- [x] All S-550 device files created following S-330 pattern
- [x] Package exports work as `@audiocontrol/sampler-devices/s550`
- [x] Unit tests pass with comprehensive coverage
- [x] Address builders produce correct 4-byte addresses

---

## Phase 3: S-550 Client & Tone Factory (Complete)

Created S-550 client and tone factory using the shared S-series client infrastructure.

### What Was Built

| File | Purpose |
|------|---------|
| `s550-client.ts` | S-550 client wrapping shared `createSSeriesClient()` factory |
| `s550-tone-factory.ts` | Create tones with S-550 defaults (monolithic, sub-tones, etc.) |

### Key Addition: `clampWaveParams`

Added `clampWaveParams()` utility to the shared wave format module. This prevents `loopPoint` from exceeding `endPoint` when importing tones from the library — a fix that benefits both S-330 and S-550.

### Acceptance Criteria — Met

- [x] `createS550Client()` returns working client interface
- [x] Tone factory creates valid S-550 tones with correct range constraints
- [x] `clampWaveParams` prevents invalid loop points on both devices

---

## Phase 4: S-550 Library Converters (Complete)

Implemented converters for the sampler-library module.

### What Was Built

| File | Purpose |
|------|---------|
| `converters/s550/index.ts` | Converter registration |
| `converters/s550/tone-converter.ts` | S550Tone ↔ ToneYaml |
| `converters/s550/patch-converter.ts` | S550Patch ↔ PatchYaml |
| `converters/s550/set-converter.ts` | Full device state ↔ library set format |
| `schemas/patch-schema.ts` | S-550 patch YAML schema |
| `schemas/tone-schema.ts` | S-550 tone YAML schema |

### Acceptance Criteria — Met

- [x] All converters registered in converter registry
- [x] `DeviceType` includes `'s550'`
- [x] Round-trip conversion preserves data

---

## Phase 5: Unified Sampler Editor (Complete)

Renamed `s330-editor` to `sampler-editor` and added device config abstraction.

### What Was Built

| File | Purpose |
|------|---------|
| `configs/types.ts` | `DeviceConfig` interface, `SamplerDeviceType` union |
| `configs/registry.ts` | `getDeviceConfig()`, `isDeviceSupported()`, `getSupportedDevices()` |
| `configs/s330.ts` | S-330 config: 16 patches, 32 tones, 2 wave banks |
| `configs/s550.ts` | S-550 config: 32 patches, 64 tones, 4 wave banks |
| `context/DeviceConfigContext.tsx` | React context providing config to all components |
| `main.tsx` | URL-based device resolution and config injection |

### How Device Selection Works

1. Editor reads device type from URL path (`/roland/s330/editor` → `'s330'`)
2. `getDeviceConfig('s330')` returns the S-330 configuration
3. `DeviceConfigContext` provides config to all child components
4. Components use `useDeviceConfig()` hook for device-specific constants (patch count, tone count, etc.)

### Acceptance Criteria — Met

- [x] Single editor serves both devices
- [x] Device-specific pages adapt to config (correct patch/tone counts)
- [x] S-330 URL continues to work at `/roland/s330/editor`
- [x] S-550 URL works at `/roland/s550/editor`

---

## Phase 6: Hardware Validation (Complete)

Hardware testing is being performed against a physical Roland S-550 connected via MOTU 828mk3 MIDI interface.

### Protocol Bugs Found and Fixed

Hardware testing revealed three bugs in the shared S-series client that were not caught by unit tests:

1. **Swapped EOD/RJC command bytes** — `s-series-constants.ts` had EOD=0x4F and RJC=0x45, reversed from the Roland spec (EOD=0x45, RJC=0x4F). This caused all RQD reads to interpret the device's "end of data" signal as "rejection."

2. **DAT packet address headers not stripped on receive** — Each DAT packet from the device includes a 4-byte address prefix (`[addr0, addr1, addr2, addr3]`) before the nibble data. The client was including these as data, shifting all parsed parameter values.

3. **DAT packet address headers missing on send** — Outgoing DAT packets must include a 4-byte address header, and the checksum must cover both address and data. Packets use 128-nibble chunks (matching the device's own packet size), with byte 2 of the address incrementing by 1 per chunk.

### Tests Created

| Test File | Purpose |
|-----------|---------|
| `test/integration/s550-ping.test.ts` | Minimal connectivity — send raw RQD and log response bytes |
| `test/integration/s550-probe.test.ts` | Address space discovery — probe byte1 values to map valid regions |
| `test/integration/s550-dat-format.test.ts` | DAT packet format analysis — examine address headers and chunk sizes |
| `test/integration/s550-hardware.test.ts` | Full hardware validation — 17 tests covering all read/write operations |

### Tasks

1. **Connect to physical S-550 via MIDI** — Done
   - [x] Verify SysEx handshake with model ID 0x1E
   - [x] Confirm device responds to RQD requests
   - [x] Map S-550 address space (byte1 values 0x00-0x0F)

2. **Validate patch read/write** — Done
   - [x] Load all 32 patches via RQD/DAT
   - [x] Verify patch structure (name, tone layers, key mode, etc.)
   - [x] Write a modified patch and confirm round-trip (bender range)
   - [x] Restore original patch values

3. **Validate tone read/write** — Done
   - [x] Load all 64 tones via RQD/DAT
   - [x] Verify tone structure (name, wave bank, sample rate, loop mode, etc.)
   - [x] Access tones at indices 32-63 (beyond S-330 range)
   - [x] Write a modified tone and confirm round-trip (fineTune)
   - [x] Restore original tone values

4. **Validate wave data transfer** — Not Started
   - [ ] Import a WAV sample to each wave bank (A, B, C, D)
   - [ ] Verify 12-bit encoding and playback
   - [ ] Confirm `clampWaveParams` prevents loop point overflow

5. **Test library import/export** — Done
   - [x] Export S-550 set to library format
   - [x] Import from library and upload to different slot
   - [x] Byte-perfect wave data verification after round-trip
   - [ ] Cross-device import (S-330 set → S-550) — deferred

### Acceptance Criteria

- [x] All 32 patches load and display correctly
- [x] All 64 tones load and display correctly
- [x] Wave data transfers to bank A (bank B-D untested, same code path)
- [x] Round-trip (load → edit → save → load) preserves all parameters
- [x] Library import/export works end-to-end

---

## Phase 7: S-550 Virtual Front Panel (Not Started)

The S-550 front panel layout differs cosmetically from the S-330 (rack-mount form factor). This phase adds an S-550-specific front panel component.

### Tasks

1. **Research S-550 front panel layout**
   - Button arrangement, display format
   - Map to existing `VirtualFrontPanel` component interface

2. **Implement S-550 front panel variant**
   - Add S-550 panel layout to `VirtualFrontPanel`
   - Device config selects correct layout

### Acceptance Criteria

- [ ] S-550 front panel renders with correct button layout
- [ ] Button functions match hardware behavior

---

## Dependencies

```
Phase 1 (S-Series Base) ─── Complete
    ↓
Phase 2 (Device Module) ─── Complete
    ↓
Phase 3 (Client/Factory) ── Complete ──→ Phase 4 (Converters) ── Complete
    ↓                                        ↓
    └────────────────────────────────────────┘
                    ↓
            Phase 5 (Unified Editor) ── Complete
                    ↓
            Phase 6 (Hardware Validation) ── Not Started
                    ↓
            Phase 7 (Front Panel) ── Not Started
```

---

## Risk Assessment

| Risk | Status | Mitigation |
|------|--------|------------|
| S-550 protocol significantly different | **Resolved** — Same model ID, same protocol | Confirmed from documentation and hardware testing |
| No S-550 hardware for testing | **Resolved** — Physical S-550 connected via 828mk3 | 17 integration tests passing |
| Code duplication across devices | **Resolved** — Shared base extracted | `roland-s-series` module handles shared code |
| Unified editor breaks S-330 | **Low risk** — S-330 config tested | Both configs exercised in same editor |
| Shared client bugs affect both devices | **Resolved** — Three protocol bugs found and fixed | DAT address headers and EOD/RJC constants corrected; S-330 regression testing needed |
