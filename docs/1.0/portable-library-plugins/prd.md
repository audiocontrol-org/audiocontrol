# Portable Library Module with Device Plugin Architecture - Product Requirements Document

**Created:** 2026-03-20
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The portable library module in `editor-core` was designed to be a superset of the sampler-editor library functionality, but currently has a feature gap:

| Component | editor-core | sampler-editor |
|-----------|-------------|----------------|
| TreeView | Basic expand/collapse, select, drag-drop | Same + inline renaming (double-click to edit) |
| TreeSection | Not present | Category headers, drop zones, empty states |
| Item types | Generic | Device-specific (tone, patch, drum-kit) with custom icons |
| Drag sources | OS file import, library moves | Device memory, library, OS imports |
| Device memory | Not present | Grid of slots with drag-drop |
| Preview panel | Generic sample detail | Device-specific (tone, patch, drum-kit details) |

The sampler-editor has device-specific features that are tightly coupled to Roland S-330/S-550 concepts. As we add support for more devices (Akai, Ensoniq, etc.), this coupling prevents code reuse and violates the multi-device architecture principles.

### Key Issues

1. **Missing TreeSection**: sampler-editor has collapsible sections with headers, drop zones, and empty states; editor-core has only TreeView
2. **No inline rename**: editor-core TreeView lacks double-click-to-rename functionality present in sampler-editor
3. **Device coupling**: sampler-editor library components contain Roland-specific types (Tone, Patch, DrumKit) that cannot be shared
4. **No plugin architecture**: No mechanism for devices to provide custom item types, icons, categories, or memory layouts
5. **Common library formats**: No translation layer between device-specific formats and portable common formats (Sample, Program)

## User Stories

- As a developer, I want device-agnostic library components so I can build editors for new sampler brands (Akai, Ensoniq, E-mu) without duplicating UI code.
- As a user, I want consistent library interactions regardless of which sampler I'm editing.
- As a developer, I want to define device-specific item types (tone, patch, keygroup, program) through a plugin interface rather than conditionals.
- As a user, I want to share samples and programs between devices via a common portable format.

## Solution

Extend editor-core with a plugin architecture that allows device-specific behavior without conditionals in UI components. Require plugins to implement bidirectional translation between device-specific formats and common library formats.

### Core Components to Add

**TreeView enhancements:**
- Inline rename support (double-click to edit, Enter to submit, Escape to cancel)
- Controlled edit state with async rename callback

**TreeSection component:**
- Collapsible section header with title and optional header actions
- Drop zone support with custom drop message
- Empty state display when no nodes
- Wraps TreeView with section-specific callbacks

**Plugin interfaces:**
- `ItemTypePlugin` — defines rendering and behavior for a specific item type (tone, patch, program, keygroup)
- `CategoryPlugin` — defines a library section (samples, programs, device-specific items)
- `ItemTranslator` — bidirectional translation between device-specific and common formats
- `DeviceLibraryPlugin` — top-level plugin for a device combining categories, translators, memory config, preview panel

**PluginLibraryBrowser component:**
- Multi-section layout driven by plugin configuration
- Device memory panel slot (plugin-rendered)
- Preview panel slot (plugin-rendered)
- Category data and operations passed as props

### Common Library Formats

The portable library is built on two device-agnostic formats from `sampler-library`:

1. **Sample** (`SampleYaml`): A single audio file with intrinsic properties
   - name, sampleRate, loopMode, loopStart, loopEnd, rootKey, tags, description
   - Stored as directory bundle: `sample.yaml` + `sample.wav`

2. **Program** (`ProgramYaml`): A collection of zones mapping samples to key/velocity ranges
   - name, zones[], polyphony, playbackMode, description, tags
   - Analogous to SFZ `<group>` with `<region>` zones
   - Stored as directory bundle: `program.yaml` + sample WAVs

Plugins translate between device terminology and these common formats:
- Roland: Tone <-> Sample, Patch <-> Program
- Akai: Sample <-> Sample, Program <-> Program (with keygroup mapping)
- E-mu: Sample <-> Sample, Preset <-> Program

## Success Criteria

- [ ] TreeView supports inline renaming via `onRename` callback and `enableInlineRename` prop
- [ ] TreeSection component renders section header, empty state, and drop zone
- [ ] Plugin interfaces defined for item types, categories, translators, and device library
- [ ] PluginLibraryBrowser renders multi-section layout with device memory slot
- [ ] S-330 plugin implementation with all categories (sets, tones, patches, drum-kits)
- [ ] S-550 plugin implementation extending S-330 plugin
- [ ] sampler-editor LibraryPage migrated to use PluginLibraryBrowser
- [ ] All builds pass: `make`
- [ ] All tests pass: `pnpm test`
- [ ] loop-editor and sample-chopper continue to work with basic LibraryBrowser

## Scope

### In Scope

- TreeView inline rename extension
- TreeSection component
- Plugin interface definitions (ItemTypePlugin, CategoryPlugin, ItemTranslator, DeviceLibraryPlugin)
- PluginLibraryBrowser component
- S-330 library plugin implementation
- S-550 library plugin implementation (extends S-330)
- sampler-editor LibraryPage migration

### Out of Scope

- Cross-device library sharing UI (future: drag from S-330 library to Akai library)
- Advanced device sync features (bulk upload, differential sync)
- Device-specific icons in editor-core (plugins provide their own)
- DeviceMemoryPanel in editor-core (plugins provide their own via `renderMemoryPanel`)
- ItemTranslator implementations beyond S-330/S-550 (future work for other devices)

## Dependencies

- `@audiocontrol/editor-core` — existing shared module (target for new components)
- `@audiocontrol/sampler-library` — common SampleYaml and ProgramYaml types
- Existing DeviceConfig/MemoryLayout types from `sampler-editor/src/configs/types.ts`

## Constraints

- Components must be device-agnostic per multi-device architecture rules
- No conditionals on device type in shared components
- Plugins define everything device-specific: item types, icons, categories, memory layout, preview panels
- Must not break existing sampler-editor library functionality during migration
- Files must stay under 500 lines
- Composition over inheritance — plugins provide render functions, not subclasses

## Open Questions

- [x] Should ItemTranslator return device-specific errors or a common error type? **Decision:** Return `string | null` for compatibility check, throw on actual conversion failure with descriptive message.
- [ ] How should translation handle lossy conversions (e.g., S-550 features not available on S-330)?

## Design Principles

1. **Common Library Abstractions**: All device plugins translate to/from Sample and Program
2. **Plugin Translation Required**: Plugins MUST implement bidirectional translation between device-specific formats and common formats
3. **Framework is device-agnostic**: No Roland, Akai, or other vendor concepts in editor-core
4. **Plugins define everything device-specific**: Item types, icons, categories, memory layout, preview panels
5. **Composition over inheritance**: Plugins provide render functions, not subclasses
