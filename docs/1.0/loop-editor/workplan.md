# Loop Point Detection & Splicing - Workplan

**Feature:** Loop Point Auto-Detection
**Branch:** `feature/s550-support`

---

## Implementation Phases

### Phase 1: Core Algorithm Modules

#### 1a: Types and Zero Crossing Detector

**Files:**
- `modules/sampler-library/src/loop-detector/types.ts`
- `modules/sampler-library/src/loop-detector/zero-crossing-detector.ts`

**Tasks:**
1. Define all TypeScript interfaces (ZeroCrossing, LoopCandidate, SearchConfig, SpliceConfig)
2. Implement `detectZeroCrossings()` - scan for sign changes
3. Implement `filterByPolarity()` - filter by positive/negative going
4. Implement `matchBySlope()` - filter by slope similarity
5. Enforce 2-byte boundary alignment

**Acceptance Criteria:**
- Sine wave at known frequency produces crossings at predictable indices
- All indices are even (2-byte aligned)
- Polarity filtering correctly separates positive/negative crossings

---

#### 1b: Transient Excluder

**Files:**
- `modules/sampler-library/src/loop-detector/transient-excluder.ts`

**Tasks:**
1. Reuse `calculateRmsWindowed()` from audio-utils.ts
2. Compute RMS envelope derivative
3. Find sustain region start (where derivative stabilizes)
4. Make configurable via TransientConfig

**Acceptance Criteria:**
- Attack transient correctly identified for percussion samples
- Sustain start correctly identified for sustained samples
- No false positives in already-sustaining material

---

#### 1c: NCC Scorer

**Files:**
- `modules/sampler-library/src/loop-detector/ncc-scorer.ts`

**Tasks:**
1. Implement normalized cross-correlation formula
2. Handle edge cases (zero variance, bounds)
3. Optimize for performance (avoid redundant calculations)

**Acceptance Criteria:**
- Identical windows return 1.0
- Inverted windows return -1.0
- Independent noise windows return ≈0
- Performance: < 1ms for 1024-sample window

---

#### 1d: Spectral Scorer

**Files:**
- `modules/sampler-library/src/loop-detector/spectral-scorer.ts`

**Dependencies:**
- Add `fft.js` to sampler-library package.json

**Tasks:**
1. Add fft.js dependency
2. Implement Hann window function
3. Implement `computeLogMagnitudeSpectrum()`
4. Implement `calculateSpectralDistance()` (L2 norm of log magnitude diff)
5. Implement `scoreSpectralSimilarity()`

**Acceptance Criteria:**
- Same frequency content → high similarity score
- Different frequencies → low similarity score
- Graceful handling of DC offset and windowing artifacts

---

#### 1e: Candidate Scorer and Loop Point Searcher

**Files:**
- `modules/sampler-library/src/loop-detector/candidate-scorer.ts`
- `modules/sampler-library/src/loop-detector/loop-point-searcher.ts`

**Tasks:**
1. Implement composite score formula (weighted sum)
2. Implement `scoreCandidates()` with all three metrics
3. Implement `rankCandidates()` - top-K sorting
4. Implement `searchLoopPoints()` - full orchestrator
5. Add progress callback support

**Acceptance Criteria:**
- Composite scores combine NCC, spectral, and slope correctly
- Top-K ranking returns correct number of candidates
- Progress callbacks fire at regular intervals
- Search handles empty results gracefully

---

#### 1f: Splice Smoother

**Files:**
- `modules/sampler-library/src/loop-detector/splice-smoother.ts`

**Tasks:**
1. Implement linear crossfade
2. Implement equal-power crossfade
3. Apply crossfade to sample buffer
4. Handle edge cases (crossfade longer than loop)

**Acceptance Criteria:**
- Step discontinuity reduced to below threshold after crossfade
- Equal-power maintains perceived loudness
- Crossfade respects minimum/maximum lengths

---

### Phase 2: Web Worker Integration

**Files:**
- `modules/sampler-editor/src/workers/loop-detection.worker.ts`
- `modules/sampler-editor/src/hooks/useLoopDetection.ts`

**Tasks:**
1. Create Web Worker with message handling
2. Use Transferable for zero-copy buffer transfer
3. Post progress updates at regular intervals
4. Create React hook with state management
5. Handle worker lifecycle (start, cancel, cleanup)

**Acceptance Criteria:**
- UI thread not blocked during search
- Progress updates appear in UI
- Search can be cancelled mid-operation
- Worker properly terminated on component unmount

---

### Phase 3: UI Integration

**Files:**
- `modules/sampler-editor/src/components/tones/LoopEditor.tsx`
- `modules/sampler-editor/src/pages/TonesPage.tsx`

**Tasks:**
1. Add "Auto-Detect" button to LoopEditor
2. Add progress indicator component
3. Add candidate markers on waveform
4. Add candidate list with scores
5. Add preview/audition functionality
6. Wire TonesPage with useLoopDetection hook
7. Handle candidate selection and parameter updates

**Acceptance Criteria:**
- Auto-Detect button triggers search
- Progress shown during search
- Candidates displayed on waveform
- Clicking candidate updates loop points
- Changes persist to device on commit

---

### Phase 4: Testing

**Files:**
- `modules/sampler-library/test/loop-detector/*.test.ts`

**Tasks:**
1. Zero crossing detector tests (sine wave, edge cases)
2. NCC scorer tests (identical, inverted, noise)
3. Spectral scorer tests (same/different frequencies)
4. Splice smoother tests (step discontinuity)
5. Integration tests (full search pipeline)

**Acceptance Criteria:**
- All unit tests pass
- Coverage > 80% for loop-detector module
- Integration test finds valid loop in test sample

---

## Verification Commands

```bash
# Build all modules
pnpm --filter @audiocontrol/sampler-library build
pnpm --filter @audiocontrol/sampler-editor build

# Run tests
pnpm --filter @audiocontrol/sampler-library test
pnpm --filter @audiocontrol/sampler-editor test

# Type check
pnpm --filter @audiocontrol/sampler-library typecheck
pnpm --filter @audiocontrol/sampler-editor typecheck

# Manual testing
pnpm --filter @audiocontrol/sampler-editor dev
```

---

## Dependencies

| Dependency | Version | Module | Purpose |
|------------|---------|--------|---------|
| fft.js | ^4.0.4 | sampler-library | FFT for spectral analysis |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FFT performance on large samples | Search too slow | Use appropriate window sizes, add early termination |
| Zero crossing count explosion | O(Z²×N) search | Pre-filter by slope before expensive scoring |
| Browser compatibility | Worker API issues | Test on Chrome, Firefox, Safari |
| Hardware round-trip failures | Clicks on device | Verify SysEx encoding, add integration tests |
