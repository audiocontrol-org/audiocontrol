# Sample Trim & Normalize

**Status:** Planning
**Feature Branch:** `feature/sample-trim-normalize`
**GitHub Milestone:** TBD

## Overview

Trim silence and normalize levels for common-area samples. The simplest DSP operations and the reference implementation for Phase 2 edit workflows.

## Documentation

- [PRD](./prd.md) - Requirements, existing code to reuse, module structure
- [Workplan](./workplan.md) - Implementation phases
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Module Structure

```
@audiocontrol/sample-trim-normalize
├── "."    → algorithms (trim, normalize, analyzeLevel)
└── "./ui" → React components (TrimNormalizePanel)
```

## Quick Reference

| Algorithm | Function | Input | Output |
|-----------|----------|-------|--------|
| Auto-trim | `autoTrim(samples, sampleRate, config)` | Int16Array + threshold | Cropped Int16Array |
| Manual trim | `manualTrim(samples, start, end)` | Int16Array + region | Cropped Int16Array |
| Peak normalize | `normalizePeak(samples, targetDb)` | Int16Array + target dBFS | Scaled Int16Array |
| RMS normalize | `normalizeRms(samples, targetDb)` | Int16Array + target dBFS | Scaled Int16Array |
| Analyze | `analyzeLevel(samples)` | Int16Array | `{ peakDb, rmsDb }` |
