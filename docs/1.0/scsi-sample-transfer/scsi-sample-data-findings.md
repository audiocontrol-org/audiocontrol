# SCSI Sample Data Transfer — Investigation Findings

**Date:** 2026-04-06

## Summary

Investigated how to retrieve sample audio data from the Akai S3000XL over the SCSI MIDI-via-SCSI channel. The goal: read PCM waveform data, not just metadata headers.

## What Works Over SCSI

| Operation | Opcode | Direction | Status |
|-----------|--------|-----------|--------|
| All metadata (RPLIST, RSLIST, RPDATA, RKDATA, RSDATA, RMDATA) | Various | Request→Response | **Works** |
| Parameter writes (PDATA, KDATA, SDATA, MDATA) | Various | Write→REPLY | **Works** |
| SDS sample SEND (upload to device) | Standard SDS | Client→Device | **Works** |
| SDS Dump Request | `F0 7E cc 03 ss ss F7` | Request→Response | **Returns Dump Header** |
| Front panel dump (device-initiated) | N/A | Device→Pi | **SDS Data Packets arrive** |

## What Doesn't Work Over SCSI

| Operation | Opcode | What Happens |
|-----------|--------|-------------|
| RSPACK (Akai sample data request) | `0x0C` | Device accepts message (no error), returns 0 bytes via MIDI_POLL |
| SDS Data Packets after Dump Request | Standard SDS | Dump Header arrives but no Data Packets follow — ACK timing too slow over network |

## Detailed Findings

### RSPACK (Akai opcode 0x0C)

Tested multiple parameter encodings:
- **7-bit encoding** (per S1000 SysEx spec): No response
- **Nibble encoding** (matching other Akai commands): No response
- **Minimal** (just sample number): No response
- **Raw bytes** (no encoding): No response

The device accepts the RSPACK message without returning an error (no REPLY opcode 0x16), but never puts response data on the MIDI_POLL channel. Tested with fresh MIDI_INIT, verified device responsiveness with RSLIST before and after.

**Conclusion:** RSPACK does not produce sample audio data over the MIDI-via-SCSI channel on the S3000XL.

### Standard SDS Dump Request

```
F0 7E 00 03 00 00 F7
```

The device responds with a **SDS Dump Header** (`F0 7E 00 01 ...`) via MIDI_POLL. This confirms:
- The device receives and processes the Dump Request
- The SDS Dump Header is routed through the MIDI-via-SCSI response buffer
- The device is ready to send sample data

However, the subsequent SDS Data Packets require a tight ACK handshake (ACK after each 127-byte packet). When ACKs are sent over the network (~100-500ms round-trip), the device times out waiting. When the front panel triggers a dump, Data Packets DO arrive — confirming the SCSI channel CAN carry them.

### Front Panel Dump

When the user initiates a sample dump from the S3000XL's front panel:
- SDS Data Packets (`F0 7E cc 02 pp ...`) arrive as pending bytes on MIDI_POLL
- Packets are 127 bytes each, arriving at intervals
- The device expects ACK responses but s2p wasn't sending them
- The s2p log showed 176, 184, 192, 200 pending bytes in successive polls

This proves the SCSI MIDI channel CAN carry SDS Data Packets. The issue is ACK timing, not a protocol limitation.

## Architecture Constraint

The ACK handshake must happen at SCSI bus speed (microseconds), not network speed. The current architecture sends each ACK through:
```
Node.js → HTTP → bridge → streaming server → QueueMidiCommand → main loop → SCSI bus
```

Each hop adds latency. The solution (per the scsi-sample-transfer PRD) is to implement the SDS ACK loop inside the s2p streaming server, where ACKs execute locally at bus speed.

## Next Steps

1. **Implement SDS receive in s2p streaming server** — MSG_SAMPLE_READ sends SDS Dump Request, handles ACK loop internally, returns assembled PCM
2. **Alternative: SCSI block reads** — Use SCSI READ(10) commands to read sample data directly from device memory at SLOCAT address (untested, requires understanding S3000XL memory layout)
3. **Test RSPACK over DIN MIDI** — Verify whether RSPACK works over standard MIDI to confirm this is a SCSI-specific limitation vs a protocol issue

## S3000 Protocol Mode Findings (2026-04-10)

The S3000XL front panel has a "Sample Protocol" setting: **Standard** (SDS) vs **S3000**. This setting is NOT stored in MiscellaneousData (RMDATA bytes are identical in both modes). It may be volatile or stored in a different data block.

### ASPACK (opcode 0x0D) — Write Sample Data

**Works in both Standard and S3000 modes.** ASPACK writes PCM sample data to an existing sample in device memory.

Format:
```
F0 47 cc 0D 48 [sample_num 4 nibbles] [offset 8 nibbles] [count 8 nibbles] [data: count × 4 nibbles] F7
```

