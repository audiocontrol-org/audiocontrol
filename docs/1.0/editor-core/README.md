# Editor-Core Shared Library

**Status:** Completed
**Branch:** `feature/editor-core`
**Milestone:** [Week of Feb 17-21](https://github.com/audiocontrol-org/audiocontrol/milestone/3)

## Overview

Create shared infrastructure to eliminate ~1,100 lines of duplicated code across the S-330, D-110, and JV-1080 web editors. This feature establishes a new `@audiocontrol/editor-core` module with reusable MIDI stores, connection components, and UI primitives.

## Documentation

- [PRD](./prd.md) - Product requirements, problem statement, and solution design
- [Workplan](./workplan.md) - Implementation phases and GitHub tracking links
- [Implementation Summary](./implementation-summary.md) - Progress and completion notes
- [Design System Plan](./design-system-plan.md) - Findings and phased plan for robust cross-editor visual consistency
- [Architecture Review](./architecture-review.md) - Design system architecture assessment and recommendations

## GitHub Tracking

- Parent issue: [[editor-core] Shared editor infrastructure (#27)](https://github.com/audiocontrol-org/audiocontrol/issues/27)
- Reference: [Cross-Editor Review](../../../cross-editor-review.md)

## Implementation Issues

| Issue | Phase | Priority | Status |
|-------|-------|----------|--------|
| [#28 Create editor-core module scaffold](https://github.com/audiocontrol-org/audiocontrol/issues/28) | 2 | P2 | Completed |
| [#29 Implement createMidiStore factory](https://github.com/audiocontrol-org/audiocontrol/issues/29) | 2 | P2 | Completed |
| [#30 Create MidiConnectionPage component](https://github.com/audiocontrol-org/audiocontrol/issues/30) | 3 | P2 | Completed |
| [#31 Add shared MidiPortSelector](https://github.com/audiocontrol-org/audiocontrol/issues/31) | 3 | P2 | Completed |
| [#32 Add shared ParameterSlider with formatters](https://github.com/audiocontrol-org/audiocontrol/issues/32) | 4 | P2 | Completed |
| [#33 Add shared CollapsibleSection](https://github.com/audiocontrol-org/audiocontrol/issues/33) | 4 | P2 | Completed |
| [#34 Create design system tokens](https://github.com/audiocontrol-org/audiocontrol/issues/34) | 5 | P3 | Completed |
| [#35 Migrate JV-1080 to EditorLayout](https://github.com/audiocontrol-org/audiocontrol/issues/35) | 1 | P1 | Completed |
| [#36 Migrate JV-1080 to Tailwind CSS](https://github.com/audiocontrol-org/audiocontrol/issues/36) | 5 | P2 | Completed |
| [#37 Standardize BrowserRouter placement](https://github.com/audiocontrol-org/audiocontrol/issues/37) | 1 | P1 | Completed |
| [#39 [editor-core] Harden shared design system across editors](https://github.com/audiocontrol-org/audiocontrol/issues/39) | 7 | P2 | In Progress |
| [#40 Normalize shared control and state styling across editor pages](https://github.com/audiocontrol-org/audiocontrol/issues/40) | 7 | P2 | Open |
| [#41 Document visual regression checklist for editor design system](https://github.com/audiocontrol-org/audiocontrol/issues/41) | 7 | P3 | Open |
| [#42 Standardize full-height layout and scroll-region contracts](https://github.com/audiocontrol-org/audiocontrol/issues/42) | 7 | P2 | Open |
| [#43 Implement shared page-shell primitives and migrate S-330 pages](https://github.com/audiocontrol-org/audiocontrol/issues/43) | 7 | P2 | Open |
| [#44 Adopt hardened editor-core primitives in D-110 and JV-1080](https://github.com/audiocontrol-org/audiocontrol/issues/44) | 7 | P2 | Open |
| [#45 Define semantic color token map for editor-core](https://github.com/audiocontrol-org/audiocontrol/issues/45) | 7 | P2 | Open |
| [#46 Add shared SelectableList abstraction for editor list UIs](https://github.com/audiocontrol-org/audiocontrol/issues/46) | 8 | P3 | Open |

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
