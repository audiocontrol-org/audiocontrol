# Roland S-330 vs S-550 Protocol Comparison

This document provides a detailed comparison of the S-330 and S-550 MIDI SysEx protocols to inform the implementation of S-550 support.

## Executive Summary

The S-330 and S-550 share the same SysEx protocol structure and model ID (0x1E), with differences primarily in memory capacity and parameter counts. The protocol is **>90% identical**, making code reuse highly feasible.

**Recommendation**: Use a shared base implementation with device-specific configuration.

## Protocol Identity

| Aspect | S-330 | S-550 | Identical? |
|--------|-------|-------|------------|
| Manufacturer ID | 0x41 (Roland) | 0x41 (Roland) | Yes |
| Model ID | 0x1E | 0x1E | **Yes** |
| Command bytes | RQD/WSD/DAT/ACK/EOD/ERR/RJC | Same | Yes |
| Checksum algorithm | Roland XOR | Same | Yes |
| Address format | 4-byte 7-bit | Same | Yes |
| Data encoding | Nibblized | Same | Yes |
| Wave encoding | 12-bit, 2-byte | Same | Yes |

## Memory Capacity

| Resource | S-330 | S-550 | S-550 Advantage |
|----------|-------|-------|-----------------|
| Patches | 64 | 32 | S-330 has more |
| Tones | 32 | 64 | 2× more tones |
| Wave Banks | 2 (A, B) | 4 (A, B, C, D) | 2× more banks |
| Total Segments | 36 | 72 | 2× more storage |
| Sample Memory | ~1.5MB | ~3MB | 2× capacity |

## Address Map Comparison

### High-Level Layout

| Content | S-330 Address | S-550 Address | Same? |
|---------|---------------|---------------|-------|
| Patches | 00 00 00 00H | 00 00 00 00H | Yes |
| Function Params | 00 01 00 00H | 00 01 00 00H | Yes |
| MIDI Params | - | 00 02 00 00H | S-550 only |
| Tones | 00 03 00 00H | 00 03 00 00H | Yes |
| SW Data | - | 00 04 00 00H | S-550 only |
| Wave Bank A | 01 00 00 00H | 01 00 00 00H | Yes |
| Wave Bank B | 01 20 00 00H | 01 20 00 00H | Yes |
| Wave Bank C | - | 01 40 00 00H | S-550 only |
| Wave Bank D | - | 01 60 00 00H | S-550 only |

### Stride and Counts

| Element | S-330 | S-550 |
|---------|-------|-------|
| Patch stride | 00 00 04 00H | 00 00 04 00H |
| Patch count | 64 | 32 |
| Tone stride | 00 00 02 00H | 00 00 02 00H |
| Tone count | 32 | 64 |
| Segment stride | 00 01 40 00H | 00 01 40 00H |

## Parameter Comparison

### Patch Parameters

| Parameter | S-330 | S-550 | Notes |
|-----------|-------|-------|-------|
| Name (12 chars) | Same | Same | |
| Bend Range | 0-12 | 0-12 | |
| Aftertouch Sense | 0-127 | 0-127 | |
| Key Mode | 0-4 | 0-4 | Normal/V-Sw/X-Fade/V-Mix/Unison |
| Velocity Threshold | 0-127 | 0-127 | |
| Tone to Key (Layer 1) | 0-31 (×109) | 0-63 (×109) | **Different range** |
| Tone to Key (Layer 2) | 0-31 (×109) | 0-63 (×109) | **Different range** |
| Octave Shift | -2 to +2 | -2 to +2 | |
| Output Level | 0-127 | 0-127 | |
| Detune | -64 to +63 | -64 to +63 | |
| Velocity Mix Ratio | 0-127 | 0-127 | |
| Aftertouch Assign | 0-4 | 0-4 | |
| Key Assign | 0-1 | 0-1 | Rotary/Fix |
| Output Assign | 0-7 | 0-8 | S-550 adds "TONE" option |

### Tone Parameters

| Parameter | S-330 | S-550 | Notes |
|-----------|-------|-------|-------|
| Name (8 chars) | Same | Same | |
| Output Assign | 0-7 | 0-7 | |
| Source Tone | 0-31 | 0-63 | **Different range** |
| Orig/Sub | 0-1 | 0-1 | |
| Sample Rate | 0-1 | 0-1 | 30kHz/15kHz |
| Orig Key Number | 11-120 | 11-120 | |
| Wave Bank | 0-1 | 0-3 | **Different range** |
| Segment Top | 0-17 | 0-17 | |
| Segment Length | 0-18 | 0-18 | |
| Start/End/Loop Points | 24-bit | 24-bit | Same range |
| Loop Mode | 0-3 | 0-3 | |
| Transpose | 0-127 | 0-127 | |
| Fine Tune | -64 to +63 | -64 to +63 | |
| Pitch Follow | 0-1 | 0-1 | |
| TVF parameters | All same | All same | |
| TVA parameters | All same | All same | |
| LFO parameters | All same | All same | |
| Envelope (8-point) | All same | All same | |

