# SCSI Sample Transfer - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Implement a `MSG_SAMPLE_READ` handler in the s2p streaming server (C++) that runs the full SDS receive conversation at SCSI bus speed. The handler sends RSPACK to trigger the S3000XL, then enters a tight loop: poll for a data packet, decode the 7-bit encoded PCM samples, send an ACK, repeat until all packets are received. The assembled PCM audio is returned to the client as a single response.

This moves the timing-critical ACK handshake from the network layer (where it fails due to ~500ms latency) to the SCSI bus layer (where it completes in microseconds). The client sees a simple request/response interface with no knowledge of the underlying SDS packet protocol.

**Key architectural decisions:**

- **ACK loop lives in s2p** -- The streaming server is the only component with direct SCSI bus access and microsecond-level timing. The SDS conversation must happen entirely within this process.
- **Single request/response from client** -- The bridge and client see `MSG_SAMPLE_READ(sampleNumber) -> PCM data`. No per-packet interaction crosses the network boundary.
- **PCM assembly in the streaming server** -- The server decodes 7-bit SDS packets to 16-bit PCM and returns raw audio bytes. This avoids shipping SDS-encoded data over the network and requiring every client to implement SDS decode.
- **Metadata in response** -- The response includes sample rate, bit depth, and sample count alongside the PCM data, so the client does not need a separate header fetch.
- **Existing SDS send path unchanged** -- Sample upload (send) already works over the current transport. Only the receive (download) path needs the server-side ACK loop.

## Implementation Phases

### Phase 1: MSG_SAMPLE_READ in s2p Streaming Server (C++)

Implement the core SDS receive loop in the streaming server that runs on the Raspberry Pi.

#### 1.1 Define MSG_SAMPLE_READ Message Format

Define the request and response message types for the streaming server protocol.

**Request:**
- Message type: `MSG_SAMPLE_READ`
- Payload: sample number (uint16), exclusive channel (uint8), encoding mode (uint8, default 7-bit)

**Response:**
- Message type: `MSG_DATA`
- Payload: sample rate (uint32), bit depth (uint8), sample count (uint32), PCM data (byte array)
- Error response: `MSG_ERROR` with error code and description

#### 1.2 Implement RSPACK Trigger

Send the RSPACK SysEx message to the S3000XL to request sample data.

```
F0 47 cc 0C nn ee F7
  cc = exclusive channel
  0C = RSPACK opcode
  nn = sample number
  ee = encoding mode (7-bit)
```

Wait for the device to begin responding with SDS Data Packets.

#### 1.3 Implement SDS ACK Loop

The core timing-critical loop:

```
loop:
  poll SCSI bus for incoming SysEx
  if Data Packet (F0 7E cc 02 pp ...):
    decode 40 PCM samples from 120 data bytes
    append to output buffer
    send ACK (F0 7E cc 7F pp F7) with matching packet number
    if all packets received: break
  if timeout (no data for N ms): break with error
  if NAK or CANCEL received: break with error
```

**Critical timing constraint:** The ACK must be sent before the device's timeout window closes. On the SCSI bus this is straightforward (microseconds). The loop must not perform any blocking I/O other than the SCSI bus read/write.

#### 1.4 Implement SDS Packet Decode

Decode 7-bit SDS encoded data packets to 16-bit PCM:

- Each packet contains 120 data bytes encoding 40 samples
- Each sample is 3 bytes in 7-bit encoding (21 bits, top 16 are the sample value)
- Verify XOR checksum per packet
- Handle the final packet which may contain fewer than 40 samples

#### 1.5 Determine End-of-Transfer

Resolve open question: how does the device signal completion? Implement whichever mechanism the device uses:
- Option A: Calculate expected packet count from sample header length, stop after that many packets
- Option B: Device sends an end-of-dump message
- Option C: Timeout after no packets for a configurable period (less reliable)

**Success criteria:**
- MSG_SAMPLE_READ returns complete PCM audio data for a known sample
- ACK loop completes without device timeout
- Decoded PCM matches expected audio content
- Handles samples of varying lengths

### Phase 2: Bridge Endpoint (Rust)

Add support for the new message type in the scsi-midi-bridge daemon.

#### 2.1 MSG_SAMPLE_READ Message Routing

Add the new message type to the bridge's protocol handler. The bridge receives the HTTP request, translates it to `MSG_SAMPLE_READ`, forwards to the streaming server, and relays the response back to the HTTP client.

**Options:**
- Option A: Add MSG_SAMPLE_READ to the existing protobuf message set and route through the standard message pipeline
- Option B: Add a dedicated REST endpoint (`POST /sample/read`) that creates and sends the message internally

#### 2.2 Response Handling

