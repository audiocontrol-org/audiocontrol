# Shared Library UI Components - Product Requirements Document

**Created:** 2026-03-19
**Status:** Planning
**Owner:** Orion Letizi

## Problem Statement

Library UI is implemented independently in three places across the monorepo, with increasing complexity:

| Location | Scope | Approx. Lines |
|----------|-------|---------------|
| loop-editor dev harness | Inline sample list, hand-rolled notifications | ~80 |
| sample-chopper dev harness | `LibraryBrowser` with tabs, tree, drag-drop, save dialog | ~840 (610 + 226 + CSS) |
| sampler-editor (production) | Two-panel layout, recursive tree, context menu, 13 dialogs, icons, Zustand store | ~5,000+ |

All three implement overlapping structural patterns independently:

- **Tree rendering** with expand/collapse, depth-based indentation
- **Drag-and-drop** between tree nodes and external sources
- **Context menus** with positioned dropdowns
- **Notification display** with auto-dismiss and error persistence
- **Save/move dialogs** with directory pickers and name input
- **Tab bars** for category switching
- **Loading/error/empty states** in browsable panels

### Key Issues

1. **Structural duplication**: Tree rendering, context menus, and dialogs are rebuilt per consumer
2. **Inconsistent UX**: Each implementation handles drag-drop, notifications, and dialogs differently
3. **Dev harness drift**: Loop-editor and sample-chopper harnesses lack features present in sampler-editor
4. **No notification system in editor-core**: Loop-editor rolled its own; sample-chopper uses inline status

## User Stories

- As a developer, I want shared library UI primitives so I can add library browsing to new editors/harnesses without reimplementing tree rendering, drag-drop, and dialogs.
- As a maintainer, I want one tree view implementation so bug fixes (e.g., drag-drop edge cases) propagate everywhere.
- As a user, I want consistent library interactions across all tools in the audiocontrol suite.

## Solution

Extract common structural components into `@audiocontrol/editor-core`:

### Notification System (separate concern, broadly useful)

- `useNotifications()` hook — manages notification lifecycle (add, auto-dismiss, dismiss)
- `<NotificationArea />` component — renders notification list with copy and dismiss buttons
- Info notifications auto-dismiss after configurable timeout; errors persist until dismissed

### Library UI Components

- `<TreeView />` — generic recursive tree with expand/collapse, selection, drag-drop zones, context menu trigger
- `<LibraryPanel />` — shell component with connection status slot, tab bar, loading/error/empty states, refresh
- `<ContextMenu />` — positioned dropdown menu with separator support, viewport-aware positioning
- `<SaveDialog />` — directory picker + name input + inline folder creation
- `<MoveDialog />` — directory tree picker for relocating items
- `<ConfirmDialog />` — simple confirm/cancel modal
- `TreeIcons` — generic folder/chevron/file/audio SVG icon components

### CSS

- `library.css` exported as `@audiocontrol/editor-core/library.css`
- Uses `ac-` class prefix consistent with existing editor-core primitives
- Extracted from sample-chopper/sampler-editor styles using current token names

## Success Criteria

- [ ] `useNotifications()` hook and `<NotificationArea />` available in editor-core with tests
- [ ] `<TreeView />` renders recursive tree with expand/collapse, drag-drop, and context menu support
- [ ] `<LibraryPanel />` provides tabbed shell with connection/loading/error states
- [ ] `<ContextMenu />`, `<SaveDialog />`, `<MoveDialog />`, `<ConfirmDialog />` available in editor-core
- [ ] loop-editor dev harness migrated to shared notifications + library panel + tree view
- [ ] sample-chopper dev harness migrated to shared `LibraryBrowser`/`SaveDialog` replacements
- [ ] sampler-editor migrated for context menu, move dialog, delete dialog, and generic icons
- [ ] Unit tests for all shared components
- [ ] No regression in existing library functionality across all three consumers

## Scope

### In Scope

- Notification system (hook + component)
- Generic tree view component
- Library panel shell component
- Context menu component
- Save, move, and confirm dialog components
- Generic tree icons
- Library CSS stylesheet
- Migration of loop-editor, sample-chopper, and sampler-editor to shared components

### Out of Scope

- Device-specific library logic (tone/patch/drum-kit business rules)
- Library storage backend changes (S3, Google Drive, local)
- Zustand store extraction (sampler-editor's libraryStore remains local)
- Device-specific dialog content (ImportToneDialog, ExportPatchDialog, etc.)
- ItemPreviewPanel and device-specific preview rendering

## Dependencies

- `@audiocontrol/editor-core` — existing shared module (target for new components)
- Existing editor-core primitives CSS (`primitives.css`, `tokens.css`)

## Constraints

- Components must be device-agnostic per multi-device architecture rules
- No conditionals on device type in shared components
- Must compose with existing editor-core design tokens
- Must not break existing sampler-editor library functionality during migration
- Files must stay under 500 lines

## Open Questions

- [ ] Should `<TreeView />` own its own drag-drop state, or accept it via props/hooks?
- [ ] Should notification positioning be fixed-bottom (loop-editor pattern) or caller-defined?
