# Roland S-330 MIDI System Exclusive Implementation

## Device Overview

The **Roland S-330** is a 12-bit digital sampler released in 1987. It is the rackmount version of the S-50, sharing the same sampling engine and sound architecture.

### Specifications

| Parameter | Value |
|-----------|-------|
| Voices | 16 polyphonic |
| Sample Resolution | 12-bit linear |
| Sample Memory | 512KB standard (expandable to 1MB) |
| Sample Rates | 15kHz, 30kHz |
| Outputs | 8 individual + stereo mix |
| Storage | 3.5" 2DD floppy (720KB) |
| MIDI | In, Out, Thru |

### Memory Organization

- **Tones**: Individual sampled sounds with loop points and pitch settings
- **Patches**: Multi-timbral setups containing up to 32 key zones (Partials)
- **Partials**: Key zone assignments linking keys to tones

## Roland SysEx Message Format

Roland samplers use a standard SysEx format:

```
F0 41 DEV 1E CMD [ADDRESS] [DATA] [CHECKSUM] F7
```

| Byte | Value | Description |
|------|-------|-------------|
| F0 | - | SysEx Start |
| 41 | - | Roland Manufacturer ID |
| DEV | 00-1F | Device ID (set on sampler, default 00) |
| 1E | - | Model ID (S-330/S-550) |
| CMD | - | Command type (see below) |
| ADDRESS | - | 4-byte address (AA BB CC DD) |
| DATA | - | Parameter data (variable length) |
| CHECKSUM | - | Roland checksum |
| F7 | - | SysEx End |

## Command Types

| Command | Hex | Direction | Description |
|---------|-----|-----------|-------------|
| RQ1 | 11 | Host → S-330 | Data Request |
| DT1 | 12 | Host → S-330 | Data Set |
| WSD | 40 | Host → S-330 | Want to Send Data |
| RQD | 41 | Host → S-330 | Request Data |
| DAT | 42 | Host ↔ S-330 | Data Transfer |
| ACK | 43 | S-330 → Host | Acknowledge |
| EOD | 45 | Host ↔ S-330 | End of Data |
| ERR | 4E | S-330 → Host | Communication Error |
| RJC | 4F | S-330 → Host | Rejection |

## Address Map

The S-330 uses a 4-byte address space organized hierarchically.

### Address Map Overview (Confirmed January 2026)

| Bank | Address Range | Description |
|------|--------------|-------------|
| 00 00 | `00 00 (pp*4) 00` | **Patch Parameters** - stride of 4 per patch |
| 00 01 | `00 01 00 xx` | **Function Parameters** - multi mode config |
| 00 02 | `00 02 00 xx` | **MIDI Parameters** |
| 00 03 | `00 03 (tt*4) 00` | **Tone Parameters** - stride of 4 per tone |
| 01 xx | `01 xx xx xx` | **Wave Data** |

### System Parameters (00 00 00 00 - 00 00 00 7F)

Base address: `00 00 00 00`

| Offset | Size | Parameter | Range | Description |
|--------|------|-----------|-------|-------------|
| 00 | 1 | Master Tune | 00-7F | Master tuning (40 = A=440Hz) |
| 01 | 1 | Master Level | 00-7F | Master output level |
| 02 | 1 | MIDI Channel | 00-0F | Basic MIDI receive channel |
| 03 | 1 | Device ID | 00-1F | SysEx device ID |
| 04 | 1 | Exclusive | 00-01 | SysEx enable (0=off, 1=on) |
| 05 | 1 | Prog Change | 00-01 | Program change enable |
| 06 | 1 | Ctrl Change | 00-01 | Control change enable |
| 07 | 1 | Bender | 00-01 | Pitch bend enable |
| 08 | 1 | Mod Wheel | 00-01 | Modulation enable |
| 09 | 1 | Aftertouch | 00-01 | Aftertouch enable |
| 0A | 1 | Hold Pedal | 00-01 | Hold pedal enable |

