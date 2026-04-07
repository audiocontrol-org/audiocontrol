# SCSI Sample Transfer - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD

## Technical Approach

Implement a `MSG_SAMPLE_READ` handler in the s2p streaming server (C++) that runs the full SDS receive conversation at SCSI bus speed. The client sends one request and receives assembled PCM audio — no knowledge of SDS packets needed.

### Key Finding: Event-Driven Architecture Required

The original approach (poll-based) failed because the streaming server's MIDI_POLL commands prevent the main loop from accepting device-initiated SCSI writes. The SDS Data Packets arrive as target-mode transactions that the main loop can only process in `WaitForSelection()`. Continuous polling starves target-mode processing.

**Solution: Invert the control flow.** Instead of the streaming server polling for data, the main loop pushes received data onto a queue that the streaming server waits on via condition variable.

### Data Flow

```
Streaming Thread                    Main Thread (SCSI bus)
─────────────────                   ─────────────────────
1. Send SDS Dump Request            
   via QueueMidiCommand ──────────► Execute MIDI_SEND (CDB 0x0C)
                                    Device receives Dump Request

2. Wait on condvar for              WaitForSelection() →
   Dump Header                      Device sends Dump Header (CDB 0x0C target write)
                        ◄────────── MidiProcessor.WriteData() pushes to queue
                                    Signal condvar

3. Parse Dump Header
   Send ACK via QueueMidiCommand ──► Execute MIDI_SEND (ACK)
                                    
4. Wait on condvar for              WaitForSelection() →
   Data Packet 0                    Device sends Data Packet 0
                        ◄────────── MidiProcessor.WriteData() pushes to queue
                                    Signal condvar

5. Parse Data Packet,
   extract audio bytes
   Send ACK ───────────────────────► Execute MIDI_SEND (ACK)

6. Repeat 4-5 until no more packets

7. Return assembled PCM to client
```

### Why This Works

- The streaming thread never queues MIDI_POLL commands, so the main loop is free to enter `WaitForSelection()` and accept target-mode transactions
- The condvar signal is microseconds (same process, no network)
- ACKs still go through `QueueMidiCommand` → main loop → SCSI bus, but between ACK calls the main loop processes target transactions
- The MidiProcessor's `WriteData` callback already receives device-initiated data — we just need to route it to a queue instead of (or in addition to) the Unix socket

### Key Architectural Decisions

- **Event-driven, not poll-based** — streaming thread waits on condvar, main thread signals when data arrives
- **MidiProcessor → queue → streaming thread** — data flows through a shared queue protected by mutex/condvar
- **ACK loop lives in s2p** — the only component with SCSI bus access
- **Single request/response from client** — bridge and TypeScript see `MSG_SAMPLE_READ(sampleNumber) → PCM data`
- **PCM assembly in the server** — decode 7-bit SDS packets to 16-bit PCM, return raw audio bytes

## Implementation

### Phase 1: Event queue in MidiProcessor

Add a shared data queue to MidiProcessor that `WriteData` pushes SysEx messages onto. The streaming server reads from this queue instead of using MIDI_POLL.

**Files:**
- `.deps/scsi2pi/cpp/devices/midi_processor.h` — Add queue, mutex, condvar members
- `.deps/scsi2pi/cpp/devices/midi_processor.cpp` — WriteData pushes to queue, add getter method

### Phase 2: ReceiveSample uses event queue

Rewrite `ReceiveSample` to wait on the queue condvar instead of polling. After sending each ACK, yield and wait for the next message from the MidiProcessor.

**Files:**
- `.deps/scsi2pi/cpp/s2p/midi_streaming_server.h` — Add reference to MidiProcessor
- `.deps/scsi2pi/cpp/s2p/midi_streaming_server.cpp` — Rewrite ReceiveSample
- `.deps/scsi2pi/cpp/s2p/s2p_core.cpp` — Pass MidiProcessor reference to streaming server

### Phase 3: Bridge and client integration

Add bridge endpoint and TypeScript client method.

**Files:**
- `services/scsi-midi-bridge/src/s2p_client.rs` — Add MSG_SAMPLE_READ support to MidiStreamClient
- `services/scsi-midi-bridge/src/routes.rs` — Add `/samples/:id/data` endpoint
- `modules/sampler-devices/src/devices/s3000xl/s3000xl-client.ts` — Add `receiveSampleViaScsi` method

### Phase 4: Integration test

**Files:**
- `modules/e2e-infra/src/node/lib/test-streaming.ts` — Add sample receive test

## Verified Findings

| What | Result |
|------|--------|
| SDS Dump Request over SCSI | ✅ Dump Header arrives via MIDI_POLL |
| ACK sent via MIDI_SEND | ✅ Device accepts |
| Data Packets after ACK via MIDI_POLL | ❌ Not received (bus contention) |
| Data Packets via front panel dump | ✅ Arrive via MIDI_POLL when no polling active |
| RSPACK (Akai 0x0C) over SCSI | ❌ No response regardless of encoding |
| All metadata commands | ✅ Work perfectly |
| SDS sample SEND (upload) | ✅ Works |
