# Loop Editor Fixes - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** audiocontrol-org

---

## Problem Statement

The loop editor has a complete UI and detection pipeline (~2000 LOC across 7 files in `sampler-library/src/loop-detector/`), but splice-point detection and crossfade are acknowledged as "pretty broken." The detection finds loop candidates, but:

1. **Crossfade is asymmetric** — applied to end region only; start region is untouched, causing discontinuity
2. **Linear crossfade has a 3dB dip** at midpoint — audible as a volume drop on every loop cycle
3. **Equal-power crossfade can amplify** correlated regions — causing clipping on tonal content
4. **Crossfade length is fixed** at 32 samples — not adaptive to sample rate or signal characteristics
5. **`analyzeDiscontinuity()` calculates useful metrics but they're unused** — the crossfade strategy doesn't adapt to the splice characteristics
6. **No phase continuity check** — candidates can have phase discontinuity at the splice point even with high NCC scores
7. **Zero-crossing detection loses precision** when snapping to 2-byte boundaries
8. **NCC scorer returns 1.0 for silent regions** — false positive on decayed/silent segments

This is a bug-fix feature, not new architecture. The goal is to make the existing loop detector produce usable loop points with clean crossfades.

## User Stories

- As a sample library curator, I want auto-detected loop points that sound clean so that I don't have to manually find loop points by ear
- As a producer loading samples onto an S-550, I want crossfades that don't click or dip in volume so that looped pads and strings sound natural
- As a developer, I want the loop detector's quality metrics to be trustworthy so that high-scoring candidates actually sound good

## Success Criteria

- [ ] Crossfade applies symmetrically (both start and end regions blended)
- [ ] No audible volume dip or click at loop splice point on tonal content
- [ ] Crossfade length adapts to sample rate and loop length
- [ ] `analyzeDiscontinuity()` metrics drive crossfade strategy selection
- [ ] Phase continuity check added to candidate scoring
- [ ] Silent-region false positives eliminated from NCC scorer
- [ ] Regression test suite with known-good and known-bad loop cases
- [ ] A/B comparison: before/after on at least 5 real-world samples

## Scope

### In Scope

- `sampler-library/src/loop-detector/splice-smoother.ts` — rewrite crossfade
- `sampler-library/src/loop-detector/ncc-scorer.ts` — fix silent-region false positive
- `sampler-library/src/loop-detector/candidate-scorer.ts` — add phase continuity to composite score
- `sampler-library/src/loop-detector/zero-crossing-detector.ts` — improve boundary precision
- Regression tests with reference audio files
- Existing unit tests updated

### Out of Scope

- Loop editor UI changes (UI is functional; this is backend quality)
- New detection algorithms (the pipeline is sound; the scoring and smoothing need fixing)
- Migrating loop editor to new workflow architecture (separate future task)
- Real-time loop preview improvements (cosmetic)

## Technical Context

### Current Pipeline

```
1. Transient exclusion → find sustain start (skip attack)
2. Zero-crossing detection → find candidate boundaries in start/end regions
3. Candidate pair generation → cartesian product of start × end crossings
4. NCC + spectral + slope scoring → composite score per candidate
5. Ranking and deduplication → top K candidates
6. Splice smoothing → crossfade at selected candidate's splice point
```

Steps 1-3 are functional. Steps 4-6 have the quality issues.

### Specific Fixes Needed

**splice-smoother.ts:**

| Issue | Current | Fix |
|-------|---------|-----|
| Asymmetric crossfade | End region only | Symmetric: blend both regions at splice zone |
| 3dB dip (linear) | `gain_a + gain_b = 1.0` at midpoint | Equal-power as default; constant-power curves |
| Fixed length (32 samples) | Hardcoded | Adaptive: `Math.min(loopLength / 4, sampleRate * 0.002)` (2ms or quarter-loop) |
| Unused `analyzeDiscontinuity()` | Metrics computed but ignored | Use amplitude ratio and DC offset to select crossfade strategy |
| Correlated amplification | Equal-power on correlated content | Detect correlation; fall back to linear for highly correlated regions |

**ncc-scorer.ts:**

| Issue | Current | Fix |
|-------|---------|-----|
| Silent regions score 1.0 | Zero variance → return 1.0 | Check RMS of both windows; return 0.0 if below noise floor (-60dB) |

**candidate-scorer.ts:**

| Issue | Current | Fix |
|-------|---------|-----|
| No phase check | Composite = NCC + spectral + slope | Add phase continuity score: measure instantaneous phase difference at splice point |

**zero-crossing-detector.ts:**

| Issue | Current | Fix |
|-------|---------|-----|
| Precision loss on snap | Snap to 2-byte boundary | Calculate slope at pre-snap position; keep original precision for scoring, snap only for final output |

### Test Strategy

Create a `test/fixtures/` directory with reference WAV files:
- Sine wave (trivial — any loop point works)
- Sustained string pad (tonal, should loop cleanly)
- Drum loop with transients (should exclude attack)
- Decaying piano note (tricky — decreasing amplitude)
- Near-silent tail (should not produce false-positive candidates)

For each fixture, record expected behavior:
- Does auto-detect find a usable loop point?
- Does crossfade produce a clean splice? (measure discontinuity before/after)
- Are silent-region candidates excluded?

## Dependencies

- No external dependencies — all fixes are within `sampler-library/src/loop-detector/`
- Existing tests in `sampler-library/test/unit/loop-detector/` updated

## Open Questions

- [ ] Should the loop editor UI show the crossfade waveform (before/after overlay)?
- [ ] Is 2ms a good default adaptive crossfade length, or should it scale with fundamental frequency?
- [ ] Should phase continuity weight be configurable or hardcoded into the composite score?