### Function Parameters - Multi Mode (00 01 00 22 - 00 01 00 5D)

Base address: `00 01 00 xx` where `xx` is the parameter offset below.

**Important**: Function parameters are in bank `00 01`, NOT `00 00`.

**Data Format**: When reading via RQD, the data is returned de-nibblized (each logical byte is sent as two nibbles in DAT packets). Each parameter is stored as a single byte at consecutive addresses.

**Writing Function Parameters**: DT1 is **silently ignored** for function parameters. You **must use WSD/DAT/EOD protocol** instead. See "Writing Function Parameters" section below.

#### MULTI MIDI RX-CH Parameters (Offset 0x22-0x29)

| Offset | Parameter | Range | Description |
|--------|-----------|-------|-------------|
| 22 | Part A Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 23 | Part B Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 24 | Part C Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 25 | Part D Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 26 | Part E Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 27 | Part F Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 28 | Part G Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |
| 29 | Part H Channel | 00-0F | MIDI receive channel (0=Ch 1, 15=Ch 16) |

#### MULTI PATCH NUMBER Parameters (Offset 0x32-0x39)

| Offset | Parameter | Range | Description |
|--------|-----------|-------|-------------|
| 32 | Part A Patch | 00-3F | Patch number (0-63), display as P11-P74 |
| 33 | Part B Patch | 00-3F | Patch number (0-63) |
| 34 | Part C Patch | 00-3F | Patch number (0-63) |
| 35 | Part D Patch | 00-3F | Patch number (0-63) |
| 36 | Part E Patch | 00-3F | Patch number (0-63) |
| 37 | Part F Patch | 00-3F | Patch number (0-63) |
| 38 | Part G Patch | 00-3F | Patch number (0-63) |
| 39 | Part H Patch | 00-3F | Patch number (0-63) |

**Display Note**: The S-330 displays patch numbers starting at P11 (first bank). Index 0 = P11, index 1 = P12, etc.

#### MULTI LEVEL Parameters (Offset 0x56-0x5D)

| Offset | Parameter | Range | Description |
|--------|-----------|-------|-------------|
| 56 | Part A Level | 00-7F | Output level (0-127) |
| 57 | Part B Level | 00-7F | Output level (0-127) |
| 58 | Part C Level | 00-7F | Output level (0-127) |
| 59 | Part D Level | 00-7F | Output level (0-127) |
| 5A | Part E Level | 00-7F | Output level (0-127) |
| 5B | Part F Level | 00-7F | Output level (0-127) |
| 5C | Part G Level | 00-7F | Output level (0-127) |
| 5D | Part H Level | 00-7F | Output level (0-127) |

**Note**: The S-330 does not have per-part output routing in multi mode - all parts share the patch's output assignment.

### Patch Parameters (00 00 00 00 - 00 00 FC 00)

Base address: `00 00 (pp*4) 00` where `pp` = patch number (00-3F)

**Important**: Each patch occupies a stride of 4 in the address space. Patch 0 is at `00 00 00 00`, Patch 1 is at `00 00 04 00`, Patch 2 is at `00 00 08 00`, etc.

#### Patch Common Parameters (Offset 00-0F)

| Offset | Size | Parameter | Range | Description |
|--------|------|-----------|-------|-------------|
| 00 | 8 | Patch Name | ASCII | 8-character name |
| 08 | 1 | Bender Range | 00-0C | Pitch bend range (semitones) |
| 09 | 1 | Aftertouch Sens | 00-7F | Aftertouch sensitivity |
| 0A | 1 | Key Mode | 00-02 | 0=Whole, 1=Dual, 2=Split |
| 0B | 1 | Split Point | 00-7F | Split point (MIDI note) |
| 0C | 1 | Portamento Time | 00-7F | Portamento time |
| 0D | 1 | Portamento Mode | 00-01 | 0=Off, 1=On |
| 0E | 1 | Output Assign | 00-08 | Output routing |
| 0F | 1 | Level | 00-7F | Patch level |

