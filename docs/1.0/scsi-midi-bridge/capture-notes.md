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

## Next Steps

1. **Custom SCSI processor device** — implement a SCSI2Pi device type (or standalone SCSI target) that:
   - Reports as processor device type in INQUIRY
   - Accepts SEND (0x0D) with arbitrary data and pipes it to the bridge daemon
   - Accepts proprietary 0x0C with 84-byte config data
   - Responds to RECEIVE (0x09) with queued SysEx data from the bridge
   - Returns GOOD status for zero-length SEND probes

2. **Investigate SCSI2Pi extensibility** — can custom device types be added without forking? Check s2p plugin/extension architecture.

3. **Capture actual SEND with data** — the current capture only shows the 0-byte probe SEND. Once the device accepts the probe, we need to capture a real SEND with SysEx payload to confirm the data format.

## Raw Trace

Full trace saved at: `s3k:/tmp/s2p_live.log` (167 lines)
