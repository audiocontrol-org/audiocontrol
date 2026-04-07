# SCSI Write Validation - Product Requirements Document

**Created:** 2026-04-05
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol SCSI-over-network stack (web editor -> SCSI MIDI transport -> scsi-midi-bridge -> scsi2pi/s2p -> PiSCSI -> Akai S3000XL) can successfully **read** data from the sampler (program names, sample names, headers), but E2E readback tests indicate that **writes** do not appear to persist. When a parameter is written and then read back, the readback returns the original value.

There are two competing hypotheses:

1. **Writes genuinely don't persist** — Something in the SCSI transport chain (bridge daemon, s2p protobuf API, SCSI bus timing, or the sampler's SCSI MIDI implementation) silently drops or mishandles write commands.

2. **Writes DO persist but our tests are wrong** — The web editor's E2E test infrastructure (Playwright -> browser -> React state -> SCSI transport) introduces layers of caching, state management, and async timing that may cause readback to return stale cached data rather than fresh device state. The S3000XL client caches program headers, keygroup headers, and sample headers — a write followed by a cached read would appear to fail even if the device accepted the write.

A parallel effort (MESA II running in SheepShaver) is investigating hypothesis #1 by capturing how Akai's own software communicates over SCSI. This project addresses hypothesis #2 by removing the web editor entirely and testing a **thin CLI client** that talks directly to the SCSI bridge, eliminating browser, React, Playwright, and the editor's caching layers as variables.

## User Stories

- As a developer, I want to send a SysEx write command directly to the SCSI bridge and read back the result so that I can determine whether the SCSI transport chain correctly persists writes
- As a developer, I want to run a simple CLI test script against the live sampler so that I can iterate quickly without spinning up a browser or Playwright
- As a developer, I want to test individual protocol operations in isolation (write program header, read program header, write keygroup, etc.) so that I can pinpoint exactly which operations succeed and which fail
- As a developer, I want to completely disable the client cache during initial testing so that caching is eliminated as a source of false results
- As a developer, I want to compare write behavior over SCSI vs regular MIDI so that I can determine whether the issue is transport-specific or protocol-specific

## Success Criteria

- [ ] S3000XL client supports a `noCache` option that completely bypasses all caching (no reads from cache, no writes to cache)
- [ ] CLI test harness connects to the SCSI bridge and confirms sampler is reachable
- [ ] Read operations (RPLIST, RSLIST, RPDATA, RKDATA, RSDATA) return valid data with cache disabled
- [ ] Write-readback test for program header: write a field, read back (no cache), compare
- [ ] Write-readback test for keygroup header: write a field, read back (no cache), compare
- [ ] Write-readback test for sample header: write a field, read back (no cache), compare
- [ ] SDS sample transfer test: send a known sample via SDS, receive it back, compare audio data
- [ ] Each test reports PASS/FAIL with the exact bytes sent and received for debugging
- [ ] Results clearly confirm or refute whether writes persist through the SCSI transport chain
- [ ] If writes succeed with cache disabled, a follow-up phase re-enables caching and validates cache invalidation on writes

## Scope

### In Scope

**S3000XL Client `noCache` Option:**
- Add a `noCache: boolean` option to `S3000xlClientOptions`
- When `noCache` is true, every read fetches fresh from the device (never reads from cache, never populates cache)
- Write methods are unaffected (they already send to the device)
- This is a first-class client option, not a test hack — useful for debugging beyond this project

**CLI test harness** (`scripts/` or `tools/` in the repo) using Node.js/tsx:
- Directly instantiates `createScsiMidiTransport()` from `midi-core`
- Directly instantiates `createS3000xlClient()` with `noCache: true` from `sampler-devices`
- No browser, no React, no Playwright, no editor UI

**Phase A — No-cache write-readback tests:**
- Connection test: connect to bridge, check `/status`, scan devices
- Read tests: fetch program names, sample names, individual headers (all fresh from device)
- Write-readback tests for each writable data type:
  1. Read current value (fresh, no cache)
  2. Write a modified value
  3. Read back from device (fresh, no cache)
  4. Compare: does the readback match the written value?
  5. Restore the original value
- SDS round-trip: send sample, receive back, compare
- Raw SysEx logging for protocol-level debugging

**Phase B — Cache validation (contingent on Phase A passing):**
- Re-enable caching (default client behavior)
- Verify that writes followed by reads return the written value (not stale cache)
- If readback fails with cache enabled, the bug is in cache invalidation logic
- Fix cache invalidation as needed

