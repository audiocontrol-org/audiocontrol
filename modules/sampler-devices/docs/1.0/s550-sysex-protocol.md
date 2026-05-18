# Roland S-550 SysEx Protocol

This document describes the MIDI System Exclusive protocol used by the Roland S-550 sampler, with comparison to the S-330.

## Overview

The S-550 uses Roland's standard handshaking SysEx protocol, identical to the S-330:

- **RQ1** (0x11): Request (one-way) - request data from the device
- **DT1** (0x12): Data Set (one-way) - send data to device
- **WSD** (0x40): Want to Send Data - request permission to send
- **RQD** (0x41): Request Data - request data (handshaking)
- **DAT** (0x42): Data Transfer - send/receive data packets
- **ACK** (0x43): Acknowledge - ready for next packet
- **EOD** (0x45): End of Data - transfer complete
- **ERR** (0x4E): Error - communication error
- **RJC** (0x4F): Rejection - request denied

## Message Format

All S-550 SysEx messages follow the same structure as S-330:

```
F0 41 <dev> 1E <cmd> [data...] [checksum] F7
```

- `F0`: SysEx start
- `41`: Roland manufacturer ID
- `<dev>`: Device ID (0x00-0x0F)
- `1E`: **Model ID (same as S-330!)**
- `<cmd>`: Command byte (RQD, DAT, ACK, etc.)
- `[data...]`: Command-specific data
- `[checksum]`: Roland checksum (for DAT messages)
- `F7`: SysEx end

**Important**: The S-550 and S-330 share the same model ID (0x1E). Device identification must rely on parameter layout differences or user configuration.

## S-550 vs S-330 Comparison

| Aspect | S-330 | S-550 | Notes |
|--------|-------|-------|-------|
| Model ID | 0x1E | 0x1E | **Identical** |
| Patches | 64 | 32 | Different count |
| Tones | 32 | 64 | Different count |
| Wave Banks | A, B (2) | A, B, C, D (4) | S-550 has 2× memory |
| Segments per Bank | 18 | 18 | Same |
| Total Segments | 36 | 72 | S-550 has 2× capacity |
| Patch Size | 00 04 00H | 00 04 00H | Same structure |
| Tone Size | 00 02 00H | 00 02 00H | Same structure |
| Wave Encoding | 12-bit | 12-bit | Identical |

## Address Map

Address format: `AA BB CC DD` where each byte is 0-127 (7-bit).

| Address | Content | Size |
|---------|---------|------|
| 00 00 00 00H | Patch parameters (×32) | 00 00 04 00H each |
| 00 01 00 00H | Function parameters | 00 00 04 00H |
| 00 02 00 00H | MIDI parameters | 00 00 08 00H |
| 00 03 00 00H | Tone parameters (×64) | 00 00 02 00H each |
| 00 04 00 00H | SW (Switch data) | 00 00 00 08H |
| 01 00 00 00H | Wave data Bank A (×18 segments) | |
| 01 20 00 00H | Wave data Bank B (×18 segments) | |
| 01 40 00 00H | Wave data Bank C (×18 segments) | |
| 01 60 00 00H | Wave data Bank D (×18 segments) | |

### Address Calculation

```typescript
// Patch address (32 patches, stride = 00 00 04 00H)
const patchAddress = [0x00, 0x00, patchIndex * 4, offset];

// Tone address (64 tones, stride = 00 00 02 00H)
const toneAddress = [0x00, 0x03 + Math.floor(toneIndex / 64), (toneIndex % 64) * 2, offset];

// Wave bank addresses
const WAVE_BANK_ADDRESSES = {
  A: [0x01, 0x00, 0x00, 0x00],
  B: [0x01, 0x20, 0x00, 0x00],
  C: [0x01, 0x40, 0x00, 0x00],
  D: [0x01, 0x60, 0x00, 0x00],
};
```

## Patch Parameters (00 00 00 00H)