#### Partial Parameters (Offset 10-2F per partial)

Each patch can have up to 32 partials. Partial `n` starts at offset `10 + (n * 20)`.

| Offset | Size | Parameter | Range | Description |
|--------|------|-----------|-------|-------------|
| 00 | 1 | Tone Number | 00-1F | Assigned tone |
| 01 | 1 | Key Range Low | 00-7F | Lower key limit |
| 02 | 1 | Key Range High | 00-7F | Upper key limit |
| 03 | 1 | Vel Range Low | 01-7F | Lower velocity limit |
| 04 | 1 | Vel Range High | 01-7F | Upper velocity limit |
| 05 | 1 | Level | 00-7F | Partial level |
| 06 | 1 | Pan | 00-7F | Pan position (40=center) |
| 07 | 1 | Coarse Tune | 00-7F | Coarse tuning (40=0, ±48 semi) |
| 08 | 1 | Fine Tune | 00-7F | Fine tuning (40=0, ±50 cents) |
| 09 | 1 | Output Assign | 00-08 | Individual output |
| 0A | 1 | Mute | 00-01 | Partial mute flag |

### Tone Parameters (00 03 00 00 - 00 03 7C 00)

Base address: `00 03 (tt*4) 00` where `tt` = tone number (00-1F)

**Important**: Like patches, each tone occupies a stride of 4 in the address space. Tone 0 is at `00 03 00 00`, Tone 1 is at `00 03 04 00`, etc.

| Offset | Size | Parameter | Range | Description |
|--------|------|-----------|-------|-------------|
| 00 | 8 | Tone Name | ASCII | 8-character name |
| 08 | 1 | Original Key | 00-7F | Original pitch (MIDI note) |
| 09 | 1 | Sample Rate | 00-01 | 0=15kHz, 1=30kHz |
| 0A | 3 | Start Address | - | Wave start (21-bit) |
| 0D | 3 | Loop Start | - | Loop start (21-bit) |
| 10 | 3 | Loop End | - | Loop end (21-bit) |
| 13 | 1 | Loop Mode | 00-02 | 0=Forward, 1=Alternating, 2=One-shot |
| 14 | 1 | Coarse Tune | 00-7F | Coarse tuning |
| 15 | 1 | Fine Tune | 00-7F | Fine tuning |
| 16 | 1 | Level | 00-7F | Tone level |
| 17 | 1 | TVA Attack | 00-7F | Amplitude attack time |
| 18 | 1 | TVA Decay | 00-7F | Amplitude decay time |
| 19 | 1 | TVA Sustain | 00-7F | Amplitude sustain level |
| 1A | 1 | TVA Release | 00-7F | Amplitude release time |
| 1B | 1 | TVF Cutoff | 00-7F | Filter cutoff frequency |
| 1C | 1 | TVF Resonance | 00-7F | Filter resonance |
| 1D | 1 | TVF Env Depth | 00-7F | Filter envelope depth |
| 1E | 1 | TVF Attack | 00-7F | Filter attack time |
| 1F | 1 | TVF Decay | 00-7F | Filter decay time |
| 20 | 1 | TVF Sustain | 00-7F | Filter sustain level |
| 21 | 1 | TVF Release | 00-7F | Filter release time |
| 22 | 1 | LFO Rate | 00-7F | LFO speed |
| 23 | 1 | LFO Depth | 00-7F | LFO amount |
| 24 | 1 | LFO Delay | 00-7F | LFO delay time |
| 25 | 1 | LFO Destination | 00-02 | 0=Pitch, 1=TVF, 2=TVA |

### Wave Data (01 00 00 00 - 01 7F 7F 7F)

Wave sample data is stored in a large contiguous memory block.

Base address: `01 00 00 00`

Wave data is stored as 12-bit samples packed into 7-bit MIDI bytes:
- Each 12-bit sample becomes two 7-bit bytes (high nibble, low byte)
- Samples are signed, center value = 0x800 (2048)

#### Wave Data Format

