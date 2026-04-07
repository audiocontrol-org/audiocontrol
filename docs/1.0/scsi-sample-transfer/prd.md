# SCSI Sample Transfer - Product Requirements Document

**Created:** 2026-04-06
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Sample audio data cannot be transferred from the Akai S3000XL over the SCSI-over-network transport chain. The standard MIDI Sample Dump Standard (SDS) protocol requires a tight closed-loop ACK handshake per data packet: the device sends a data packet, waits for an ACK, then sends the next packet. On the SCSI bus, this handshake completes in microseconds. Over the audiocontrol network path (browser -> bridge -> s2p -> SCSI bus -> S3000XL), each ACK round trip takes approximately 500ms due to TCP reconnection, polling sleep, and HTTP overhead. The S3000XL times out waiting for the ACK after sending only 2 data packets.

This was confirmed during SCSI write validation testing: RSPACK (Akai SysEx opcode 0x0C, requesting the device to send sample data) successfully triggers SDS Data Packet responses over SCSI when using 7-bit encoding (not nibble pairs). Two data packets (F0 7E cc 02 ...) arrived before the device gave up waiting for ACK responses.

The fix is to move the entire SDS conversation (RSPACK trigger, poll for data packets, send ACK per packet, repeat until end-of-transfer) inside the s2p streaming server on the Raspberry Pi, where the ACK timing is at SCSI bus speed. The client sends a single `MSG_SAMPLE_READ` request and receives assembled PCM audio data back.

## User Stories

- As a developer, I want to retrieve sample audio data from the S3000XL over WiFi so that I can build a sample browser and preview feature in the web editor
- As a musician, I want to back up all programs AND their associated audio data from the S3000XL so that I have a complete backup, not just parameter data
- As a developer, I want to preview samples stored on the S3000XL in the browser without physical access to the device so that I can build a remote editing workflow
- As a developer, I want sample transfer to complete as a single client request so that I do not need to manage per-packet ACK timing in JavaScript or deal with transport latency constraints at the application layer

## Success Criteria

- [ ] Sample audio data retrieved from S3000XL via a single client request (`MSG_SAMPLE_READ`)
- [ ] Audio data is bit-accurate within SDS encoding constraints (16-bit samples encoded as 7-bit SDS packets, 40 samples per packet, 3 bytes each)
- [ ] Transfer completes in under 5 seconds for a typical sample (< 1 second of audio at 44100 Hz, mono)
- [ ] Transfer handles samples of varying lengths, including the maximum sample size the device can hold
- [ ] TypeScript client method returns raw PCM data suitable for playback or export
- [ ] Integration test compares SCSI-received sample audio against a known reference sample

## Scope

### In Scope

- **MSG_SAMPLE_READ handler in s2p streaming server** (C++) -- Receives a sample read request, sends RSPACK to the S3000XL via SCSI, runs the SDS ACK loop at bus speed (poll for data packet, decode, send ACK, repeat), assembles raw PCM audio, returns assembled data to the client
- **SDS Data Packet decode** -- Parse the 7-bit encoded SDS data packets (F0 7E cc 02 pp ...) and extract 16-bit PCM samples (40 samples per packet, 3 bytes each in 7-bit encoding)
- **End-of-transfer detection** -- Determine when the device has finished sending all packets (via packet count matching sample length, or device-sent termination signal)
- **Bridge endpoint** (Rust) -- New message type (`MSG_SAMPLE_READ`) passthrough or dedicated REST endpoint that forwards the request to the streaming server and relays assembled PCM back to the client
- **TypeScript client method** -- `receiveSampleViaScsi(sampleNumber)` on the S3000XL client that sends the request through the transport chain and returns PCM audio data
- **Integration test** -- Send a known sample to the device (SDS send already works), retrieve it via `MSG_SAMPLE_READ`, compare sent vs received audio data

### Out of Scope

- **Sample upload (send) via this path** -- SDS send already works over the existing transport. No need to move the send path into the streaming server.
- **Non-S3000XL devices** -- This is specific to the Akai S3000XL SCSI-over-MIDI implementation. Other devices may need different approaches.
- **Real-time audio streaming** -- This is a batch transfer (request and receive a complete sample), not a streaming audio protocol.
- **Disk image extraction** -- An alternative approach to getting sample data by reading the device's disk image over SCSI. Out of scope for this feature but remains a potential fallback.
- **Web editor UI for sample browsing** -- The client method is the deliverable; the editor UI that uses it is a separate feature.

## Dependencies