- Sample number, offset, and count are nibble-encoded (LE, 4 nibbles per u16, 8 nibbles per u32)
- Each 16-bit PCM sample is 4 nibbles (LE nibble pairs)
- Device returns REPLY (opcode 0x16, status 0x01) on success
- **Cannot create new samples** — only overwrites data in existing sample slots
- **Multi-chunk writes work** but only within the sample's allocated memory. Writing beyond the allocated length returns empty reply. Failure occurs consistently at the allocation boundary (e.g., offset 8448 for a sample created with ~8000 samples).
- **Single-chunk writes can exceed allocated length** — sending the entire sample in one ASPACK appears to trigger reallocation. A 44100-sample single-chunk write succeeds even on a sample originally allocated smaller.
- **CDB poll flag must be 0x00** — using flag `$80` on CDB 0x0D (Data Byte Enquiry) returns 0 bytes. This was the cause of the original "multi-chunk fails" bug. The S3000XL only reports pending bytes with flag `$00`.
- **CDB send flag must be 0x00** — using flag `$80` on CDB 0x0C (Send MIDI Data) causes the device to not generate a REPLY at all. MESA documentation says `$80` means "reply expected" but the S3000XL behaves opposite — `$00` is required for ASPACK.

Throughput (via raw SCSI CDBs, MIDI mode kept enabled):

| Chunk size | Per-chunk | Throughput |
|-----------|-----------|-----------|
| 48 samples | 229ms | 0.4 KB/s |
| 768 samples | 286ms | 4.3 KB/s |
| 6144 samples | 533ms | 12.1 KB/s |
| 44100 samples | 3564ms | **23.4 KB/s** |

Per-chunk overhead is ~230ms (2 SCSI CDB calls: send + read reply). Larger chunks amortize this overhead. **At 23 KB/s, ASPACK is 10.6x faster than batched SDS (2.2 KB/s).**

A 1-second 44.1kHz sample (86 KB) transfers in ~3.6 seconds via ASPACK vs ~40 seconds via batched SDS.

### RSPACK (opcode 0x0C) — Read Sample Data

**Only works in S3000 mode.** Returns 0 bytes in Standard mode (confirmed).

In S3000 mode, RSPACK triggers the device to send sample data as **SDS Data Packets** (F0 7E cc 02 ...), not Akai proprietary format. The response appears on the MIDI poll buffer.

Format:
```
F0 47 cc 0C 48 [sample_num 4 nibbles] [offset 8 nibbles] [count 8 nibbles] [interval 2 nibbles] F7
```

**Warning:** RSPACK in S3000 mode starts a persistent SDS data dump. If the dump is not properly consumed (all packets read + ACKs sent), the device continues sending data packets indefinitely. This floods the MIDI buffer and blocks all other SysEx operations. Recovery requires:
1. Disable MIDI mode (CDB 0x09) — sometimes sufficient
2. Power cycle — if the dump state persists after MIDI mode toggle

### Batched SDS Findings

SDS data packets can be batched: send N packets concatenated in a single CDB 0x0C, then read all N ACKs in a single CDB 0x0E. The S3000XL processes them sequentially and returns all ACKs.

| Batch size | Per-packet | Speedup vs single |
|-----------|-----------|---------|
| 1 | 227ms | 1x |
| 10 | 35ms | 6.6x |
| 20 | 25ms | **9.2x** |
| 50 | 35ms | 6.5x (ACK read too large) |

Batch 20 is the sweet spot. Full bridge path throughput: **2.2 KB/s** (6.3x faster than unbatched).

### SDS + ASPACK Hybrid (Untested Fully)

Hypothesis: create sample via SDS (which allocates memory and registers the sample in RSLIST), then overwrite with real PCM data via ASPACK for speed.

Tested:
- SDS dump header creates the sample slot ✓
- ASPACK at offset 0 accepted after SDS header ✓
- ASPACK at offset > 0 fails after SDS header ✗
- Sample not registered in RSLIST until SDS transfer completes ✗

The SDS protocol must complete (all data packets sent) for the sample to appear in RSLIST. Partial SDS + ASPACK does not register the sample. Full SDS followed by ASPACK overwrite may work but requires the full SDS transfer time.

### SCSI CDB Timing

Each s2p SCSI command takes ~113ms:
- TCP connect: 2-3ms
- Send: <1ms
- **Receive (s2p SCSI bus execution): 109-113ms** — this is the bottleneck

The 113ms is the s2p protobuf API overhead for executing one SCSI CDB. The actual SCSI bus transaction is fast; the overhead is in s2p's command processing pipeline.

### Streaming MIDI Port (6870) — Dead End

s2p's streaming MIDI port uses persistent TCP with MSG_SEND/MSG_DATA framing. Tested for SDS — the port does NOT relay device ACK responses back to the client. Only forwards client→device data, not device→client responses. Filed as issue #183 for deletion.

## Open Questions

- Can ASPACK write at offset > 0? The multi-chunk failure may be an encoding issue, not a protocol limitation. MESA II uses 192-byte chunks with offset addressing — it must work somehow.
- Does MESA II use SDS to create samples, or does it use a different mechanism (e.g., NewSample SysEx command)?
- Is there an Akai SysEx command to create an empty sample of a given size without SDS?
- What is the maximum ASPACK message size the S3000XL accepts?
- Can the "Sample Protocol" mode be toggled via SysEx, or is it front-panel only?
