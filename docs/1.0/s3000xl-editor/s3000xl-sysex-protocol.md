# Akai S3000XL SysEx Protocol Reference

Reverse-engineered protocol documentation for the Akai S3000XL sampler's MIDI SysEx and SCSI MIDI interfaces. Based on the [S1000 SysEx specification](https://lakai.sourceforge.net/docs/s1000_sysex.html), hardware testing, and [MESA II binary analysis](../scsi-midi-bridge/mesa-ii-analysis.md).

## Message Format

All Akai SysEx messages follow:
```
F0 47 cc op 48 [data...] F7

F0    — SysEx start
47    — Akai manufacturer ID
cc    — Exclusive channel (0-based; front panel shows 1-based)
op    — Opcode (see table below)
48    — S3000XL device ID
data  — Opcode-specific payload
F7    — SysEx end
```

## Opcodes

### Request/Response (Control Plane)

| Opcode | Hex | Name | Direction | Description |
|--------|-----|------|-----------|-------------|
| RSTAT | 0x00 | Request status | Request→Response | Device status |
| RPLIST | 0x02 | Request program list | Request→Response | List of program names |
| RSLIST | 0x04 | Request sample list | Request→Response | List of sample names |
| RPDATA | 0x06 | Request program data | Request→Response | Full program header |
| RKDATA | 0x08 | Request keygroup data | Request→Response | Full keygroup header |
| RSDATA | 0x0A | Request sample header | Request→Response | Sample metadata (not audio) |
| RMDATA | 0x0E | Request misc data | Request→Response | Global/miscellaneous settings |

### Write (Control Plane)

| Opcode | Hex | Name | Direction | Description |
|--------|-----|------|-----------|-------------|
| STAT | 0x01 | Status data | Response | Response to RSTAT |
| PLIST | 0x03 | Program list data | Response | Response to RPLIST |
| SLIST | 0x05 | Sample list data | Response | Response to RSLIST |
| PDATA | 0x07 | Program data | Write→REPLY | Write program header |
| KDATA | 0x09 | Keygroup data | Write→REPLY | Write keygroup header |
| SDATA | 0x0B | Sample header data | Write→REPLY | Write sample metadata |
| MDATA | 0x0F | Misc data | Write→REPLY | Write global settings |
| REPLY | 0x16 | Reply | Response | Acknowledgement (status byte follows) |

### Sample Data Transfer (Data Plane)

| Opcode | Hex | Name | Direction | Description |
|--------|-----|------|-----------|-------------|
| RSPACK | 0x0C | Request sample packets | Request→SDS Data | Request PCM audio data |
| ASPACK | 0x0D | Accept sample packets | Write→REPLY | Write PCM audio data |

### Item Management

| Opcode | Hex | Name | Direction | Description |
|--------|-----|------|-----------|-------------|
| DELP | 0x12 | Delete program | Write→REPLY | Delete program by index |
| DELK | 0x14 | Delete keygroup | Write→REPLY | Delete keygroup |
| DELS | 0x10 | Delete sample | Write→REPLY | Delete sample by index |

## Data Encoding

### Item Numbers (Request Opcodes)

Item numbers in request opcodes (RPDATA, RKDATA, RSDATA, DELP, DELK, DELS) use **7-bit encoding**, LSB first:

```
item 22 → [22 & 0x7F, (22 >> 7) & 0x7F] → [0x16, 0x00]
```

**Not nibble encoding.** Using nibble encoding for item numbers works for indices 0-15 but silently fails for index 16+.

### Header Data (Response/Write Payloads)

Parameter data within PDATA, KDATA, SDATA, MDATA payloads uses **nibble encoding** (4-bit), low nibble first:

```
byte 0xAB → [0x0B, 0x0A]
```

### Sample Audio Data (ASPACK)

PCM samples in ASPACK use **nibble encoding** per 16-bit sample word:

```
sample 0x1234 → [0x04, 0x03, 0x02, 0x01]  (4 nibbles, LE)
```

## ASPACK — Write Sample Audio Data

Writes PCM audio data to an existing sample in device memory.

### Message Format

```
F0 47 cc 0D 48 [sample_num 4n] [offset 8n] [count 8n] [data: count × 4n] F7

sample_num — Sample index (nibble-encoded, 2 bytes = 4 nibbles)
offset     — Start position in samples (nibble-encoded, 4 bytes = 8 nibbles)
count      — Number of samples (nibble-encoded, 4 bytes = 8 nibbles)
data       — PCM samples, each 16-bit word as 4 nibbles (LE)
```