Total size per patch: 00 00 04 00H (1024 nibbles = 512 bytes)

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 00H-17H | PATCH NAME (12 chars) | 32-127 | ASCII |
| 00 18H-19H | BEND RANGE | 0-12 | Semitones |
| 00 1CH-1DH | AFTER TOUCH SENSE | 0-127 | |
| 00 1EH-1FH | KEY MODE | 0-4 | 0:Normal, 1:V-Sw, 2:X-Fade, 3:V-Mix, 4:Unison |
| 00 20H-21H | VELOCITY SW THRESHOLD | 0-127 | |
| 00 22H-01 7BH | TONE TO KEY #1 (×109) | 0-63 | Layer 1, keys C0-C9 |
| 01 7CH-03 55H | TONE TO KEY #2 (×109) | 0-63 | Layer 2, keys C0-C9 |
| 03 56H-57H | COPY SOURCE | 0-7 | |
| 03 58H-59H | OCTAVE SHIFT | -2 to +2 | Stored as 0-4 |
| 03 5AH-5BH | OUTPUT LEVEL | 0-127 | |
| 03 5EH-5FH | DETUNE | -64 to +63 | |
| 03 60H-61H | VELOCITY MIX RATIO | 0-127 | |
| 03 62H-63H | AFTER TOUCH ASSIGN | 0-4 | 0:Mod, 1:Vol, 2:Bend+, 3:Bend-, 4:Filter |
| 03 64H-65H | KEY ASSIGN | 0-1 | 0:Rotary, 1:Fix |
| 03 66H-67H | OUTPUT ASSIGN | 0-8 | 0-7:OUTPUT 1-8, 8:TONE |

**Note**: TONE TO KEY values range 0-63 (for 64 tones) vs S-330's 0-31.

## Function Parameters (00 01 00 00H)

Total size: 00 00 04 00H

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 00H-01H | MASTER TUNE | -64 to +63 | |
| 00 20H-21H | VOICE MODE | 0-23 | See Voice Mode table |
| 00 22H-31H | MULTI MIDI RX-CH 1-8 | 0-15 | |
| 00 32H-41H | MULTI PATCH NUMBER 1-8 | 0-31 | |

### Voice Mode Values

| Value | Mode |
|-------|------|
| 0 | AUTO MODE (Last Note Priority) |
| 1 | AUTO MODE (First Note Priority) |
| 2-23 | FIX MODE 1-22 |

## MIDI Parameters (00 02 00 00H)

Total size: 00 00 08 00H

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 40H-4FH | RX CHANNEL 1-8 | 0-16 | 0-15:CH 1-16, 16:OFF |
| 00 50H-5FH | RX PROGRAM CHANGE 1-8 | 0-1 | 0:OFF, 1:ON |
| 00 60H-6FH | RX BENDER 1-8 | 0-1 | |
| 00 70H-7FH | RX MODULATION 1-8 | 0-1 | |
| 01 00H-0FH | RX HOLD 1-8 | 0-1 | |
| 01 10H-1FH | RX AFTER TOUCH 1-8 | 0-1 | |
| 01 20H-2FH | RX VOLUME 1-8 | 0-1 | |
| 01 30H-3FH | RX BEND RANGE 1-8 | 0-1 | |
| 01 42H-43H | SYSTEM EXCLUSIVE | 0-1 | 0:OFF, 1:ON |
| 01 44H-45H | DEVICE ID | 0-15 | |
| 01 46H-02 07H | RX PROGRAM CHANGE NUMBER 1-32 | 0-127 | |
| 01 5CH-66H | BLOCK 1 DISK LABEL | ASCII | 60 chars |
| 01 66H-67H | EXTERNAL CONTROLLER | 0-2 | 0:OFF, 1:MOUSE, 2:RC-100 |
| 04 66H-05 5DH | BLOCK 2 DISK LABEL | ASCII | 60 chars |

## Tone Parameters (00 03 00 00H)

Total size per tone: 00 00 02 00H (512 nibbles = 256 bytes)

### Basic Parameters

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 00H-0FH | TONE NAME (8 chars) | 32-127 | ASCII |
| 00 10H-11H | OUTPUT ASSIGN | 0-7 | |
| 00 12H-13H | SOURCE TONE | 0-63 | Reference tone index |
| 00 14H-15H | ORIG/SUB TONE | 0-1 | 0:ORG, 1:SUB |
| 00 16H-17H | SAMPLING FREQUENCY | 0-1 | 0:30kHz, 1:15kHz |
| 00 18H-19H | ORIG KEY NUMBER | 11-120 | MIDI note number |
| 00 1AH-1BH | WAVE BANK | 0-3 | 0:A, 1:B, 2:C, 3:D |
| 00 1CH-1DH | WAVE SEGMENT TOP | 0-17 | |
| 00 1EH-1FH | WAVE SEGMENT LENGTH | 0-18 | |

