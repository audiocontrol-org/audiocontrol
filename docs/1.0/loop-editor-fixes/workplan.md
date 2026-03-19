# Loop Editor Fixes - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

---

## Implementation Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Test Fixtures & Regression Suite | Not Started | Reference audio + expected behavior |
| Phase 2: NCC Scorer Fix | Not Started | Silent-region false positive |
| Phase 3: Splice Smoother Rewrite | Not Started | Symmetric crossfade, adaptive length |
| Phase 4: Candidate Scoring Improvements | Not Started | Phase continuity, zero-crossing precision |
| Phase 5: A/B Validation | Not Started | Before/after comparison on real samples |

---

## Phase 1: Test Fixtures & Regression Suite

### Goal

Establish reference audio files and expected behavior before changing any code. This lets us measure improvement objectively.

### Tasks

1. **Create test fixtures directory**
   ```
   modules/sampler-library/test/fixtures/loop-detector/
   ├── sine-440hz-2s.wav          # Trivial case
   ├── string-pad-sustained.wav   # Tonal loop target
   ├── drum-loop-120bpm.wav       # Transient content
   ├── piano-decay.wav            # Decreasing amplitude
   └── near-silent-tail.wav       # False positive test
   ```

2. **Record current behavior baseline**
   - Run loop detection on each fixture
   - Record top candidate scores and positions
   - Record crossfade discontinuity metrics (amplitude jump, DC offset, slope mismatch)
   - Save as `test/fixtures/loop-detector/baseline.json`

3. **Write regression tests**
   - Each fixture has assertions on candidate quality
   - `sine-440hz`: should find loop point, crossfade should have <0.01 discontinuity
   - `near-silent-tail`: should NOT score silent-region candidates above 0.5
   - `string-pad`: crossfade should not produce >1dB amplitude dip

### Acceptance Criteria

- [ ] At least 5 reference fixtures with expected behavior documented
- [ ] Baseline metrics recorded for current (broken) behavior
- [ ] Regression tests fail on known-bad cases (confirming the bugs exist)

---

## Phase 2: NCC Scorer Fix

### Goal

Eliminate false-positive scores on silent or near-silent regions.

### Tasks

1. **Add RMS floor check to `calculateNCC()`**
   - Before computing NCC, calculate RMS of both windows
   - If either window RMS < noise floor (-60dBFS ≈ 0.001 amplitude), return 0.0
   - Same fix for `calculateZeroMeanNCC()`

2. **Update tests**
   - `near-silent-tail` fixture should no longer produce high-scoring candidates
   - Existing NCC tests updated with silent-region edge case

### Acceptance Criteria

- [ ] Silent regions return NCC score of 0.0
- [ ] Non-silent regions unaffected
- [ ] `near-silent-tail` fixture passes regression test

---

## Phase 3: Splice Smoother Rewrite

### Goal

Replace the current crossfade with a symmetric, adaptive, strategy-driven implementation.

### Tasks

1. **Implement symmetric crossfade**
   - Current: only end region is faded
   - New: blend zone centered on splice point, both regions contribute
   - `crossfadeSymmetric(samples, loopStart, loopEnd, length, mode)`

2. **Implement adaptive crossfade length**
   - Default: `Math.min(loopLength / 4, Math.round(sampleRate * 0.002))`
   - Minimum: 8 samples (avoid degenerate cases)
   - Maximum: half the loop length

3. **Implement strategy selection using `analyzeDiscontinuity()`**
   - Calculate correlation between start and end windows
   - If correlation > 0.8: use linear crossfade (avoids amplification)
   - If correlation < 0.8: use equal-power crossfade (maintains energy)
   - Report strategy chosen in result

4. **Fix equal-power curves**
   - Use `cos²/sin²` (constant power) instead of `cos/sin` (equal power)
   - Verify no amplitude dip at midpoint: `cos²(π/4) + sin²(π/4) = 1.0`

5. **Update tests**
   - `string-pad` fixture: crossfade should produce <0.5dB amplitude variation
   - `sine-440hz`: crossfade should be seamless (< 0.01 discontinuity)
   - No clipping on any fixture

### Acceptance Criteria

- [ ] Crossfade is symmetric (both regions blended)
- [ ] Crossfade length adapts to sample rate and loop length
- [ ] Strategy selection uses discontinuity metrics
- [ ] No audible volume dip on tonal content
- [ ] No clipping on correlated content

---

## Phase 4: Candidate Scoring Improvements

### Goal

Improve candidate ranking so that high-scoring candidates actually sound good.

### Tasks

1. **Add phase continuity score**
   - At the splice point, compare instantaneous phase of start and end regions
   - Phase difference → score: 0° = 1.0, 180° = 0.0
   - Add to composite: `weights.phase * phaseScore`
   - Default weight: 0.15 (reduce slope weight to compensate)
   - New weights: `{ ncc: 0.45, spectral: 0.30, slope: 0.10, phase: 0.15 }`

2. **Improve zero-crossing precision**
   - Calculate slope at original (pre-snap) sample position
   - Use sub-sample interpolation for slope calculation
   - Snap to 2-byte boundary only in final output, not during scoring

3. **Update composite scoring**
   - Add `phaseScore` to `LoopCandidate` type
   - Update `scoreCandidate()` to include phase calculation
   - Update deduplication to prefer higher phase-continuity candidates

4. **Update tests**
   - Verify phase score calculation on known waveforms
   - Verify improved ranking on `string-pad` and `piano-decay` fixtures

### Acceptance Criteria

- [ ] Phase continuity score included in candidate ranking
- [ ] Zero-crossing slope calculation uses pre-snap precision
- [ ] Top-ranked candidates have better phase continuity than before
- [ ] `LoopCandidate` type includes `phaseScore` field

---

## Phase 5: A/B Validation

### Goal

Verify that the fixes produce measurably and audibly better results on real-world samples.

### Tasks

1. **Run detection on all fixtures with old and new code**
   - Compare: top candidate composite scores
   - Compare: crossfade discontinuity metrics
   - Compare: crossfade amplitude variation (dB)

2. **Create comparison report**
   - Table: fixture × metric × before × after
   - Note any regressions

3. **Listen test**
   - Loop each fixture at the top candidate with old and new crossfade
   - Document: click/pop, volume dip, tonal artifacts

### Acceptance Criteria

- [ ] All fixtures show improved or equal discontinuity metrics
- [ ] No regressions on any fixture
- [ ] Listen test confirms no audible artifacts on top candidates

---

## Dependencies

```
Phase 1 (Fixtures) → Phase 2 (NCC Fix) → Phase 3 (Smoother) → Phase 4 (Scoring) → Phase 5 (Validation)
```

Phase 2 and 3 could be done in parallel after Phase 1, but sequential is safer for regression tracking.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Crossfade changes break existing working loops | Medium | Medium | Phase 1 baseline captures current behavior; regression suite catches regressions |
| Phase continuity score over-constrains candidates | Low | Low | Weight is configurable; start at 0.15 and tune |
| Adaptive crossfade length too short for low sample rates | Low | Low | Minimum 8 samples enforced |
| Test fixtures not representative of real content | Medium | Low | Use actual samples from S-550 library if available |
