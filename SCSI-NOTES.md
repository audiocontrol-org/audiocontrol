# SCSI Notes — Travel Log

A chronological record of strategies, attempts, findings, bugs, debugging steps, blind alleys, and incorrect assumptions encountered while building SCSI MIDI and sample transfer support for the Akai S3000XL via a Raspberry Pi SCSI bridge.

## Cast of Characters

- **S3000XL** — Akai sampler (1996), SCSI ID 6, connected to Pi via 50-pin SCSI cable
- **Pi (s3k.local)** — Raspberry Pi running s2p (SCSI device emulator) and our custom scsi-midi-bridge
- **s2p** — Fork of scsi2pi, acts as SCSI initiator. Exposes protobuf API on port 6868 and streaming MIDI on port 6870
- **scsi-midi-bridge** — Rust daemon on the Pi, HTTP/WebSocket API on port 7033, translates web requests to SCSI CDBs via s2p
- **Web editor** — React app (akai-s3k-editor), communicates with bridge via HTTP and WebSocket

## Architecture

```
Browser ──HTTP/WS──► scsi-midi-bridge (Pi:7033)
                         │
                         ├──TCP──► s2p protobuf API (Pi:6868) ──SCSI bus──► S3000XL
                         │
                         └──TCP──► s2p streaming MIDI (Pi:6870) [DEAD END — see below]
```

---

## 2026-04-02: MESA II Binary Analysis

