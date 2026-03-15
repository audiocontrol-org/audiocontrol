# Roland S-550 Editor Support - Implementation Summary

**Status:** In Progress (Hardware Validation Underway, Wave Transfer Remaining)
**Completed:** Phases 1-5, Phase 6 partial (patch/tone read-write validated)
**Author:** audiocontrol-org

---

## Overview

Added S-550 support to the audiocontrol ecosystem through three key changes: extracting shared S-series protocol code into a common base module, implementing S-550 device-specific modules, and unifying the editor application to serve both S-330 and S-550 via a device configuration registry.

## What Was Built

### Shared S-Series Base (`sampler-devices/src/devices/roland-s-series/`)

Extracted from the S-330 implementation. Contains all protocol code shared between S-330 and S-550:

- **Config interface** — `SSeriesDeviceConfig` parameterizes device-specific memory layout
- **Types** — Envelope, key mode, LFO, TVF/TVA parameter types, MIDI adapter interface
- **Constants** — SysEx commands (RQD/WSD/DAT/ACK/EOD/DT1), timing, error codes
- **Messages** — Nibblization, size encoding, SysEx message builders
- **Params** — Enum parsing, name encoding, address parsing, envelope encoding
- **Wave format** — WAV ↔ S-series 12-bit conversion, resampling, segment calculation
- **Client factory** — `createSSeriesClient()` with bulk dump, parameter I/O, wave transfer

### S-550 Device Module (`sampler-devices/src/devices/s550/`)

- `s550-config.ts` — 32 patches, 64 tones, 4 wave banks (A-D)
- `s550-addresses.ts` — Address constants, builders with S-550 value ranges
- `s550-types.ts` — `S550Tone`, `S550Patch`, `S550SystemParams`, `S550DeviceState`
- `s550-params.ts` — Parameter parsing/encoding with S-550 range validation
- `s550-client.ts` — Client using shared factory with S-550 config
- `s550-tone-factory.ts` — Tone creation with S-550 defaults

### S-550 Library Converters (`sampler-library/src/converters/s550/`)

- Tone converter: `S550Tone` ↔ `ToneYaml`
- Patch converter: `S550Patch` ↔ `PatchYaml`
- Set converter: Full device state ↔ library set format
- Schema support for S-550 patch and tone YAML validation

### Unified Sampler Editor (`sampler-editor/`, replacing `s330-editor/`)

- `DeviceConfig` interface and registry (`configs/types.ts`, `configs/registry.ts`)
- S-330 and S-550 configurations (`configs/s330.ts`, `configs/s550.ts`)
- `DeviceConfigContext` React context for component access
- URL-based device resolution in `main.tsx`
- All pages and components adapted to use device config instead of hardcoded constants

## Protocol Findings

| Aspect | S-330 | S-550 | Impact |
|--------|-------|-------|--------|
| Model ID | 0x1E | 0x1E | Shared — same protocol family |
| Patch count | 64 | 32 | Config constant |
| Tone count | 32 | 64 | Config constant |
| Wave banks | 2 (A, B) | 4 (A, B, C, D) | Config constant + range validation |
| Patch block | 512 bytes | 512 bytes | Identical structure |
| Tone block | 256 bytes | 256 bytes | Identical structure |
| Patch stride | 4 | 4 | Identical addressing |
| Tone stride | 2 | 2 | Identical addressing |
| Tone layer range | 0-31 | 0-63 | Wider range in S-550 |
| Wave bank range | 0-1 | 0-3 | Wider range in S-550 |
| SysEx commands | RQD/WSD/DAT/ACK/EOD/DT1 | Same | Fully shared |
| Wave encoding | 12-bit nibblized | Same | Fully shared |

**Summary:** The devices are protocol-identical. All differences are in memory layout constants and value ranges, not in command structure or data encoding.

### Hardware Validation Findings (Phase 6)

Hardware testing against a physical S-550 revealed three bugs in the shared S-series client:

| Bug | Impact | Fix |
|-----|--------|-----|
| EOD/RJC command bytes swapped in `s-series-constants.ts` | All RQD reads failed — device EOD (0x45) was interpreted as rejection | Corrected to EOD=0x45, RJC=0x4F per Roland spec |
| DAT packets include 4-byte address header not being stripped | Parsed data was offset by 4 bytes per packet, corrupting all parameter values | Strip 4-byte address prefix from each received DAT packet |
| Outgoing DAT packets missing address headers | Writes were rejected by device (checksum mismatch) | Include 4-byte address + correct checksum in each sent DAT packet; use 128-nibble chunks |

After fixes, all 17 hardware integration tests pass:
- Patch read/write round-trip verified (32 patches)
- Tone read/write round-trip verified (64 tones, including indices 32-63 beyond S-330 range)
- Tone parameter modification confirmed (fineTune write + readback)
- Error handling validated (wrong device ID correctly times out)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Shared base module over device-specific duplication | >90% code overlap; shared fixes benefit both devices |
| Unified editor over separate apps | Single codebase eliminates UI/store/routing duplication; device config registry enables runtime selection |
| `SSeriesDeviceConfig` interface | Captures all device-specific constants in a validated configuration object |
| `clampWaveParams` utility added to shared module | Prevents loop point exceeding end point during library import; benefits both devices |
| Patch stride = 4, Tone stride = 2 (address byte 2) | Confirmed identical addressing scheme for both devices |

## Deviations from Original Plan

| Original Plan | Actual Implementation | Reason |
|--------------|----------------------|--------|
| Separate `s550-editor` module | Unified `sampler-editor` | >90% code overlap made separate editor wasteful |
| Option A vs B for code sharing (deferred to Phase 1) | Option A: shared base with device configs | Protocol analysis confirmed near-identical devices |
| 5 phases with Phase 5 optional extraction | Extraction done in Phase 1 as prerequisite | Made more sense to extract first, then build S-550 on shared base |

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| `sampler-devices/s550` (addresses) | 348 assertions | Passing |
| `sampler-devices/s550` (params) | 438 assertions | Passing |
| Total project (sampler-devices) | 412 tests | Passing (4 unrelated Akai failures) |

## Remaining Work

### Hardware Validation (Phase 6) — In Progress

- [x] Connect to physical S-550 via MIDI
- [x] Validate all 32 patches load and parse correctly
- [x] Validate all 64 tones load and parse correctly
- [x] Confirm patch round-trip (read → modify → write → read)
- [x] Confirm tone round-trip (read → modify → write → read)
- [ ] Test wave data transfer to all 4 banks (A-D)
- [ ] Test library import/export end-to-end

### S-550 Virtual Front Panel (Phase 7)

- Research rack-mount panel button layout
- Implement S-550 variant in `VirtualFrontPanel` component

## Lessons Learned

1. **Protocol research before coding pays off** — Confirming model ID 0x1E was shared eliminated uncertainty early and justified the shared base approach
2. **Config-driven architecture scales** — Adding S-550 to the editor required only a new config file and registration, not new components
3. **Inverted memory layout is the key difference** — More tones + fewer patches + more wave banks is the entire delta between the devices at the protocol level
4. **Extract shared code when adding the second device, not the third** — The "rule of three" would have meant duplicating 3000+ lines of protocol code
5. **Hardware testing is essential** — Unit tests and documentation review missed three protocol bugs (swapped constants, DAT packet address headers) that were immediately caught by the first hardware test run
6. **Incremental hardware probing pays off** — A minimal ping test, then an address probe, then a DAT format analysis, each built understanding before writing the full integration test suite
