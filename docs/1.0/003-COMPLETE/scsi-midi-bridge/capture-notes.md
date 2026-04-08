# Phase 3 Capture Notes: S3000XL MIDI-via-SCSI Protocol

**Date:** 2026-04-01
**Device:** Akai S3000XL (firmware 2.00, SCSI ID 6)
**Bridge:** SCSI2Pi 6.2.1 on Raspberry Pi (board ID 7)
**Capture method:** s2p in trace mode with SCHS and SCDP device types at ID 0

## Captured Command Sequence

When the S3000XL initiates a MIDI-via-SCSI dump, it sends this sequence to the remote SCSI device:

### Initial probe (first contact)

| # | Command | CDB | Description |
|---|---------|-----|-------------|
| 1 | RETRIEVE STATS | `09:00:01:01:00:00` | Read 257 bytes? (processor RECEIVE command) |
| 2 | SET INTERFACE MODE | `0c:00:00:00:54:00` | Send 84 bytes (0x54) of config data |
| 3 | TEST UNIT READY | `00:00:00:00:00:00` | Standard readiness check |
| 4 | INQUIRY | `12:00:00:00:07:00` | Request 7 bytes of device identification |
| 5 | SEND (SET MULTICAST) | `0d:00:00:00:00:00` | SEND with 0-byte transfer (probe) |

### Retry loop (on failure)

After each failed SEND command:
1. Bus RESET
2. TEST UNIT READY
3. INQUIRY
4. SEND (retry)

The S3000XL retries the probe 4-5 times before giving up.

## SCSI Command Analysis

### CDB `0x09` — RECEIVE (6)

Standard SCSI processor command. The S3000XL uses this to read data from the remote device.

```
CDB: 09:00:01:01:00:00
     │  │  │  │  │  └─ control
     │  │  └──┴──┘── transfer length (0x000101 = 257 bytes?)
     │  └─ LUN/reserved
     └─ opcode: RECEIVE
```

### CDB `0x0C` — SET INTERFACE MODE

Not a standard SCSI command. Akai-proprietary. Used to configure the MIDI-via-SCSI interface.

```
CDB: 0c:00:00:00:54:00
     │  │  │  │  │  └─ control
     │  │  └──┴──┘── transfer length (0x000054 = 84 bytes)
     │  └─ LUN/reserved
     └─ opcode: Akai proprietary (configuration)
```

This is a DATA OUT command — the S3000XL sends 84 bytes of configuration data to the remote device. The SCHS device rejected this as ILLEGAL REQUEST.

### CDB `0x0D` — SEND (6)

Standard SCSI processor command. The S3000XL uses this to send MIDI SysEx data to the remote device.

```
CDB: 0d:00:00:00:00:00
     │  │  │  │  │  └─ control
     │  │  └──┴──┘── transfer length (0x000000 = 0 bytes — probe)
     │  └─ LUN/reserved
     └─ opcode: SEND
```

The initial SEND has a 0-byte transfer length — it's a capability probe. The S3000XL checks if the remote device supports the SEND command before attempting a real data transfer.

## Device Type Requirements

The remote SCSI device must:

1. Respond to **INQUIRY** with device type `0x03` (Processor)
2. Accept **SEND** (`0x0D`) commands with variable-length DATA OUT phase
3. Accept proprietary command `0x0C` with 84-byte DATA OUT phase
4. Support **RECEIVE** (`0x09`) for reading data back
5. Handle **TEST UNIT READY** (`0x00`) with GOOD status

### Built-in SCSI2Pi device types tested:

| Type | Result |
|------|--------|
| SCHS (Host Services) | Rejects SEND (0x0D) as ILLEGAL REQUEST |
| SCDP (DaynaPort) | Handles RECEIVE (0x09) but returns wrong data format; S3000XL refuses to ACK |

Neither built-in type supports the S3000XL's MIDI-via-SCSI protocol.

## SCSI2Pi Extensibility Analysis

**SCSI2Pi has no plugin system.** Device types are hardcoded in `device_factory.cpp` with compile-time `BUILD_*` guards and a switch statement. Adding a new device type requires modifying the source:
- Add a new `PbDeviceType` enum value in the protobuf definition
- Add a new case in `DeviceFactory::CreateDevice()`
- Implement the device class inheriting from `PrimaryDevice`

**The DaynaPort device (`SCDP`) uses the same SCSI opcodes** as the S3000XL's MIDI-via-SCSI:
- `0x09` = `CMD_SCSILINK_STATS` (DaynaPort) / RECEIVE (S3000XL)
- `0x0C` = `CMD_SCSILINK_SET` (DaynaPort) / SET INTERFACE MODE (S3000XL)
- `0x0D` = `SetMcastAddr` (DaynaPort) / SEND (S3000XL)

The DaynaPort pipes data to/from a TAP network interface. A MIDI processor device would pipe data to/from a socket (for the bridge daemon).

## Recommendation: Fork SCSI2Pi

A standalone SCSI target would require reimplementing all low-level SCSI bus handling (GPIO, selection, bus phases, data transfer) — hundreds of lines of timing-critical code that SCSI2Pi already handles correctly.