- **scsi2pi fork (s2p streaming server)** -- The MSG_SAMPLE_READ handler must be implemented in the C++ streaming server that runs on the Pi. This is the core of the feature.
- **scsi-midi-bridge** (Rust) -- Must support routing the new message type between the HTTP client and the streaming server.
- **midi-core transport** -- The TypeScript SCSI MIDI transport that communicates with the bridge over HTTP.
- **sampler-devices** -- The S3000XL client where the `receiveSampleViaScsi` method lives.
- **Raspberry Pi with SCSI connection** -- Physical hardware: Pi running s2p connected to S3000XL via SCSI bus.
- **SCSI e2e provisioning pipeline** -- Cross-compilation, deployment, and daemon management handled by the shared e2e infrastructure.

## Open Questions

- [ ] Does the S3000XL send a SDS Dump Header (F0 7E cc 01 ...) before the Data Packets in response to RSPACK, or does it go straight to Data Packets? The Dump Header contains sample rate, bit depth, and sample length which are needed to know how many packets to expect.
- [ ] How does the device signal end of transfer? Options: (a) the client calculates expected packet count from the sample header's length field, (b) the device sends a specific termination message, (c) the device simply stops sending and the server detects a timeout.
- [ ] What is the maximum sample size that can be transferred in a single MSG_SAMPLE_READ request? The S3000XL has 32MB RAM; a full-length mono sample at 44100 Hz / 16-bit could be ~16 seconds (~1.4MB of audio). Does the streaming server need to handle back-pressure or chunked delivery?
- [ ] What RSPACK encoding mode triggers the correct SDS response? Initial testing confirmed 7-bit encoding works (not nibble pairs). Need to verify this is consistent across sample sizes.
- [ ] Should the streaming server return raw PCM bytes, or should it include a header with sample rate, bit depth, and length metadata? Returning metadata avoids requiring the client to fetch the sample header separately.

## Appendix

### Architecture

```
Client (browser/Node.js)
    │
    │  HTTP POST /sample/read { sampleNumber: N }
    │
    ▼
scsi-midi-bridge (Rust, port 7033)
    │
    │  MSG_SAMPLE_READ (protobuf/binary)
    │
    ▼
s2p streaming server (C++, port 6870)
    │
    │  ┌─── Internal SDS conversation (microsecond timing) ───┐
    │  │                                                       │
    │  │  RSPACK (F0 47 cc 0C nn F7)  ──SCSI──►  S3000XL     │
    │  │                                                       │
    │  │  ACK    (F0 7E cc 7F pp F7)  ◄──SCSI──  Data Pkt 0  │
    │  │  ACK    (F0 7E cc 7F pp F7)  ◄──SCSI──  Data Pkt 1  │
    │  │  ...                                                  │
    │  │  ACK    (F0 7E cc 7F pp F7)  ◄──SCSI──  Data Pkt N  │
    │  │                                                       │
    │  └───────────────────────────────────────────────────────┘
    │
    │  Assembled PCM audio data
    │
    ▼
scsi-midi-bridge (Rust, port 7033)
    │
    │  HTTP response: PCM bytes + metadata
    │
    ▼
Client (browser/Node.js)
```

### SDS Data Packet Format

Per MIDI SDS specification:

```
F0 7E cc 02 pp <120 data bytes> cs F7

cc = channel (device exclusive channel)
02 = Data Packet opcode
pp = running packet count (0-127, wraps)
data bytes = 120 bytes encoding 40 x 3-byte samples (7-bit encoding)
cs = XOR checksum of pp + data bytes
```

Each 3-byte sample group in 7-bit encoding:
- Byte 0: bits 15-9 of sample (high 7 bits)
- Byte 1: bits 8-2 of sample (middle 7 bits)
- Byte 2: bits 1-0 of sample shifted left 5 (low 2 bits in high position)

### Confirmed Findings from SCSI Write Validation

From the `scsi-write-validation` implementation:

1. **RSPACK with 7-bit encoding works** -- Sending RSPACK (opcode 0x0C) with 7-bit encoding selector correctly triggers the S3000XL to begin sending SDS Data Packets over SCSI.
2. **Data Packets arrive on SCSI bus** -- Two SDS Data Packets (F0 7E cc 02 ...) were observed before the device timed out.
3. **Timeout after 2 packets** -- The device expects an ACK (F0 7E cc 7F pp F7) within its timeout window. The ~500ms network round trip is too slow.
4. **Transport overhead breakdown** -- Per the latency findings: 87% of round-trip time is overhead (polling sleep + TCP reconnection). Actual SCSI bus operation is ~112ms. The ACK must happen at the SCSI layer, not the application layer.