```
Sample (12-bit):  HHHH LLLL LLLL
MIDI byte 1:      0HHH HLLL L000  (bits 11-5)
MIDI byte 2:      0000 0LLL LLLL  (bits 4-0, padded)
```

## Checksum Calculation

Roland uses a running sum checksum:

```
checksum = 128 - ((sum of address bytes + sum of data bytes) & 0x7F)
```

If the result equals 128, use 0 instead.

### Example Checksum Calculation

For address `00 01 00 08` and data `40`:

```
sum = 00 + 01 + 00 + 08 + 40 = 49 (0x31)
checksum = 128 - (0x31 & 0x7F) = 128 - 49 = 79 (0x4F)
```

## Handshake Protocol

### Data Request (RQ1) Flow

```
Host                          S-330
  |                             |
  |--- RQ1 (address, size) ---->|
  |                             |
  |<---- DT1 (address, data) ---|
  |                             |
```

### Data Set (DT1) Flow

```
Host                          S-330
  |                             |
  |--- DT1 (address, data) ---->|
  |                             |
  (No response expected)
```

**WARNING**: DT1 is **silently ignored** for function parameters (address `00 01 xx xx`). The S-330 accepts the message but does not apply the change. You must use WSD/DAT/EOD protocol for writing function parameters. See "Writing Function Parameters" section below.

### Writing Function Parameters (WSD/DAT/EOD)

**DT1 does not work for function parameters**. You must use the WSD/DAT/EOD handshaking protocol.

#### WSD Message Format

```
F0 41 dev 1E 40 [address 4B] [size 4B] [checksum] F7
```

#### Minimum Size Constraints

The S-330 rejects (RJC) WSD requests with insufficient size:

| Parameter Group | Address | Minimum Size | Notes |
|-----------------|---------|--------------|-------|
| Part Patches | 00 01 00 32 | 8 | All 8 parts must be written together |
| Part Channels | 00 01 00 22 | 8 | All 8 parts must be written together |
| Part Levels | 00 01 00 56 | 8 | All 8 parts must be written together |

**Single-parameter writes (size=1) are rejected!** You must read all values, modify one, and write all back.

#### WSD/DAT/EOD Flow

```
Host                          S-330
  |                             |
  |--- WSD (addr, size) ------->|
  |                             |
  |<-------- ACK ---------------|  (or RJC if invalid)
  |                             |
  |--- DAT (addr, data) ------->|  (data is nibblized)
  |                             |
  |--- EOD -------------------->|
  |                             |
```

#### Example: Set Part A Patch to Index 1

First read all 8 part patches, then write all 8 back:

```
# Step 1: Read current values
TX: F0 41 00 1E 41 00 01 00 32 00 00 00 10 3D F7  (RQD addr=00 01 00 32, size=16 nibbles)
RX: F0 41 00 1E 42 ... [16 nibbles] ... F7        (DAT with 8 patch indices)
TX: F0 41 00 1E 43 F7                              (ACK)
RX: F0 41 00 1E 45 F7                              (EOD)

# Step 2: Send WSD
TX: F0 41 00 1E 40 00 01 00 32 00 00 00 08 45 F7  (WSD addr=00 01 00 32, size=8 bytes)
RX: F0 41 00 1E 43 F7                              (ACK - ready to receive)

# Step 3: Send DAT with nibblized data
TX: F0 41 00 1E 42 00 01 00 32 00 01 00 01 00 02 00 03 00 04 00 05 00 06 00 07 30 F7
    (DAT with modified data: Part A=1, others unchanged)

# Step 4: Send EOD
TX: F0 41 00 1E 45 F7                              (EOD)
```

### Bulk Dump (WSD/RQD/DAT) Flow

#### Sending Data to S-330

```
Host                          S-330
  |                             |
  |--- WSD (addr, size) ------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
  |--- DAT (addr, data) ------->|
  |                             |
  |--- EOD -------------------->|
  |                             |
```

