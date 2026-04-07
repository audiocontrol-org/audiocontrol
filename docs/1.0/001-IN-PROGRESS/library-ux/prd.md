# Roland S-330/S-550 Library Page UX Improvements

**Created:** 2026-03-30
**Status:** Draft
**Owner:** TBD

## Problem Statement

The roland-sxx0-editor Library page provides powerful functionality for managing sampler tones, patches, sets, drum kits, and samples across device memory and the local library. However, the current implementation has UX rough edges that create friction for users:

1. **Visual complexity** — The three-column layout (device memory, library browser, preview panel) can be overwhelming, especially for new users
2. **Discoverability issues** — Key workflows like drag-and-drop import/export, context menus, and keyboard shortcuts are not immediately obvious
3. **Feedback gaps** — Long-running operations (import, export, device communication) lack clear progress indication and error recovery paths
4. **Navigation friction** — Moving between deep library hierarchies and device slots requires many clicks
5. **Code complexity** — The LibraryPage component is 908 lines, indicating potential for simplification

## User Stories

### Primary Workflows

1. **As a user**, I want to quickly import a tone from my library to the device so I can use it in my music production
2. **As a user**, I want to export my device patches to the library so I can back them up or organize them
3. **As a user**, I want to manage my library organization (folders, naming) without losing context of what's on the device
4. **As a user**, I want to preview library items before importing them to understand what they contain
5. **As a user**, I want to load and save complete sets so I can switch between different project configurations

### Pain Points to Address

1. **As a user**, I get confused about which panel is focused and where my next action will apply
2. **As a user**, I don't realize I can drag items between panels until I accidentally discover it
3. **As a user**, I lose my place in the library tree when switching between categories
4. **As a user**, I can't easily tell which device slots are empty vs populated
5. **As a user**, error messages don't help me understand what went wrong or how to fix it

## Success Criteria

### User Experience
- [ ] New users can complete import/export workflows within 2 interactions
- [ ] Visual hierarchy clearly indicates focus and available actions
- [ ] All operations provide clear progress feedback
- [ ] Error states include actionable recovery suggestions
- [ ] Keyboard navigation supports all common workflows

### Code Quality
- [ ] LibraryPage component reduced to <500 lines via extraction
- [ ] Shared patterns extracted to editor-core where applicable
- [ ] Test coverage for new/modified components
- [ ] No regression in existing E2E tests

## Scope

### In Scope

1. **Visual polish**
   - Panel focus indicators
   - Empty state designs
   - Loading states and skeletons
   - Progress indicators for operations

2. **Interaction improvements**
   - Drag-and-drop affordances (drop zones, cursor feedback)
   - Context menu organization and keyboard shortcuts
   - Breadcrumb navigation for deep hierarchies
   - Keyboard navigation (arrow keys, Enter, Escape)

3. **Feedback improvements**
   - Operation progress with cancel support where possible
   - Error messages with recovery suggestions
   - Success confirmations for destructive actions
   - Undo support for reversible operations

4. **Code refactoring**
   - Extract reusable components
   - Simplify state management
   - Improve component composition

### Out of Scope

- New library features (new item types, new operations)
- Device protocol changes
- Performance optimization (separate effort if needed)
- Mobile/responsive layout (desktop-first editor)

## Dependencies and Constraints

### Dependencies
- editor-core shared components (may need enhancements)
- Existing library-service.ts APIs
- Plugin architecture for device-specific behavior

### Constraints
- Must maintain backwards compatibility with existing library formats
- Must not break existing E2E tests
- Must work with both S-330 and S-550 device configurations

## Open Questions

1. Should we conduct user research to identify specific pain points, or proceed with heuristic evaluation?
2. Are there specific workflows from the S3K editor UX effort that should inform this work?
3. What is the priority order for the improvements listed above?
4. Should keyboard shortcuts be customizable?

## Technical Notes

### Current Architecture

The LibraryPage uses a three-column layout:
- **Left:** DeviceMemoryPanel (tones/patches on device)
- **Center:** PluginLibraryTreePanel (library browser with tree navigation)
- **Right:** ItemPreviewPanel / SampleBundlePreviewPanel (preview with actions)

Key hooks and utilities:
- `useLibraryConnection` — OPFS/native filesystem connection
- `useLibraryExport` — Export operations to library
- `useLibraryImportDialogs` — Import dialog state management
- `useDirectoryOperations` — Folder CRUD operations
- Plugin architecture — Device-specific item types and behaviors

### Dialogs (11 total)
- SaveSetDialog, LoadSetDialog
- ImportLibraryToneDialog, ImportLibraryPatchDialog, ImportSamplesDialog
- ExportToneDialog, ExportPatchDialog
- CreateDirectoryDialog, RenameDirectoryDialog, DeleteDirectoryDialog, MoveItemDialog
- SampleChopperDialog, LoopEditorDialog, SampleEditorDialog

This dialog complexity suggests potential for consolidation or workflow simplification.