### S-550 Additional Parameters

| Parameter | S-330 | S-550 | Notes |
|-----------|-------|-------|-------|
| External Controller | - | 0-2 | OFF/MOUSE/RC-100 |
| Disk Labels | - | 60 chars | Block 1 & 2 |
| MIDI Params section | Embedded | Separate | Full section |
| SW (UI state) | - | Separate | |
| REC parameters | - | Full set | Recording setup |
| Zoom parameters | - | Multiple | Display settings |

## Code Reuse Analysis

### Fully Reusable (No Changes)

1. **Message builders** (`buildRQDMessage`, `buildDATMessage`, etc.)
2. **Checksum calculation** (`calculateChecksum`)
3. **Nibblization** (`nibblize`, `denibblize`)
4. **Wave encoding** (`wavToS330`, `s330ToWav` → rename generically)
5. **Segment calculations** (stride, samples per segment)
6. **Envelope parsing** (8-point structure identical)
7. **MIDI adapter interface** (`S330MidiAdapter` → `SSeriesMidiAdapter`)

### Parameterizable (Config-driven)

1. **Device constants**
   - Patch count: 64 vs 32
   - Tone count: 32 vs 64
   - Wave banks: 2 vs 4

2. **Value ranges**
   - Tone-to-key: 0-31 vs 0-63
   - Source tone: 0-31 vs 0-63
   - Wave bank: 0-1 vs 0-3
   - Output assign: 0-7 vs 0-8

3. **Address calculations** (same formula, different counts)

### Device-Specific

1. **Type definitions** (`S550Patch`, `S550Tone`)
2. **Address constants** (`S550_ADDRESSES`)
3. **Parameter offsets** (slightly different layout)
4. **MIDI parameters section** (S-550 has dedicated section)
5. **Recording parameters** (S-550 specific)
6. **External controller support** (S-550 specific)

## Implementation Strategy

### Option A: Shared Base (Recommended)

```
sampler-devices/src/devices/
├── shared/
│   ├── roland-s-series-base.ts    # Shared protocol logic
│   ├── roland-s-series-types.ts   # Common interfaces
│   └── roland-wave-format.ts      # Wave encoding (from s330)
├── s330/
│   ├── s330-config.ts             # S-330 specific config
│   ├── s330-types.ts              # S330-specific types
│   └── index.ts                   # Re-exports with S330 types
└── s550/
    ├── s550-config.ts             # S-550 specific config
    ├── s550-types.ts              # S550-specific types
    └── index.ts                   # Re-exports with S550 types
```

### Option B: Copy-and-Modify (Fallback)

If Option A proves too complex for the initial implementation:

```
sampler-devices/src/devices/
├── s330/                          # Existing, unchanged
└── s550/                          # Copy of s330, modified
    ├── s550-addresses.ts
    ├── s550-types.ts
    ├── s550-params.ts
    ├── s550-client.ts
    └── ...
```

This creates duplication but allows rapid implementation. Extraction to shared base can happen in Phase 5 (future).

### Recommendation

**Start with Option B** for faster delivery, with clear TODOs for future extraction. The S-550 implementation will validate which code is truly shared vs device-specific before premature abstraction.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hidden protocol differences | Low | Medium | Test with real hardware |
| Model ID collision | N/A | Low | User selects device type |
| Parameter offset errors | Medium | High | Thorough testing, compare to manual |
| Tone index overflow | Low | Medium | Validate ranges in setters |

## Testing Strategy

### Unit Tests

1. Address calculation for all 64 tones (vs 32 for S-330)
2. Wave bank C/D address generation
3. Tone-to-key value range (0-63)
4. Parameter encoding for S-550-specific values

### Integration Tests

1. Read all 32 patches
2. Read all 64 tones
3. Read from wave banks C and D
4. Write parameters with S-550 ranges
5. Round-trip: read → modify → write → read

### Hardware Validation

1. Confirm model ID response
2. Verify memory layout matches documentation
3. Test edge cases (tone 63, bank D, etc.)
4. Compare DT1 messages from panel edits
