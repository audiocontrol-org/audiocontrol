# Phase 2 Findings: SCSI Bus Access Constraints

**Date:** 2026-04-01

## Key Finding: s2pexec and s2p Cannot Coexist

`s2pexec` (SCSI initiator tool) and `s2p` (SCSI target daemon) both need exclusive access to the PiSCSI board's GPIO/SCSI bus. They cannot run simultaneously.

- `s2pexec` fails with: "Can't register event request. If s2p is running, shut it down first."
- `s2p` cannot be started while `s2pexec` holds the bus
- There is no shared-bus mode

This means the bridge daemon cannot simply shell out to `s2pexec` while `s2p` is running (which it needs to be for the sampler to access disk images).

## s2pctl: Control Interface for Running s2p

`s2pctl` communicates with the running `s2p` process to manage emulated devices:

```
s2pctl -l          # List attached devices
s2pctl -T          # List device types
s2pctl -o          # List remote operations
s2pctl -c attach   # Attach a device
s2pctl -c detach   # Detach a device
```

But `s2pctl` does NOT support:
- Raw SCSI initiator commands (INQUIRY, READ, WRITE)
- Sending arbitrary data to a target device
- SCSI bus scanning while s2p is running

## Available s2p Device Types

```
SAHD  — SASI hard drive
SCCD  — SCSI CD-ROM
SCDP  — DaynaPort network bridge
SCHD  — SCSI hard drive (currently used for disk images)
SCHS  — SCSI Host Services (unknown purpose, no properties listed)
SCLP  — SCSI printer
SCMO  — SCSI magneto-optical
SCRM  — SCSI removable media
SCSG  — SCSI generic
SCTP  — SCSI tape
```

`SCHS` and `SCSG` may be relevant for MIDI-via-SCSI but need investigation.

## Current Device Configuration

```
ID 0-5: SCHD (hard drives, disk images for sampler)
ID 6:   (S3000XL — not an emulated device, it's the physical sampler)
ID 7:   SCHD (another disk image) — this is also the board/initiator ID
```

Note: ID 7 is both the PiSCSI board's initiator ID AND has a disk image attached. This may need to change for MIDI-via-SCSI.

## Implications for Bridge Design

### Option A: Stop/Start s2p for Each Transfer
- Stop s2p → run s2pexec → restart s2p
- Simple but disruptive (sampler loses disk access during transfer)
- May cause sampler errors if it's accessing a disk image

### Option B: Use s2p's Device Emulation
- Attach a custom device type (SCHS? SCSG?) that handles MIDI-via-SCSI
- The sampler writes MIDI SysEx to this emulated device
- s2p captures the writes and pipes them to the bridge daemon
- No bus contention since s2p manages everything

### Option C: Modify s2p to Support Initiator Commands
- Extend s2p with an API endpoint for sending raw SCSI commands
- s2p could briefly switch to initiator mode, send the command, then resume target mode
- Requires SCSI2Pi source modifications

### Recommendation

**Option B is the most promising** for the read path (sampler → laptop). The sampler initiates a MIDI-via-SCSI dump, which is a SCSI WRITE to the Pi. If s2p has a device type that captures incoming writes, we can pipe them to the bridge.

**For the write path** (laptop → sampler), we may need to temporarily stop s2p. But this should only happen during active sample transfers, not continuously.

**Phase 3 (capture)** must happen with s2p stopped, since we need s2pexec in trace mode. This is a one-time research step.

## Next Steps

1. Phase 3: Stop s2p, run capture, document CDB format
2. Investigate SCSG device type — can it pipe incoming writes to userspace?
3. Check SCSI2Pi documentation/source for processor device support
