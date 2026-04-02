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

## Raw Trace

Full trace saved at: `s3k:/tmp/s2p_live.log` (167 lines)