**Recommended approach:** Fork SCSI2Pi and add a `SCMP` (SCSI MIDI Processor) device type based on the DaynaPort pattern:
1. Responds to INQUIRY as device type `0x03` (Processor)
2. Accepts SEND (`0x0D`) — pipes DATA OUT to a Unix domain socket
3. Accepts `0x0C` — accepts 84-byte config data with GOOD status
4. Responds to RECEIVE (`0x09`) — reads queued data from the socket
5. Returns GOOD for zero-length SEND probes

The bridge daemon connects to the Unix socket and relays SysEx between the SCSI device and the network (audiocontrol).

## Next Steps

1. Fork SCSI2Pi repository
2. Implement SCMP device type (based on DaynaPort template)
3. Test with S3000XL — verify it completes the full SEND sequence
4. Capture actual SEND with SysEx payload data
5. Implement bridge daemon socket relay

## SCMP Device Implementation Progress

Built a custom SCSI2Pi device type (SCMP) at `audiocontrol-org/scsi2pi` branch `feature/midi-processor`.

### What works:
| Command | Opcode | Status |
|---------|--------|--------|
| TEST UNIT READY | 0x00 | ✅ GOOD |
| INQUIRY | 0x12 | ✅ Returns 7 bytes, processor type 0x03 |
| RETRIEVE STATS | 0x09 | ✅ StatusPhase GOOD |
| SET INTERFACE MODE | 0x0C | ✅ Receives config data (21-63 bytes) via DataOutPhase |
| ENABLE INTERFACE | 0x0E | ✅ StatusPhase GOOD |
| SET MULTICAST ADDR | 0x0D | ❌ MESSAGE IN timeout (see below) |

### The 0x0D problem:

The S3000XL sends `CDB 0d:00:00:00:00:00` (vendor-specific, zero transfer length). After COMMAND phase, our device enters STATUS phase with GOOD. The controller then transitions to MESSAGE IN to send COMMAND COMPLETE (1 byte). The S3000XL **does not ACK** this byte — 3-second timeout, then bus RESET.

Tried:
- `StatusPhase()` — MESSAGE IN timeout
- `DataOutPhase(0)` — skipped by controller, same as StatusPhase
- `DataOutPhase(512)` — DATA OUT entered, S3000XL sends 0 bytes, timeout
- `DataInPhase(0)` — skipped by controller, same as StatusPhase
- Akai vendor/product in INQUIRY — no change
- SCHD (hard drive) device type — same 0x0D behavior

Opcode 0x0D is **vendor-specific** per the T10 SCSI standards (not the standard SEND command, which is 0x0A). The S3000XL firmware may handle the SCSI bus phases differently for this vendor command — possibly skipping MESSAGE IN entirely, or expecting a non-standard phase sequence.

### Next steps:

1. **Capture working traffic** — run MESA II (Akai's Mac OS 9 SCSI editor) in SheepShaver emulator with virtual SCSI passthrough to see what a working implementation does for 0x0D
2. **Consult SCSI2Pi maintainer** — he may recognize the MESSAGE IN timeout pattern or know of vendor-specific command quirks
3. **Try modifying SCSI2Pi controller** — skip MESSAGE IN for vendor commands, go directly from STATUS to BUS FREE

## FULL PROTOCOL DECODED (2026-04-02)

The complete SCSI MIDI protocol for the Akai S3000XL:

| Step | CDB | Direction | Purpose |
|------|-----|-----------|---------|
| 1. Init | `09:00:01:01:00:00` | No data | Activate MIDI-via-SCSI session |
| 2. Send | `0C:00:00:00:LL:00` | DATA OUT (LL bytes) | Send MIDI SysEx to S3000XL |
| 3. Poll | `0D:00:00:00:00:00` | DATA IN (3 bytes) | Read pending response byte count (`00 HH LL`) |
| 4. Read | `0E:00:00:00:LL:00` | DATA IN (LL bytes) | Read buffered SysEx response |

### Confirmed working:

```
# Activate session
s2pexec -i 6 -c 09:00:01:01:00:00

# Send Akai RSLIST command
echo -ne '\xf0\x47\x00\x04\x48\xf7' > /tmp/rslist.bin
s2pexec -i 6 -c 0c:00:00:00:06:00 -f /tmp/rslist.bin

# Poll for response
s2pexec -i 6 -c 0d:00:00:00:00:00 -b 4 -F /tmp/poll.bin
# Returns: 00 00 44 (68 bytes available)

# Read response
s2pexec -i 6 -c 0e:00:00:00:44:00 -b 128 -F /tmp/response.bin
# Returns: F0 47 00 05 48 05 00 ... F7 (complete SLIST with 5 sample names)
```

### Implications:

- **Fully automated** — no front-panel interaction needed
- **Same protocol as MIDI** — all Akai SysEx commands (RSLIST, RPDATA, RSPACK, ASPACK, etc.) work
- **Much faster than MIDI** — SCSI bus speed vs 31.25kbaud
- **The SCMP target device is NOT needed for initiator-mode access** — we can use `s2pexec` directly
- **But s2pexec can't coexist with s2p** — bridge daemon must stop/start s2p for each SCSI operation, OR we implement the initiator commands within s2p itself

## Raw Traces

Full traces saved at: `s3k:/tmp/s2p-capture.log` (multiple runs, timestamped)
