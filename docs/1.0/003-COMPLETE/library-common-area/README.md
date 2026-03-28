# Library Common Area

**Status:** Complete
**Updated:** 2026-03-28

## Overview

Device-agnostic storage for samples and programs before assignment to specific devices. Enables import, editing, and organization of audio content independent of device format.

## Documentation

- [PRD](./prd.md) - Product requirements
- [Workplan](./workplan.md) - Implementation phases
- [Implementation Summary](./implementation-summary.md) - Completed work

## Key Features

- **SampleYaml Schema** - Device-agnostic sample metadata (rootKey, loopMode, etc.)
- **ProgramYaml Schema** - Device-agnostic instrument mapping with zones
- **Promotion/Demotion** - Convert between common-area and device formats
- **Streaming Operations** - Progress reporting for large files
- **Legacy Migration** - ChoppedSample format backward compatibility

## Location

Common area samples are stored at `library/common/samples/` with structure:
```
library/common/samples/<sample-name>/
├── sample.yaml    # Metadata
└── audio.wav      # Audio data
```

## Integration

- Appears as category in library browser
- Outputs from sample chopper go to common area
- Loop editor operates on common-area samples
- Promote to device tones when ready