**Note**: WAVE BANK supports 4 banks (0-3) vs S-330's 2 banks (0-1).

### Sample Points (24-bit values)

| Offset | Parameter | Range |
|--------|-----------|-------|
| 00 20H-25H | START POINT | 0-221180 |
| 00 26H-2BH | END POINT | 4-221184 |
| 00 2CH-31H | LOOP POINT | 0-221180 |
| 01 4CH-51H | LOOP LENGTH | 0-221184 |

### Playback Parameters

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 32H-33H | LOOP MODE | 0-3 | 0:Fwd, 1:Alt, 2:1Shot, 3:Reverse |
| 00 48H-49H | TRANSPOSE | 0-127 | 64 = no transpose |
| 00 4AH-4BH | FINE TUNE | -64 to +63 | |
| 01 52H-53H | PITCH FOLLOW | 0-1 | 0:OFF, 1:ON |

### LFO Parameters

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 34H-35H | TVA LFO DEPTH | 0-127 | |
| 00 38H-39H | LFO RATE | 0-127 | |
| 00 3AH-3BH | LFO SYNC | 0-1 | 0:OFF, 1:ON |
| 00 3CH-3DH | LFO DELAY | 0-127 | |
| 00 40H-41H | LFO MODE | 0-1 | 0:NORMAL, 1:ONE SHOT |
| 00 42H-43H | OSC LFO DEPTH | 0-127 | Pitch modulation |
| 00 44H-45H | LFO POLARITY | 0-1 | 0:Sine, 1:Peak hold |
| 00 46H-47H | LFO OFFSET | 0-127 | |
| 00 54H-55H | TVF LFO DEPTH | 0-127 | |

### TVF (Filter) Parameters

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 4CH-4DH | TVF CUT OFF | 0-127 | |
| 00 4EH-4FH | TVF RESONANCE | 0-127 | |
| 00 50H-51H | TVF KEY FOLLOW | 0-127 | |
| 00 56H-57H | TVF EG DEPTH | 0-127 | |
| 00 58H-59H | TVF EG POLARITY | 0-1 | 0:NORMAL, 1:REVERSE |
| 00 5AH-5BH | TVF LEVEL CURVE | 0-5 | |
| 00 5CH-5DH | TVF KEY RATE FOLLOW | 0-127 | |
| 00 5EH-5FH | TVF VELOCITY RATE FOLLOW | 0-127 | |
| 00 62H-63H | TVF SWITCH | 0-1 | 0:OFF, 1:ON |

### TVF Envelope (8-point)

| Offset | Parameter | Range |
|--------|-----------|-------|
| 01 56H-57H | TVF ENV SUSTAIN POINT | 0-7 |
| 01 58H-59H | TVF ENV END POINT | 1-7 |
| 01 5AH-69H | TVF ENV LEVEL 1-8 | 0-127 |
| 01 5CH-79H | TVF ENV RATE 1-8 | 1-127 |

### TVA (Amplifier) Parameters

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00 64H-65H | BENDER SWITCH | 0-1 | 0:OFF, 1:ON |
| 00 66H-67H | TVA ENV SUSTAIN POINT | 0-7 | |
| 00 68H-69H | TVA ENV END POINT | 1-7 | |
| 01 0CH-0DH | TVA ENV KEY-RATE | 0-127 | |
| 01 0EH-0FH | LEVEL | 0-127 | |
| 01 10H-11H | ENV VEL-RATE | 0-127 | |
| 01 32H-33H | TVA LEVEL CURVE | 0-5 | |
| 01 7AH-7BH | AFTER TOUCH SWITCH | 0-1 | 0:OFF, 1:ON |

### TVA Envelope (8-point)

| Offset | Parameter | Range |
|--------|-----------|-------|
| 00 6AH-01 01H | TVA ENV LEVEL 1-8 | 0-127 |
| 00 6CH-01 09H | TVA ENV RATE 1-8 | 1-127 |

