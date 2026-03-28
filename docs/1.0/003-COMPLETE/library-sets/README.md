# Library Page and Sets

**Status:** Planning
**Branch:** `feature/s330-editor` (existing feature branch)
**Milestone:** TBD

## Overview

A dedicated Library page for the S-330 web editor that shows device memory and library contents side-by-side. Introduces "Sets" as an organizational unit that mirrors the S-330's floppy disk workflow, enabling bulk save/restore of complete device state.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## Quick Links

- **Repository:** [audiocontrol-org/audiocontrol](https://github.com/audiocontrol-org/audiocontrol)
- **Feature Branch:** `feature/s330-editor`
- **Editor Module:** `modules/s330-editor/`
- **Library Module:** `modules/sampler-library/`

## Key Features

1. **Three-column Library page** - Device memory, library tree, and preview
2. **Sets as storage units** - Named collections of tones/patches
3. **Namespace isolation** - Multiple "KICK" tones in different sets
4. **Bulk operations** - Save/load entire device state
5. **Individual import/export** - Single tone/patch transfer
6. **Backward compatible** - Existing global library works unchanged

## Library Structure

```
~/Documents/AudioTools/library/s330/
├── tones/                          # Global tones (existing)
├── patches/                        # Global patches (existing)
├── templates/                      # Templates (existing)
└── sets/                           # NEW: Named sets
    ├── Factory_Demo/
    │   ├── set.yaml
    │   ├── tones/
    │   └── patches/
    └── My_808_Kit/
        ├── set.yaml
        ├── tones/
        └── patches/
```

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Set Schema and Paths | Pending |
| 2 | Set Storage | Pending |
| 3 | Set Converter | Pending |
| 4 | Library Service Integration | Pending |
| 5 | Library Page UI | Pending |
| 6 | Bulk Operation Dialogs | Pending |
| 7 | Testing and Polish | Pending |
