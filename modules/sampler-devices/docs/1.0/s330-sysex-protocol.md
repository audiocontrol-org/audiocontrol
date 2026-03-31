# Roland S-Series SysEx Protocol (S-330 / S-550)

This document describes the MIDI System Exclusive protocol used by the Roland S-330 and S-550 samplers. Both devices share model ID `0x1E` and use identical command structure and data encoding. Key differences: memory layout constants (patch/tone counts, wave bank counts) and **wave segment addressing** (see "Wave Address Calculation" section — the stride formula differs between devices).

Focus areas include the RQD/WSD handshake protocol, the DAT packet format with address headers, and the distinction between nibblized parameter data and 7-bit encoded wave data.

## Overview

The S-330 uses Roland's standard handshaking SysEx protocol:

- **RQD** (0x41): Request Data - request data from the device
- **DAT** (0x42): Data Transfer - send/receive data packets
- **ACK** (0x43): Acknowledge - ready for next packet
- **EOD** (0x45): End of Data - transfer complete
- **ERR** (0x4E): Error - communication error
- **RJC** (0x4F): Rejection - request denied

## Message Format

All S-series SysEx messages follow this structure:

```
F0 41 <dev> 1E <cmd> [data...] [checksum] F7
```

- `F0`: SysEx start
- `41`: Roland manufacturer ID
- `<dev>`: Device ID (0x00-0x0F)
- `1E`: S-series model ID (shared by S-330 and S-550)
- `<cmd>`: Command byte (RQD, DAT, ACK, etc.)
- `[data...]`: Command-specific data
- `[checksum]`: Roland checksum (for DAT messages)
- `F7`: SysEx end

## DAT Packet Format

**IMPORTANT**: Each DAT packet (both sent and received) includes a **4-byte address header** before the data payload:

```
F0 41 <dev> 1E 42 <addr0> <addr1> <addr2> <addr3> <data...> <checksum> F7
```

- The 4 address bytes indicate the starting address of this packet's data
- Address advances between packets (byte 2 increments by 1 per 128-nibble chunk)
- The checksum covers both the address header AND the data
- Each DAT packet carries 128 nibbles (for parameter data) or 128 bytes (for wave data)

This was confirmed via hardware testing against a physical S-550. When receiving DAT packets, the address header must be stripped before collecting nibble/byte data. When sending DAT packets, the address header must be included and the checksum must cover it.

## Data Encoding: Parameter Data vs Wave Data

**IMPORTANT**: The S-330 uses two different data encoding schemes:

### Parameter Data (Nibblized)

Patch and tone parameters are transmitted in **nibblized** format:
- Each logical byte is split into two nibbles (4 bits each)
- Transmitted as two MIDI bytes: `[high nibble] [low nibble]`
- Each nibble is in the range 0x00-0x0F

To decode nibblized data:
```typescript
byte = (highNibble << 4) | lowNibble
```

### Wave Data (7-bit Encoded 12-bit Samples)

Wave/sample data uses a **different encoding** - NOT nibblized:
- Each 12-bit sample is transmitted as 2 MIDI-safe bytes
- All bytes have MSB=0 (values 0-127, valid MIDI data bytes)

#### Wave Data Byte Format

From the S-330 MIDI Implementation:

| Address | Byte Format | Description |
|---------|-------------|-------------|
| 00 00 00H | `0aaa aaaa` | Upper 7 bits of 12-bit sample |
| 00 00 01H | `0bbb bb00` | Lower 5 bits (shifted left by 2) |

The 12-bit sample bits are arranged as: `aaaa aaab bbbb`

#### Decoding Wave Data

To decode a 12-bit sample from 2 transmitted bytes:

```typescript
const byte0 = data[i * 2];     // 0aaa aaaa - upper 7 bits
const byte1 = data[i * 2 + 1]; // 0bbb bb00 - lower 5 bits, left-shifted

// Combine: upper 7 bits << 5, lower 5 bits >> 2
const sample12bit = (byte0 << 5) | (byte1 >> 2);

// Sign extend from 12-bit 2's complement
if (sample12bit & 0x800) {
    sample12bit -= 0x1000;  // Convert to negative
}

// Scale to 16-bit for WAV export
const sample16bit = sample12bit << 4;
```

#### Size Calculation

When requesting wave data:
- **Size = sample count × 2** (2 bytes per sample)
- The RQD size field specifies bytes, not nibbles