The response may be large (up to ~1.4MB for a maximum-length sample). Ensure the bridge:
- Handles large responses without truncation
- Sets appropriate Content-Type headers (application/octet-stream or a structured format)
- Includes metadata (sample rate, bit depth, sample count) in the response

**Success criteria:**
- Bridge forwards MSG_SAMPLE_READ to streaming server and returns response to client
- Large responses (>1MB) transfer without corruption
- Error responses from the streaming server propagate to the client with meaningful error messages

### Phase 3: TypeScript Client Method

Add `receiveSampleViaScsi` to the S3000XL client.

#### 3.1 Transport Layer Support

Add `MSG_SAMPLE_READ` support to the SCSI MIDI transport in `midi-core`.

**Files to modify:**
- SCSI transport implementation -- add method to send `MSG_SAMPLE_READ` and receive PCM response

#### 3.2 Client Method

Implement `receiveSampleViaScsi(sampleNumber: number)` on the S3000XL client.

**Returns:**
```typescript
interface ScssSampleData {
  sampleRate: number;
  bitDepth: number;
  sampleCount: number;
  pcmData: Int16Array;
}
```

**Behavior:**
1. Send `MSG_SAMPLE_READ` with sample number and exclusive channel
2. Receive response with metadata and PCM data
3. Return structured object with typed PCM array
4. Throw descriptive error on failure (timeout, device error, bridge error)

**Success criteria:**
- Client method returns complete sample data
- PCM data is correctly typed as Int16Array
- Errors propagate with actionable messages
- Method works from both browser and Node.js contexts

### Phase 4: Integration Test

End-to-end verification that sample audio data survives the full round trip.

#### 4.1 Round-Trip Test

Follow the established e2e testing pattern (send known data, receive, compare):

1. Generate a known test sample (e.g., 256-sample sine wave at 44100 Hz, 16-bit mono)
2. Send to device via SDS (existing `sendSampleViaSds` -- already confirmed working)
3. Retrieve via `receiveSampleViaScsi` (new path)
4. Compare sent PCM vs received PCM

**Comparison criteria:**
- Sample count matches
- Sample rate matches
- Bit depth matches
- PCM data matches within SDS encoding tolerance (7-bit encoding may introduce rounding at the LSB level)

#### 4.2 Variable-Length Test

Test with samples of different sizes to verify the end-of-transfer detection and packet count handling:
- Very short sample (< 40 samples, fits in one packet)
- Medium sample (~1000 samples, ~25 packets)
- Long sample (several seconds of audio, hundreds of packets)

#### 4.3 Make Target

Add `make test-scsi-sample-transfer` target that uses the shared SCSI e2e provisioning pipeline (build ARM64 binaries, deploy to Pi, start daemons, run tests, cleanup).

**Success criteria:**
- Round-trip test passes: sent audio matches received audio
- Variable-length tests pass across sample sizes
- Test runs via `make test-scsi-sample-transfer` with full provisioning

## Task Breakdown

| # | Task | Phase | Est. |
|---|------|-------|------|
| 1 | Define MSG_SAMPLE_READ request/response format | 1.1 | 0.25d |
| 2 | Implement RSPACK trigger in streaming server | 1.2 | 0.5d |
| 3 | Implement SDS ACK loop with bus-speed timing | 1.3 | 1d |
| 4 | Implement SDS 7-bit packet decode to 16-bit PCM | 1.4 | 0.5d |
| 5 | Determine and implement end-of-transfer detection | 1.5 | 0.5d |
| 6 | Test Phase 1 against live hardware | 1 | 0.5d |
| 7 | Add MSG_SAMPLE_READ routing to bridge | 2.1 | 0.5d |
| 8 | Handle large response passthrough in bridge | 2.2 | 0.25d |
| 9 | Add MSG_SAMPLE_READ to SCSI transport in midi-core | 3.1 | 0.5d |
| 10 | Implement receiveSampleViaScsi client method | 3.2 | 0.5d |
| 11 | Build round-trip integration test | 4.1 | 0.5d |
| 12 | Build variable-length sample tests | 4.2 | 0.25d |
| 13 | Add make target with e2e provisioning | 4.3 | 0.25d |

## Dependencies

- Phase 1 has no code dependencies (standalone C++ work in s2p fork), but requires answers to the open questions in the PRD (Dump Header behavior, end-of-transfer signaling)
- Phase 2 depends on Phase 1 (bridge must know the message format the streaming server expects)
- Phase 3 depends on Phase 2 (client needs the bridge endpoint to exist)
- Phase 4 depends on Phase 3 (integration test uses the client method)
- All phases require the Pi + S3000XL hardware setup for testing
