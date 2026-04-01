# SCSI MIDI Bridge - Product Requirements Document

**Created:** 2026-03-31
**Status:** Planning
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

- [ ] Pi bridge daemon responds to `GET /status` with version, SCSI2Pi version, board ID, and sampler reachability
- [ ] Pi bridge daemon responds to `GET /scsi/scan` with enumerated SCSI devices (ID, vendor, product, revision)
- [ ] audiocontrol can enumerate SCSI devices over WiFi and display them in the UI
- [ ] `ScsiMidiTransport` implements the `SysexTransport` interface and is a drop-in replacement for the MIDI cable transport
- [ ] A WAV file dragged into audiocontrol loads into S3000XL RAM via SCSI (write path)
- [ ] A sample dump triggered on the S3000XL appears in audiocontrol via SCSI (read path)
- [ ] Transfer speed over SCSI is measurably faster than MIDI cable for equivalent sample data
- [ ] Exact CDB and framing format for MIDI-via-SCSI is captured and documented

## Scope

### In Scope

- Raspberry Pi bridge daemon (Rust)
  - HTTP endpoints: `GET /status`, `GET /scsi/scan`, `POST /sds/send`
  - WebSocket endpoint: `WS /sds/stream` for bidirectional SysEx streaming
  - Shells out to `s2pexec` for SCSI bus access
  - Runs as systemd service alongside `s2p`
  - No authentication in v1
- `ScsiMidiTransport` TypeScript class
  - Implements `SysexTransport` interface (`send`, `onMessage`, `connect`, `disconnect`)
  - HTTP for one-shot sends, WebSocket for bidirectional streaming
  - Drop-in replacement for MIDI cable transport in `SdsClient`
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

## Open Questions

1. **Custom processor device type:** Does SCSI2Pi support registering a custom processor device type for the read path (sampler-initiated SCSI writes to the Pi)?
2. **CDB format:** What exact CDB does the S3000XL use for MIDI-via-SCSI writes? This is unknown until the capture session in Phase 3.
3. **Message boundaries:** Does the sampler issue one SCSI WRITE per SysEx message, or does it stream continuously? This affects how the bridge daemon frames messages for the WebSocket.
4. **S5000/S6000 compatibility:** These models likely use the same MIDI-via-SCSI protocol as the S3000XL, but this is unconfirmed.
5. **SysEx channel configuration:** Should the SysEx channel be auto-detected from the SCSI device inquiry, or user-configured in audiocontrol?

## Appendix

### System Architecture

```
Laptop (audiocontrol)  <-- WiFi -->  Raspberry Pi (SCSI2Pi + bridge daemon)  <-- SCSI bus -->  Akai S3000XL
```

### Transport Interface

The `SysexTransport` interface abstracts the physical transport. The existing MIDI cable transport and the new SCSI bridge transport both implement this interface, allowing the SDS client to work with either.

```typescript
interface SysexTransport {
  send(message: Uint8Array): Promise<void>;
  onMessage(handler: (message: Uint8Array) => void): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

### Pi Bridge API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | GET | Bridge version, SCSI2Pi version, board ID, sampler reachability |
| `/scsi/scan` | GET | Enumerate SCSI devices: `[{ id, vendor, product, revision }]` |
| `/sds/send` | POST | Send complete SDS byte stream over SCSI to sampler |
| `/sds/stream` | WS | Bidirectional SysEx stream for closed-loop handshaking |

### Confirmed Working (as of 2026-03-31)

- SCSI2Pi 6.2.1 on Pi, serving disk images via `s2p`
- INQUIRY to S3000XL returns: `AKAI EMI / S3000XL SAMPLER / 2.00`
- S3000XL mounts and reads disk images from Pi
- Pi at SCSI ID 7, S3000XL at SCSI ID 6

### References

- [MIDI SDS spec](http://midi.teragonaudio.com/tech/sds.htm)
- [Akai SysEx spec](https://lakai.sourceforge.net/docs/s2000_sysex.html)
- [SCSI2Pi docs](https://www.scsi2pi.net/)
- [Phase 1 (completed)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/midi-sds/README.md)