### Behavior

- Returns REPLY (0x16) with status 0x01 on success
- **Cannot create new samples** — only writes to existing sample slots
- Multi-chunk writes (offset > 0) currently fail with empty reply (may be encoding issue)
- Single-chunk writes at offset 0 work reliably up to at least 44100 samples
- Works in both "Standard" and "S3000" protocol modes

### Throughput

Via raw SCSI CDBs (MIDI mode kept enabled, no per-request overhead):

| Chunk size | Throughput | Notes |
|-----------|-----------|-------|
| 48 samples | 0.4 KB/s | |
| 768 samples | 4.3 KB/s | |
| 6144 samples | 12.1 KB/s | |
| 44100 samples | **23.4 KB/s** | 10.6x faster than batched SDS |

Per-chunk overhead: ~230ms (2 SCSI CDB calls via s2p). Larger chunks amortize this.

## RSPACK — Request Sample Audio Data

Requests PCM audio data from the device.

### Message Format

```
F0 47 cc 0C 48 [sample_num 4n] [offset 8n] [count 8n] [interval 2n] F7

sample_num — Sample index (nibble-encoded, 2 bytes = 4 nibbles)
offset     — Start position in samples (nibble-encoded, 4 bytes = 8 nibbles)
count      — Number of samples (nibble-encoded, 4 bytes = 8 nibbles)
interval   — 0=single, 1=average, 2=peak (nibble-encoded, 1 byte = 2 nibbles)
```

### Behavior

- **Only works in S3000 protocol mode** (front panel setting). Returns 0 bytes in Standard mode.
- Response is **SDS Data Packets** (F0 7E cc 02 ...), not Akai proprietary format
- Triggers a persistent SDS data dump — device keeps sending packets until all data is consumed or MIDI mode is disabled
- **Warning:** Incomplete consumption of the dump floods the MIDI buffer and blocks all SysEx operations. May require power cycle to recover.

## Sample Protocol Mode

The S3000XL front panel "Sample Protocol" setting controls RSPACK behavior:

| Mode | RSPACK | ASPACK | SDS Upload | SDS Download |
|------|--------|--------|-----------|-------------|
| Standard | ✗ No response | ✓ Works | ✓ Works | Partial (header only) |
| S3000 | ✓ Returns SDS packets | ✓ Works | ✓ Works | Untested |

This setting is **NOT stored in MiscellaneousData** (RMDATA bytes are identical in both modes). It may be volatile or stored in a separate configuration block. No SysEx command to toggle it has been identified.

## SCSI MIDI Interface

The S3000XL's SCSI MIDI interface uses vendor-specific CDBs:

| CDB | Name | Description |
|-----|------|-------------|
| 0x09 | MIDI Init | Enable (01) or disable (00) MIDI-over-SCSI mode |
| 0x0C | MIDI Send | Send MIDI/SysEx data to device |
| 0x0D | MIDI Poll | Query pending response byte count (returns 3-byte count) |
| 0x0E | MIDI Read | Read pending MIDI response data |

MIDI mode must be enabled (CDB 0x09) before any MIDI/SysEx communication. While enabled, serial MIDI ports on the device are blocked.

## SDS (MIDI Sample Dump Standard)

Standard SDS is used for sample upload to device. The S3000XL supports closed-loop SDS with per-packet ACK handshake.

### Handshake Messages

```
F0 7E cc 7F pp F7 — ACK (continue to next packet)
F0 7E cc 7E pp F7 — NAK (resend packet)
F0 7E cc 7D pp F7 — Cancel (abort transfer)
F0 7E cc 7C pp F7 — Wait (pause, then resume)
```

### Batching

Multiple SDS data packets can be concatenated into a single SCSI MIDI send (CDB 0x0C), and all ACKs read in a single read (CDB 0x0E). Batch of 20 gives ~9x speedup over single-packet flow. Batch of 50 exceeds the read buffer.

### Throughput

| Method | Throughput | Notes |
|--------|-----------|-------|
| Single packet SDS | ~350 bytes/s | 227ms per packet |
| Batched SDS (20) | **2.2 KB/s** | 25ms per packet effective |
| ASPACK (large chunk) | **23.4 KB/s** | 10.6x faster than batched SDS |

## References

- [S1000 SysEx Specification](https://lakai.sourceforge.net/docs/s1000_sysex.html)
- [MESA II Binary Analysis](../scsi-midi-bridge/mesa-ii-analysis.md)
- [SCSI Sample Transfer Findings](../scsi-sample-transfer/scsi-sample-data-findings.md)
