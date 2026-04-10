# Library UX Improvements - Product Requirements Document

**Created:** 2026-03-30
**Updated:** 2026-04-07
**Status:** Approved
**Owner:** Orion Letizi

## Problem Statement

Both the Roland S-330/S-550 editor and the Akai S3000XL editor have library pages for managing samples, programs, and device memory. However, the two implementations have diverged:

1. **Implementation divergence** - The S3K editor uses `PluginLibraryBrowser` from editor-core (the shared component). The Roland editor does NOT - it has its own bespoke three-column layout built from `DeviceMemoryPanel`, `PluginLibraryTreePanel`, and `ItemPreviewPanel`. This means UX improvements must be made twice and drift over time.

2. **Roland LibraryPage complexity** - The Roland editor's `LibraryPage.tsx` is 908 lines (violating the 500-line guideline) with 11+ dialogs managed inline, complex state management, and tightly coupled selection/operation logic.

3. **UX rough edges** - Both editors lack visual polish: empty states are unhelpful, drag-and-drop has no affordances, there are no loading skeletons, keyboard navigation is missing, and progress indicators are minimal.

4. **Roland is the UX reference** - The Roland library page is the more mature implementation and the standard that `PluginLibraryBrowser` was based on. But the shared component has drifted from the reference.

## User Stories

### Alignment

- As a developer, I want both editors to use the same `PluginLibraryBrowser` component so that UX improvements land in both editors automatically
- As a developer, I want shared hooks for common patterns (editor dialogs, library data loading) so I don't reimplement the same logic per editor
- As a developer, I want each editor's LibraryPage under 500 lines so the code is maintainable

### UX

- As a user, I want clear visual hierarchy showing which panel is focused and what actions are available
- As a user, I want drag-and-drop to be discoverable (grab cursors, drop zone highlights, invalid target indicators)
- As a user, I want loading skeletons instead of blank panels while data loads
- As a user, I want progress bars for import/export operations with cancellation support where possible
- As a user, I want keyboard navigation (arrow keys, Enter, Escape, Delete) for all common workflows
- As a user, I want empty states that guide me toward the next action instead of showing blank panels
- As a user, I want error messages that explain what went wrong and how to recover

### Device-Specific

- As a Roland editor user, I want Sets to continue working as a device-specific category in the library browser
- As an S3K editor user, I want the same visual quality and interaction patterns as the Roland editor

## Success Criteria

### Alignment
- [ ] Roland editor uses `PluginLibraryBrowser` from editor-core (same component as S3K)
- [ ] Roland `LibraryPage.tsx` is under 500 lines
- [ ] Shared `useEditorDialogs` hook in editor-core used by both editors
- [ ] `PluginLibraryBrowser` matches Roland's UX standard (context menus, all category types)
- [ ] `libraryHandle` prop type widened to accept `StorageDirectoryHandle`

### UX
- [ ] All panels have focus indicators
- [ ] Empty states show guidance and action prompts
- [ ] Loading skeletons shown during async operations
- [ ] Drag-and-drop has visual affordances (grab cursor, drop zones, invalid targets)
- [ ] Keyboard navigation works for tree browsing (arrows, Enter, Escape, Delete)
- [ ] Import/export operations show progress bars

### Regression Safety
- [ ] All existing Roland E2E tests pass after migration
- [ ] All existing S3K E2E tests pass
- [ ] No visual regression in either editor
- [ ] Sets functionality preserved in Roland editor

## Scope

### In Scope

**Alignment work:**
- Extract Roland LibraryPage into hooks (editor dialogs, data loading, selection mapping, operation handlers)
- Upstream Roland patterns to editor-core (context menu wiring, Sets as CategoryPlugin)
- Migrate Roland to `PluginLibraryBrowser`
- Extract shared `useEditorDialogs` hook to editor-core with `WavLoaderStrategy` interface
- Delete bespoke Roland layout components after migration

**UX polish (in shared components, benefiting both editors):**
- Panel focus indicators
- Empty state designs with guidance text
- Loading skeleton placeholders
- Progress bar indicators for operations
- Drag-and-drop affordances
- Keyboard navigation in tree views
- Context menu improvements

### Out of Scope

- New library features (new item types, new operations)
- Vendor-agnostic "Multi" concept (deferred; Sets remain device-specific)
- Device protocol changes
- Performance optimization
- Mobile/responsive layout
- Sample rate conversion
- Automatic sample dependency resolution
- Akai disk browsing and disk object transfer via PiSCSI (see [Future Integration](#future-integration))

## Storage Architecture

This feature operates within the four-zone storage model described in [SAMPLER-LIBRARY.md](/SAMPLER-LIBRARY.md):

```
Sampler Disk ←→ Device Memory ←→ Device-Specific Library ←→ Common Area
```

Key architectural decisions for library UX:
- **The library browser shows both Zone 3 (device-specific) and Zone 4 (common area)** — users need access to both areas
- **Higher-order objects (drum kits, chopped samples) exist only in the common area** — device-specific storage mirrors native device format without interpretation
- **Conversion between zones is explicit** — the UI provides clear workflows for promoting device-specific objects to the common area and demoting common-area objects to device-specific format
- **Sets are device-specific (Zone 3)** — they are complete device state snapshots, not portable across devices

## Disk Browser Integration

The SCSI disk browser (merged from `feature/scsi-disk-browser`) adds Zone 1 access to the S3K library page. The disk browser panel presents Akai-formatted SCSI disk contents alongside the device memory and library storage, with workflows to transfer disk objects to the device-specific library (Zone 3).

Future work: conversion from disk-imported programs in the device-specific library to common-area program bundles (Zone 3 → Zone 4), which is where higher-order annotations (drum kit metadata, slice definitions) can be applied.

## Dependencies

- `editor-core` PluginLibraryBrowser and plugin interfaces (will be modified)
- Existing Roland plugin architecture (s330-library-plugin, s550-library-plugin)
- Existing S3K plugin architecture (s3k-library-plugin)
- `sampler-library` filesystem operations (unchanged)
- Existing E2E test infrastructure

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration vs shared hooks only | Migrate Roland to PluginLibraryBrowser | Eliminates divergence at the source; all future UX work lands in one place |
| UX reference standard | Roland editor | More mature implementation, what PluginLibraryBrowser was based on |
| Sets modeling | headerSections slot (device-specific) | Sets have two-level selection with lazy manifest loading; doesn't fit CategoryPlugin |
| Library browser scope | Show both device-specific and common-area categories | Users need access to both areas |
| Priority ordering | Alignment first, polish second | UX polish on shared components benefits both editors only after alignment |
| Higher-order objects | Common area only | Device-specific library mirrors native format without interpretation; drum kit / chopped sample metadata applied only during Zone 3 → Zone 4 promotion |
| Storage model | Four zones with explicit conversion | See [SAMPLER-LIBRARY.md](/SAMPLER-LIBRARY.md) |

## Open Questions

- [ ] Can Sets be cleanly modeled as a `CategoryPlugin`, or do they need a `headerSections` render slot in PluginLibraryBrowser? (to be determined during Phase 2 prototyping)