This differs from parameter data where size = bytes × 2 (nibble count).

## Address Map

### Parameter Addresses

Addresses are shared between S-330 and S-550. All 4-byte addresses use 7-bit values (0x00-0x7F per byte).

| Address Base | Content | S-330 | S-550 |
|--------------|---------|-------|-------|
| 00 00 xx 00 | Patch data (stride=4 in byte 2) | 64 patches (0-63) | 32 patches (0-31) |
| 00 01 00 xx | Function parameters (Multi mode) | Same | Same |
| 00 02 xx 00 | Reserved/unknown | Valid data (usage TBD) | Valid data (usage TBD) |
| 00 03 xx 00 | Tone data (stride=2 in byte 2) | 32 tones (0-31) | 64 tones (0-63) |
| 00 04 xx 00 | Reserved/unknown | — | Small valid region |
| 00 05-07 | — | — | RJC (rejected) |
| 00 08-0F | Reserved/unknown | — | Valid data (usage TBD) |

The S-550 address space was mapped via hardware probing (2-nibble reads at each byte1 value 0x00-0x0F).

### Wave Data Address

From the S-330 MIDI Implementation, Section 4 (Address Mapping):
- Addresses are represented from 00 to 7F by hexadecimal (7-bit per byte)
- Format: `AA BB CC DD` where each byte is 0-127

| Address | Content | Device |
|---------|---------|--------|
| 01 00 00 00H | Wave Bank A (18 segments) | Both |
| 01 01 00 00H | Wave Bank B (18 segments) | Both |
| 01 02 00 00H | Wave Bank C (18 segments) | S-550 only |
| 01 03 00 00H | Wave Bank D (18 segments) | S-550 only |

#### Wave Memory Organization

Each bank contains 18 segments. Key measurements:

| Property | Value | Notes |
|----------|-------|-------|
| Samples per segment | 12000 | 0.4s at 30kHz, 0.8s at 15kHz |
| Data bytes per segment | 24000 | 2 bytes per 12-bit sample |

#### Wave Address Calculation: S-330 vs S-550

**IMPORTANT**: The S-330 and S-550 use different wave segment addressing despite sharing the same SysEx protocol (model ID 0x1E). Using the wrong addressing formula causes wave data to be written to incorrect physical memory locations. The device ACKs the write but the tone's wave allocation reads back as empty.

##### S-330 Wave Addressing

The S-330 uses a linear stride in flat address space:

```typescript
const SEGMENT_ADDR_STRIDE = 24576;  // 00 01 40 00H in 7-bit encoding
const bankBaseAddr = waveBank === 0 ? 0 : (0x20 << 14);  // Bank B = 0x20 in byte 1

const addrOffset = bankBaseAddr + (waveSegmentTop * SEGMENT_ADDR_STRIDE);

const address = [
    0x01,                        // Wave memory area
    (addrOffset >> 14) & 0x7F,   // BB
    (addrOffset >> 7) & 0x7F,    // CC
    addrOffset & 0x7E            // DD - LSB must be even
];
```

Examples (S-330):
| Segment | Address | Notes |
|---------|---------|-------|
| Bank A, seg 0 | `01 00 00 00` | |
| Bank A, seg 1 | `01 00 40 00` | Stride visible in byte 2 |
| Bank A, seg 12 | `01 12 00 00` | Stride wraps into byte 1 |
| Bank B, seg 0 | `01 20 00 00` | |

S-330 properties:
- Segment stride: 24576 (00 01 40 00H) flat address units
- Padding per segment: 576 unused address units
- Bank size: 442368 (18 × 24576)
- 2 wave banks (A, B)

##### S-550 Wave Addressing

The S-550 uses a simplified structured address with bank base + segment index:

```typescript
const WAVE_BANK_BASE = { 0: 0x00, 1: 0x20, 2: 0x40, 3: 0x60 };

const byte1 = WAVE_BANK_BASE[absoluteWaveBank];
const byte2 = (segmentIndex * 8) & 0x7F;  // Segment stride is 8 in byte 2

const address = [0x01, byte1, byte2, 0x00];
```