### Strategy
Install MESA II v1.2 (Akai's official Mac OS 9 SCSI editor) in SheepShaver to analyze how Akai's own software communicates with the S3000XL over SCSI.

### What we found
- MESA II is a plugin architecture: main app + Sampler Editor 2.3 + SCSI Plug 2.1.2
- All code in Mac OS 9 resource forks (68k/PPC code resources)
- Extracted resource forks and analyzed with `strings` and manual 68k disassembly

### Key discoveries from Sampler Editor 2.3
- `GetSampleData` uses opcode `0x0B` (SDATA) with `'BULK'` transfer mode and 192-byte chunks
- `BuildSampleDataRequest(buf, opcode=0x0B, channel, sampleNum, offset, length)` — sample data transfer uses SDATA, not RSPACK
- `SendAudioFileToSampler` and `SendAudioBufferToSampler` — dedicated sample upload methods
- Critical string: "Sample data can only be transferred if you are using SCSI to communicate with the sampler. You are currently using MIDI."
- `NewProgram(name, short)` exists — suggests programmatic sample/program creation

### Key discoveries from SCSI Plug 2.1.2
- `SetSCSIMIDIMode(short scsiId, uchar midiMode, uchar thruMode)` — CDB 0x09 with both MIDI and thru flags
- `SMSendData` — CDB 0x0C with flag byte `$80` (reply expected) or `$00` (fire-and-forget)
- `SMDataByteEnquiry` — CDB 0x0D with flag byte `$80`
- `SMDispatchReply` — CDB 0x0E, terminates on `$F7` (SysEx end)
- Complete MIDI transaction flow: enable → drain → send (flag $80) → poll → read → disable

### Documentation produced
- `docs/1.0/scsi-midi-bridge/mesa-ii-analysis.md` — full binary analysis
- `mesa-plug-harness` repo — 68k emulator harness for running SCSI Plug code

---

## 2026-04-06 19:40 PDT: Mesa Plug Harness — 68k Emulation

### Strategy
Build a standalone 68k CPU emulator (using Musashi) that can execute the SCSI Plug's code resources directly, intercepting SCSIAction calls to observe the exact CDB bytes MESA sends.

### What we built
- Standalone C harness loading the SCSI Plug binary into Musashi 68k emulator
- SCSIAction trap interception to capture CDBs
- Extracted complete SCSI protocol reference from the binary

### Documentation produced
- `mesa-plug-harness/SCSI-PROTOCOL.md` — definitive CDB reference with flag bytes, timeout values, error handling

---

## 2026-04-06 20:31 PDT: First S3000XL Communication via SCSI

### Milestone
First successful MIDI-over-SCSI conversation with a real S3000XL using our own code (not MESA). The mesa-plug-harness `s3k-client` sent RSLIST and received the sample name list.

### Rapid progress (20:31 - 23:31)
- 20:31 — First SCSI communication
- 20:34 — Bridge working
- 20:46 — Read sample and program names
- 21:19 — Standalone S3K client
- 21:56 — Fixed sample header parser
- 22:18 — Download sample audio via RSPACK/SDS
- 22:37 — Program header, keygroup header, status, drain
- 22:42 — Write/upload/delete operations
- 22:49 — CLI for upload, delete, verified round-trip
- 23:02 — Clone program
- 23:26 — Read-modify-write + misc data
- 23:31 — Program creation works

---

## 2026-04-06: SCSI Sample Data Transfer Investigation

### Strategy
Systematically test every possible way to read/write sample audio data over the SCSI MIDI channel.

### What works
- All metadata (RPLIST, RSLIST, RPDATA, RKDATA, RSDATA, RMDATA)
- All parameter writes (PDATA, KDATA, SDATA, MDATA)
- SDS sample upload (client → device)
- SDS Dump Header response (Dump Request → device returns header)
- Front panel dump (device-initiated SDS data packets arrive)

### What doesn't work
- RSPACK (opcode 0x0C) — device accepts but returns 0 bytes via MIDI_POLL
- SDS Data Packets after Dump Request — header arrives but data packets don't (ACK timing too slow over network)

### Key insight
The ACK handshake must happen at SCSI bus speed, not network speed. Each ACK goes through: Node.js → HTTP → bridge → s2p → SCSI bus. The solution (later implemented) was batching.

### Documentation produced
- `docs/1.0/scsi-sample-transfer/scsi-sample-data-findings.md`

---

## 2026-04-09 ~16:00 PDT: SDS Upload — First Working Transfer

### Strategy
Use MIDI Sample Dump Standard (SDS) over the SCSI MIDI channel (CDB 0x0C send, 0x0D poll, 0x0E read) to upload samples to the S3000XL.

### What worked
- SDS dump header creates a sample slot on the device
- SDS data packets (40 samples per packet, 120 data bytes) with per-packet ACK handshake
- Post-upload RSLIST polling to detect the new sample, followed by SysEx rename

### Bugs found
- **7-bit vs nibble encoding**: RSDATA item numbers used nibble encoding (4-bit) instead of 7-bit encoding. Worked for indices 0-15 (where both produce identical bytes), silently failed for index 16+.
- **Sample rate 0**: `parseSampleHeaderFromDisk` read SSRATE as 0 when the validity flag was set but the field was uninitialized. Bridge panicked on divide-by-zero. Fixed with bandwidth-derived fallback.
- **SDS response dispatch**: `sendAndReceive` listener accepted any Akai response (F0 47), causing response swapping between concurrent requests. Fixed with precise opcode matching.
- **Background poll loop race**: 50ms poll loop stole response bytes from send_and_receive. Removed.

### Performance
- **227ms per packet** (40 samples = 80 bytes PCM)
- Each packet = 2 SCSI CDB calls × ~113ms = ~350 bytes/sec
- A 1-second 44.1kHz sample takes ~4 minutes

### Incorrect assumption
The 113ms per SCSI command was initially attributed to TCP connection overhead. Timing breakdown revealed: `tcp_connect_ms=2-3ms`, `recv_ms=109-113ms`. The bottleneck is s2p's SCSI CDB execution time, not networking.

---

## 2026-04-09 ~19:30 PDT: Defensive Sleeps — A Pattern of Wrong Instincts

### Blind alley
Added 50ms sleep between packet send and ACK poll, 100ms sleep in ACK poll loop, 200ms post-header sleep, 3-second post-upload "commit" sleep. Each added "just in case" the device needed time.

### Why it was wrong
The device ACK is definitive — if it sends ACK, it's ready for the next packet. The sleeps added ~150ms per packet for zero benefit. User feedback: "your first impulse should NEVER be to add a delay."

### Fix
Removed all defensive sleeps. Implemented exponential backoff for ACK polling per project guidelines: 1ms initial, 2x per retry, 50ms cap, 5s hard timeout. ACK is the only signal that matters.

---

## 2026-04-09 ~22:30 PDT: Client-Side Timeout — The Silent Killer

### Bug
SDS uploads for samples > ~1 second (44100+ samples) silently failed. The `ImportInstrumentDialog` reported "none of the zone samples were found on the device" even though the SDS transfer appeared to complete.

### Root cause
The SCSI SDS transport (`scsi-midi-transport.ts`) had a hardcoded 120-second WebSocket timeout. A 44100-sample file at ~340ms/packet takes ~165 seconds — exceeding the timeout. The client closed the WebSocket, the bridge kept sending packets (no cancellation), and `sendSampleViaSds` threw an error that was caught and silently swallowed.

### Fix
Dynamic timeout based on sample count: `packets * 400ms + 30s margin`, minimum 60s. Also added WebSocket disconnect detection in the bridge — when the progress channel's receiver drops (WebSocket closed), the upload loop checks a cancellation flag and stops.

---

## 2026-04-10 00:58 PDT: Batched SDS — 9x Speedup

### Strategy
Send multiple SDS data packets concatenated in a single CDB 0x0C call, read all ACKs in a single CDB 0x0E call. This amortizes the ~113ms per-SCSI-command overhead across the batch.

### Experiment results (Node.js test: `test-sds-batch.ts`)

| Batch size | Per-packet | Speedup |
|-----------|-----------|---------|
| 1 (baseline) | 227ms | 1x |
| 2 | 114ms | 2.0x |
| 5 | 57ms | 4.0x |
| 10 | 35ms | 6.6x |
| 20 | 25ms | **9.2x** |
| 50 | 35ms | 6.5x (ACK read buffer too small) |

Batch 20 is the sweet spot. Full bridge WebSocket path: **2.2 KB/s** (6.3x speedup).

### Implementation
Changed `upload_sample_inner` in `scsi_midi.rs` to build batches of 20 packets, send in one CDB 0x0C, read all ACKs in one CDB 0x0E. Progress reported per batch, not per packet.

---

## 2026-04-10 00:37 PDT: Streaming Port 6870 — Dead End

### Strategy
s2p has a streaming MIDI port (6870) with persistent TCP and simple frame protocol (MSG_SEND/MSG_DATA). Hypothesis: bypass the per-command protobuf overhead for massive speedup.

### What happened
Connected, initialized (MSG_INIT), sent SDS dump header via MSG_SEND, got WAIT response. Then... nothing. The streaming port does NOT relay device ACK responses back to the client. It only forwards client→device data.

### Why
The streaming server is designed for SysEx request/response (send query, get reply). SDS has a different model — the device sends unsolicited ACK/NAK/Wait responses that the streaming server doesn't handle.

### Outcome
Filed issue #183 for deletion. The `MidiStreamClient` code is dead — no code path uses it. Per nucleation site guidelines, it should be removed.

---

## 2026-04-10 00:01 PDT: Bridge Spamming — WebSocket Disconnect Doesn't Stop Upload

### Bug
When the browser page reloaded during an SDS transfer, the bridge continued sending packets to the sampler indefinitely. The sampler's SCSI LED flashed continuously. Only killing the bridge process stopped it.

### Root cause
The WebSocket disconnect closed the progress forwarding channel, but the progress receiver (`progress_rx`) stayed alive because the forwarding task kept running. The worker's `progress.try_send()` never failed, so the cancellation flag was never set.

### Fix
Changed the forwarding task to break its loop when `tx_forward.send()` fails (WebSocket closed). This drops `progress_rx`, making `try_send` fail in the worker, setting the cancellation flag. The upload loop checks the flag before each batch and stops.

---

## 2026-04-10 01:30 PDT: S3000 Protocol Mode — ASPACK Discovery

### Context
The S3000XL front panel has a "Sample Protocol" setting: Standard (SDS) vs S3000. MESA II (Akai's Mac OS 9 editor) uses a proprietary protocol for sample transfer, not SDS.

### MESA II analysis findings
From the 68k disassembly in `mesa-ii-analysis.md`:
- `BuildSampleDataRequest` pushes opcode `0x0B` (SDATA), not SDS
- Uses `'BULK'` transfer mode identifier and 192-byte chunk size
- "Sample data can only be transferred if you are using SCSI" — confirms SCSI-only for audio data

### ASPACK (opcode 0x0D) — Write sample data

Tested via Node.js (`test-aspack-raw.ts`): sends PCM data in nibble encoding with sample index, offset, and count parameters.

| Chunk size | Throughput | vs batched SDS |
|-----------|-----------|---------------|
| 768 samples | 4.3 KB/s | 1.8x |
| 6144 samples | 12.1 KB/s | 5.5x |
| 44100 samples | **23.4 KB/s** | **10.6x** |

A 1-second sample in 3.6 seconds vs 40 seconds with batched SDS.

### RSPACK (opcode 0x0C) — Read sample data

Only works in S3000 protocol mode. Returns SDS data packets (not Akai proprietary format). Triggers a persistent dump — device keeps sending until all data is consumed.

### Gaps blocking production use
1. **Multi-chunk writes fail** — offset > 0 returns empty reply
2. **Cannot create new samples** — ASPACK only overwrites existing sample slots
3. **Protocol mode not SysEx-controllable** — must be changed on front panel

Filed as issue #184 with exploration plan.

---

## 2026-04-10 02:00 PDT: MESA SCSI Plug Protocol — CDB Flag Byte

### Finding
The `mesa-plug-harness` repo (`SCSI-PROTOCOL.md`) reveals MESA uses flag byte `$80` on CDB 0x0C when a reply is expected, and `$00` for fire-and-forget. Our bridge always uses `0x00`.

MESA's protocol flow before each MIDI send:
1. Enable MIDI mode
2. Drain pending data (poll + read)
3. Send with flag `$80`
4. Read reply

### Status
Untested — the multi-chunk ASPACK test failed even with flag `$80` and drain, but the sampler may have been in a bad state from prior SDS dump. Needs clean retest. Plan documented in `bulk-transfer-exploration-plan.md`.

---

## 2026-04-10 01:45 PDT: MiscellaneousData Diff — Protocol Mode Not Stored

### Strategy
Read RMDATA with sampler in "Standard" mode, switch to "S3000" on front panel, read again, diff to find the protocol mode byte.

### Result
**Every byte is identical.** The protocol mode setting is NOT stored in MiscellaneousData. It may be volatile (RAM-only) or stored in a different data block not accessible via RMDATA. No SysEx command to toggle it has been found.

---

## 2026-04-10 01:50 PDT: SDS in S3000 Mode — Accidental Dump Flood

### Bug
Running the SDS batch test while the sampler was in S3000 protocol mode caused the device to start sending SDS data packets back. The bridge's `send_and_receive` kept reading data packets instead of the expected SysEx response, flooding the MIDI buffer.

### What happened
In S3000 mode, the SDS dump header triggered the device to respond with sample data. This is because RSPACK is enabled in S3000 mode, and the SDS dump header may have been interpreted as a data request.

### Recovery
Disabling MIDI mode (CDB 0x09) sometimes stops the flood. If not, power cycle required. The flood persists across MIDI mode toggle because the device's SDS dump state is in RAM.

### Lesson
Always verify the sampler's protocol mode before running SDS operations. S3000 mode makes the device respond to requests that Standard mode ignores.

---

## Recurring Themes

### Things that keep biting us
1. **Stale state after interrupted transfers** — SDS dumps, MIDI mode, protocol mode all persist in device RAM
2. **Bridge keeps running after client disconnects** — solved for SDS upload, but may recur in other paths
3. **Per-SCSI-command overhead** — 113ms per CDB execution through s2p is the fundamental bottleneck
4. **Encoding confusion** — 7-bit vs nibble vs raw bytes, LE vs BE, with/without flag bytes

### What the user keeps reminding us
- "STOP TRYING TO ADD DELAYS" — delays are never the first answer
- "Don't blame the device" — investigate the code first
- "Don't guess, test" — write a Node.js script and try it
- "Don't make things up" — every claim needs evidence from hardware testing
- "Why is X so slow?" — always measure, never assume

---

## 2026-04-10 11:00 PDT: Concretizing Batched SDS in Web Editor

### What we verified
- Batched SDS (20 packets/batch) works end-to-end through the bridge WebSocket → web app
- Node.js speed test: 2.4 KB/s (6.9x speedup confirmed)
- Web editor Send Sample dialog shows proper byte-level progress with elapsed time and ETA
- Post-upload rename works — samples appear with correct names instead of "MIDI XX"

### Bugs fixed during integration
- SDS progress bar didn't meet project spec — added bytes, elapsed, ETA
- `SendSampleDialog` didn't pass sample name to `sendSampleViaSds` — samples appeared as "MIDI 98" etc.
- `DiskToLibraryDialog.saveToCommonLibrary` used `createWritable()` which fails on Safari/iOS (#185)

---

## Open Questions

- Can ASPACK write at offset > 0? MESA II does it with 192-byte chunks. What's different about our encoding?
- Is there an undocumented SysEx opcode for creating empty sample slots?
- Can the S3000 protocol mode be toggled via SysEx?
- Why does s2p take 113ms per SCSI CDB? Is there internal locking, logging, or device emulation overhead?
- What does MESA's `SetSCSIMIDIMode` 84-byte config block contain?
