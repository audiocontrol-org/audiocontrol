# Loop Point Detection & Splicing

**Status:** In Development
**Branch:** `feature/s550-support`
**Module:** `@audiocontrol/sampler-library` (algorithm) + `@audiocontrol/sampler-editor` (UI)

---

## Overview

Automatic loop point detection and splice smoothing for the Roland S-550/S-330 loop editor. Finds optimal `(loopStart, loopEnd)` pairs where the sampler can seamlessly loop without clicks, tonal discontinuities, or amplitude steps.

---

## Documentation

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Product requirements document |
| [loop-editor-spec.md](./loop-editor-spec.md) | Technical specification |
| [workplan.md](./workplan.md) | Implementation plan |
| [implementation-summary.md](./implementation-summary.md) | Post-implementation summary |

---

## Implementation Status

### Phase 1: Core Algorithm Modules

| Module | Status | Location |
|--------|--------|----------|
| types.ts | Complete | `modules/sampler-library/src/loop-detector/types.ts` |
| zero-crossing-detector.ts | Complete | `modules/sampler-library/src/loop-detector/zero-crossing-detector.ts` |
| transient-excluder.ts | Complete | `modules/sampler-library/src/loop-detector/transient-excluder.ts` |
| ncc-scorer.ts | Complete | `modules/sampler-library/src/loop-detector/ncc-scorer.ts` |
| spectral-scorer.ts | Complete | `modules/sampler-library/src/loop-detector/spectral-scorer.ts` |
| candidate-scorer.ts | Complete | `modules/sampler-library/src/loop-detector/candidate-scorer.ts` |
| splice-smoother.ts | Complete | `modules/sampler-library/src/loop-detector/splice-smoother.ts` |
| loop-point-searcher.ts | Complete | `modules/sampler-library/src/loop-detector/loop-point-searcher.ts` |

### Phase 2: Web Worker Integration

| Module | Status | Location |
|--------|--------|----------|
| loop-detection.worker.ts | Complete | `modules/sampler-editor/src/workers/loop-detection.worker.ts` |
| useLoopDetection.ts | Complete | `modules/sampler-editor/src/hooks/useLoopDetection.ts` |

### Phase 3: UI Integration

| Component | Status | Location |
|-----------|--------|----------|
| LoopEditor enhancements | Complete | `modules/sampler-editor/src/components/tones/LoopEditor.tsx` |
| ToneEditor updates | Complete | `modules/sampler-editor/src/components/tones/ToneEditor.tsx` |
| TonesPage integration | Complete | `modules/sampler-editor/src/pages/TonesPage.tsx` |

### Phase 4: Testing

| Test Suite | Status | Location |
|------------|--------|----------|
| Zero crossing tests | Complete | `modules/sampler-library/test/unit/loop-detector/zero-crossing-detector.test.ts` |
| NCC scorer tests | Complete | `modules/sampler-library/test/unit/loop-detector/ncc-scorer.test.ts` |
| Spectral scorer tests | Complete | `modules/sampler-library/test/unit/loop-detector/spectral-scorer.test.ts` |
| Splice smoother tests | Complete | `modules/sampler-library/test/unit/loop-detector/splice-smoother.test.ts` |
| Transient excluder tests | Complete | `modules/sampler-library/test/unit/loop-detector/transient-excluder.test.ts` |

---

## Dependencies

### New Dependencies

- `fft.js` - Pure JavaScript FFT implementation for spectral analysis

### Existing Dependencies (Reused)

- `calculateRmsWindowed` from `@audiocontrol/sampler-library` for transient detection
- `msToSamples` / `samplesToMs` for sample rate conversion

---

## Testing

```bash
# Run loop detector tests
pnpm --filter @audiocontrol/sampler-library test -- --grep "loop-detector"

# Run all sampler-library tests
pnpm --filter @audiocontrol/sampler-library test

# Run editor tests
pnpm --filter @audiocontrol/sampler-editor test
```

---

## Related Links

- Technical specification: [loop-editor-spec.md](./loop-editor-spec.md)
- Sample chopper audio utils: `modules/sampler-library/src/sample-chopper/audio-utils.ts`
- Existing LoopEditor: `modules/sampler-editor/src/components/tones/LoopEditor.tsx`