**Note**: Unlike receiving, there is no ACK after DAT when sending. Just send DAT then EOD.

#### Receiving Data from S-330

**Using RQD with address/size (RECOMMENDED):**

```
Host                          S-330
  |                             |
  |--- RQD (addr, size) ------->|
  |                             |
  |<------ DAT (packet 1) ------|  (no initial ACK!)
  |                             |
  |-------- ACK --------------->|
  |                             |
  |<------ DAT (packet 2) ------|  (if more data)
  |                             |
  |-------- ACK --------------->|
  |                             |
  ...                          ...
  |                             |
  |<-------- EOD ---------------|
  |                             |
  |-------- ACK --------------->|
  |                             |
```

**Note:** The S-330 sends DAT immediately after RQD - there is no initial ACK.
See "Hardware Testing Findings" section for address/size format details.

### Bulk Dump Types

| Type | Description |
|------|-------------|
| 00 | All patches |
| 01 | All tones |
| 02 | Single patch (followed by patch number) |
| 03 | Single tone (followed by tone number) |
| 04 | Wave data (tone number) |
| 7F | All data (patches + tones + waves) |

### Error Handling

If the S-330 sends **ERR** (4E):

| Error Code | Description |
|------------|-------------|
| 00 | Checksum error |
| 01 | Unknown command |
| 02 | Wrong format |
| 03 | Memory full |
| 04 | Parameter out of range |

If the S-330 sends **RJC** (4F):
- Communication rejected (busy, not ready, etc.)
- Host should wait and retry

## Example Messages

### Request Master Tune

```
F0 41 00 1E 11 00 00 00 00 00 00 00 01 7F F7
```

Breakdown:
- `F0` - SysEx start
- `41` - Roland ID
- `00` - Device ID
- `1E` - S-330 Model ID
- `11` - RQ1 command
- `00 00 00 00` - Address (System, offset 0)
- `00 00 00 01` - Size (1 byte)
- `7F` - Checksum
- `F7` - SysEx end

### Set Patch Level to 100 (DT1 - May Not Work)

**WARNING**: DT1 is silently ignored for function parameters. Use WSD/DAT/EOD instead for addresses in bank `00 01`.

```
F0 41 00 1E 12 00 01 00 0F 64 0C F7
```

Breakdown:
- `F0` - SysEx start
- `41` - Roland ID
- `00` - Device ID
- `1E` - S-330 Model ID
- `12` - DT1 command
- `00 01 00 0F` - Address (Function params, offset 0F)
- `64` - Data (100 decimal)
- `0C` - Checksum: 128 - ((0+1+0+0F+64) & 7F) = 128 - 116 = 12 (0x0C)
- `F7` - SysEx end

**Note**: This example shows DT1 format but the S-330 may silently ignore it. Verified that function parameter writes require WSD/DAT/EOD protocol.

### Request Tone 8 Parameters (RQD with address)

```
F0 41 00 1E 41 00 02 08 00 00 00 00 4C 2A F7
```

Breakdown:
- `F0` - SysEx start
- `41` - Roland ID
- `00` - Device ID
- `1E` - S-330 Model ID
- `41` - RQD command
- `00 02 08 00` - Address (Tone 8, offset 0)
- `00 00 00 4C` - Size (76 nibbles = 38 bytes, tone parameter block)
- `2A` - Checksum: 128 - ((0+2+8+0 + 0+0+0+4C) & 0x7F) = 128 - 0x56 = 0x2A
- `F7` - SysEx end

**Important:** Both address LSB (0x00) and size LSB (0x4C) are even.

## Timing Considerations

- **Inter-byte delay**: Minimum 1ms between SysEx bytes during bulk dumps
- **ACK timeout**: Wait up to 500ms for ACK response
- **Retry**: On timeout or ERR, wait 100ms then retry (max 3 attempts)
- **Bulk transfer**: Maximum 256 bytes per DAT packet

## Hardware Testing Findings

Based on actual testing with S-330 hardware (January 2026), the following protocol behaviors were confirmed:

