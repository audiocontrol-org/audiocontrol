# Shared Library UI Components

**Status:** Planning
**Branch:** `feature/shared-library-ui`
**Milestone:** [Week of Mar 23-27](https://github.com/audiocontrol-org/audiocontrol/milestone/6)

## Overview

Extract common library UI patterns from three independent implementations (loop-editor, sample-chopper, sampler-editor) into shared `@audiocontrol/editor-core` components. Includes a notification system, generic tree view, library panel shell, context menu, and reusable dialog components.

## Documentation

- [PRD](./prd.md) - Product requirements, problem statement, and solution design
- [Workplan](./workplan.md) - Implementation phases and GitHub tracking links
- [Implementation Summary](./implementation-summary.md) - Progress and completion notes

## GitHub Tracking

- Parent issue: [[editor-core] Shared library UI components (#76)](https://github.com/audiocontrol-org/audiocontrol/issues/76)
- Milestone: [Week of Mar 23-27](https://github.com/audiocontrol-org/audiocontrol/milestone/6)

## Implementation Issues

| Issue | Phase | Status |
|-------|-------|--------|
| [#77 Add useNotifications hook and NotificationArea](https://github.com/audiocontrol-org/audiocontrol/issues/77) | 1 | Planning |
| [#78 Add generic TreeView and TreeIcons](https://github.com/audiocontrol-org/audiocontrol/issues/78) | 2 | Planning |
| [#79 Add LibraryPanel shell component](https://github.com/audiocontrol-org/audiocontrol/issues/79) | 3 | Planning |
| [#80 Add ContextMenu component](https://github.com/audiocontrol-org/audiocontrol/issues/80) | 3 | Planning |
| [#81 Add SaveDialog, MoveDialog, ConfirmDialog](https://github.com/audiocontrol-org/audiocontrol/issues/81) | 4 | Planning |
| [#82 Add library.css stylesheet](https://github.com/audiocontrol-org/audiocontrol/issues/82) | 3 | Planning |
| [#83 Migrate loop-editor dev harness](https://github.com/audiocontrol-org/audiocontrol/issues/83) | 5 | Planning |
| [#84 Migrate sample-chopper dev harness](https://github.com/audiocontrol-org/audiocontrol/issues/84) | 5 | Planning |
| [#85 Migrate sampler-editor](https://github.com/audiocontrol-org/audiocontrol/issues/85) | 5 | Planning |

## Quick Links

- Target module: `modules/editor-core/`
- Reference (loop-editor): `modules/loop-editor/dev/main.tsx`
- Reference (sample-chopper): `modules/sample-chopper/dev/LibraryBrowser.tsx`
- Reference (sampler-editor): `modules/sampler-editor/src/components/library/`
