# Library Common Area — Implementation Summary

**Status:** Complete
**Updated:** 2026-03-28

## Summary

The library common area provides device-agnostic storage for samples and programs before they are assigned to specific devices. This enables workflows where users import, edit, and organize audio content without committing to a device format.

## What Was Built

### Schemas

**SampleYaml Schema** (`src/schemas/sample-schema.ts`):
- Device-agnostic audio metadata
- Properties: rootKey, loopMode, loopStart, loopEnd, pitchCorrection
- Zod validation with type inference

**ProgramYaml Schema** (`src/schemas/program-schema.ts`):
- Device-agnostic instrument mapping
- Properties: zones (array), keyRange, velocityRange, sampleRef
- Multi-sample and velocity layer support

**ChoppedSampleSchema** (`src/schemas/chopped-sample-schema.ts`):
- Legacy format for backward compatibility
- Migration path to SampleYaml

### Storage Operations

**Sample Operations** (`src/common-area/samples.ts`, 16.8KB):
- `listSamples()` - List all common-area samples
- `loadSample()` - Load sample with audio data and metadata
- `saveSample()` - Save sample with progress reporting
- `deleteSample()` - Remove sample from common area
- `moveSample()` - Move/rename sample
- Streaming support for large files

**Program Operations** (`src/common-area/programs.ts`):
- `listPrograms()` - List all common-area programs
- `loadProgram()` - Load program with zone references
- `saveProgram()` - Save program metadata
- `deleteProgram()` - Remove program

**Import Operations** (`src/common-area/import.ts`, 8.8KB):
- `importWavFile()` - Import WAV with auto-detection
- `importFromDevice()` - Import tone/patch from device
- `importChoppedSamples()` - Migrate legacy format
- Progress callbacks for UI integration

### Converters

**Promotion/Demotion** (`src/converters/promotion.ts`):
- `promoteToTone()` - Sample → Device Tone
- `demoteToSample()` - Device Tone → Sample
- `promoteToTone()` - Program → Device Patch
- `demoteToPatch()` - Device Patch → Program
- Bidirectional conversion with metadata preservation

**Legacy Migration** (`src/converters/chopped-sample-converter.ts`, `chopped-sample-migration.ts`):
- Convert ChoppedSample → SampleYaml
- Preserve slice data as program zones
- Backward compatibility for existing libraries

### Streaming Support

**Progress Reporting** (`src/common-area/streaming.ts`):
- `readFileWithProgress()` - Streaming read with callbacks
- Integration with storage backends (FSAA, Google Drive, S3)
- UI progress bar support

## Key Decisions

1. **Device-Agnostic by Design** - Common area knows nothing about S-330, S-550, or any device
2. **YAML + WAV Format** - Human-readable metadata alongside standard audio
3. **Promotion Pattern** - Clear conversion path to device-specific formats
4. **Streaming First** - All operations support progress reporting for large files
5. **Legacy Support** - Migration path for existing ChoppedSample format

## Directory Structure

```
library/
└── common/
    ├── samples/
    │   ├── my-sample/
    │   │   ├── sample.yaml    # SampleYaml metadata
    │   │   └── audio.wav      # Audio data
    │   └── ...
    └── programs/
        ├── my-program/
        │   └── program.yaml   # ProgramYaml with zone refs
        └── ...
```

## Testing

- Unit tests for all schemas (Zod validation)
- Integration tests for CRUD operations
- Migration tests for legacy format conversion
- All tests part of sampler-library's 608-test suite

## Integration Points

- **Library Browser** - Common area appears as category in library tree
- **Sample Chopper** - Outputs slices to common area
- **Loop Editor** - Operates on common-area samples
- **Device Editors** - Promote samples to device tones
