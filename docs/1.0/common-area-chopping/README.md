# Common-Area Chopping

**Status:** Planning
**Feature Branch:** `feature/common-area-chopping`
**GitHub Milestone:** TBD

## Overview

Connect the existing sample chopper to common-area samples. Load from common area, chop, save slices as device-agnostic `SampleYaml` objects, and optionally bundle as a `ProgramYaml` program.

## Documentation

- [PRD](./prd.md) - Requirements, integration points, existing code to reuse
- [Workplan](./workplan.md) - Implementation phases
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Data Flow

```
Common Area                  Chopper                    Common Area
┌─────────────┐    load     ┌──────────────┐   save    ┌──────────────┐
│ SampleYaml  │ ─────────→  │ Slice Engine │ ───────→  │ SampleYaml[] │
│ + WAV file  │             │ (unchanged)  │           │ + WAV files  │
└─────────────┘             └──────────────┘           │              │
                                                       │ ProgramYaml  │
                                                       │ (optional)   │
                                                       └──────────────┘
```

## Key Additions

| Component | Change |
|-----------|--------|
| `sample-chopper/src/common-area.ts` | `slicesToCommonArea()` converter |
| `sample-chopper/src/program.ts` | `createProgram()` zone mapper |
| Chopper UI | "Load from Library" + "Save to Common Area" options |
| `sampler-editor` | "Chop" action on common-area samples |
