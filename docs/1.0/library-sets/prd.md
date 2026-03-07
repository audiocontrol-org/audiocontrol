# Library Page and Sets - Product Requirements Document

**Created:** 2026-03-07
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The S-330 sampler uses floppy disks as its primary storage mechanism, where each disk contains a complete "set" of tones, patches, and wave data. Currently, the s330-editor has no equivalent concept for organizing library content. Users face several challenges:

1. **Namespace collisions** - Multiple tones named "KICK" from different sessions cannot coexist in the global library
2. **No bulk operations** - Saving or restoring an entire device state requires individual tone/patch operations
3. **No side-by-side view** - Users cannot easily compare device memory to library contents
4. **Workflow mismatch** - The floppy-based "set" workflow (backup/restore entire state) has no digital equivalent

## User Stories

- As a musician, I want to save my entire device state (all tones and patches) to a named set so that I can restore it later as a complete unit
- As a musician, I want to see device memory and library contents side-by-side so that I can easily compare and transfer items between them
- As a musician, I want to have multiple "KICK" tones in different sets without name collisions so that I can organize sounds by project or session
- As a musician, I want to preview library items before importing them to the device so that I can make informed decisions
- As a musician, I want to import/export individual tones between device and library so that I can build custom configurations
- As a musician, I want my existing global library to continue working so that I don't lose access to previously saved tones/patches

## Success Criteria

- [ ] Library page accessible at `/library` route in s330-editor
- [ ] Three-column layout shows device memory, library contents, and preview
- [ ] Sets can be created, loaded, and deleted
- [ ] "Save Device to Set" captures all 32 tones, 16 patches, and wave data
- [ ] "Load Set to Device" restores all contents from a set
- [ ] Individual tone/patch import/export works from the preview panel
- [ ] Sets provide namespace isolation (multiple "KICK" tones allowed across sets)
- [ ] Global library (existing tones/patches) remains accessible and functional
- [ ] Set manifest (set.yaml) is human-readable and editable

## Scope

### In Scope

- **Library page** - New `/library` route with three-column layout
- **Set storage** - `sets/` directory structure within library
- **Set manifest** - `set.yaml` schema with Zod validation
- **Bulk operations** - Save/load entire device state as a set
- **Individual operations** - Import/export single tones/patches
- **Preview panel** - Item details and waveform visualization
- **Device memory panel** - List of current device tones/patches
- **Library tree panel** - Hierarchical view of sets and global items

### Out of Scope

- Cloud storage or sync
- Real-time library file watching (manual refresh only)
- Batch selection of multiple items (one at a time for now)
- Set merging or conflict resolution
- Wave segment reallocation during load (use saved allocation)

## Dependencies

- `@audiocontrol/sampler-library` - Existing library module (must extend)
- `@audiocontrol/sampler-devices` - Device communication layer
- File System Access API - For browser file operations
- Zustand - State management for library store

## Open Questions

- [x] Where to store sets relative to existing library structure?
  - **Decision**: `~/Documents/AudioTools/library/s330/sets/{set-name}/`
- [x] Should set.yaml embed tone parameters or reference external files?
  - **Decision**: Reference files (T01.yaml + T01.wav) for reusability
- [x] What happens if wave segment allocation differs during load?
  - **Decision**: Use the allocation stored in set.yaml; throw error if insufficient space

## Appendix

### Directory Structure

```
~/Documents/AudioTools/library/
├── s330/
│   ├── tones/                        # Global tones (existing)
│   ├── patches/                      # Global patches (existing)
│   ├── templates/                    # Templates (existing)
│   └── sets/                         # NEW: Named sets
│       ├── Factory_Demo/
│       │   ├── set.yaml              # Set manifest
│       │   ├── tones/
│       │   │   ├── T01.yaml + T01.wav
│       │   │   └── T02.yaml + T02.wav
│       │   └── patches/
│       │       └── P01.yaml
│       └── My_808_Kit/
│           ├── set.yaml
│           ├── tones/
│           └── patches/
```

### UI Layout Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Connect] [Play] [Patches] [Tones] [Library]              MIDI Status  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  DEVICE MEMORY  │  │     LIBRARY     │  │    DETAILS / PREVIEW   │  │
│  │  Tones (32)     │  │  Sets           │  │  [Selected item info]  │  │
│  │  Patches (16)   │  │  Global Tones   │  │  [Waveform preview]    │  │
│  │                 │  │  Global Patches │  │  [Import] [Export]     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ [Save Device to Set...]  [Load Set to Device...]  [Refresh Device] ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```
