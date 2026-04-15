---
paths:
  - "modules/sampler-midi/src/**/s3000*"
  - "modules/sampler-midi/src/**/akai*"
  - "modules/sampler-devices/src/**/s3000*"
  - "modules/sampler-devices/src/**/akai*"
  - "modules/akai-s3k-editor/**"
  - "modules/e2e-infra/src/**/s3k*"
  - "modules/e2e-infra/src/**/akai*"
---

# S3000XL SysEx Exclusive Channel

The `cc` byte in Akai SysEx messages (`F0 47 cc ...`) is the **exclusive channel**, NOT the MIDI channel. It's an Akai-specific control address that selects which device responds to SysEx commands. This allows independent control of multiple Akai devices on the same SCSI bus (e.g., S3000XL at SCSI ID 6 on exclusive channel 0, S5000 at SCSI ID 5 on exclusive channel 1).

- Stored in MiscellaneousData as `EXCHAN` (0-based in protocol, 1-based on front panel UI)
- Default: 0 (displayed as "1" on the device)
- **Do not write EXCHAN via SysEx without immediate restore** — changing it mid-session causes the device to stop responding on the original channel
- The `--channel` CLI argument sets this exclusive channel, not the MIDI playback channel

# S3000XL SysEx Encoding

The S1000/S3000XL SysEx protocol uses **two different encodings** that must not be confused:

1. **Request item numbers** (RPDATA, RKDATA, RSDATA, DELP, DELK, DELS): encoded as two **7-bit bytes**, LSB first. Example: sample 22 → `[22 & 0x7F, (22 >> 7) & 0x7F]` → `[0x16, 0x00]`.

2. **Header data fields** (within PDATA, KDATA, SDATA payloads): encoded as **nibble pairs** (4-bit), low nibble first. Example: byte 0xAB → `[0x0B, 0x0A]`.

Using nibble encoding for item numbers works for indices 0-15 (where both encodings produce identical bytes) but silently fails for index 16+. Reference: https://lakai.sourceforge.net/docs/s1000_sysex.html — "groups of bytes in messages represent concatenated 7-bit sections of a data word, LSB first."

# S3000XL SDS Storage Behavior

The S3000XL uses the SDS sample number in the Dump Header to determine overwrite vs create: if the number matches an existing sample's RSLIST index, the device overwrites that sample in place. If the number doesn't match, a new sample is created at the end of the RSLIST. To replace a sample, send with its RSLIST index. To add a new sample, send with an unused number (e.g., current sample count). Confirmed via hardware testing.
