# Roland D-110 Edisyn Implementation Analysis

Analysis of the Edisyn D-110 implementation from https://github.com/eclab/edisyn/tree/master/edisyn/synth/rolandd110

## SysEx Message Format

### Data Set (DT1) - Write to Device

```
F0 41 [ID] 16 12 [AA] [BB] [CC] [DATA...] [CHECKSUM] F7
```

| Byte | Description |
|------|-------------|
| F0 | SysEx start |
| 41 | Roland manufacturer ID |
| ID | Device ID (0x10-0x1F, default 0x10) |
| 16 | D-110 model ID |
| 12 | DT1 command (data set) |
| AA BB CC | 3-byte address |
| DATA | Parameter data |
| CHECKSUM | Roland checksum |
| F7 | SysEx end |

### Data Request (RQ1) - Read from Device

```
F0 41 [ID] 16 11 [AA] [BB] [CC] 00 [SIZE_MSB] [SIZE_LSB] [CHECKSUM] F7
```

| Byte | Description |
|------|-------------|
| 11 | RQ1 command (data request) |
| SIZE | 2 bytes, size of data to request |

## Checksum Calculation

```typescript
function rolandChecksum(data: number[], start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += data[i];
  }
  sum = sum & 0x7F;           // mod 128
  sum = 0x80 - sum;           // subtract from 128
  if (sum === 0x80) sum = 0;  // if result is 128, return 0
  return sum;
}
```

The checksum covers all address bytes (AA, BB, CC) and data bytes.

## Memory Map

### Address Overview

| AA | Description |
|----|-------------|
| 0x03 | Temporary Timbre (part configurations) |
| 0x04 | Temporary Tone (working tone data) |
| 0x06 | Patch Memory (64 patches) |
| 0x08 | Tone RAM (64 permanent tones) |
| 0x10 | System Parameters |

### Temporary Tone Address (0x04)

```typescript
// For part 0-7:
const location = partNumber * 246;
const AA = 0x04;
const BB = (location >> 7) & 0x7F;
const CC = location & 0x7F;
```

Size: 246 bytes per tone

### Permanent Tone Address (0x08)

```typescript
// For tone 0-63:
const AA = 0x08;
const BB = toneNumber * 2;
const CC = 0x00;
```

Size: 256 bytes per tone

### Timbre/Part Address (0x03)

```typescript
// For part 0-7:
const AA = 0x03;
const BB = partNumber * 0x10;
const CC = 0x00;
```

Size: 16 bytes per part, 144 bytes total (8 parts + rhythm)

### System Parameters Address (0x10)

```typescript
const AA = 0x10;
const BB = 0x00;
const CC = 0x00;
```

Size: 33 bytes (starts at offset 1, skipping master tune)

### Patch Memory Address (0x06)

```typescript
// For patch 0-63:
const AA = 0x06;
const BB = patchNumber;
const CC = 0x00;
```

Size: 138 bytes per patch

## Tone Structure (246 bytes)

### Common Parameters (14 bytes, offset 0x00)

| Offset | Parameter | Size | Range |
|--------|-----------|------|-------|
| 0x00-0x09 | Patch Name | 10 | ASCII |
| 0x0A | Structure 1-2 | 1 | 0-12 |
| 0x0B | Structure 3-4 | 1 | 0-12 |
| 0x0C | Partial Mutes | 1 | Bits [P4:P3:P2:P1] |
| 0x0D | Envelope Mode | 1 | 0-1 |

### Partial Offsets

| Partial | Offset |
|---------|--------|
| 1 | 0x0E |
| 2 | 0x48 |
| 3 | 0x82 (0x01:0x02 in 7-bit) |
| 4 | 0xBC (0x01:0x3C in 7-bit) |

### Partial Parameters (~58 bytes each)

#### Pitch Section

| Offset | Parameter | Range |
|--------|-----------|-------|
| 0 | Pitch Coarse | 0-96 (C1-C9) |
| 1 | Pitch Fine | 0-100 (±50 cents) |
| 2 | Pitch Keyfollow | 0-16 |
| 3 | Pitch Bender Switch | 0-1 |
| 4 | Waveform | 0-1 + PCM bank bit |
| 5 | PCM Wave Number | 0-127 |
| 6 | Pulse Width | 0-100 |
| 7 | Pulse Width Velocity | 0-100 |

#### Pitch Envelope

