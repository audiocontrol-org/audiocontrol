# MIDI Sample Dump Standard (SDS) Support - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Build a generic MIDI SDS implementation in `shared-midi` following the same patterns used by the Roland S-series protocol layer (`s-series-messages.ts`, `s-series-constants.ts`). The implementation is structured as pure functions for message building/parsing/encoding, plus a transfer state machine for managing closed-loop handshake sequences. The S3000XL client in `sampler-devices` integrates SDS as an alternative sample transfer method alongside its existing proprietary RSPACK/ASPACK protocol.

**Key architectural decisions:**

- **Generic in `shared-midi`** -- SDS is device-agnostic, so it belongs in the shared MIDI layer, not in any device-specific module
- **Pure functions for protocol** -- Message builders, parsers, and encoding are stateless pure functions (easy to test, no side effects)
- **State machine for transfers** -- Closed-loop transfer uses an explicit state machine that accepts MIDI messages as inputs and produces MIDI messages as outputs, with the transport layer injected
- **Composition with device clients** -- The S3000XL client composes the SDS transfer functions with its existing request queue and MidiIO adapter rather than inheriting from an SDS base class
- **Interface-first** -- Define `SdsSender`, `SdsReceiver`, and `SdsTransferProgress` interfaces before implementation

## Implementation Phases

### Phase 1: SDS Protocol Layer in `shared-midi`

Build the core SDS protocol implementation as pure functions and types.

#### 1.1 Types and Constants

Define all SDS-related types, constants, and message identifiers.

**Files to create:**
- `modules/shared-midi/src/sds/sds-types.ts` -- Interfaces for SDS messages (DumpHeader, DataPacket, DumpRequest, Ack, Nak, Wait, Cancel)
- `modules/shared-midi/src/sds/sds-constants.ts` -- Protocol constants (command bytes, max packet size, encoding parameters)

**Key types:**

```typescript
interface SdsDumpHeader {
  sampleNumber: number;       // 0-16383
  sampleFormat: number;       // 8-28 bits per word
  samplePeriodNs: number;     // nanoseconds (1_000_000_000 / sampleRate)
  sampleLength: number;       // words
  loopStart: number;          // word offset
  loopEnd: number;            // word offset
  loopType: SdsLoopType;      // forward, forward-backward, off
}

interface SdsDataPacket {
  packetNumber: number;       // 0-127
  data: Uint8Array;           // 120 bytes of 7-bit encoded data
  checksum: number;
}

interface SdsTransferProgress {
  packetsSent: number;
  packetsTotal: number;
  bytesSent: number;
  bytesTotal: number;
}
```

#### 1.2 Message Builders and Parsers

Pure functions to build and parse all 7 SDS message types.

**Files to create:**
- `modules/shared-midi/src/sds/sds-messages.ts` -- Builder and parser functions

**Functions:**

| Function | Purpose |
|----------|---------|
| `buildDumpHeader(channel, header)` | Build Dump Header SysEx message |
| `buildDataPacket(channel, packetNumber, data)` | Build Data Packet with checksum |
| `buildDumpRequest(channel, sampleNumber)` | Build Dump Request message |
| `buildAck(channel, packetNumber)` | Build ACK handshake |
| `buildNak(channel, packetNumber)` | Build NAK handshake |
| `buildWait(channel, packetNumber)` | Build WAIT handshake |
| `buildCancel(channel, packetNumber)` | Build CANCEL handshake |
| `parseSdsMessage(data)` | Parse any incoming SDS SysEx into typed message |
| `validateChecksum(packet)` | Verify Data Packet checksum |

**Success criteria:**
- All builders produce correct byte sequences per SDS spec
- Parser round-trips with builders (build -> parse -> compare)
- Checksum validation catches single-bit errors

#### 1.3 Sample Data Encoding/Decoding

7-bit MIDI encoding for sample data at any bit depth (8-28 bits).

**Files to create:**
- `modules/shared-midi/src/sds/sds-encoding.ts` -- Encode/decode functions

**Functions:**

