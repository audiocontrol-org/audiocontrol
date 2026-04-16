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

## 2026-04-01 20:44 PDT: SCMP — First Attempt at SCSI MIDI

### Strategy
Add a "SCSI MIDI Processor" (SCMP) device type to s2p that presents itself as a target device on the SCSI bus, accepting MIDI data from the S3000XL.

### What happened
- s2p fork modified to register as SCSI device type `$03` (Processor)
- S3000XL sends a 63-byte config block via `SET_IFACE_MODE` (CDB 0x0C with flag byte)
- But `MESSAGE IN` phase times out after `STATUS GOOD` — the S3000XL expects target-mode behavior that s2p can't provide in time

### Blind alley
Target-mode SCMP was abandoned. The S3000XL's MIDI-over-SCSI protocol requires s2p to act as an **initiator** sending CDBs to the sampler, not as a target receiving them.

---

## 2026-04-01 23:48 PDT: Breakthrough — CDB 0x0D Is a Poll

### Discovery
CDB 0x0D is not a "set interface mode" variant — it's **Data Byte Enquiry**, a poll that returns 3 bytes indicating how many MIDI bytes are buffered on the device. This was the Rosetta Stone for the protocol.

```
0x0D returns: [HH MM LL] = 24-bit big-endian byte count
```

---

## 2026-04-02 08:48 PDT: Breakthrough — MIDI SDS Over SCSI Works

### Milestone
CDB 0x0C successfully carried a MIDI SDS Dump Header (`F0 7E ...`) to the S3000XL over the SCSI bus. The device responded with a SDS ACK. First proof that MIDI-over-SCSI works with s2p as initiator.

### Rapid progress (April 2)
- 08:48 — CDB 0x0C carries MIDI data
- 09:01 — Full protocol decoded (0x09 init, 0x0C send, 0x0D poll, 0x0E read)
- 09:25 — Socket-based SCMP with SDS ACK generation
- 09:36 — Bidirectional initiator/target mode
- 10:05 — MIDI-over-SCSI protobuf API in s2p
- 10:50 — MIDI API works for INIT, bus contention for SEND
- 11:13 — MIDI queue + bus mode switch
- 13:07 — Dual target/initiator GPIO fix
- 19:05 — Direct protobuf write test
- 19:16 — Protocol probe and write variant tests
- 19:22 — SDS sample transfer over SCSI works!
- 19:29 — Fix CDB transfer length for >255 bytes
- 22:51 — SCSI_EXEC generic command execution

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

## 2026-04-04 17:54 PDT: SheepShaver SCSI Bridge — Mac OS 9 Over Network SCSI

### Original motivation
SysEx parameter writes to the S3000XL via the bridge didn't persist — data could be read but writes didn't stick. MESA II presumably handles writes correctly, so the plan was to capture MESA's traffic to find the difference. (Spoiler: the write persistence issue turned out to be an encoding bug, not a protocol issue — but the investigation produced invaluable protocol knowledge.)

