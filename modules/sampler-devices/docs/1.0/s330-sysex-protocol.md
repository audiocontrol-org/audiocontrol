# Roland S-330 SysEx Protocol

This document describes the MIDI System Exclusive protocol used by the Roland S-330 sampler, with particular focus on wave data transfer which uses a different encoding than parameter data.

## Overview

The S-330 uses Roland's standard handshaking SysEx protocol:

- **RQD** (0x41): Request Data - request data from the device
- **DAT** (0x42): Data Transfer - send/receive data packets
- **ACK** (0x43): Acknowledge - ready for next packet
- **EOD** (0x45): End of Data - transfer complete
- **ERR** (0x4E): Error - communication error
- **RJC** (0x4F): Rejection - request denied

## Message Format

All S-330 SysEx messages follow this structure:

```
F0 41 <dev> 1E <cmd> [data...] [checksum] F7
```

- `F0`: SysEx start
- `41`: Roland manufacturer ID
- `<dev>`: Device ID (0x00-0x0F)
- `1E`: S-330 model ID
- `<cmd>`: Command byte (RQD, DAT, ACK, etc.)
- `[data...]`: Command-specific data
- `[checksum]`: Roland checksum (for DAT messages)
- `F7`: SysEx end

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

| Address Base | Content |
|--------------|---------|
| 00 00 xx 00 | Patch data (64 patches, stride=4) |
| 00 01 00 xx | Function parameters (Multi mode) |
| 00 03 xx 00 | Tone data (32 tones, stride=2) |

### Wave Data Address

From the S-330 MIDI Implementation, Section 4 (Address Mapping):
- Addresses are represented from 00 to 7F by hexadecimal (7-bit per byte)
- Format: `AA BB CC DD` where each byte is 0-127

| Address | Content |
|---------|---------|
| 01 00 00 00H | Wave Bank A (18 segments) |
| 01 20 00 00H | Wave Bank B (18 segments) |

#### Wave Memory Organization

Each bank contains 18 segments. Key measurements:

| Property | Value | Notes |
|----------|-------|-------|
| Segment stride | 00 01 40 00H = 24576 | Address units between segments |
| Samples per segment | 12000 | 0.4s at 30kHz, 0.8s at 15kHz |
| Data bytes per segment | 24000 | 2 bytes per 12-bit sample |
| Padding per segment | 576 | Unused address space |
| Bank size | 442368 | 18 × 24576 |

#### Calculating Wave Addresses

To fetch wave data for a tone:

```typescript
// From tone parameters:
// - waveBank: 0=A, 1=B
// - waveSegmentTop: starting segment index (0-17)
// - waveSegmentLength: number of segments

const SEGMENT_ADDR_STRIDE = 24576;  // 00 01 40 00H
const BANK_ADDR_SIZE = SEGMENT_ADDR_STRIDE * 18;

const bankBaseAddr = waveBank * BANK_ADDR_SIZE;
const addrOffset = bankBaseAddr + (waveSegmentTop * SEGMENT_ADDR_STRIDE);

// Encode as 4-byte 7-bit address
const address = [
    0x01,                        // Wave memory area
    (addrOffset >> 14) & 0x7F,   // BB
    (addrOffset >> 7) & 0x7F,    // CC
    addrOffset & 0x7E            // DD - LSB must be even
];

// Request size in bytes (NOT address units)
const bytesToFetch = waveSegmentLength * 12000 * 2;
```

#### Important Notes

1. **Segment stride ≠ data size**: Each segment occupies 24576 address units but contains only 24000 bytes of sample data.

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
