# Decision Record — 2026-04-18

**Decision:** SDS optimization (Option 1 from #315) is insufficient. Continue MESA II reverse engineering to find what makes MESA's sample throughput fast — this is the only remaining path that justifies the SCSI bridge infrastructure.

**Supersedes:** earlier #315 commitment to Option 1 (SDS optimize).

**Scope:** feature-wide; all future Phase 3 work should derive from this decision until it's itself superseded.

---

## What changed between the earlier decision and this one

**Earlier (2026-04-18, morning session):** pick Option 1 (SDS optimize) from four options in #315. Ship at 8 KB/s minimum throughput. Codex parity endorsed.

**What Phase 3.1-3.3 produced:**
- Baseline: **2.91 KB/s** on 16000-sample upload, measured through production `/sds/stream` path
- Batch-size sweep (20/40/60/100/150/200): batch=20 is the optimum; larger batches degrade throughput 30-60%
- Pipeline-depth sweep (1-8): depth=1 is the optimum; higher depths degrade 30-40%
- Per-packet math: 27ms × 80 audio bytes = 2.96 KB/s — matches measured throughput exactly
- **The device IS the rate-limiter, not the bridge.** SDS can't meaningfully go faster than 3 KB/s on this hardware, period.

**What the user reframed:**

> "The ENTIRE SCSI infrastructure is only interesting if we can provide reasonable sample data throughput to and from the device. It needs to be about an order of magnitude greater than the serial MIDI case, which already works — and, can be used with samplers WITHOUT SCSI devices attached. To me, that means we need to keep working on figuring out how MESA II makes sample data throughput fast."

## Why SDS at 3 KB/s doesn't justify the SCSI bridge

Throughput math:
- Serial MIDI wire ceiling: 31250 baud / 10 = 3.125 KB/s wire
- SDS encodes 16-bit samples as 3 wire bytes (50% framing overhead)
- Serial-MIDI SDS audio ceiling: ~2.1 KB/s
- SCSI SDS measured: 2.91 KB/s
- **Speedup: ~1.4x** — not an order of magnitude

The SCSI bridge's complexity cost:
- Raspberry Pi hardware + setup + networking
- scsi2pi fork + custom Rust bridge daemon
- Docker cross-compile toolchain for ARM64
- Deployment pipeline (make targets, runner scripts)
- Recurring build-system issues (stale stamp files in fresh worktrees, etc.)
- SCSI cable + termination + ID configuration on the user's side

1.4x throughput improvement over a transport that "just works" with any MIDI-equipped sampler does not earn that complexity. If the SCSI bridge ships with only 1.4x improvement for sample upload, users with simpler hardware make the right call to skip it.

**Order-of-magnitude threshold:** ~10x serial MIDI = 20+ KB/s. That's what MESA II delivers in period-accurate use (estimated, not measured — see Guard Rails below). That's the target.

## Why continuing MESA II RE is the only remaining path

Three options to reach 20+ KB/s throughput were weighed:

**1. Find an undocumented Akai opcode that uploads fast with correct SLNGTH.** Rejected: firmware-state risk, speculative. Unchanged from #315 Option 3 rejection.

**2. Measure what MESA II actually does and reproduce it.** This is the current path. Continues the #315 Option 2 work (harness end-to-end) in a narrower form: decode MESA's upload chain function-by-function from primary evidence until we have a testable hypothesis.

**3. Measure MESA II directly.** Blocked — we don't have vintage Mac OS 9 hardware with working SCSI to the S3000XL. The SheepShaver-over-network-SCSI path has persistent Gestalt timing problems that make MESA unusable through it. That's why we're reverse-engineering the binaries in the first place.

Path 2 is the only viable one. We've already decoded most of MESA's chain:
- Sampler Editor side: `SendAudioBufferToSampler` (full call graph)
- `BuildSampleHeaderFromMAH` (200-byte Akai header layout)
- `AcceptSampleHeader` (vtable[0x017c], SysEx builder dispatch)
- `BuildCommand` (CAkaiMIDIDispatcher vtable[0x14], 392-byte SysEx output)
- `SwapLongWord` (CAkaiMIDIDispatcher vtable[0x38], SLNGTH encoding)
- `ActivateThisSocket` (CMESASocket vtable[0x30], in-memory state, NO wire output)
- `UALL` dispatch path (this+4 → vtable[0x28] command-bus, also no wire output per Codex #314)
- SCSI Plug side: `SendData` dispatch table, BULK handler, BOFF handler

**Remaining gap:** SRAW. MESA sends PCM audio data via `SendData(socket, 'SRAW', byte_count, buf_ptr)` in the upload loop. The harness Phase 5 traced BULK but skipped SRAW with an inference comment. Nobody has actually produced primary evidence of what bytes SRAW emits on the wire. That's the next decode target.

## What this decision commits us to AVOID

**Do not measure ASPACK throughput and infer from it.** The bridge comment says ASPACK is 10x SDS, but we have no primary evidence that ASPACK data is actually committed to device memory. The device's REPLY 0x16 may mean "received" not "saved." Without a sample-data readback round trip proving the audio is actually there, any ASPACK throughput measurement is meaningless. And we don't have a working sample-data readback path.

**Do not infer from MESA's observed UI throughput.** We've estimated MESA's empirical throughput at ~50 KB/s based on period screen-captures and user experience reports. That's inference, not measurement. Any plan that depends on a specific MESA throughput number is conjecture.

**Do not pursue SDS micro-optimization any further.** Phase 3.4 (skip per-packet ACK) and Phase 3.5 (hardware verify) in their current scope are dead. The device processes SDS packets at ~27ms each; bridge-side optimizations can't change that.

**Do not ship ASPACK-with-broken-SLNGTH as default delivery path.** Broken SLNGTH means samples play only their first ~48 samples correctly. That's data corruption shaped like a feature. Acceptable as opt-in "advanced mode" only if there's a clear user acknowledgment.

**Do not build plans on code comments.** The `upload_sample_aspack` comment saying "10x faster than SDS" was written during an earlier session by someone who may have measured it or may not have. Until we re-measure AND verify data commit, treat it as unverified.

## Path forward

1. **Decode SRAW's wire-bytes behavior** from primary evidence (static decode of SCSI Plug, extended harness trace, or both). The $1106E patchable slot is the critical junction.
2. **Evaluate after the decode produces data.** If the decoded behavior is testable from the bridge, write a test. If it's not, continue decoding upward until something testable falls out.
3. **No further commitments beyond #1 until #1 produces evidence.**

## Guard rails adopted (now enforced on all future work)

- **Primary evidence only:** every claim must cite a file offset, decoded assembly, or trace output
- **Measured > inferred:** throughput numbers from measurement, not from comments or extrapolation
- **No speculation about MESA II's behavior** beyond what's in the decoded binaries
- **Verify data commit, not just ACK:** a device REPLY is not proof the data was saved; only sample-data round-trip comparison is
- **Stop if a decode path produces a testable hypothesis** — don't keep decoding speculatively; shift to hardware testing of the hypothesis

## Related issues

- #315 (parent decision issue) — will be updated with a comment pointing at this record
- #304, #305, #306, #307 (parent/phase feature issues)
- #309, #310, #311, #312, #313, #314 (Codex parity wave — all open, still awaiting user close)
