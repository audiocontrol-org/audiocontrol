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

The S-330 uses a 4-byte address space organized hierarchically:

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

### Patch Parameters (00 01 00 00 - 00 01 7F 7F)

Base address: `00 01 pp 00` where `pp` = patch number (00-3F)

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

### Tone Parameters (00 02 00 00 - 00 02 1F 7F)

Base address: `00 02 tt 00` where `tt` = tone number (00-1F)

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

### Bulk Dump (WSD/RQD/DAT) Flow

#### Sending Data to S-330

```
Host                          S-330
  |                             |
  |--- WSD (type) ------------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
  |--- DAT (packet 1) --------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
  |--- DAT (packet 2) --------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
  ...                          ...
  |                             |
  |--- EOD -------------------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
```

#### Receiving Data from S-330

```
Host                          S-330
  |                             |
  |--- RQD (type) ------------->|
  |                             |
  |<-------- ACK ---------------|
  |                             |
  |<------ DAT (packet 1) ------|
  |                             |
  |-------- ACK --------------->|
  |                             |
  |<------ DAT (packet 2) ------|
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

### Set Patch Level to 100

```
F0 41 00 1E 12 00 01 00 0F 64 0C F7
```

Breakdown:
- `F0` - SysEx start
- `41` - Roland ID
- `00` - Device ID
- `1E` - S-330 Model ID
- `12` - DT1 command
- `00 01 00 0F` - Address (Patch 0, Level offset)
- `64` - Data (100 decimal)
- `0C` - Checksum: 128 - ((0+1+0+0F+64) & 7F) = 128 - 116 = 12 (0x0C)
- `F7` - SysEx end

### Request Single Tone Dump

```
F0 41 00 1E 41 03 00 F7
```

Breakdown:
- `F0` - SysEx start
- `41` - Roland ID
- `00` - Device ID
- `1E` - S-330 Model ID
- `41` - RQD command
- `03` - Type (single tone)
- `00` - Tone number 0
- `F7` - SysEx end

## Timing Considerations

- **Inter-byte delay**: Minimum 1ms between SysEx bytes during bulk dumps
- **ACK timeout**: Wait up to 500ms for ACK response
- **Retry**: On timeout or ERR, wait 100ms then retry (max 3 attempts)
- **Bulk transfer**: Maximum 256 bytes per DAT packet

## Hardware Testing Findings

Based on actual testing with S-330 hardware, the following protocol behaviors were confirmed:

### RQ1/DT1 vs RQD/WSD Protocol

**Important:** The S-330 does NOT respond to RQ1 (0x11) data request commands. Instead, it exclusively uses the handshake-based RQD/WSD protocol for data transfer.

| Command | Hardware Response | Notes |
|---------|------------------|-------|
| RQ1 | No response | Not supported on S-330 |
| DT1 | No response | Write-only, no ACK returned |
| RQD | DAT, RJC, or ERR | Returns data or rejection |
| WSD | ACK or RJC | Ready to receive or rejection |

### RQD/WSD Data Types

The RQD and WSD commands use a data type byte with checksum:

```
F0 41 dev 1E 41/40 tt cs F7
```

Where:
- `tt` = Data type
- `cs` = Checksum: `(128 - tt) & 0x7F`

| Type | Hex | Description |
|------|-----|-------------|
| All Data | 00 | Complete memory dump |
| Patch 1-32 | 01 | First 32 patches |
| Patch 33-64 | 02 | Second 32 patches |
| Tone 1-32 | 03 | First 32 tones |
| Tone 33-64 | 04 | Second 32 tones (if expanded) |
| Function | 05 | System function parameters |

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

**RQD Type 1 (Patch 1-32) - Success:**
```
TX: F0 41 00 1E 41 01 7F F7
RX: F0 41 00 1E 42 01 7F [128 bytes nibblized patch data] cs F7
```

**WSD Type 0 (All Data) - Ready to Receive:**
```
TX: F0 41 00 1E 40 00 00 F7
RX: F0 41 00 1E 43 F7  (ACK)
```

**RQD Type 3 (Tone 1-32) - No Data Available:**
```
TX: F0 41 00 1E 41 03 7D F7
RX: F0 41 00 1E 4F F7  (RJC)
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
