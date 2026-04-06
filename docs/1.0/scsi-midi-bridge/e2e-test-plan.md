# SCSI MIDI Bridge — E2E Test Plan

## Overview

End-to-end tests for the SCSI MIDI bridge stack verify that the browser-based S3000XL editor can communicate with the sampler over SCSI through a Raspberry Pi, using the same UI and protocol layer as the MIDI cable transport.

### Stack under test

```
Browser (Playwright)
  → ScsiMidiTransport (HTTP/WS, ?midi=scsi&scsiBridgeUrl=...)
  → scsi-midi-bridge (Rust, Pi port 7033)
  → s2p protobuf API (Pi port 6868)
  → SCSI bus (Pi GPIO → PiSCSI board → 50-pin SCSI cable)
  → Akai S3000XL (SCSI ID 6)
```

### How to run

```bash
# Full pipeline: clone, cross-compile, deploy, test
make test-e2e-s3k-scsi

# Use local scsi2pi checkout (faster during development)
make test-e2e-s3k-scsi SCSI2PI_DIR=~/work/scsi2pi-work/scsi2pi

# Custom Pi address
make test-e2e-s3k-scsi SCSI_PI_HOST=10.0.0.57

# Filter tests
make test-e2e-s3k-scsi ARGS="--grep 'SDS transfer'"
```

### Prerequisites

- Raspberry Pi with PiSCSI board at `s3k.local` (SSH key auth configured)
- Akai S3000XL powered on, connected via SCSI, set to SCSI ID 6
- Docker running on dev machine (for ARM64 cross-compilation)
- S3000XL should have at least one program and one sample loaded

---

## Test Suites

### Suite 1: Connection and Discovery

**File:** `e2e/scsi-connected.spec.ts`

Verifies the SCSI transport connects and the editor can communicate with the sampler.

| # | Test | What it verifies |
|---|------|------------------|
| 1.1 | Connect to S3000XL via SCSI bridge | Transport initializes, bridge status OK, device discovered via `/scsi/scan`, MIDI store reaches `connected` state |
| 1.2 | Connection persists across navigation | Navigate from editor root to programs page — connection stays alive |
| 1.3 | Retrieve sample list via SCSI | After connection, navigate to samples section, verify at least one sample name is visible |
| 1.4 | Disconnect and reconnect | Disconnect, verify `disconnected` state, reconnect, verify `connected` |

### Suite 2: Program Operations

**File:** `e2e/scsi-programs.spec.ts`

Round-trip program data through the SCSI bridge. Mirrors `device-programs.spec.ts`.

| # | Test | What it verifies |
|---|------|------------------|
| 2.1 | Program list loads from device | Navigate to programs page, verify program names appear in the list |
| 2.2 | Program name round-trip | Edit program name → write to device → re-read → verify new name persists |
| 2.3 | Program parameter round-trip (polyphony) | Change polyphony value → write → re-read → compare |
| 2.4 | Program parameter round-trip (level) | Change program level → write → re-read → compare |
| 2.5 | Program parameter round-trip (pan) | Change pan position → write → re-read → compare |
| 2.6 | Select parameter round-trip (priority) | Change priority select → write → re-read → compare |
| 2.7 | Toggle parameter round-trip (legato) | Toggle legato → write → re-read → compare |

### Suite 3: Keygroup Operations

**File:** `e2e/scsi-keygroups.spec.ts`

Round-trip keygroup data. Mirrors `device-keygroups.spec.ts`.

| # | Test | What it verifies |
|---|------|------------------|
| 3.1 | Keygroup list loads after program selection | Select program → keygroups populate |
| 3.2 | Keygroup editor opens on selection | Click keygroup → editor panel appears |
| 3.3 | Note range round-trip | Edit low note → write → re-read → verify |
| 3.4 | Filter frequency round-trip | Edit filter freq → write → re-read → verify |
| 3.5 | Amplitude envelope attack round-trip | Edit attack → write → re-read → verify |
| 3.6 | Amplitude envelope sustain round-trip | Edit sustain → write → re-read → verify |
| 3.7 | Keygroup chain navigation | Navigate from keygroup 1 to keygroup 2 |

### Suite 4: Velocity Zones

**File:** `e2e/scsi-velocity-zones.spec.ts`

Round-trip velocity zone data. Mirrors `device-velocity-zones.spec.ts`.

| # | Test | What it verifies |
|---|------|------------------|
| 4.1 | Zone tabs are visible | After selecting a keygroup, velocity zone tabs render |
| 4.2 | Zone parameter display | Click zone tab → zone parameters appear with values |
| 4.3 | Sample name is displayed | Active zone shows the assigned sample name |
| 4.4 | Velocity range round-trip | Edit velocity range → write → re-read → verify |
| 4.5 | Zone tuning offset round-trip | Edit zone 2 tuning → write → re-read → verify |

### Suite 5: Sample Headers

**File:** `e2e/scsi-sample-headers.spec.ts`

Verify sample metadata is accessible over SCSI. Mirrors `device-sample-headers.spec.ts`.

