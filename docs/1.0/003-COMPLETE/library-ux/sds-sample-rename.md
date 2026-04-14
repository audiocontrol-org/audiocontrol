# SDS Sample Rename After Upload

## Problem

When a sample is uploaded to the S3000XL via SDS, the device auto-assigns a name (e.g., "MIDI 18"). The user expects the sample to have the name they chose in the library. Programs that reference samples by name will fail to find their samples because the device-assigned names don't match the program's sample references.

## Solution

After the SDS transfer completes and the device commits the sample, the S3K client reads the sample header back via SysEx, modifies the name field to match the user's expected name, and writes the header back. The name is sanitized to the Akai character set (uppercase A-Z, 0-9, space, `#+-. `, 12 chars max).

## Design

### sendSampleViaSds gets a `name` parameter

```typescript
sdsOptions?: {
  name?: string;          // Rename sample after upload
  loopStart?: number;
  loopEnd?: number;
  loopType?: SdsLoopType;
  onProgress?: (progress: SdsTransferProgress) => void;
}
```

### Post-upload rename sequence

1. SDS transfer completes (all packets ACKed)
2. Wait 3 seconds for device to commit sample to memory
3. Fetch sample header via SysEx: `fetchSampleHeader(sampleNumber)`
4. Modify `SHNAME` field and encode name bytes into `header.raw`
5. Write sample header via SysEx: `writeSampleHeader(header)`
6. Invalidate sample names cache

### Name sanitization

Uses existing `string2AkaiBytes()` from `akai-utils.ts`:
- Uppercases automatically
- Truncates to 12 characters
- Replaces unsupported characters with space
- Pads with spaces

### Separation of concerns

The rename happens at the S3K client level, NOT in the SdsChannel. The SdsChannel only transfers audio data (transport layer). The client handles naming (application layer). This keeps the SdsChannel reusable across different device types.

### Atomic program+sample upload

For programs that reference samples by name:
1. Upload all referenced samples, renaming each to its expected name
2. Verify all sample names via `refreshSampleNames()`
3. THEN upload the program (which references those names by SHNAME)

The program upload coordinator (ImportProgramDialog / ImportDrumKitDialog) must ensure all samples are named before writing the program.

## Files to modify

| File | Change |
|------|--------|
| `modules/sampler-devices/src/devices/s3000xl/s3000xl-types.ts` | Add `name?: string` to SDS options |
| `modules/sampler-devices/src/devices/s3000xl/s3000xl-client.ts` | Post-SDS rename in `sendSampleViaSds` |
| `modules/e2e-infra/src/node/lib/test-sds.ts` | Pass name, verify rename in round-trip test |

## Bug fix: 7-bit encoding for SysEx item numbers

During implementation, RSDATA (fetch sample header) failed for sample indices >= 16. Root cause: item numbers in Akai SysEx request opcodes must be encoded as two **7-bit bytes** (LSB first), not as nibble pairs (4-bit). The S1000 spec states: "groups of bytes in messages represent concatenated 7-bit sections of a data word, LSB first." For indices 0-15 both encodings happen to produce identical bytes, masking the bug. Fixed in `s3000xl-client.ts` by replacing `byte2nibblesLE()` with `numberTo7bitPair()` for all request opcodes.

## Verification

```bash
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'
```

Expected: upload → rename to "SDSTEST" → download → data matches → name matches → PASS
