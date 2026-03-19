# Sample Trim & Normalize - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

Users import WAV files into the common area that have silence at the beginning or end, inconsistent levels, or both. There is no way to crop or normalize samples within audiocontrol — users must leave the app, process in a DAW or Audacity, re-export, and re-import. This breaks the workflow and discourages library curation.

Trim and normalize are the two simplest DSP operations and a proving ground for the edit workflow architecture established in Phase 1. The algorithms already exist in `sample-chopper` (`trimSilence()`, `calculateRms()`, `calculatePeak()`). What's missing is the workflow UI and the integration with common-area samples.

## User Stories

- As a producer, I want to trim silence from the start and end of a sample so that it triggers immediately when played
- As a library curator, I want to normalize samples to a consistent level so that previewing doesn't require constant volume adjustment
- As a developer, I want a reference Phase 2 workflow module so that future workflows (chopping, velocity layers) follow the same pattern

## Success Criteria

- [ ] Trim: crop start/end of common-area samples with visual waveform selection
- [ ] Normalize: peak or RMS mode, with configurable target level
- [ ] Non-destructive preview: audition before/after without modifying the original
- [ ] Save: write processed sample back to common area (new file or overwrite)
- [ ] Module follows two-part export convention (algorithms + UI)
- [ ] Standalone dev harness runs independently (`pnpm dev` in module)
- [ ] Uses `AudioPlayback` and `FileIO` from environment capability interfaces — no direct browser API calls

## Scope

### In Scope

- `@audiocontrol/sample-trim-normalize` module
- Trim algorithm (silence-based auto-trim + manual region selection)
- Normalize algorithm (peak mode, RMS mode)
- Waveform UI with region selection (reuse `WaveformEditor` from sample-chopper)
- Before/after audio preview via `AudioPlayback` interface
- Dev harness following sample-chopper pattern
- Unit tests for algorithms

### Out of Scope

- Fade in/out (Phase 5 — effects chain)
- Batch processing (future enhancement)
- Undo/redo history (keep it simple for reference workflow)
- Effects beyond trim and normalize (Phase 5)

## Technical Context

### Existing Code to Reuse

| Component | Location | Usage |
|-----------|----------|-------|
| `trimSilence()` | `sample-chopper/src/silence-detector.ts` | Returns `{ start, end }` indices for silence boundaries |
| `calculateRms()` | `sample-chopper/src/audio-utils.ts` | RMS calculation for normalize target |
| `calculatePeak()` | `sample-chopper/src/audio-utils.ts` | Peak detection for normalize target |
| `amplitudeToDb()` / `dbToAmplitude()` | `sample-chopper/src/audio-utils.ts` | Level conversion |
| `WaveformEditor` | `sample-chopper/src/ui/components/WaveformEditor.tsx` | Canvas waveform with region markers |
| `AudioPlayback` | `editor-core/src/environments/types.ts` | Playback interface (browser impl exists) |
| `FileIO` | `editor-core/src/environments/types.ts` | File I/O interface (browser impl exists) |
| `SampleYaml` schema | `sampler-library/src/schemas/sample-schema.ts` | Common-area sample metadata |

### Module Structure

```
modules/sample-trim-normalize/
├── package.json          # Two-part export: "." and "./ui"
├── tsup.config.ts
├── src/
│   ├── index.ts          # Algorithm exports
│   ├── trim.ts           # trimSilence wrapper + manual trim
│   ├── normalize.ts      # normalizePeak(), normalizeRms()
│   ├── types.ts          # TrimConfig, NormalizeConfig, ProcessResult
│   └── ui/
│       ├── index.ts      # React component exports
│       ├── components/
│       │   └── TrimNormalizePanel.tsx
│       └── hooks/
│           └── useTrimNormalize.ts
├── dev/
│   ├── vite.config.ts    # Standalone dev harness
│   ├── main.tsx
│   └── index.html
└── test/
    └── unit/
        ├── trim.test.ts
        └── normalize.test.ts
```

### Algorithm Design

**Trim:**
- Auto-trim: call `trimSilence(samples, sampleRate, thresholdDb)` → `{ start, end }`
- Manual trim: user drags region markers on waveform
- Output: new `Int16Array` with cropped samples

**Normalize (Peak):**
1. Find peak: `calculatePeak(samples, 0, samples.length)`
2. Calculate gain: `targetPeak / currentPeak`
3. Apply: multiply all samples by gain, clamp to [-32768, 32767]

**Normalize (RMS):**
1. Calculate current RMS: `calculateRms(samples, 0, samples.length)`
2. Calculate gain: `dbToAmplitude(targetRmsDb) / currentRms`
3. Apply with limiter: multiply all samples, soft-clip if any exceed max

### Workflow Pattern

Per edit-workflow-architecture, this module:
- Receives audio data and environment capabilities via props/injection
- Operates on `SampleYaml` metadata + WAV data
- Returns processed audio + updated metadata
- Never imports browser APIs directly
- Standalone dev harness wires up browser implementations

## Dependencies

- `@audiocontrol/sample-chopper` — reuse `trimSilence`, audio utils
- `@audiocontrol/editor-core` — `AudioPlayback`, `FileIO` interfaces
- `@audiocontrol/sampler-library` — `SampleYaml` schema

## Open Questions

- [ ] Should trim and normalize be a single combined UI or two separate workflows?
- [ ] What is the default RMS target level? (-14 dBFS is a common mastering standard, but sampler content may want -6 dBFS)
- [ ] Should the module export `WaveformEditor` or import it from sample-chopper?