| Function | Purpose |
|----------|---------|
| `encodeSampleData(samples, bitsPerWord)` | Pack sample words into 7-bit MIDI bytes |
| `decodeSampleData(midiBytes, bitsPerWord)` | Unpack 7-bit MIDI bytes to sample words |
| `samplesToPackets(samples, bitsPerWord)` | Split encoded data into 120-byte packets |
| `packetsToSamples(packets, bitsPerWord, sampleCount)` | Reassemble packets into sample array |

**Encoding rules:**
- Each sample word is left-justified into ceil(bitsPerWord / 7) MIDI bytes
- Unused low bits are zeroed
- 120 bytes per packet, last packet zero-padded

**Success criteria:**
- Round-trip encode/decode for 8, 12, 16, 24-bit sample data
- Correct left-justification for all bit depths
- Last packet correctly zero-padded

#### 1.4 Transfer State Machine

Closed-loop and open-loop transfer logic.

**Files to create:**
- `modules/shared-midi/src/sds/sds-transfer.ts` -- Transfer state machine
- `modules/shared-midi/src/sds/index.ts` -- Public API barrel export

**Interfaces:**

```typescript
interface SdsSenderOptions {
  channel: number;
  header: SdsDumpHeader;
  samples: Int16Array | Int32Array;
  mode: 'open-loop' | 'closed-loop';
  onProgress?: (progress: SdsTransferProgress) => void;
  ackTimeoutMs?: number;     // default 2000
  maxRetries?: number;       // default 3
}

interface SdsReceiverOptions {
  channel: number;
  onHeader?: (header: SdsDumpHeader) => void;
  onProgress?: (progress: SdsTransferProgress) => void;
  onComplete?: (samples: Int16Array | Int32Array) => void;
  onError?: (error: Error) => void;
}
```

**Functions:**

| Function | Purpose |
|----------|---------|
| `createSdsSender(midiOut, options)` | Create sender; returns `{ start(), cancel() }` |
| `createSdsReceiver(midiIn, options)` | Create receiver; returns `{ start(), cancel() }` |
| `requestSample(midiOut, channel, sampleNumber)` | Send Dump Request and return receiver |

**Closed-loop sender flow:**
1. Send Dump Header
2. Wait for ACK
3. For each packet: send Data Packet, wait for ACK/NAK/WAIT/CANCEL
4. On NAK: retransmit packet (up to maxRetries)
5. On WAIT: pause until ACK received
6. On CANCEL: abort transfer
7. Report progress after each ACK

**Success criteria:**
- Closed-loop sender handles ACK, NAK, WAIT, CANCEL correctly
- Open-loop sender transmits all packets without waiting
- Timeout triggers error after ackTimeoutMs with no response
- Progress callback fires with correct counts
- NAK triggers retransmit up to maxRetries, then errors

### Phase 2: S3000XL SDS Integration in `sampler-devices`

Wire the generic SDS implementation into the S3000XL client.

#### 2.1 Add SDS Methods to S3000XL Client Interface

Extend the S3000XL client interface with SDS sample transfer methods.

**Files to modify:**
- `modules/sampler-devices/src/devices/s3000xl/s3000xl-client.ts` -- Add SDS transfer methods

**New methods:**

```typescript
// Send a sample to the device via SDS
sendSampleViaSds(
  sampleNumber: number,
  sampleData: Int16Array,
  sampleRate: number,
  options?: { loopStart?: number; loopEnd?: number; loopType?: SdsLoopType; onProgress?: (p: SdsTransferProgress) => void }
): Promise<void>

// Receive a sample from the device via SDS
receiveSampleViaSds(
  sampleNumber: number,
  onProgress?: (p: SdsTransferProgress) => void
): Promise<{ header: SdsDumpHeader; samples: Int16Array }>
```

**Integration approach:**
- SDS transfers go through the existing request serialization queue (one SysEx operation at a time)
- Use the existing `MidiIO` adapter for MIDI send/receive
- Map S3000XL sample numbers to SDS sample numbers
- Convert between S3000XL native sample format and SDS header fields

**Success criteria:**
- SDS methods respect the request serialization queue
- Transfer errors are reported with descriptive messages
- Progress callbacks propagate from SDS layer to caller

#### 2.2 S3000XL SDS Configuration

Determine and configure S3000XL-specific SDS parameters.