### RQ1/DT1 Protocol

**The S-330 DOES respond to RQ1 (0x11) data request commands** when using proper address-based requests. This is useful for reading individual parameters without handshaking.

| Command | Hardware Response | Notes |
|---------|------------------|-------|
| RQ1 | DT1 with data | Address-based read - simple, no handshake |
| DT1 | No response | **Silently ignored for function params!** |
| RQD (type only) | RJC | Old bulk dump format - rejected |
| RQD (address) | DAT | **Address-based - WORKS with handshake** |
| WSD (address) | ACK or RJC | **Required for function param writes** |

**Critical Finding**: DT1 writes are **silently ignored** for function parameters (address `00 01 xx xx`). The S-330 accepts the message but does not apply the change. You must use WSD/DAT/EOD for these addresses.

### RQD with Address/Size Format (RECOMMENDED)

**RQD works when using address and size fields** (not the old type-byte format). This allows bulk data transfer with handshaking.

```
F0 41 dev 1E 41 [address 4B] [size 4B] [checksum] F7
```

#### Critical Constraints (from Roland documentation)

> *3-1 Address and size should specify a memory space in which data exist.
> The lowest bit of LSB byte in address and size should be 0.*
>
> *3-2 The number of data bytes should be even number*

This means:
- **Address LSB must be even**: `address[3] & 0x01 == 0`
- **Size LSB must be even**: `size[3] & 0x01 == 0`
- **Size represents nibble count**, not byte count

These constraints exist because all data is nibblized. You cannot request an odd number of nibbles (half a byte).

#### Size Field Calculation

To request N logical bytes:
```
size_nibbles = N * 2
size = [0x00, 0x00, (size_nibbles >> 7) & 0x7F, size_nibbles & 0x7F]
```

Examples:
- 8-byte name: size = `[0x00, 0x00, 0x00, 0x10]` (16 nibbles)
- 64-byte block: size = `[0x00, 0x00, 0x01, 0x00]` (128 nibbles, note 7-bit encoding)

#### RQD Handshake Flow

```
Host                          S-330
  |                             |
  |--- RQD (addr, size) ------->|
  |                             |
  |<-------- DAT (data) --------|
  |                             |
  |-------- ACK --------------->|
  |                             |
  |<-------- DAT (data) --------|  (if more data)
  |                             |
  |-------- ACK --------------->|
  |                             |
  |<-------- EOD ---------------|
  |                             |
  |-------- ACK --------------->|
  |                             |
```

**Note:** No initial ACK from S-330 - it goes directly to sending DAT packets.

#### Example: Request Patch 16 Name (8 bytes)

```
Address: 00 01 10 00  (Patch 16, offset 0)
Size:    00 00 00 10  (16 nibbles = 8 bytes)
Checksum: 128 - ((00+01+10+00 + 00+00+00+10) & 0x7F) = 128 - 0x21 = 0x5F

TX: F0 41 00 1E 41 00 01 10 00 00 00 00 10 5F F7
RX: F0 41 00 1E 42 00 01 10 00 [16 nibbles] cs F7  (DAT)
TX: F0 41 00 1E 43 F7  (ACK)
RX: F0 41 00 1E 45 F7  (EOD)
TX: F0 41 00 1E 43 F7  (ACK)
```

### Data Nibblization

**All parameter data is nibblized** - each logical byte is transmitted as two nibbles:
- High nibble first (bits 7-4 in bits 3-0)
- Low nibble second (bits 3-0 in bits 3-0)

To decode: `actualByte = (highNibble << 4) | lowNibble`

To encode: `[byte >> 4, byte & 0x0F]`

### RQD/WSD Bulk Data Types (DEPRECATED)

**Note:** The old bulk dump format (RQD with just a type byte) is rejected by the S-330. Use RQD with address/size instead.

The legacy format was:
```
F0 41 dev 1E 41 tt cs F7
```