### Strategy
Run MESA II (Akai's official editor) inside SheepShaver (Mac OS 9 emulator) on a modern Mac, connecting to the real S3000XL via network SCSI bridge to the Pi. Goals: observe how MESA communicates and provide a working MESA setup.

### What we built (macemu fork)
- SheepShaver with custom SCSI backend (`scsi_s2p.cpp`) that forwards CDBs over TCP to s2p on the Pi
- Hand-rolled protobuf client (same wire format as the Rust bridge)
- HFS volume mounting over SCSI bridge — Mac OS 9 can access disk images served by s2p

### Milestones
- 17:54 — HFS volume mounts over SCSI bridge
- 18:08 — Writes persist across reboots — Phase 2 complete
- 20:07 — **MIDI-over-SCSI works from the SheepShaver driver** — CDB 0x09 init + 0x0D poll succeed

### Architecture
SheepShaver runs in Docker (linux/amd64 via QEMU on Apple Silicon) with `--privileged` for `vm.mmap_min_addr=0`. Two containers: full fork (port 16080) for OS 9 + MESA II, minimal fork (port 16082) for debugging. The `scsi_s2p.cpp` backend forwards raw SCSI CDBs over TCP to s2p on the Pi.

### The Gestalt gauntlet
MESA II's SCSI Plug has prerequisite checks that must pass before it issues any SCSI calls:
1. **`Gestalt('scsi')`** — must return `gestaltAsyncSCSI` flags. Fixed by registering in `InstallDrivers`.
2. **ROM+0x12** — must equal `0x2AF2` (identifies specific Mac models). Patched in `patch_68k`.
3. **`Gestalt('mach')`** — must be ≤ `0x7E` (built-in SCSI Macs). This one was the killer.

Mac OS 9 checks `Gestalt('mach')` during boot. Replace too early → "This startup disk will not work on this Macintosh model." Replace too late → MESA's SCSI Plug has already cached its "no SCSI" decision during Startup Items execution.

### MESA II "Find Sampler" generates zero SCSI calls
Despite the S3000XL being found during boot INQUIRY scan, clicking Sampler > Find Sampler produces zero SCSI calls on any API path. The Plug's internal state check fails due to the Gestalt timing problem.

### The Mixed Mode rabbit hole (April 5)
Attempted to intercept MESA II's SCSIAction calls to capture the exact CDB bytes:
- Mac OS 9 uses "Mixed Mode" to bridge 68k and PPC code
- The A-line trap handler (`$A089` = `_SCSIDispatch`) is unreachable from Mixed Mode because the ROM patches disable the 68k exception table
- Tried patching opcode tables, `.EDisk` driver installation, PPC stub injection — none reached from MESA's Plug code
- Concluded that SheepShaver's emulation architecture fundamentally prevents A-line trap interception from Mixed Mode code

### Bisect finding
Commit `25848e89` (SCSIAction handler with ROM patches) breaks OS 7 boot. Last good commit for OS 7: `8f67ef4e`. The PPC SCSIAction thunk rewriting at ROM 0x150000-0x170000 hits wrong code in the OS 7 boot path.

### Outcome
SheepShaver SCSI bridge works for disk access but MESA II's SCSI Plug traffic could not be intercepted due to Mixed Mode architecture. Led to building the mesa-plug-harness (standalone 68k emulator) as the alternative approach. The Gestalt timing problem and MESA's startup caching remain unsolved — possible future approach: remove MESA from Startup Items and launch manually after Gestalt patches take effect.

---

## 2026-04-05 23:24 PDT: s2p Streaming MIDI Server

### Motivation
The protobuf API (port 6868) creates a new TCP connection per SCSI command. Each SysEx request/response requires multiple SCSI commands (enable MIDI → send → poll → read → disable MIDI), each as a separate TCP connection. Hypothesis: a persistent connection with internal SCSI polling could eliminate network round trips.

### What we built in s2p (C++)
- `midi_streaming_server.cpp` — TCP server on port 6870
- Frame protocol: `[4-byte LE length][1-byte type][payload]`
- MSG_INIT (0x01): set target SCSI ID, establish session
- MSG_SEND (0x02): send SysEx, server polls SCSI bus internally at 500µs intervals, pushes response
- MSG_DATA (0x03): server pushes response/unsolicited data
- MSG_ERROR (0x04): server pushes error
- MSG_SAMPLE_READ (0x05): send SDS Dump Request, handle ACK loop internally

### Hardware results (April 5)
Verified 34% improvement for SysEx request/response:
- RPLIST: 565ms (was 865ms)
- RPDATA: 794ms (was 1196ms)
- Write: 572ms (was 874ms)

### Rust bridge integration (April 5-6)
- `MidiStreamClient` in `s2p_client.rs` — persistent TCP with lazy reconnect, TCP_NODELAY
- Bridge tries streaming first, falls back to protobuf
- Bug: connection was torn down on timeout/unexpected responses, causing reconnection overhead. Fixed by preserving connection on non-I/O errors.

### MSG_SAMPLE_READ — SDS download attempt (April 6)
1. First tried RSPACK (Akai opcode 0x0C) — device accepts but returns 0 bytes via MIDI_POLL
2. Switched to standard SDS Dump Request — Dump Header arrives, ACK sent successfully
3. **Data Packets do NOT arrive** via MIDI_POLL after ACK — the device sends them as device-initiated SCSI writes (target mode) which s2p can't process while servicing initiator-mode MIDI commands
4. Added event queue with condvar to MidiProcessor for async data delivery — infrastructure correct but SDS Data Packets never arrive through the SCSI MIDI channel

### Death of the streaming path (April 8)
Two commits killed it:

**`77b419e2` (April 8 21:49):** "eliminate duplicate SCSI MIDI paths" — the bridge had two MIDI paths: protobuf wrappers and raw CDB functions. The protobuf path treated CHECK CONDITION as fatal; the raw CDB path correctly ignored it. Multi-sample workflows broke because the protobuf path failed on status bytes. Also: SDS transfers disabled MIDI mode but the SysEx path never re-enabled it. Fix: delete entire protobuf MIDI layer, use raw CDBs exclusively.

**`3ec5daa8` (April 8 22:57):** "use raw CDB path exclusively" — removed `MidiStreamClient` from the SysEx worker path. The streaming client returned stale or incorrectly formatted data after SDS transfers, causing nibble parse errors in the TypeScript client. Root cause never fully diagnosed — possibly leftover SDS data packets in the streaming server's buffer contaminated subsequent SysEx responses.

### What remains (April 10)
The `MidiStreamClient` code is still in `s2p_client.rs` (lines 413-623) but nothing calls it. The s2p streaming server is still compiled and runs on port 6870 but serves no purpose. Testing on April 10 confirmed the streaming port doesn't relay device ACK responses for SDS uploads — it only forwards client→device data. Filed for deletion as issue #183.

### Lessons
1. The 34% SysEx improvement was real but insufficient to justify the complexity
2. The streaming server couldn't handle SDS because SDS data packets arrive as device-initiated SCSI operations (target mode), not as responses to initiator commands
3. Stale data after SDS transfers was a persistent bug that was never root-caused — the workaround (use raw CDBs exclusively) was the right call
4. The batching approach (April 10) achieved 9x speedup with far less complexity by staying on the CDB path

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

## 2026-04-16: ASPACK Upload SLNGTH Investigation

### Problem
Samples uploaded via ASPACK play only the first ~40-48 samples. SLNGTH in the sample header stays at the value from the SDS stub creation, regardless of how much data ASPACK writes.

### Theories

All tested via raw SCSI CDBs (`test-aspack-slngth.ts`) — no client library.

**Theory A: Real length in dump header, no data packet, ASPACK fills.**
- Hypothesis: Dump header allocates memory. ASPACK fills data. No data packet needed.
- Session 8 result: Header ACK'd, ASPACK REPLY'd, but sample NOT created in RSLIST.
- Conclusion: **Dump header alone does not create a sample.** Data packet required.

**Theory B: 40-sample stub header + data packet, ASPACK fills, SDATA patches SLNGTH.**
- Hypothesis: Create small sample via SDS, fill with ASPACK, patch SLNGTH via SDATA.
- Session 8 result: Sample created. ASPACK FAILED (no REPLY). SDATA rejected (error code 1).
- Session 8 bugs: SLNGTH parsing offset was wrong (`5+59` instead of `59`). Fixed session 9.
- Open: Was ASPACK failure due to wrong index? Does device need commit time before ASPACK?
- Open: Does error code 1 mean SLNGTH can't exceed allocated memory?

**Theory C: Real length in header + 40-sample data packet, then ASPACK.**
- Hypothesis: Declare real count in header (allocates full memory), send 40-sample data packet (triggers creation). SLNGTH should already be correct from header.
- Not yet tested.
- Risk: Device may NAK the data packet if declared length doesn't match packet count.

### Resolved Issues
- SLNGTH nibble offset in raw test: `raw[59]` is correct (includes 5-byte SysEx header). Was using `5+59=64`.
- midiPoll: s2p returns 3 bytes, not 4. Parser fixed.

### Session 9 Results (corrected RSLIST parser)

Previous session's test failures were ALL caused by a bad RSLIST parser (used `(len-6)/24` instead of the 2-byte count at offset 5). The device had 7+ samples, not 3. Tests were overwriting existing samples, not creating new ones.

**Theory B (40-sample stub) — CONFIRMED WORKING:**
- 40-sample header + data packet → sample created (count increased)
- SLNGTH = 48 (device rounds up from 40 to internal block alignment)
- ASPACK write to new sample → REPLY received (was hidden in buffer padding)
- ASPACK does NOT update SLNGTH — it stays at 48

**Theory C (real length header + data packet) — FAILED:**
- Header ACK'd (WAIT then ACK), data packet ACK'd
- Sample NOT created — device waits for full SDS transfer to complete
- The SDS transfer is open-ended until all declared samples are received

**SDATA SLNGTH write — READ ONLY:**
- Attempted writing SLNGTH=20 to a sample with SLNGTH=48 via SDATA
- No REPLY received, SLNGTH unchanged on readback
- SLNGTH is controlled internally by the device, not writable via SDATA

### Proven Facts
1. SDS dump header declares length → device allocates memory AND expects that many samples via SDS packets
2. Device won't commit to RSLIST until the full SDS transfer completes
3. ASPACK writes data at arbitrary offsets but doesn't change SLNGTH
4. SLNGTH is read-only via SDATA — can't be patched after creation
5. The only way to set SLNGTH is through the SDS dump header at creation time

### Remaining Approaches
1. **Send full SDS transfer at declared length, then overwrite with ASPACK** — defeats ASPACK speed advantage
2. **Find another way to create samples with correct SLNGTH** — MESA's `SendAudioBufferToSampler` does it somehow, but we haven't disassembled that method
3. **Investigate whether ASPACK can grow the allocation** — untested; ASPACK writes beyond SLNGTH succeed but the data may not be playable
4. **Send SDS at maximum batch speed** — the batched SDS path (20 packets per CDB) runs at ~2.2 KB/s; for short samples this may be acceptable

### 2026-04-16 13:00 PDT — MESA II Disassembly: SendAudioBufferToSampler

Extracted `Sampler Editor 2.3` resource fork (506909 bytes) from Mac OS 9 disk image via hfsutils. Disassembled `SendAudioBufferToSampler` (0x030713 - 0x030cc5, 1458 bytes of 68k code). Binaries and disassembly archived in `docs/1.0/001-IN-PROGRESS/akai-ux-improvement/mesa-ii-analysis/`.

**Observations (from static disassembly — not yet validated against hardware):**

- **No ASPACK (0x0D) opcode push** found in the function body.
- **4 instances of `MOVE.B #$01,-(SP)`** — 0x01 is the SDS dump header opcode. This suggests MESA builds SDS headers, but the exact context of each push is not yet fully traced.
- **`MOVE.L #'BULK',-(SP)`** — passes the 'BULK' tag to the SCSI Plug's `SendData` method.
- **No explicit SDS data packet (0x02) push** — the BULK handler may construct data packets internally, or the data may be sent through a different mechanism.

**SCSI Plug dispatch table** (at 0x0e58 in scsi-plug-rsrc.bin — confirmed by hex inspection):

| Tag | Offset | Purpose (inferred) |
|-----|--------|---------|
| BOFF → SYSX | 0x04 | Possibly normal SysEx mode |
| BOFF | 0x1a | Possibly buffer-off cleanup |
| BULK | 0x30 | Bulk data transfer |
| MIDI | 0x2A2 | Possibly raw MIDI |
| SRAW | 0x46 | Possibly raw SysEx without handshake |
| SYSX | 0x246 | Possibly SysEx with handshake |

**Tentative interpretation:** MESA may send a complete SDS transfer using the BULK handler for optimized throughput. However, this is based on opcode scanning — the full control flow has not been traced through all branches.

### 2026-04-16 13:30 PDT — SCSI Plug BULK Handler Analysis

Disassembled the full `SendData` function (1068 bytes). Traced the BULK code path:

**Observations (from static analysis — needs hardware validation):**

1. The BULK path appears to check that the data starts with Akai SysEx framing (`F0` at byte 0, `0x47` at byte 1, `0x48` at byte 4).
2. It appears to check byte 3 (the opcode) against `0x0B` (SDATA). If the opcode is `0x0B`, it enters a code path that reads bytes 0x0b-0x0e from the data — these would be offset/length parameters if the message follows `BuildSampleDataRequest` format.
3. It calls `JSR $0000106E` which appears to be the raw SCSI send function (`SMSendData` based on address proximity to its name string at 0x16dc).

**Caution:** The 68k decoder is incomplete (many instructions show as `.word`). The control flow between the dispatch table match and the actual send is not fully traced. The interpretation that "BULK sends SDATA with offset/length" is a hypothesis, not proven.

### 2026-04-16 13:35 PDT — BuildSampleDataRequest Message Format

From disassembly of `BuildSampleDataRequest` (178 bytes at 0x06dc5b). This function's name and parameter types are known from the THINK C name string.

**Observed encoding (high confidence — the byte writes are explicit in the disassembly):**

```
F0 47 cc 0B 48 ss ss oo oo oo oo nn nn nn nn 01 00 F7
                ^^                             ^^
                SDATA opcode                   interval byte

  ss ss         — sample number (7-bit pair, LE)
  oo oo oo oo   — offset (4 × 7-bit bytes, LE)
  nn nn nn nn   — count (4 × 7-bit bytes, LE)
  01            — interval mode? (literal 0x01 written at offset 0x0f)
  00            — literal 0x00 at offset 0x10
  F7            — SysEx end
```

This message is 18 bytes and contains NO audio data. It appears to be a request/command header.

**Open question:** How does the actual PCM audio data get transmitted? Possibilities:
1. The BULK handler appends PCM data to the same CDB 0x0C write (making one large SCSI transfer)
2. The PCM data follows in a subsequent CDB 0x0C write
3. The PCM data is sent through a completely different mechanism (direct SCSI block write?)

**NOT YET TESTED against hardware.**

### 2026-04-16 14:00 PDT — Hardware Test: SDATA with offset/length

Sent the `BuildSampleDataRequest` message format to the S3000XL via SCSI MIDI (CDB 0x0C). Test file: `test-sdata-bulk-probe.ts`.

**Results:**
- SDATA with offset/length (0x0B opcode + sample#/offset/count): **no response**. Device ignores it completely.
- Tried with CDB flag 0x00 and 0x80: no response either way.
- Normal RSDATA (0x0A, header read): works fine, 230 bytes returned.

**Interpretation:** The SDATA-with-offset-length command does not work over the SCSI MIDI channel (CDB 0x0C/0x0D/0x0E). This is consistent with the earlier finding that RSPACK (0x0C) also doesn't work over SCSI MIDI. Both are sample DATA commands (as opposed to sample HEADER commands), and both are silent.

**This suggests MESA's BULK handler does NOT send sample data through CDB 0x0C (MIDI send).** It may use a different CDB entirely — possibly a vendor-specific CDB for direct memory/data transfer, or it may layer the data differently (e.g., appending PCM data to the SysEx message itself before sending via CDB 0x0C).

### Open Questions (as of 2026-04-16 14:00 PDT)
1. How does MESA's SCSI Plug actually send the PCM data in BULK mode? The `SMSendData` function uses CDB 0x0C — but does it send the 18-byte header alone, or does it build a larger payload that includes the PCM data inline?
2. Could the data be nibble-encoded PCM appended to the SDATA SysEx message before the F7 terminator? (Similar to how ASPACK sends nibble-encoded data in a single SysEx message.)
3. Is there a completely separate SCSI command (not CDB 0x0C) for bulk data?

### Next Steps
1. **Disassemble SMSendData more carefully** — trace exactly what data buffer it sends. Does it send just the 18-byte header, or does the Sampler Editor append PCM data to the buffer before calling SendData?
2. **Look at SendAudioBufferToSampler more carefully** — what does it put in the buffer that gets passed to SendData with BULK mode? The 'BULK' tag and the BuildSampleDataRequest header may be just part of a larger structure.

### Test Files
- `test-aspack-slngth.ts` — original multi-theory test (RSLIST parser bug, needs update)
- `test-theory-b.ts`, `test-b-fixed.ts`, `test-b-full.ts` — Theory B validation
- `test-c-fixed.ts` — Theory C validation
- `test-sdata-slngth.ts` — SDATA SLNGTH write test

---

## 2026-04-10 16:00 PDT: ASPACK End-to-End — Multi-Chunk, Bridge, Web Editor

### Multi-chunk solved

The multi-chunk ASPACK bug from the previous session was **the poll flag**. CDB 0x0D (poll) with flag 0x80 returns 0 bytes on the S3000XL. Flag 0x00 works. This was the opposite of what MESA II documentation suggested. Same applies to CDB 0x0C (send) — flag 0x00 required.

### Sample creation

ASPACK alone cannot create new samples. The minimum viable creation: 1 SDS dump header + 1 SDS data packet (40 samples of silence). This registers the sample in the RSLIST in ~700ms. Then ASPACK overwrites the data at any size.

### Block boundary bug

ASPACK rejects writes starting at exact multiples of 8192 samples (for N≥1). Chunk size 8191 avoids all boundaries. Single-chunk works for samples ≤60,000 (below any boundary).

### Bridge integration

New WebSocket endpoint `sample-upload-fast`: creates sample slot via minimal SDS, queries RSLIST for index, writes PCM via ASPACK chunks. Stall-based timeout replaces fixed overall timeout — resets 30s deadline on every progress message.

### Throughput

- Single chunk (≤60K samples): 23.4 KB/s
- Multi-chunk (8191-sample chunks): ~17.2 KB/s (944ms per chunk including poll+ACK overhead)
- vs SDS batched: 2.2 KB/s
- Speedup: 8-10x over SDS

### Bug fixes this session

- **ASPACK timeout**: 573K-sample upload took 67s but bridge timeout was 57s. Transfer completed on device but bridge killed the connection. Fixed with stall-based timeout.
- **Ghost dialog**: `deviceSampleCount` in SendSampleDialog's useEffect deps caused the effect to re-fire after `onTransferComplete` refreshed device state, resetting the dialog to "ready" phase.
- **Device memory scroll**: `max-h-48` capped name lists at 192px regardless of available space.

---

## Open Questions

- ~~Can ASPACK write at offset > 0?~~ **Yes** — poll flag 0x00 was the bug, not the offset.
- ~~Is there an undocumented SysEx opcode for creating empty sample slots?~~ **No** — use minimal SDS (1 header + 1 data packet).
- Can the S3000 protocol mode be toggled via SysEx?
- Why does s2p take 113ms per SCSI CDB? Is there internal locking, logging, or device emulation overhead?
- What does MESA's `SetSCSIMIDIMode` 84-byte config block contain?
