# Editor-Core Shared Library

**Status:** Planning
**Branch:** `feature/editor-core`
**Milestone:** [Week of Feb 17-21](https://github.com/audiocontrol-org/audiocontrol/milestone/3)

## Overview

Create shared infrastructure to eliminate ~1,100 lines of duplicated code across the S-330, D-110, and JV-1080 web editors. This feature establishes a new `@audiocontrol/editor-core` module with reusable MIDI stores, connection components, and UI primitives.

## Documentation

- [PRD](./prd.md) - Product requirements, problem statement, and solution design
- [Workplan](./workplan.md) - Implementation phases and GitHub tracking links
- [Implementation Summary](./implementation-summary.md) - Progress and completion notes

## GitHub Tracking

- Parent issue: [[editor-core] Shared editor infrastructure (#27)](https://github.com/audiocontrol-org/audiocontrol/issues/27)
- Reference: [Cross-Editor Review](../../../cross-editor-review.md)

## Implementation Issues

| Issue | Phase | Priority | Status |
|-------|-------|----------|--------|
| [#28 Create editor-core module scaffold](https://github.com/audiocontrol-org/audiocontrol/issues/28) | 2 | P2 | Planned |
| [#29 Implement createMidiStore factory](https://github.com/audiocontrol-org/audiocontrol/issues/29) | 2 | P2 | Planned |
| [#30 Create MidiConnectionPage component](https://github.com/audiocontrol-org/audiocontrol/issues/30) | 3 | P2 | Planned |
| [#31 Add shared MidiPortSelector](https://github.com/audiocontrol-org/audiocontrol/issues/31) | 3 | P2 | Planned |
| [#32 Add shared ParameterSlider with formatters](https://github.com/audiocontrol-org/audiocontrol/issues/32) | 4 | P2 | Planned |
| [#33 Add shared CollapsibleSection](https://github.com/audiocontrol-org/audiocontrol/issues/33) | 4 | P2 | Planned |
| [#34 Create design system tokens](https://github.com/audiocontrol-org/audiocontrol/issues/34) | 5 | P3 | Planned |
| [#35 Migrate JV-1080 to EditorLayout](https://github.com/audiocontrol-org/audiocontrol/issues/35) | 1 | P1 | Planned |
| [#36 Migrate JV-1080 to Tailwind CSS](https://github.com/audiocontrol-org/audiocontrol/issues/36) | 5 | P2 | Planned |
| [#37 Standardize BrowserRouter placement](https://github.com/audiocontrol-org/audiocontrol/issues/37) | 1 | P1 | Planned |

## Quick Links

- Target module: `modules/editor-core/`
- Reference implementation (S-330): `modules/s330-editor/`
- Reference implementation (D-110): `modules/d110-editor/`
- Migration target (JV-1080): `modules/jv1080-editor/`

## Code Duplication Summary

From [Cross-Editor Review](../../../cross-editor-review.md):

| Category | Lines | Notes |
|----------|-------|-------|
| MIDI stores | ~450 | 80%+ identical logic |
| MidiPortSelector | ~200 | S-330/D-110 nearly identical |
| HomePage/Connection | ~400 | Config-only differences |
| Utilities | ~60 | cn(), formatters duplicated |
| **Total** | **~1,100** | Target: 80% reduction |
