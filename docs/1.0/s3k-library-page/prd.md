# S3000XL Library Page Conformance - Product Requirements Document

**Created:** 2026-03-31
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The Akai S3000XL editor's library page is significantly behind the standard established by the Roland S-330/S-550 editor (`roland-sxx0-editor`). The Roland library page provides a rich three-column layout with a device memory panel, a hierarchical library browser with drag-and-drop, and a context-aware preview panel with import/export actions for tones, patches, and sets. The S3K library page has only a two-column layout with a basic tree browser and a metadata-only detail panel — no device memory view, no drag-and-drop, no import/export dialogs, and no device transfer integration.

Meanwhile, the MIDI Sample Dump Standard (SDS) implementation is complete in `midi-core` and wired into the S3000XL client (`sendSampleViaSds` / `receiveSampleViaSds`), but it's only exposed on the standalone Samples page. The library page has no way to send samples to or receive samples from the device.

Additionally, the S3000XL supports program and keygroup data transfer via its proprietary SysEx protocol (RPDATA/PDATA for programs, RKDATA/KDATA for keygroups), but there is no library workflow for saving/loading complete programs (with their keygroups) or for transferring them between the library and the device.

This feature brings the S3K library page into conformance with the Roland editor's UI/UX patterns and adds the missing data transfer capabilities.

## User Stories

- As a musician, I want to see what programs and samples are currently loaded on my S3000XL alongside my library so that I can plan imports and exports without switching pages
- As a musician, I want to drag a sample from my library onto a device slot to send it to the S3000XL via SDS so that loading sounds is intuitive
- As a musician, I want to drag a sample from the device to my library to save it via SDS so that I can back up sounds without navigating to the Samples page
- As a sound designer, I want to export a complete program (with all its keygroups and sample assignments) from the device to my library so that I can archive and reuse complex patches
- As a sound designer, I want to import a saved program from my library back to the S3000XL so that I can restore archived patches
- As a musician, I want to export and import multis so that I can save and restore complete performance setups
- As a musician, I want to see transfer progress and errors inline on the library page so that I don't need to switch between pages during transfers
- As a developer, I want the S3K library page to follow the same plugin-driven architecture as the Roland editor so that the codebase remains consistent and maintainable

## Success Criteria

- [ ] Library page uses a three-column layout matching the Roland editor pattern (Device | Library Browser | Preview/Actions)
- [ ] Left column shows device programs and samples with their names and indices
- [ ] Device memory panel updates when programs/samples are added or removed
- [ ] Library browser supports hierarchical tree view for samples, programs, and multis
- [ ] Drag-and-drop: library sample to device triggers SDS send with progress
- [ ] Drag-and-drop: device sample to library triggers SDS receive and save
- [ ] Preview panel shows context-aware metadata and action buttons based on selection type
- [ ] "Send to Device" button on library sample sends via SDS with progress bar
- [ ] "Receive from Device" button on device sample receives via SDS and saves to library
- [ ] "Export to Library" button on device program saves program header + all keygroup headers to library
- [ ] "Import to Device" button on library program writes program header + keygroups to device
- [ ] "Export to Library" button on device multi saves multi configuration to library
- [ ] "Import to Device" button on library multi writes multi configuration to device
- [ ] Import/export dialogs show progress, handle errors, and support cancellation
- [ ] Library page uses S3K-specific plugin for the editor-core library architecture
- [ ] All existing library operations (folder create/delete/move, WAV import, storage backend switching) continue to work

## Scope

### In Scope

**Layout & Architecture:**
- Refactor library page to three-column layout matching Roland editor
- Create S3K library plugin conforming to the editor-core plugin architecture
- Add device memory panel component showing resident programs and samples

**Sample Transfer (via SDS):**
- "Send to Device" action on library samples (invokes `sendSampleViaSds`)
- "Receive from Device" action on device samples (invokes `receiveSampleViaSds`)
- Drag-and-drop between device panel and library browser for samples
- Transfer progress bar and error display
- Send mode selection: add as new sample or replace existing

**Program Transfer (via Akai SysEx):**
- Export program from device: read program header + all keygroup headers, serialize to library
- Import program to device: deserialize from library, write program header + all keygroup headers
- Program library file format (YAML or JSON with program header + keygroup array)
- Import dialog with target program slot selection

**Multi Transfer (via Akai SysEx):**
- Export multi from device to library (pending protocol investigation — see Open Questions)
- Import multi from library to device
- Multi library file format

