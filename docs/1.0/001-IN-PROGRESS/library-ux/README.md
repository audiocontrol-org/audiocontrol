# Library UX Improvements

**Status:** In Progress
**Branch:** `feature/library-ux`

## Documentation

- [PRD](./prd.md) - Product requirements document
- [Workplan](./workplan.md) - Implementation plan

## Overview

Align and improve library page UX across both the Roland S-330/S-550 editor and the Akai S3000XL editor. The core problem is implementation divergence: the S3K editor uses the shared `PluginLibraryBrowser` from editor-core, but the Roland editor has its own bespoke three-column layout (908 lines, violating the 500-line guideline). Roland's UX is the more mature implementation and the reference standard.

## Key Goals

1. **Alignment** - Migrate Roland onto `PluginLibraryBrowser`, updating the shared component to match Roland's UX standard
2. **Code reuse** - Extract shared hooks and patterns to editor-core so both editors benefit
3. **Code quality** - Reduce Roland's LibraryPage from 908 lines to <500 via hook extraction
4. **UX polish** - Improve visual hierarchy, interaction feedback, and discoverability in the shared components

## Scope

- **Both editors:** Roland S-330/S-550 (`roland-sxx0-editor`) and Akai S3000XL (`akai-s3k-editor`)
- **Shared layer:** `editor-core` PluginLibraryBrowser, plugin interfaces, shared hooks
- Sets remain device-specific (Roland-only category); vendor-agnostic "Multi" concept deferred
- Both device-specific and common-area categories shown in the library browser

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Extract Roland hooks | Not started | Pure refactor, no rendering changes |
| Phase 2: Upstream to editor-core | Not started | Depends on Phase 1 |
| Phase 3: Migrate Roland to PluginLibraryBrowser | Not started | Highest risk phase |
| Phase 4: UX polish on shared components | Not started | Benefits both editors |

## Related Documentation

- [S3K Library Page Conformance](../../s3k-library-page/) - Prior effort that brought S3K to three-column layout (largely complete)
