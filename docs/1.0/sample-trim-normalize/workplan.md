# Sample Trim & Normalize - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Algorithm Implementation | Not Started | Trim + normalize functions with tests |
| Phase 2: UI Components | Not Started | Waveform panel, controls, preview |
| Phase 3: Dev Harness | Not Started | Standalone Vite environment |
| Phase 4: Editor Integration | Not Started | Wire into sampler-editor common-area workflow |

---

## Phase 1: Algorithm Implementation

### Goal

Implement trim and normalize as pure functions with comprehensive tests.

### Tasks

1. **Create `modules/sample-trim-normalize/` package**
   - `package.json` with two-part exports (`.` and `./ui`)
   - `tsup.config.ts` building both entry points
   - `tsconfig.json` extending base

2. **Implement `trim.ts`**
   - `autoTrim(samples, sampleRate, config)` — wraps `trimSilence` from sample-chopper
   - `manualTrim(samples, startSample, endSample)` — crop to region
   - `TrimConfig`: `{ thresholdDb: number; minDurationMs?: number }`
   - `TrimResult`: `{ samples: Int16Array; startCropped: number; endCropped: number; originalLength: number }`

3. **Implement `normalize.ts`**
   - `normalizePeak(samples, targetPeakDb)` — scale to target peak
   - `normalizeRms(samples, targetRmsDb)` — scale to target RMS with limiter
   - `analyzeLevel(samples)` — return `{ peakDb, rmsDb, peakAmplitude, rmsAmplitude }`
   - `NormalizeConfig`: `{ mode: 'peak' | 'rms'; targetDb: number }`
   - `NormalizeResult`: `{ samples: Int16Array; gainAppliedDb: number; clipped: boolean }`

4. **Write tests**
   - Trim: silence detection, edge cases (all silence, no silence, single-sample)
   - Normalize: peak mode, RMS mode, clipping behavior, gain calculation
   - Round-trip: trim then normalize preserves sample integrity

### Acceptance Criteria

- [ ] `autoTrim` correctly removes leading/trailing silence
- [ ] `normalizePeak` scales to target without clipping (or reports clipping)
- [ ] `normalizeRms` scales to target RMS with soft limiting
- [ ] `analyzeLevel` reports accurate peak and RMS in dBFS
- [ ] All functions operate on `Int16Array` (native sample format)
- [ ] No browser API dependencies in algorithm code

---

## Phase 2: UI Components

### Goal

Build the workflow UI panel using existing waveform rendering components.

### Tasks

1. **Create `TrimNormalizePanel.tsx`**
   - Waveform display showing full sample with trim region markers
   - Trim controls: auto-trim button, threshold slider, manual drag handles
   - Normalize controls: mode selector (peak/RMS), target level slider
   - Level meters showing before/after peak and RMS
   - Preview button (plays processed result via `AudioPlayback`)
   - Apply button (returns processed samples to caller)

2. **Create `useTrimNormalize.ts` hook**
   - State: original samples, trim region, normalize config, processed preview
   - Actions: `setTrimRegion`, `autoTrim`, `normalize`, `preview`, `apply`
   - Computes processed samples on-demand (not on every slider change)

3. **Export UI components**
   - `src/ui/index.ts` exports `TrimNormalizePanel` and hook

### Acceptance Criteria

- [ ] Waveform shows trim region with draggable handles
- [ ] Auto-trim button snaps handles to detected silence boundaries
- [ ] Normalize mode and target are configurable
- [ ] Before/after preview plays through `AudioPlayback` interface
- [ ] No direct browser API usage in components

---

## Phase 3: Dev Harness

### Goal

Standalone development environment following sample-chopper pattern.

### Tasks

1. **Create `dev/` directory**
   - `vite.config.ts` — standalone Vite config
   - `main.tsx` — React entry with file picker and library browser
   - `index.html` — minimal HTML shell

2. **Wire up browser environment**
   - `createBrowserFileIO()` for loading WAV files
   - `createBrowserAudioPlayback()` for preview
   - Library browser for loading common-area samples

3. **Verify standalone operation**
   - `pnpm dev` in module directory launches working trim/normalize UI
   - Load WAV from file picker → trim → normalize → preview → save

### Acceptance Criteria

- [ ] `cd modules/sample-trim-normalize && pnpm dev` launches working app
- [ ] Can load, trim, normalize, preview, and save a WAV file
- [ ] No dependency on sampler-editor or MIDI

---

## Phase 4: Editor Integration

### Goal

Wire trim/normalize into the sampler-editor common-area workflow.

### Tasks

1. **Add route or panel in sampler-editor**
   - Common-area sample → "Edit" action → TrimNormalizePanel
   - Per edit-workflow-architecture navigation pattern

2. **Connect to library storage**
   - Read sample from common area
   - Write processed sample back (new file or overwrite)
   - Update `SampleYaml` metadata if trim changes loop points

3. **Test end-to-end**
   - Load common-area sample → trim → normalize → save → verify in library

### Acceptance Criteria

- [ ] Trim/normalize accessible from common-area sample context menu or action
- [ ] Processed sample saved correctly to library
- [ ] Sample metadata updated (duration, loop points adjusted for trim)

---

## Dependencies

```
Phase 1 (Algorithms) → Phase 2 (UI) → Phase 3 (Dev Harness) → Phase 4 (Integration)
```

All phases sequential.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WaveformEditor coupling to sample-chopper internals | Medium | Medium | Import as dependency; if too coupled, extract to shared package |
| Normalize clipping on hot samples | Low | Low | Report clipping in result; UI shows warning |
| Int16Array precision loss on repeated normalize | Low | Low | Operate on copy, never chain multiple normalizations |