### Recording Parameters (S-550 specific)

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 01 12H-13H | REC THRESHOLD | 0-127 | |
| 01 14H-15H | REC PRE-TRIGGER | 0-3 | 0:0ms, 1:10ms, 2:50ms, 3:100ms |
| 01 16H-17H | REC SAMPLING FREQUENCY | 0-1 | 0:30kHz, 1:15kHz |
| 01 18H-1DH | REC START POINT | 0-221180 | |
| 01 1EH-23H | REC END POINT | 4-221184 | |
| 01 24H-29H | REC LOOP POINT | 0-221180 | |

### Display Parameters

| Offset | Parameter | Range |
|--------|-----------|-------|
| 01 2AH-2BH | ZOOM T | 0-5 |
| 01 2CH-2DH | ZOOM L | 0-5 |
| 01 2EH-2FH | COPY SOURCE | 0-31 |
| 01 30H-31H | LOOP TUNE | -64 to +63 |
| 01 54H-55H | ENV ZOOM | 0-5 |

## SW (Switch Data) (00 04 00 00H)

Total size: 00 00 00 08H

| Offset | Parameter | Range | Notes |
|--------|-----------|-------|-------|
| 00H-01H | SW 1 (all) | | UI state |
| 02H-03H | SW 2 (character) | | |
| 04H-05H | SW 3 (patch) | | |
| 06H-07H | ALPHA DIAL | -127 to +127 | |

## Wave Data (01 00 00 00H - 01 7F 7F 7FH)

Wave data encoding is identical to S-330:

- **Bit depth**: 12-bit linear PCM
- **Encoding**: 2's complement (signed)
- **Transmission**: 2 MIDI bytes per sample
- **Sample rates**: 15kHz or 30kHz

### Bank Addresses

| Bank | Address | Segments |
|------|---------|----------|
| A | 01 00 00 00H | 0-17 |
| B | 01 20 00 00H | 0-17 |
| C | 01 40 00 00H | 0-17 |
| D | 01 60 00 00H | 0-17 |

### Segment Layout

- **Segment stride**: 00 01 40 00H (24576 address units)
- **Samples per segment**: 12000
- **Data bytes per segment**: 24000 (2 bytes × 12000 samples)

### Wave Data Byte Format

Same as S-330:

| Byte | Format | Description |
|------|--------|-------------|
| 0 | `0aaa aaaa` | Upper 7 bits of 12-bit sample |
| 1 | `0bbb bb00` | Lower 5 bits (shifted left by 2) |

```typescript
// Decode 12-bit sample
const sample12bit = (byte0 << 5) | (byte1 >> 2);

// Sign extend
const signed = sample12bit & 0x800 ? sample12bit - 0x1000 : sample12bit;

// Scale to 16-bit
const sample16bit = signed << 4;
```

## Checksum Calculation

Same as S-330:

```typescript
function calculateChecksum(address: number[], data: number[]): number {
  const sum = [...address, ...data].reduce((a, b) => a + b, 0);
  return (128 - (sum & 0x7F)) & 0x7F;
}
```

## Implementation Notes

### Device Differentiation

Since S-330 and S-550 share the same model ID (0x1E), differentiation options:

1. **User selection**: Let the user specify which device they're connecting to
2. **Parameter probing**: Read a parameter that has different valid ranges
   - S-330: 32 tones (tone addresses 0-31)
   - S-550: 64 tones (tone addresses 0-63)
3. **Memory probing**: Check for presence of wave banks C/D

### Code Reuse Strategy

Given the protocol similarity:

```typescript
// Shared base for Roland S-series
interface RolandSSeriesConfig {
  modelId: number;        // 0x1E for both
  patchCount: number;     // 64 or 32
  toneCount: number;      // 32 or 64
  waveBanks: number;      // 2 or 4
  // Parameter offset maps
  patchOffsets: PatchOffsets;
  toneOffsets: ToneOffsets;
}

// Device-specific configs
const S330_CONFIG: RolandSSeriesConfig = {
  modelId: 0x1E,
  patchCount: 64,
  toneCount: 32,
  waveBanks: 2,
  // ...
};

const S550_CONFIG: RolandSSeriesConfig = {
  modelId: 0x1E,
  patchCount: 32,
  toneCount: 64,
  waveBanks: 4,
  // ...
};
```

## References

- Roland S-550 MIDI Implementation (S550-MIDI-IMPLEMENTATION.pdf)
- Roland S-330 SysEx Protocol (s330-sysex-protocol.md)