**Comparison framework:**
- Ability to run the same tests over MIDI (via `httpMidiTransport` + `midi-server`) to compare SCSI vs MIDI behavior

### Out of Scope

- Modifying the scsi-midi-bridge daemon or s2p protobuf protocol
- Browser or Playwright testing (that's the existing E2E suite)
- MESA II / SheepShaver analysis (parallel effort on `feature/scsi-midi-bridge`)

## Dependencies

- `midi-core` — `createScsiMidiTransport()` for SCSI bridge communication
- `sampler-devices` — `createS3000xlClient()` for Akai SysEx protocol
- `scsi-midi-bridge` daemon running on Pi (accessible at e.g., `http://s3k.local:7033`)
- S3000XL connected to Pi via SCSI
- For MIDI comparison tests: `midi-server` + physical MIDI connection

## Open Questions

- [ ] Does the S3000XL client's write buffer (`writeFlushDelayMs: 150`) interact badly with the SCSI transport's serialized send queue? A write followed by an immediate read might arrive before the device has committed the write.
- [ ] Does the SCSI bridge's `send_and_receive` correctly wait for the device's REPLY response to write commands, or does it return before the device acknowledges?
- [ ] Is there a timing difference between how the S3000XL handles writes over SCSI vs MIDI that requires additional delay before readback?

## Appendix

### Transport Chain Under Test

```
┌──────────────────────────┐
│  CLI Test Harness (tsx)  │  ← THIS PROJECT
│  createS3000xlClient()   │
│  createScsiMidiTransport │
└──────────┬───────────────┘
           │ HTTP (fetch)
           │
┌──────────▼───────────────────────┐
│  scsi-midi-bridge (Rust/Axum)    │
│  POST /sds/send → s2p protobuf  │
│  GET /sds/poll  → s2p protobuf  │
│  Port 7033                       │
└──────────┬───────────────────────┘
           │ Protobuf (TCP)
           │ MIDI_SEND / MIDI_POLL / MIDI_READ
           │
┌──────────▼───────────────────────┐
│  SCSI2Pi / s2p (port 6868)       │
│  Translates to SCSI CDB          │
└──────────┬───────────────────────┘
           │ SCSI bus
           │
┌──────────▼───────────────────────┐
│  Akai S3000XL (SCSI ID 6)        │
│  MIDI-over-SCSI                  │
└──────────────────────────────────┘
```

### Test Operations Matrix

| Operation | SysEx Direction | Opcode(s) | What to Verify |
|-----------|----------------|-----------|----------------|
| List programs | Request → Response | RPLIST (0x02) → PLIST (0x03) | Names match known device state |
| List samples | Request → Response | RSLIST (0x04) → SLIST (0x05) | Names match known device state |
| Read program header | Request → Response | RPDATA (0x06) → PDATA (0x07) | Header fields parse correctly |
| Write program header | Write → REPLY | PDATA (0x07) → REPLY (0x16) | Field persists on readback |
| Read keygroup header | Request → Response | RKDATA (0x08) → KDATA (0x09) | Header fields parse correctly |
| Write keygroup header | Write → REPLY | KDATA (0x09) → REPLY (0x16) | Field persists on readback |
| Read sample header | Request → Response | RSDATA (0x0a) → SDATA (0x0b) | Header fields parse correctly |
| Write sample header | Write → REPLY | SDATA (0x0b) → REPLY (0x16) | Field persists on readback |
| SDS send sample | SDS Dump Header + Packets | F0 7E ... | Device receives sample |
| SDS receive sample | SDS Dump Request → Packets | F0 7E 03 ... | Audio data matches sent |

### Testing Strategy: Cache-Free First

The S3000XL client caches program names, sample names, program headers, keygroup headers, and sample headers. In the existing E2E tests, a write followed by a read may return stale cached data, making it impossible to distinguish "write didn't persist" from "read returned cached pre-write value."

**Phase A** eliminates this ambiguity entirely by running with `noCache: true`. Every read hits the device directly. If writes still don't persist with no caching in the picture, the problem is definitively in the transport chain or the device's SCSI MIDI implementation.

**Phase B** (only if Phase A passes) re-enables caching to verify that the client's cache invalidation logic correctly handles writes. If Phase B fails, we know the transport works but the cache doesn't invalidate properly on writes — a much simpler bug to fix.
