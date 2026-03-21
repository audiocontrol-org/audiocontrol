# Portable Library Module with Device Plugin Architecture

**Status:** Planning
**Branch:** `feature/s550-support`
**Milestone:** TBD

## Overview

Extend editor-core's library components with a plugin architecture that allows device-specific behavior (custom item types, icons, categories, memory layouts, preview panels) without conditionals in UI components. Require plugins to implement bidirectional translation between device-specific formats (Tone, Patch) and common library formats (Sample, Program).

## Documentation

- [PRD](./prd.md) - Product requirements, problem statement, and solution design
- [Workplan](./workplan.md) - Implementation phases and GitHub tracking links
- [Implementation Summary](./implementation-summary.md) - Progress and completion notes

## GitHub Tracking

- Parent issue: TBD
- Milestone: TBD

## Implementation Issues

| Issue | Phase | Status |
|-------|-------|--------|
| Add inline rename support to TreeView | 1 | Pending |
| Add TreeSection component | 2 | Pending |
| Define plugin interfaces | 3 | Pending |
| Add PluginLibraryBrowser component | 4 | Pending |
| Implement S-330 library plugin | 5 | Pending |
| Implement S-550 library plugin | 5 | Pending |
| Migrate sampler-editor LibraryPage | 6 | Pending |

## Quick Links

- Target module: `modules/editor-core/`
- Plugin implementations: `modules/sampler-editor/src/plugins/`
- Reference (TreeView): `modules/editor-core/src/components/library/TreeView.tsx`
- Reference (LibraryTreeNode): `modules/sampler-editor/src/components/library/LibraryTreeNode.tsx`
- Common formats: `modules/sampler-library/src/types/`
