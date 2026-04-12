# Staged SDS Batch Upload for Drum Kit Import

## Problem

The web editor's `importDrumKitToDevice` calls `client.sendSampleViaSds` per slice. Each call does SDS upload → RSLIST poll → rename, interleaving SDS and SysEx. The S3000XL can't handle this interleaving — SDS transfers disable MIDI-over-SCSI mode, and subsequent SysEx commands fail or time out.

The node-based drum kit e2e test proved the staged approach works: send all SDS first, then do all SysEx (RSLIST, renames, program, keygroups).

## Solution

### Add `uploadSampleRaw` to `S3000xlClientInterface`

A new method that does only the SDS transfer — no RSLIST polling, no renaming. The caller orchestrates batch uploads and handles verification/renaming afterward.

```typescript
/** Upload a sample via SDS without RSLIST polling or renaming.
 *  For batch uploads — caller is responsible for verification and renaming. */
uploadSampleRaw(
  sampleNumber: number,
  sampleData: Int16Array,
  sampleRate: number,
  onProgress?: (progress: SdsTransferProgress) => void,
): Promise<void>;
```

### Restructure `importDrumKitToDevice`

Current (interleaved):
```
for each slice:
  sendSampleViaSds(slot, audio, rate, { name })  // SDS + RSLIST + rename
create program
create keygroups
```

New (staged):
```
Stage 1: batch SDS uploads (no SysEx)
  for each slice: client.uploadSampleRaw(slot, audio, rate, onProgress)

Stage 2: verify all arrived
  names = client.refreshSampleNames()

Stage 3: rename each slice via SysEx
  for each slice: fetchSampleHeader → writeSHNAME → writeSampleHeader

Stage 4: create program (unchanged)

Stage 5: create keygroups (unchanged)
```

### Refactor `sendSampleViaSds` to use `uploadSampleRaw`

Extract the SDS-only portion into `uploadSampleRaw`. `sendSampleViaSds` calls `uploadSampleRaw` internally, then does its RSLIST + rename for the single-sample use case. No code duplication.

## Files to modify

| File | Change |
|------|--------|
| `modules/sampler-devices/src/devices/s3000xl/s3000xl-types.ts` | Add `uploadSampleRaw` to interface |
| `modules/sampler-devices/src/devices/s3000xl/s3000xl-client.ts` | Implement `uploadSampleRaw`, refactor `sendSampleViaSds` to use it |
| `modules/akai-s3k-editor/src/lib/drumkit-import.ts` | Use staged batch approach |

## Verification

```bash
# Node drum kit test (should still pass — uses raw WebSocket, not client)
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test drumkit --verbose'

# Node SDS test (regression — sendSampleViaSds still works for single sample)
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'

# Browser drum kit import test
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "Drum Kit Import"'
```