**Files to create/modify:**
- `modules/sampler-devices/src/devices/s3000xl/s3000xl-sds-config.ts` -- S3000XL SDS configuration

**Configuration:**
- MIDI channel mapping (S3000XL SysEx channel to SDS channel)
- Sample number mapping (if S3000XL sample indices differ from SDS sample numbers)
- Supported bit depths (S3000XL is 16-bit)
- Timeout values tuned for S3000XL response times

**Success criteria:**
- Configuration values validated against hardware testing
- Open questions from PRD resolved through hardware experimentation

### Phase 3: S3000XL Editor UI for Sample Transfer

Add sample send/receive UI to the Akai S3000XL sample editor.

#### 3.1 Sample Transfer UI Components

Add transfer controls to the sample header view in `akai-s3k-editor`.

**Files to create/modify:**
- `modules/akai-s3k-editor/src/components/SampleTransferPanel.tsx` -- Transfer UI panel
- `modules/akai-s3k-editor/src/components/TransferProgressBar.tsx` -- Progress indicator
- Wire into existing sample header page

**UI elements:**
- "Send to Device" button (sends a local sample to the S3000XL via SDS)
- "Receive from Device" button (receives a sample from the S3000XL via SDS)
- Progress bar showing packets transferred / total
- Error display for transfer failures
- Cancel button to abort in-progress transfers

**Success criteria:**
- User can send a sample to the S3000XL and verify it plays back correctly
- User can receive a sample from the S3000XL and verify the audio is correct
- Progress updates smoothly during transfer
- Errors are displayed clearly with actionable messages
- Cancel stops the transfer cleanly

### Phase 4: Testing

#### 4.1 Unit Tests for SDS Protocol Layer

**Files to create:**
- `modules/shared-midi/src/sds/__tests__/sds-messages.test.ts`
- `modules/shared-midi/src/sds/__tests__/sds-encoding.test.ts`
- `modules/shared-midi/src/sds/__tests__/sds-transfer.test.ts`

**Test coverage:**
- Message builder output matches SDS spec byte-for-byte
- Parser round-trips with all message types
- Checksum calculation and validation
- 7-bit encoding/decoding for 8, 12, 16, 24-bit sample data
- Packet splitting and reassembly
- Closed-loop sender state transitions (ACK, NAK, WAIT, CANCEL)
- Open-loop sender transmits without waiting
- Timeout and retry behavior
- Progress callback accuracy

#### 4.2 Integration Tests with S3000XL Hardware

**Files to create:**
- Tests in S3000XL e2e test suite (requires hardware)

**Test scenarios:**
- Send a known sample via SDS, read it back via SDS, compare
- Send via SDS, verify sample header on device matches
- Trigger NAK by corrupting a packet, verify retransmit
- Cancel mid-transfer, verify device state is clean

## Task Breakdown

| # | Task | Phase | Est. |
|---|------|-------|------|
| 1 | Define SDS types and constants | 1.1 | 0.5d |
| 2 | Implement SDS message builders | 1.2 | 1d |
| 3 | Implement SDS message parsers | 1.2 | 1d |
| 4 | Implement 7-bit sample encoding/decoding | 1.3 | 1d |
| 5 | Implement packet splitting/reassembly | 1.3 | 0.5d |
| 6 | Implement closed-loop sender state machine | 1.4 | 1.5d |
| 7 | Implement closed-loop receiver state machine | 1.4 | 1.5d |
| 8 | Implement open-loop sender | 1.4 | 0.5d |
| 9 | Write unit tests for protocol layer | 4.1 | 1.5d |
| 10 | Add SDS methods to S3000XL client | 2.1 | 1d |
| 11 | Create S3000XL SDS configuration | 2.2 | 0.5d |
| 12 | Build sample transfer UI panel | 3.1 | 1d |
| 13 | Build transfer progress bar | 3.1 | 0.5d |
| 14 | Hardware integration testing with S3000XL | 4.2 | 1d |

## Dependencies

- Phase 2 depends on Phase 1 (generic SDS layer must exist before device integration)
- Phase 3 depends on Phase 2 (client methods must exist before UI can call them)
- Phase 4.1 can run in parallel with Phase 1 (test-driven development)
- Phase 4.2 depends on Phase 2 (requires integrated client)
