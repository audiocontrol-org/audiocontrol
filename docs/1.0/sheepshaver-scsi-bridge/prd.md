# SheepShaver SCSI Network Bridge - Product Requirements Document

**Created:** 2026-04-02
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Vintage Akai sampler editors like MESA II require a physical SCSI connection to communicate with hardware like the Akai S3000XL. This currently requires a vintage Macintosh with a SCSI card — hardware that is increasingly rare, expensive, and unreliable. SheepShaver can emulate Mac OS 9 on modern Macs but has no way to connect to SCSI devices over a network.

Meanwhile, Raspberry Pi boards running scsi2pi (with PiSCSI boards) already provide SCSI bus access for vintage hardware. Bridging SheepShaver's SCSI interface to scsi2pi over TCP would eliminate the need for vintage Mac hardware entirely.

## User Stories

- As a vintage sampler owner, I want to run MESA II on my modern Mac and connect to my S3000XL via a Pi, so that I don't need to maintain a vintage Mac with SCSI hardware
- As a developer, I want to capture MESA II's exact SCSI traffic to understand proprietary protocols, so that I can implement compatible software
- As an audiocontrol user, I want fast sample data transfer between the browser editor and my sampler, so that I can work with audio at SCSI bus speed instead of MIDI baud rate

## Success Criteria

- [ ] SheepShaver running on macOS can discover SCSI devices on a remote Pi running scsi2pi
- [ ] MESA II running in SheepShaver can connect to a real Akai S3000XL via the network bridge
- [ ] MESA II can read and write programs, keygroups, and sample headers via the bridge
- [ ] MESA II can transfer sample waveform data via the bridge
- [ ] All SCSI commands and responses are logged for protocol analysis
- [ ] Configuration requires only a hostname/IP and port (no complex setup)

## Scope

### In Scope

- Network SCSI backend for SheepShaver (`scsi_s2p.cpp`)
- Generic SCSI command execution API in s2p (`SCSI_EXEC` protobuf operation)
- SCSI command logging for protocol reverse-engineering
- Configuration via SheepShaver preferences file
- Documentation for setup and usage

### Out of Scope

- Modifying SheepShaver's Mac SCSI Manager emulation (it already works)
- Supporting non-SCSI2Pi SCSI bridges
- GUI configuration (prefs file is sufficient)
- Performance optimization beyond functional correctness
- Supporting multiple simultaneous SheepShaver clients

## Dependencies

- scsi2pi fork with MIDI-over-SCSI support (audiocontrol-org/scsi2pi, branch feature/midi-processor)
- SheepShaver/macemu (kanjitalk755/macemu)
- Raspberry Pi with PiSCSI board running scsi2pi
- Akai S3000XL (or compatible) connected via SCSI

## Open Questions

- [ ] Should the SCSI_EXEC operation reuse the existing MIDI command queue or have its own queue?
- [ ] Does SheepShaver's macOS build support custom SCSI backends, or only the dummy?
- [ ] What SheepShaver preferences format should we use for s2p host/port configuration?

## Appendix

### SheepShaver SCSI Backend Interface

The backend must implement 5 functions (from `scsi.h`):

```c
void scsi_set_cmd(int cmd_length, uint8 *cmd);
bool scsi_is_target_present(int id);
bool scsi_set_target(int id, int lun);
bool scsi_send_cmd(size_t data_length, bool reading,
                   int sg_index, uint8 **sg_ptr, uint32 *sg_len,
                   uint16 *stat, uint32 timeout);
```

### Existing Implementations

- `scsi_linux.cpp` — Linux /dev/sg* backend (reference implementation)
- `scsi_dummy.cpp` — No-op template
- `scsi_beos.cpp` — BeOS raw device backend

### Protocol Wire Format

s2p uses: `"RASCSI"` magic (6 bytes) + LE length (4 bytes) + protobuf payload. Response: LE length (4 bytes) + protobuf payload. One TCP connection per command.