| Type | Hex | Description | Hardware Response |
|------|-----|-------------|------------------|
| All Data | 00 | Complete memory dump | RJC |
| Patch 1-32 | 01 | First 32 patches | RJC |
| Patch 33-64 | 02 | Second 32 patches | RJC |
| Tone 1-32 | 03 | First 32 tones | RJC |
| Tone 33-64 | 04 | Second 32 tones (if expanded) | RJC |
| Function | 05 | System function parameters | RJC |

**Use RQD with address/size format instead.**

### Response Codes

| Response | Hex | Meaning |
|----------|-----|---------|
| DAT | 42 | Data follows (RQD success) |
| ACK | 43 | Ready to receive (WSD success) |
| EOD | 45 | End of data transfer |
| ERR | 4E | Communication/checksum error |
| RJC | 4F | Request rejected (no data available) |

### DAT Packet Format

When RQD succeeds, the S-330 responds with DAT packets:

```
F0 41 dev 1E 42 tt cs data... checksum F7
```

The data is nibblized (2 bytes per actual byte, MSN then LSN).

### Protocol State Machine

The S-330 maintains protocol state:

1. After WSD ACK, the device expects DAT packets (RQD will be rejected)
2. After receiving complete data, the device returns to idle state
3. RQD only succeeds when relevant data exists (patches/tones loaded)
4. If no samples are loaded, RQD for tones returns RJC

### Example Captured Responses

**RQD with Address - Requesting Patch 16 Name (8 bytes):**
```
TX: F0 41 00 1E 41 00 01 10 00 00 00 00 10 5F F7
    (RQD, addr=00 01 10 00, size=00 00 00 10)
RX: F0 41 00 1E 42 00 01 10 00 [16 nibbles] cs F7  (DAT)
TX: F0 41 00 1E 43 F7  (ACK)
RX: F0 41 00 1E 45 F7  (EOD)
TX: F0 41 00 1E 43 F7  (ACK)
```

**RQD with Address - Large Range (multiple packets):**
```
TX: F0 41 00 1E 41 00 01 00 00 00 00 10 00 5F F7
    (RQD, addr=00 01 00 00, size=00 00 10 00 = 4096 nibbles)
RX: F0 41 00 1E 42 ... (DAT packet 1)
TX: F0 41 00 1E 43 F7  (ACK)
RX: F0 41 00 1E 42 ... (DAT packet 2)
TX: F0 41 00 1E 43 F7  (ACK)
... (more packets)
RX: F0 41 00 1E 45 F7  (EOD)
TX: F0 41 00 1E 43 F7  (ACK)
```

**RQD with Odd Size - Rejected:**
```
TX: F0 41 00 1E 41 00 01 10 00 00 00 00 7F xx F7
    (size LSB 0x7F is odd)
RX: F0 41 00 1E 4F F7  (RJC - rejected!)
```

**WSD Type 0 (All Data) - Ready to Receive:**
```
TX: F0 41 00 1E 40 00 00 F7
RX: F0 41 00 1E 43 F7  (ACK)
```

## Notes

### Sample Rate and Pitch

The S-330's sample rates affect pitch tracking:

| Sample Rate | Nyquist | Original Key Interpretation |
|-------------|---------|----------------------------|
| 15kHz | 7.5kHz | Key = recorded pitch |
| 30kHz | 15kHz | Key = recorded pitch |

When the sample rate doesn't match playback rate, pitch shifting is required.

### Memory Limitations

- Maximum 32 tones resident
- Maximum 64 patches resident
- Wave memory shared across all tones
- 720KB floppy holds approximately 23 seconds at 30kHz mono

### Compatibility

The S-330 shares the SysEx format with:
- **S-550** (same model ID 1E)
- **S-50** (keyboard version, same engine)
- **MKS-100** (limited subset)

Software editors for these devices are generally compatible.

## References

- Roland S-330 Owner's Manual (1987)
- Roland S-330 Service Notes
- MIDI Manufacturers Association SysEx Specification
- Roland System Exclusive Implementation Chart
