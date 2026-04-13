# E2E Integration Tests

**Status:** In Progress

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)
- [Comprehensive Test Plan](./comprehensive-test-plan.md) — Full-coverage test matrix (229 test cases, 145 covered)
- [Testing Infrastructure Guide](./testing-infrastructure.md) — How to run tests, prerequisites, troubleshooting
- [App Capabilities Audit](./app-capabilities-audit.md) — Application feature inventory
- [Existing Tests Audit](./existing-tests-audit.md) — Current test coverage analysis

### Infrastructure Audit (2026-03-29)

- [Infrastructure Audit Report](./infrastructure-audit-2026-03-29.md) — Monorepo-wide e2e test infrastructure audit
- [Audit Remediation Plan](./audit-remediation-plan.md) — Phased plan to address audit findings

## Overview

Comprehensive E2E integration test suite for the roland-sxx0-editor module. Tests cover library CRUD operations, device communication via MIDI SysEx, editor parameter sync, sample import/export, drum kit workflows, and error recovery. All hardware tests verified on Roland S-550.

## Current Status

### Test Coverage (v1.4 — 2026-04-13)

| Priority | Total | Covered | Partial | Remaining |
|----------|-------|---------|---------|-----------|
| P0       | 44    | 38      | 2       | 4         |
| P1       | 148   | 92      | 10      | 46        |
| P2       | 37    | 15      | 2       | 20        |
| **Total**| **229** | **145** | **14** | **70**   |

| Category | Total | Covered | Partial | Remaining |
|----------|-------|---------|---------|-----------|
| No Hardware | 83 | 79 | 1 | 3 |
| Hardware Required | 146 | 66 | 13 | 67 |

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Device ↔ Library Integration | ✅ Complete — atomic round-trip tests |
| 2 | Set Operations | ✅ Complete — save/load device state |
| 3 | Editor Controls | ✅ Complete — play/patch/tone parameter sync |
| 4 | Loop Editor | ⚠️ Partial — inline hardware sync works, library dialog not tested |
| 5 | Drum Kit & Slice Workflows | ✅ Complete — v1/v2 import, chopper, pad editor |
| 6 | Error Scenarios | ✅ Complete — timeout, rejection, disconnect |
| — | Tone Parameter Sync | ✅ 13 params verified on S-550 |
| — | Sample Operations | ✅ Export WAV, import WAV, wave bank selection |
| — | Tone Edge Cases | ✅ Empty tone, bad format, corrupt WAV |

### Remaining P0 Gaps

1. **Auto-Fit Slot Allocation** — "Find Best Fit" for tone and patch imports
2. **Multi-device support** — S-550 specific connection tests

### App Bugs Found

| Bug | Status | Found In |
|-----|--------|----------|
| Envelope inputs committed on every keystroke | Fixed | `device-tone-envelope-controls.spec.ts` |
| `handleToneCommit` read stale React closure | Fixed | `device-tone-controls.spec.ts` |
| Chopper slice labels used drum names instead of ordinal | Fixed | `library-chopper-save.spec.ts` |
| `SampleChopperDialog` onConfirm not wired to button | Fixed | `library-chopper-save.spec.ts` |
| Slice boundaries not restored on chopper reopen | Fixed | `library-chopper-save.spec.ts` |

### Open Issues

- [#176](https://github.com/audiocontrol-org/audiocontrol/issues/176) — MIDI port selector not visible in device-library tests
- [#178](https://github.com/audiocontrol-org/audiocontrol/issues/178) — Roland tone export fails — libraryHandle null on Tones page

## Quick Start

All tests are invoked via `make` targets from the repo root:

```bash
# Library tests (no hardware required) — runs ~100 tests in ~45s
make test-e2e-roland-library

# Device tests (requires S-330/S-550 + midi-server)
E2E_DEVICE_TYPE=s550 make test-e2e-roland-device

# Run specific tests
make test-e2e-roland-library ARGS="--grep 'Chopper Save'"
E2E_DEVICE_TYPE=s550 make test-e2e-roland-device ARGS="--grep 'original key'"
```

### Prerequisites

- `devenv` shell active (auto-installed by make)
- For hardware tests: Roland S-330 or S-550 connected via MIDI, midi-server running

## Test Files

### Device Tests (hardware required)

| File | Tests | Coverage |
|------|-------|----------|
| `device-library-roundtrip.spec.ts` | Tone + patch atomic round trips | Import → export → compare |
| `device-library-set-roundtrip.spec.ts` | Set save/load | Save device → load from library |
| `device-tone-controls.spec.ts` | 13 tone parameters | Name, key, loop, TVF, TVA, LFO, pitch |
| `device-patch-controls.spec.ts` | 11 patch parameters | Name, key mode, bender, aftertouch, zones |
| `device-play-controls.spec.ts` | 4 per-part controls | Channel, patch, output, level |
| `device-tone-envelope-controls.spec.ts` | 7 envelope tests | TVA/TVF rate, level, sustain, end point |
| `device-loop-editor.spec.ts` | 3 loop editor tests | Open, sync, hardware write |
| `device-error-recovery.spec.ts` | 4 error scenarios | Timeout, rejection, disconnect |
| `device-sample-operations.spec.ts` | 3 sample ops | WAV export, import, bank B |
| `device-tone-edge-cases.spec.ts` | 3 edge cases | Empty tone, bad format, corrupt WAV |
| `device-drumkit.spec.ts` | 2 drum kit imports | v1 + v2 format |
| `device-tone-chopper.spec.ts` | 2 chopper tests | Open from device, save kit |

### Library Tests (no hardware)

| File | Tests | Coverage |
|------|-------|----------|
| `library-tones.spec.ts` | Tone CRUD | List, create, rename, delete, move, edge cases |
| `library-patches.spec.ts` | Patch CRUD | List, create, rename, delete, move, edge cases |
| `library-sets.spec.ts` | Set CRUD | List, create, rename, delete, move, edge cases |
| `library-directories.spec.ts` | Directory ops | Create, rename, delete, move, nesting |
| `library-chopper-save.spec.ts` | 7 chopper tests | Save slices, labels, persistence, drum kit |
| `library-drumkit-editor.spec.ts` | 4 pad editor tests | Pad list, MIDI notes, playback, load audio |
| `library-drumkit-error.spec.ts` | 2 error tests | Missing WAV files (v1 + v2) |

### Shared Infrastructure

| File | Purpose |
|------|---------|
| `e2e-infra/helpers/library-fixtures.ts` | OPFS fixture writers (tones, patches, samples) |
| `e2e-infra/helpers/library-ui-helpers.ts` | UI navigation, library connection, OPFS cleanup |
| `helpers/connection-helper.ts` | MIDI connection, device readiness |
| `helpers/device-readback-helpers.ts` | Hardware SysEx readback for value verification |
| `helpers/device-state-helpers.ts` | Device memory state queries |

## App Features Built for Testing

- **"Chop into Drum Kit" button** on Tones page — `useDeviceToneChopper` hook
- **DrumKitPadList component** — per-pad playback via `useTriggerPlayback`, MIDI note display
- **"Edit Sample" buttons** — on drum kit info panel and slice editor
- **Slice persistence** — reopening chopper restores previously saved slices
- **Data-testid attributes** — added to ImportSampleDialog, ToneEditor export/import buttons
- **`saveDrumKitSource`** — write edited source audio back to drum kit directory
