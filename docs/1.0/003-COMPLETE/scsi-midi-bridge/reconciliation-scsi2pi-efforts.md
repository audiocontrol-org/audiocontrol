# Reconciliation: SCSI MIDI Bridge and SheepShaver/MESA II/scsi2pi Efforts

**Date:** 2026-04-05

## Overview

Two parallel efforts both extend the scsi2pi protobuf API to enable communication with the Akai S3000XL over a Raspberry Pi's SCSI bus. This document maps how the pieces relate, where they overlap, and how to reconcile them going forward.

## The Two Efforts

### 1. SCSI MIDI Bridge (audiocontrol)

**Purpose:** Enable audiocontrol's browser-based editor to send/receive Akai SysEx and SDS sample data over SCSI via WiFi.

**Repos:**
- `audiocontrol-org/audiocontrol` (branch `feature/scsi-midi-bridge`) — Rust bridge daemon + TypeScript transport
- `audiocontrol-org/scsi2pi` (branch `feature/midi-processor`) — scsi2pi fork with `MIDI_*` operations and SCMP device

**Architecture:**
```
Browser (audiocontrol)
    ↓ HTTP/WebSocket (port 7033)
scsi-midi-bridge daemon (Rust/Axum)
    ↓ Protobuf: MIDI_INIT/SEND/POLL/READ (ops 200-203)
s2p (scsi2pi fork, port 6868)
    ��� SCSI CDBs: 0x09, 0x0C, 0x0D, 0x0E
Akai S3000XL
```

**What it uses from the scsi2pi fork:**
- `MIDI_INIT` (200) — Activate MIDI-via-SCSI session (sends CDB `0x09`)
- `MIDI_SEND` (201) — Send SysEx to sampler (sends CDB `0x0C`)
- `MIDI_POLL` (202) — Poll for pending response bytes (sends CDB `0x0D`)
- `MIDI_READ` (203) ��� Read buffered response (sends CDB `0x0E`)

These are **high-level convenience operations** — s2p knows the MIDI-via-SCSI 4-step CDB protocol internally and executes the right SCSI commands on behalf of the caller. The Rust bridge daemon never constructs raw CDBs.

### 2. SheepShaver/MESA II Network SCSI Bridge

