# MIDI Sample Dump Standard (SDS) Support - Product Requirements Document

**Created:** 2026-03-31
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol project supports multiple hardware samplers (Roland S-330, S-550, Akai S3000XL), each with its own proprietary SysEx protocol for transferring sample data over MIDI. The Roland devices use a proprietary RQD/WSD/DAT handshake, and the Akai S3000XL uses its own RSPACK/ASPACK opcodes. There is no shared, device-agnostic sample transfer layer.

The MIDI Sample Dump Standard (SDS) is an industry-standard protocol (adopted January 1986 by the MMA and JMSC) that defines a universal method for transferring audio sample data between any MIDI-equipped devices. SDS uses Non-Real Time Universal SysEx messages (ID `0x7E`) and supports both open-loop (fire-and-forget) and closed-loop (handshaked) transfer modes.

Adding a generic SDS implementation to `shared-midi` would:

1. Enable sample transfer with any SDS-compatible device without writing device-specific code
2. Provide a reference implementation for the SDS protocol that other modules can build on
3. Enable the Akai S3000XL sample editor to send and receive sample data (the S3000XL supports SDS in addition to its proprietary protocol)

## User Stories

- As a musician, I want to transfer samples from my computer to my S3000XL over MIDI so that I can load custom sounds without using floppy disks or SCSI
- As a musician, I want to receive samples from my S3000XL to my computer over MIDI so that I can back up and edit sounds in the browser
- As a developer, I want a generic SDS implementation so that I can add sample transfer to any SDS-compatible device without reimplementing the protocol
- As a developer, I want progress callbacks during sample transfers so that I can show transfer progress in the UI
- As a musician, I want reliable transfers with error detection so that corrupted samples are caught and retransmitted automatically

## Success Criteria

- [ ] Generic SDS message builder/parser handles all 7 SDS message types (Dump Header, Data Packet, Dump Request, ACK, NAK, WAIT, CANCEL)
- [ ] Closed-loop sender transmits sample data with handshaking (ACK/NAK/WAIT/CANCEL handling)
- [ ] Closed-loop receiver accepts sample data with handshaking (sends ACK/NAK per packet)
- [ ] Open-loop sender transmits sample data without handshaking
- [ ] Checksum validation detects corrupted packets and triggers NAK/retransmit
- [ ] Sample format encoding/decoding supports 8-28 bit sample widths
- [ ] 7-bit MIDI encoding correctly packs/unpacks sample data for any bit depth
- [ ] Progress callbacks report transfer progress (packet count, bytes transferred)
- [ ] S3000XL sample editor can send samples to the device via SDS
- [ ] S3000XL sample editor can receive samples from the device via SDS
- [ ] Unit tests cover message building, parsing, encoding, checksums, and transfer state machines

## Scope

### In Scope

- Generic SDS protocol implementation in `shared-midi` module
  - Message builders for all 7 SDS message types
  - Message parsers for all 7 SDS message types
  - 7-bit MIDI sample data encoding/decoding (8-28 bit sample widths)
  - Checksum calculation and validation
  - Closed-loop transfer state machine (sender and receiver)
  - Open-loop transfer (sender only)
  - Configurable timeouts and retry counts
  - Progress callbacks
- Integration into Akai S3000XL client (`sampler-devices`)
  - Send sample to device via SDS
  - Receive sample from device via SDS
  - Wire into existing request serialization queue
- S3000XL sample editor UI for sample transfer
  - Send/receive buttons on sample header view
  - Transfer progress indicator
  - Error reporting

### Out of Scope

- Sample Dump Standard extensions (Sample Name, Sample Header Extension) - future enhancement
- Replacing existing Roland S-series proprietary transfer protocol with SDS (the Roland protocol is device-specific and optimized for those devices)
- MIDI file format (.sds file) import/export
- Sample rate conversion during transfer
- Sample format conversion (bit depth changes) during transfer

## Dependencies

- `shared-midi` module (host for generic SDS implementation)
- `sampler-devices` S3000XL client (integration point)
- `akai-s3k-editor` module (UI integration)
- Web MIDI API (browser) or Node.js MIDI backend (CLI)

## Open Questions

- [ ] Does the S3000XL require any proprietary handshake before accepting SDS transfers, or does it accept standard SDS messages directly?
- [ ] What is the maximum packet size the S3000XL can buffer for SDS transfers?
- [ ] Should the generic SDS implementation live in `shared-midi` or a new `midi-sds` module?
- [ ] Do we need to support the extended SDS messages (Sample Name Transmission, Sample Header Extension) for the S3000XL?

## Appendix

### MIDI SDS Protocol Summary

**Message Types:**

| Message | Command | Direction | Purpose |
|---------|---------|-----------|---------|
| Dump Header | `0x01` | Sender -> Receiver | Sample metadata (format, rate, length, loops) |
| Data Packet | `0x02` | Sender -> Receiver | 120 bytes of encoded sample data per packet |
| Dump Request | `0x03` | Requester -> Sender | Request a specific sample by number |
| ACK | `0x7F` | Receiver -> Sender | Packet received successfully |
| NAK | `0x7E` | Receiver -> Sender | Packet corrupted, retransmit |
| WAIT | `0x7C` | Receiver -> Sender | Pause transmission |
| CANCEL | `0x7D` | Receiver -> Sender | Abort transfer |

**All messages use Universal Non-Real Time SysEx format:**
```
F0 7E cc <command> [data...] F7
```

**Dump Header format (21 bytes):**
```
F0 7E cc 01 sl sh ee pl pm ph al am ah bl bm bh cl cm ch tt F7
```

| Field | Bytes | Description |
|-------|-------|-------------|
| `sl`, `sh` | 2 | Sample number (LSB, MSB; max 16384) |
| `ee` | 1 | Sample format: bits per word (8-28) |
| `pl`, `pm`, `ph` | 3 | Sample period in nanoseconds (3x 7-bit; 1,000,000,000 / sample_rate) |
| `al`, `am`, `ah` | 3 | Sample length in words (3x 7-bit, 21-bit max) |
| `bl`, `bm`, `bh` | 3 | Sustain loop start point (3x 7-bit) |
| `cl`, `cm`, `ch` | 3 | Sustain loop end point (3x 7-bit) |
| `tt` | 1 | Loop type (0x00=forward, 0x01=forward-backward, 0x7F=off) |

**Data Packet format (127 bytes):**
```
F0 7E cc 02 kk <120 bytes data> cs F7
```

- `kk`: Running packet count (0x00-0x7F, wraps)
- 120 bytes of 7-bit encoded sample data
- `cs`: Checksum (XOR of bytes from `0x7E` through all 120 data bytes)

**7-bit data encoding:** Each sample word is left-justified into ceil(bits/7) MIDI bytes. For 16-bit samples, 3 MIDI bytes encode 2 data bytes (21 usable bits, 5 unused bits zeroed).

**Transfer modes:**
- **Open loop:** Sender transmits header + all packets with no handshaking
- **Closed loop:** Receiver sends ACK/NAK/WAIT/CANCEL after each packet; sender waits for response before continuing

### Reference

- [MIDI Sample Dump Standard](http://www.4front-tech.com/pguide/midi/midi8.html) (4Front Technologies)
- [SDS Technical Reference](http://midi.teragonaudio.com/tech/sds.htm) (Teragon Audio)
