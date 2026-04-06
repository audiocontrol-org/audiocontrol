# SCSI MIDI Bridge - Product Requirements Document

**Created:** 2026-03-31
**Status:** Implemented (Phases 2-5), hardware validated
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol MIDI SDS implementation (completed in Phase 1) enables sample transfer between a laptop and the Akai S3000XL over a standard MIDI cable. This works, but MIDI's 31.25 kbaud bandwidth limits transfer speed to roughly 25 seconds for 1 second of 22 kHz audio. For practical use -- loading multiple samples, programs, or entire sound libraries -- MIDI cable transfers are too slow.

The S3000XL supports "MIDI via SCSI": standard MIDI SysEx messages (including SDS) transmitted over the SCSI bus instead of a MIDI cable. The SCSI bus operates at megabytes per second, orders of magnitude faster than MIDI. The payload is byte-for-byte identical; only the physical transport changes.

The challenge is that modern laptops do not have SCSI ports. A Raspberry Pi running SCSI2Pi can bridge the gap: the Pi connects to the sampler's SCSI bus and exposes it over the network via HTTP/WebSocket, allowing audiocontrol running in a browser on a laptop to send and receive SysEx over WiFi at SCSI speeds.

## User Stories

- As a musician, I want to transfer samples to my S3000XL over WiFi so that I do not need a MIDI cable connected to my laptop
- As a musician, I want faster sample transfers so that loading a multi-sample program takes seconds instead of minutes
- As a developer, I want a `SysexTransport` implementation that works over HTTP/WebSocket so that the existing SDS client code works unchanged with a different physical transport
- As a musician, I want to see which SCSI devices are connected so that I can verify my sampler is online before starting a transfer
- As a developer, I want the SCSI-to-network bridge to be a standalone daemon on the Pi so that it runs headless as a systemd service

## Success Criteria

- [x] Pi bridge daemon responds to `GET /status` with version, SCSI2Pi version, board ID, and sampler reachability
- [x] Pi bridge daemon responds to `GET /scsi/scan` with enumerated SCSI devices (ID, vendor, product, revision)
- [x] audiocontrol can enumerate SCSI devices over WiFi and display them in the UI
- [x] `ScsiMidiTransport` implements the `MidiIO` interface and is a drop-in replacement for the MIDI cable transport
- [x] A WAV file sent from audiocontrol loads into S3000XL RAM via SCSI (write path via SDS)
- [ ] A sample dump triggered on the S3000XL appears in audiocontrol via SCSI (read path) — **BLOCKED: S3000XL firmware does not route SDS Data Packets through the SCSI response buffer. Workaround: read sample data from disk images directly.**
- [x] Transfer speed over SCSI is measurably faster than MIDI cable for equivalent sample data
- [x] Exact CDB and framing format for MIDI-via-SCSI is captured and documented

## Scope

### In Scope

- Raspberry Pi bridge daemon (Rust)
  - HTTP endpoints: `GET /status`, `GET /scsi/scan`, `POST /sds/send`
  - WebSocket endpoint: `WS /sds/stream` for bidirectional SysEx streaming
  - Communicates with s2p via protobuf API (port 6868) — s2pexec cannot coexist with running s2p
  - Runs as systemd service alongside `s2p`
  - No authentication in v1
- `ScsiMidiTransport` TypeScript class (in `midi-core`)
  - Implements `MidiIO` interface (`send`, `onSysEx`, `removeSysExListener`)
  - HTTP POST for sends, WebSocket for incoming SysEx with HTTP polling fallback
  - Drop-in replacement for Web MIDI or HTTP MIDI transports
- SCSI capture session
  - Capture live MIDI-via-SCSI traffic from S3000XL using SCSI2Pi trace
  - Document exact CDB, framing, and data format
  - Determine message boundary behavior (one SCSI WRITE per SysEx message vs. continuous stream)
- Write path: laptop to sampler via `POST /sds/send` and SCSI bus
- Read path: sampler to laptop via WebSocket and SCSI bus
- Akai S3000XL as the initial (and only v1) target device

### Out of Scope

- Roland S-550 SCSI support (different SCSI protocol, separate feature)
- Akai disk image filesystem manipulation (reading/writing `.hfe`, `.img` files)
- Sample editing or waveform display in audiocontrol
- Multi-sample or program bulk transfer (Akai Extended protocol is Phase 6, deferred)
- Authentication or TLS on the Pi bridge (v1 runs on a trusted local network)
- S5000/S6000 support (likely compatible but unvalidated)

## Dependencies

- **SCSI2Pi 6.2.1** on Raspberry Pi (confirmed working)
  - `s2p` daemon serving disk images (target mode)
  - `s2pexec` for initiator-mode SCSI commands