**Purpose:** Run MESA II (Akai's Mac OS 9 SCSI editor) in SheepShaver on a modern Mac, connecting to a real S3000XL via the Pi's SCSI bus over the network. Goals: (a) observe how MESA II communicates over SCSI to build a definitive protocol reference, (b) provide a working MESA II setup without vintage Mac hardware.

**Repos:**
- `audiocontrol-org/scsi2pi` (branch `feature/midi-processor`) — Same fork, also has `SCSI_EXEC` operation
- Fork of `kanjitalk755/macemu` (branch `feature/scsi-network-bridge`) — SheepShaver with network SCSI backend

**Architecture:**
```
MESA II (Mac OS 9 in SheepShaver)
    ↓ SheepShaver SCSI Manager emulation
scsi_s2p.cpp (SheepShaver network backend)
    ↓ Protobuf: SCSI_EXEC (op 210)
s2p (scsi2pi fork, port 6868)
    ↓ Raw SCSI CDBs (any command)
Akai S3000XL / disk images
```

**What it uses from the scsi2pi fork:**
- `SCSI_EXEC` (210) — Generic SCSI command execution: caller provides a raw CDB, data direction, and data buffer; s2p executes it on the bus and returns the SCSI status + response data.

This is a **low-level generic operation** — the SheepShaver backend constructs raw CDBs exactly as Mac OS 9's SCSI Manager would, and s2p acts as a transparent SCSI bus proxy.

## How They Share the scsi2pi Fork

Both efforts live on the **same branch** (`feature/midi-processor`) of the scsi2pi fork. The proto file (`api/s2p_interface.proto`) defines all operations:

```protobuf
// High-level MIDI-via-SCSI (used by SCSI MIDI Bridge daemon)
MIDI_INIT = 200;
MIDI_SEND = 201;
MIDI_POLL = 202;
MIDI_READ = 203;

// Low-level generic SCSI (used by SheepShaver backend)
SCSI_EXEC = 210;

// Device type (prototyped, not in production use)
SCMP = 12;  // MIDI Processor device
```

Both the Rust bridge daemon and the SheepShaver C++ backend use **hand-rolled protobuf encoding** (no protoc dependency) to communicate with s2p on port 6868. They use the same wire format: `"RASCSI"` magic + LE length + protobuf payload.

## Can They Coexist?

**Yes.** Both are TCP clients to the same s2p process. Multiple clients can connect to port 6868 simultaneously. s2p serializes SCSI bus operations at the hardware level (one command at a time), so concurrent requests queue naturally.

In practice:
- The bridge daemon connects when the audiocontrol editor is active
- SheepShaver connects when MESA II is running
- Both can be running at the same time — s2p handles request serialization

## Does SCSI_EXEC Supersede the MIDI Bridge?

**At the protocol level, yes.** `SCSI_EXEC` can execute the exact same CDBs that `MIDI_INIT/SEND/POLL/READ` use internally:

| MIDI operation | Equivalent SCSI_EXEC CDB |
|---------------|--------------------------|
| `MIDI_INIT` | `SCSI_EXEC` with CDB `09:00:01:01:00:00` |
| `MIDI_SEND` | `SCSI_EXEC` with CDB `0C:00:00:00:LL:00` + DATA OUT |
| `MIDI_POLL` | `SCSI_EXEC` with CDB `0D:00:00:00:00:00` + DATA IN (3 bytes) |
| `MIDI_READ` | `SCSI_EXEC` with CDB `0E:00:00:00:LL:00` + DATA IN |

**At the architectural level, no.** The `MIDI_*` operations provide a cleaner abstraction:
- The bridge daemon doesn't need to know the CDB format
- s2p handles the init/send/poll/read state machine
- Error handling and retry logic are encapsulated
- The Rust code is simpler and more readable

**Recommendation:** Keep both. The `MIDI_*` operations are a domain-specific convenience layer on top of `SCSI_EXEC`. Removing them would push CDB construction into the Rust bridge daemon with no benefit. However, if the scsi2pi fork API surface needs to be minimized for upstream contribution, `SCSI_EXEC` alone would be sufficient and the bridge daemon could be refactored to use it.

## Current State of Each Effort

### SCSI MIDI Bridge
- **Status:** Phases 2-5 complete (Phase 5 partial — SDS Data Packet firmware limitation)
- **Deployed:** Bridge daemon running on Pi, all Akai SysEx commands working over SCSI
- **Open issue:** Write persistence under investigation (`feature/scsi-write-validation`)

### SheepShaver/MESA II
- **scsi2pi fork:** `SCSI_EXEC` implemented and working, including emulated READ/WRITE routing for disk images
- **SheepShaver backend:** `scsi_s2p.cpp` (464 lines) implemented with hand-rolled protobuf, INQUIRY probing, S/G table handling
- **Mac OS 9 boots** in SheepShaver Docker with the s2p backend, can mount disk images over the network
- **MESA II:** SCSIAction interception work in progress (last commits Apr 3 are debug/fix for PLUG analysis)
- **Status:** Actively stabilizing — SheepShaver can boot and access SCSI devices, but MESA II SCSI Plug integration is still being debugged

### scsi2pi Fork
- **Branch:** `feature/midi-processor` (31 commits ahead of upstream)
- **Contains:** `MIDI_*` operations, `SCSI_EXEC` operation, SCMP device type, emulated device routing
- **Deployed on Pi:** Yes (the running s2p instance uses this fork)
- **Not upstreamed:** All changes are local to the fork

## Reconciliation Recommendations

### 1. Keep the scsi2pi fork branch unified

Both `MIDI_*` and `SCSI_EXEC` operations live on the same `feature/midi-processor` branch. This is correct — they serve different clients but share the same s2p process. No branch split needed.

### 2. Deploy the same fork to the Pi

Both efforts depend on the same scsi2pi fork. The Pi should always run the `feature/midi-processor` branch build. Document the deployment procedure (build, cross-compile, systemd restart).

### 3. Consider SCSI_EXEC as the long-term path

If the goal is to upstream changes to scsi2pi, `SCSI_EXEC` is the more general and upstreamable operation. The `MIDI_*` operations are Akai-specific convenience and less likely to be accepted upstream. A future refactor could:
- Upstream `SCSI_EXEC` to scsi2pi proper
- Refactor the bridge daemon to use `SCSI_EXEC` with raw CDBs
- Drop the `MIDI_*` operations from the fork

This is not urgent — the current setup works — but it would simplify the fork delta.

### 4. The SCMP device can be retired

The SCMP (MIDI Processor) target-mode device was prototyped but never used in production due to the 0x0D MESSAGE IN timeout. Both the bridge daemon and SheepShaver use initiator-mode operations (`MIDI_*` and `SCSI_EXEC` respectively) via the protobuf API. The SCMP code can remain in the fork for reference but is not load-bearing.

### 5. SheepShaver findings should flow back to SCSI MIDI Bridge

Once MESA II is fully working through the SheepShaver bridge, captured SCSI traffic should be compared against the audiocontrol bridge's behavior to:
- Confirm our write commands match MESA II's format exactly
- Understand how MESA II handles write acknowledgment and timing
- Potentially resolve the write persistence issue (`feature/scsi-write-validation`)

## Repo and Branch Map

| Component | Repo | Branch | Language | Status |
|-----------|------|--------|----------|--------|
| SCSI MIDI Bridge daemon | audiocontrol-org/audiocontrol | feature/scsi-midi-bridge | Rust | Complete |
| SCSI MIDI transport | audiocontrol-org/audiocontrol | feature/scsi-midi-bridge | TypeScript | Complete |
| scsi2pi fork (MIDI_* + SCSI_EXEC + SCMP) | audiocontrol-org/scsi2pi | feature/midi-processor | C++ | Complete |
| SheepShaver network backend | fork of kanjitalk755/macemu | feature/scsi-network-bridge | C++ | In progress |
| SheepShaver/MESA II feature docs | audiocontrol-org/audiocontrol | feature/scsi-midi-bridge | Markdown | Draft |
| SCSI write validation | audiocontrol-org/audiocontrol | feature/scsi-write-validation | TypeScript | Planning |
