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

## Open Questions

- Does RSPACK work over DIN MIDI on the S3000XL, or is it S1000-only?
- What is the S3000XL's ACK timeout window for SDS? (determines minimum bus speed required)
- Can the s2p main loop service MIDI_SEND (ACK) fast enough between WaitForSelection iterations?
- Does the device mode (STANDARD vs AKAI in Global menu) affect RSPACK behavior?