| Offset | Parameter | Range |
|--------|-----------|-------|
| 8 | Depth | 0-100 |
| 9 | Velocity Sensitivity | 0-100 |
| 10 | Time Keyfollow | 0-100 |
| 11-14 | Time 1-4 | 0-100 |
| 15-17 | Level 0-2 | 0-100 |
| 18 | Sustain Level | 0-100 |
| 19 | End Level | 0-100 |

#### Filter (TVF) Section

| Offset | Parameter | Range |
|--------|-----------|-------|
| 20 | Cutoff Frequency | 0-100 |
| 21 | Resonance | 0-30 |
| 22 | Keyfollow | 0-16 |
| 23 | Bias Point | 0-100 |
| 24 | Bias Level | 0-100 |
| 25 | Envelope Depth | 0-100 |
| 26 | Env Velocity Sensitivity | 0-100 |
| 27 | Env Depth Keyfollow | 0-100 |
| 28 | Env Time Keyfollow | 0-100 |
| 29-33 | Time 1-5 | 0-100 |
| 34-36 | Level 1-3 | 0-100 |
| 37 | Sustain Level | 0-100 |

#### Amplifier (TVA) Section

| Offset | Parameter | Range |
|--------|-----------|-------|
| 38 | Level | 0-100 |
| 39 | Velocity Sensitivity | 0-100 |
| 40-41 | Bias Point 1-2 | 0-127 (note) |
| 42-43 | Bias Level 1-2 | 0-100 |
| 44 | Env Time Keyfollow | 0-100 |
| 45 | Env Time 1 Velocity | 0-100 |
| 46-50 | Time 1-5 | 0-100 |
| 51-53 | Level 1-3 | 0-100 |
| 54 | Sustain Level | 0-100 |

#### LFO Section

| Offset | Parameter | Range |
|--------|-----------|-------|
| 55 | Rate | 0-100 |
| 56 | Depth | 0-100 |
| 57 | Modulation Sensitivity | 0-100 |

### Waveform Encoding

The waveform and PCM wave number use 2-byte encoding:

```typescript
// Byte 1 (Waveform):
// Bit 0: Waveform type (0=Square, 1=Sawtooth)
// Bit 1: PCM bank select (0=Bank A, 1=Bank B)

// Byte 2: PCM wave number (0-127)

// Combined: 256 total waveforms (2 banks × 128 waves)
```

## Multi/Patch Structure

### System Parameters (33 bytes at 0x10:0x00:0x00)

| Offset | Parameter | Size | Range |
|--------|-----------|------|-------|
| 0x00 | *Skip* (Master Tune) | 1 | - |
| 0x01 | Reverb Mode | 1 | 0-7 |
| 0x02 | Reverb Time | 1 | 0-7 |
| 0x03 | Reverb Level | 1 | 0-7 |
| 0x04-0x0B | Partial Reserve (8 parts) | 8 | 0-32 |
| 0x0C | Partial Reserve (Rhythm) | 1 | 0-32 |
| 0x0D-0x15 | MIDI Channels (9 parts) | 9 | 1-16 |
| 0x16-0x1F | Patch Name | 10 | ASCII |

### Part Parameters (16 bytes per part)

| Offset | Parameter | Range |
|--------|-----------|-------|
| 0x00 | Tone Group | 0-3 (Preset A/B, User 1/2) |
| 0x01 | Tone Number | 0-63 |
| 0x02 | Key Shift | 0-48 (±24 semitones) |
| 0x03 | Fine Tune | 0-100 (±50 cents) |
| 0x04 | Bender Range | 0-12 |
| 0x05 | Assign Mode | 0-2 |
| 0x06 | Output Assign | 0-6 |
| 0x07 | *Reserved* | - |
| 0x08 | Output Level | 0-100 |
| 0x09 | Pan | 0-100 (L50-R50) |
| 0x0A | Key Range Lower | 0-127 |
| 0x0B | Key Range Upper | 0-127 |
| 0x0C-0x0F | *Reserved* | - |

## SysEx Recognition

### Tone Messages

- Position 5 (after model ID): 0x02, 0x04, or 0x08
- Length: 256 bytes (temporary) or 266 bytes (permanent)

### Multi Messages

- Position 5: 0x03 (timbre), 0x06 (patch), or 0x10 (system)
- System data: 43 bytes
- Timbre data: 154 bytes
- Patch dump: 138 bytes

## Key Implementation Notes

1. **7-bit encoding**: All addresses and data use 7-bit values (0x00-0x7F)
2. **Two-stage patch dump**: System data (0x10) and timbre data (0x03) requested separately
3. **Partial reserve**: Total across all 9 parts cannot exceed 32
4. **Firmware**: v1.13+ recommended for reliable real-time parameter updates
