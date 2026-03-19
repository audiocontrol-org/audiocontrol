# Loop Editor Fixes

**Status:** Planning
**Feature Branch:** `feature/loop-editor-fixes`
**GitHub Milestone:** TBD

## Overview

Fix broken splice-point detection and crossfade in the existing loop editor. The detection pipeline is architecturally sound but produces audibly poor results due to asymmetric crossfade, fixed crossfade length, silent-region false positives, and missing phase continuity checks.

## Documentation

- [PRD](./prd.md) - Bug inventory, specific fixes needed, test strategy
- [Workplan](./workplan.md) - Implementation phases
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Bug Summary

| Bug | File | Impact |
|-----|------|--------|
| Asymmetric crossfade | `splice-smoother.ts` | Discontinuity at splice |
| 3dB dip (linear mode) | `splice-smoother.ts` | Audible volume drop every loop cycle |
| Fixed 32-sample crossfade | `splice-smoother.ts` | Too short for low rates, too long for short loops |
| Unused discontinuity metrics | `splice-smoother.ts` | Crossfade doesn't adapt to signal |
| Silent regions score 1.0 | `ncc-scorer.ts` | False-positive candidates |
| No phase continuity check | `candidate-scorer.ts` | Phase-mismatched candidates rank high |
| Precision loss on boundary snap | `zero-crossing-detector.ts` | Slope scoring inaccurate |

## Files Modified

All changes within `modules/sampler-library/src/loop-detector/`:
- `splice-smoother.ts` — rewrite
- `ncc-scorer.ts` — silent-region fix
- `candidate-scorer.ts` — phase continuity score
- `zero-crossing-detector.ts` — precision improvement
- `types.ts` — add `phaseScore` to `LoopCandidate`