**Preview Panel:**
- Context-aware preview for: device programs, device samples, library samples, library programs, library multis, directories
- Action buttons appropriate to each selection type
- Loading and error states

**Library Store Updates:**
- Extend `libraryStore` with device state (program names, sample names)
- Add operation state tracking (transfer in progress, dialog state)
- Add drag-and-drop data types for S3K items

### Out of Scope

- Replacing the standalone Samples page (it remains as a direct SDS transfer tool)
- Sample rate conversion during SDS transfer
- Automatic sample dependency resolution when importing programs (user must ensure referenced samples exist on device)
- Loop editor or sample editor integration on the library page (these remain on their existing pages)
- Set-based bulk operations (save/load entire device state as a set) — future enhancement

## Dependencies

- `editor-core` library plugin architecture (already exists from Roland editor extraction)
- `midi-core` SDS implementation (complete)
- `sampler-devices` S3000XL client with SDS methods (complete)
- `sampler-library` filesystem operations (complete)
- S3000XL keygroup read/write methods in client (complete: `fetchKeygroupHeader`, `writeKeygroupHeader`, `createKeygroup`)

## Open Questions

- [ ] Does the S3000XL SysEx protocol support multi read/write? The current `s3000xl-protocol.ts` defines opcodes for programs, keygroups, and samples but no multi-specific opcodes. Multi support may require additional protocol investigation or may not be possible via SysEx.
- [ ] What serialization format should library programs use? The Roland editor uses YAML manifests. Should the S3K follow the same pattern?
- [ ] Should the device memory panel auto-refresh on connect, or require an explicit refresh button?
- [ ] When importing a program that references samples not on the device, should the UI warn the user or attempt to resolve dependencies automatically?

## Appendix

### Roland Editor Library Page Architecture (Reference Standard)

The Roland S-330/S-550 editor library page uses a three-column plugin-driven architecture:

```
┌─────────────────┬──────────────────────┬─────────────────────┐
│ Device Memory   │ Library Browser       │ Preview / Actions   │
│                 │                       │                     │
│ Tones:          │ Sets:                 │ [Selected Item]     │
│  T1: Piano      │  ├ My Set 1           │                     │
│  T2: Strings    │  └ My Set 2           │ Name: Piano         │
│  T3: (empty)    │ Tones:                │ Rate: 30000 Hz      │
│  ...            │  ├ Bass/              │ Loop: Forward       │
│                 │  │  ├ Synth Bass      │                     │
│ Patches:        │  │  └ Upright Bass    │ [Send to Device]    │
│  P1: Warm Pad   │  ├ Keys/             │ [Open in Editor]    │
│  P2: Lead       │  │  └ EP Rhodes      │                     │
│  ...            │  └ Strings/           │                     │
│                 │ Patches:              │                     │
│ [Drag to export]│  └ ...                │                     │
│                 │ [Drag to import]      │                     │
└─────────────────┴──────────────────────┴─────────────────────┘
```

**Key UX patterns:**
- Drag device item -> library = export (save to library)
- Drag library item -> device slot = import (send to device)
- Click library item -> preview panel shows metadata + action buttons
- Click device item -> preview panel shows device-side metadata
- Import dialogs handle slot selection, memory allocation, progress, errors
- Export dialogs handle naming, progress, confirmation

### S3000XL Data Model Mapping

| Roland Concept | S3000XL Equivalent | Transfer Method |
|---------------|-------------------|-----------------|
| Tone (audio + params) | Sample (audio data) | MIDI SDS |
| Patch (key mapping) | Program (keygroups + zones) | Akai SysEx (RPDATA/PDATA + RKDATA/KDATA) |
| Set (tone + patch bundle) | Multi (channel->program map) | Akai SysEx (TBD) |

### S3000XL SysEx Opcodes Used

| Operation | Request Opcode | Response Opcode | Purpose |
|-----------|---------------|-----------------|---------|
| List programs | RPLIST (0x02) | PLIST (0x03) | Get program names for device panel |
| List samples | RSLIST (0x04) | SLIST (0x05) | Get sample names for device panel |
| Read program | RPDATA (0x06) | PDATA (0x07) | Export program header |
| Read keygroup | RKDATA (0x08) | KDATA (0x09) | Export keygroup headers |
| Write program | PDATA (0x07) | REPLY (0x16) | Import program header |
| Write keygroup | KDATA (0x09) | REPLY (0x16) | Import keygroup headers |
| Send sample | SDS protocol | SDS ACK/NAK | Send audio to device |
| Receive sample | SDS Dump Request | SDS Header + Packets | Receive audio from device |