- **Completed MIDI SDS feature** (`docs/1.0/midi-sds/`)
  - Generic SDS protocol in `midi-core`
  - S3000XL client integration in `sampler-devices`
  - Editor UI in `akai-s3k-editor`
- **Hardware:**
  - Raspberry Pi with Fullspec PiSCSI board (SCSI ID 7)
  - Akai S3000XL (SCSI ID 6)
  - WiFi network accessible to both Pi and laptop
- **Pi configuration:**
  - Hostname: `s3k`
  - User: `orion`
  - SCSI2Pi: 6.2.1
  - Board ID: 7, S3000XL at ID 6

## Resolved Questions

1. **Custom processor device type:** SCSI2Pi has no plugin system. A custom SCMP device was prototyped in a fork (`audiocontrol-org/scsi2pi`, branch `feature/midi-processor`) but the S3000XL's vendor-specific 0x0D command has a MESSAGE IN timeout issue that remains unresolved. **However, the SCMP device is not needed** — the bridge daemon uses s2p's protobuf API for initiator-mode SCSI commands directly.
2. **CDB format:** Fully decoded. Four-step sequence: INIT (`0x09`), SEND (`0x0C`), POLL (`0x0D`), READ (`0x0E`). See [capture-notes.md](capture-notes.md).
3. **Message boundaries:** Poll-based, not streaming. CDB `0x0D` returns 3 bytes (`00 HH LL`) indicating pending response size. CDB `0x0E` reads that many bytes. Each SysEx message is a complete F0...F7 frame.
4. **S5000/S6000 compatibility:** Unvalidated. Likely compatible (same Akai SCSI protocol family) but not confirmed.
5. **SysEx channel configuration:** User-configured in audiocontrol (default: channel 0).

## Open Questions

- [ ] Do writes to the sampler via the SCSI transport chain actually persist? E2E readback tests return stale values. See `feature/scsi-write-validation` for targeted investigation.
- [ ] Can the SCMP device's 0x0D MESSAGE IN timeout be resolved for sampler-initiated SCSI traffic?

## Appendix

### System Architecture

```
Laptop (audiocontrol)  <-- WiFi -->  Raspberry Pi (SCSI2Pi + bridge daemon)  <-- SCSI bus -->  Akai S3000XL
```

### Transport Interface

The `MidiIO` interface abstracts the physical transport. The SCSI bridge transport implements this interface, making it a drop-in replacement for Web MIDI or HTTP MIDI transports.

```typescript
interface MidiIO {
  send(message: number[]): void;
  onSysEx(callback: SysExCallback): void;
  removeSysExListener(callback: SysExCallback): void;
}
```

### Pi Bridge API (Implemented)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/status` | GET | Bridge version, SCSI2Pi version, board ID, sampler reachability |
| `/scsi/scan` | GET | Enumerate SCSI devices: `[{ id, vendor, product, revision }]` |
| `/sds/send` | POST | Send SysEx over SCSI, return response |
| `/sds/poll` | GET | Poll for pending incoming SysEx (no send) |
| `/sds/stream` | WS | Bidirectional SysEx stream |

### MIDI-via-SCSI Protocol (Decoded)

| Step | CDB | Direction | Purpose |
|------|-----|-----------|---------|
| 1. Init | `09:00:01:01:00:00` | No data | Activate MIDI-via-SCSI session |
| 2. Send | `0C:00:00:00:LL:00` | DATA OUT (LL bytes) | Send SysEx to S3000XL |
| 3. Poll | `0D:00:00:00:00:00` | DATA IN (3 bytes) | Read pending response byte count (`00 HH LL`) |
| 4. Read | `0E:00:00:00:LL:00` | DATA IN (LL bytes) | Read buffered SysEx response |

### Confirmed Working (as of 2026-04-02)

- SCSI2Pi 6.2.1 on Pi, serving disk images via `s2p`
- INQUIRY to S3000XL returns: `AKAI EMI / S3000XL SAMPLER / 2.00`
- S3000XL mounts and reads disk images from Pi
- Pi at SCSI ID 7, S3000XL at SCSI ID 6
- Bridge daemon (Rust/Axum) running on port 7033
- All Akai SysEx commands work over SCSI: RSTAT, RSLIST, RPLIST, RPDATA, RKDATA, RSDATA, PDATA, KDATA, SDATA
- SDS sample upload works over SCSI (closed-loop with ACK handshake)
- SDS sample download partially works (Dump Header arrives, Data Packets do not — firmware limitation)

### References

- [MIDI SDS spec](http://midi.teragonaudio.com/tech/sds.htm)
- [Akai SysEx spec](https://lakai.sourceforge.net/docs/s2000_sysex.html)
- [SCSI2Pi docs](https://www.scsi2pi.net/)
- [Phase 1 (completed)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/midi-sds/README.md)