| # | Test | What it verifies |
|---|------|------------------|
| 5.1 | Sample names load in dropdown | Velocity zone sample dropdown contains non-empty names |
| 5.2 | Sample dropdown options are valid | Each option corresponds to a real sample on the device |

### Suite 6: SDS Sample Transfer over SCSI

**File:** `e2e/scsi-sds-transfer.spec.ts`

The flagship test — verifies sample data transfer over SCSI at bus speed. Mirrors `device-sds-transfer.spec.ts`. This is the primary use case for the SCSI bridge.

| # | Test | What it verifies |
|---|------|------------------|
| 6.1 | Sample dropdown populated from device | Sample list fetched via SCSI, dropdown options rendered |
| 6.2 | Receive button state management | Disabled with no selection, enabled after selection |
| 6.3 | Receive sample from device via SCSI | Select sample → click Receive → SDS dump completes → sample info displayed (name, length, sample rate) |
| 6.4 | Send test sample to device via SCSI | Generate test tone → click Send → SDS upload completes → verify sample count incremented on device |
| 6.5 | Round-trip: send then receive back | Send a known sample → receive it back → compare waveform data byte-for-byte. This is the definitive correctness test. |
| 6.6 | Transfer speed comparison | Time the SDS transfer over SCSI and log the throughput. Not a pass/fail test — observability for performance regression detection. |

### Suite 7: SCSI-Specific Edge Cases

**File:** `e2e/scsi-edge-cases.spec.ts`

Tests unique to the SCSI transport path that don't apply to MIDI cable.

| # | Test | What it verifies |
|---|------|------------------|
| 7.1 | Bridge reconnection after s2p restart | Kill s2p on Pi → bridge returns error → restart s2p → bridge recovers → operations resume |
| 7.2 | Large SysEx over SCSI | Send a large sample (>64KB) — verifies the protobuf API handles multi-packet SDS correctly over SCSI |
| 7.3 | Concurrent operations | Send RSLIST while a prior RPDATA is in flight — verify no corruption or deadlock |
| 7.4 | Bridge URL validation | Navigate with invalid bridge URL → verify graceful error message, not a crash |

---

## Test Design Principles

### Atomic Round-Trips

Every parameter test follows the round-trip pattern from the CLAUDE.md E2E testing tenets:

```
Library/UI (set value) → write to device → read back from device → compare
```

For SCSI tests, the full data path is:

```
Browser UI → HTTP POST /sds/send → bridge → s2p protobuf → SCSI bus → S3000XL
S3000XL → SCSI bus → s2p protobuf → bridge poll+read → WS /sds/stream → Browser UI
```

### No Mocking

- Real S3000XL hardware (SCSI ID 6)
- Real SCSI bus (PiSCSI board GPIO)
- Real s2p (cross-compiled ARM64 binary)
- Real bridge daemon (cross-compiled ARM64 binary)
- Real browser (Playwright Chromium)

### SCSI Tests Mirror MIDI Tests

Each `scsi-*.spec.ts` file mirrors the corresponding `device-*.spec.ts` file. The only difference is how the URL is constructed (`buildScsiUrl` vs `buildUrl`). The app UI, selectors, and assertions are identical — verifying that the SCSI transport is a drop-in replacement for MIDI.

### Timeouts

SCSI operations traverse the network (browser → Pi → SCSI bus → back), so timeouts are 2-3x longer than MIDI cable tests:

| Operation | MIDI cable | SCSI bridge |
|-----------|-----------|-------------|
| Test timeout | 10s | 30s |
| Connection | 5s | 15s |
| SDS transfer | 15s | 45s |
| Watchdog stale | 10s | 20s |

---

## Infrastructure Summary

| Component | Path |
|-----------|------|
| Make target | `make test-e2e-s3k-scsi` |
| Runner script | `modules/e2e-infra/scripts/run-scsi-midi-e2e.sh` |
| Thin wrapper | `modules/akai-s3k-editor/scripts/run-scsi-midi-e2e.sh` |
| Playwright config | `modules/akai-s3k-editor/playwright.scsi-midi.config.ts` |
| Bridge validator | `modules/e2e-infra/scripts/validate-scsi-bridge.ts` |
| Connection helper | `modules/e2e-infra/helpers/connection-helper.ts` (`buildScsiUrl`) |
| Test specs | `modules/akai-s3k-editor/e2e/scsi-*.spec.ts` |

## Implementation Priority

1. **Suite 1** (Connection) — already implemented in `scsi-connected.spec.ts`
2. **Suite 6** (SDS Transfer) — the primary use case, validates the full data path
3. **Suite 2** (Programs) — most tests, highest coverage of SysEx round-trips
4. **Suite 3** (Keygroups) — validates complex nested data structures
5. **Suite 4** (Velocity Zones) — validates zone-specific parameter handling
6. **Suite 5** (Sample Headers) — lightweight metadata verification
7. **Suite 7** (Edge Cases) — robustness and recovery testing