Examples (S-550):
| Segment | Address | Notes |
|---------|---------|-------|
| Bank A, seg 0 | `01 00 00 00` | Same as S-330 |
| Bank A, seg 1 | `01 00 08 00` | Different from S-330 |
| Bank A, seg 12 | `01 00 60 00` | Very different from S-330's `01 12 00 00` |
| Bank B, seg 0 | `01 20 00 00` | Same as S-330 |
| Bank C, seg 0 | `01 40 00 00` | S-550 only |
| Bank D, seg 0 | `01 60 00 00` | S-550 only |

S-550 properties:
- Segment stride: 8 in byte 2 position
- 4 wave banks (A, B, C, D)
- Max uniquely addressable segments per bank: 16 (byte2 wraps at segment 16 due to `& 0x7F`)

**Discovery date**: 2026-03-30. Empirical probe results below.

##### Empirical S-550 Probe Results (2026-03-30)

A full memory probe wrote unique identifiable data to every segment on every bank of a physical S-550, then read it all back. Results:

**Write phase**: All 4 banks (A-D) × 18 segments accept WSD writes using the S-330 stride formula. The S-550 `buildWaveDataAddress` formula (byte2 = segment×8) was tested earlier and all writes were rejected — **that formula is wrong**. Both devices use the same stride (24576).

**Read phase**: Only **even-numbered segments** (0, 2, 4, 6, 8, 10, 12, 14, 16) are readable via RQD. Odd segments (1, 3, 5, ...) return RJC despite successful writes. All 32 readable segments returned correct marker data (100% match).

| Bank | Writable segments | Readable segments | Notes |
|------|------------------|-------------------|-------|
| A (0) | 0-17 (all 18) | 0,2,4,6,8,10,12,14,16 (9) | |
| B (1) | 0-17 (all 18) | 0,2,4,6,8,10,12,14,16 (9) | |
| C (2) | 0-17 (all 18) | 0,2,4,6,8,10,12,14,16 (9) | |
| D (3) | 0-8 (9 tested) | 0,2,4,6,8 (5 tested) | Tone slots exhausted at index 63 |

**Aliasing test**: Wrote 0xAAA to segment 0, then 0xBBB to segment 1, then re-read segment 0. Marker was still 0xAAA — **no aliasing**. Odd segments are distinct physical memory that accepts writes but cannot be read back via RQD. The data is likely accessible through audio playback but not through the SysEx protocol.

**Implication for import**: When importing a tone to an odd segment, the wave data IS written to the device, but `requestWaveData` cannot verify it. The tone's `segmentLength` reads back as 0 because the device's RQD-based tone read may also fail to detect wave data at odd segments. The app's `importTone` writes to odd segments successfully, but the re-read after import sees `segmentLength=0` because the verification read fails.

**Corrected understanding**: The S-550's `s550-addresses.ts` `buildWaveDataAddress` function is incorrect. Both S-330 and S-550 use the same linear stride formula (24576 address units per segment). The S-550 additionally supports banks C and D at offsets 0x40 and 0x60 in byte 1.

##### Segment 0 Coincidence

Both formulas produce `01 00 00 00` for segment 0 of bank A (and `01 20 00 00` for bank B segment 0). This is why basic import/export works — most tests default to segment 0. The bug only manifests at segments > 0.

#### Request Size

```typescript
// Request size in bytes (NOT address units)
const bytesToFetch = waveSegmentLength * 12000 * 2;
```

#### Important Notes

1. **Device-specific addressing is required**: The wave address calculation MUST use the correct formula for the connected device. Both devices ACK writes to any address, but only the correctly addressed writes persist.

2. **startPoint/endPoint/loopPoint** in tone parameters are playback offsets relative to the segment, NOT memory addresses.

3. **LSB must be even**: Per Roland spec, the lowest bit of the address LSB should be 0.

## Sample Format Details

- **Bit depth**: 12-bit linear PCM
- **Encoding**: 2's complement (signed)
- **Sample rates**: 15kHz or 30kHz (stored in tone parameters)
- **Channels**: Mono

The 12-bit samples provide a dynamic range of approximately 72dB.

## Checksum Calculation

Roland checksum for DAT messages:

```typescript
function calculateChecksum(address: number[], data: number[]): number {
    const sum = [...address, ...data].reduce((a, b) => a + b, 0);
    return (128 - (sum & 0x7F)) & 0x7F;
}
```

## References

- Roland S-330 MIDI Implementation
  - Section 3: Exclusive Communications
  - Section 4: Address Mapping of Parameters
  - Section 4.6: Wave Data (offset addresses and total size)
- Roland S-330 Owner's Manual
