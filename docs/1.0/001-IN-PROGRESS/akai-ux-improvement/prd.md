# PRD: Akai S3000XL Editor UX Improvement

## Problem Statement

The Akai S3000XL editor is currently organized around device memory structures -- separate pages for programs, keygroups, and samples that mirror how data is stored in RAM, not how a user thinks about editing sounds. This creates several concrete problems:

1. **No program or keygroup CRUD.** Users cannot create, rename, or delete programs or keygroups from the editor UI. These operations require front-panel interaction on the hardware.
2. **No sample-to-keygroup zone mapping.** There is no UI for assigning samples to keygroup zones or visualizing how zones span the keyboard and velocity range. Users must mentally track which sample lives in which keygroup at which key range.
3. **No multi-editor.** Users cannot compare or edit multiple programs side by side, which is a common workflow when building layered or split patches.
4. **Parameters not grouped by workflow.** Parameters are presented in device memory order rather than logical editing groups (filter, amp, pitch, effects, output). Users must hunt through flat lists to find related parameters.
5. **Visual layout needs polish.** Spacing, alignment, and proportional layout do not yet follow the patterns established in editor-core for the Roland editors.

Cross-editor patterns established in the library-ux branch may inform shared component extraction. Where the Akai editor needs UI elements that converge with Roland editor needs (parameter sections, zone visualizations, multi-editor shells), those should be extracted to editor-core rather than duplicated.

## User Stories

1. **As a sound designer**, I want to create and manage programs directly in the editor so I do not have to use the S3000XL front panel for basic CRUD operations.
2. **As a sound designer**, I want to see and edit keygroups inline within the program editor so I understand a program's structure at a glance.
3. **As a sound designer**, I want to visually assign samples to keygroup zones with key range and velocity range controls so I can build multi-sampled instruments efficiently.
4. **As a sound designer**, I want a zone overview visualization showing the full keyboard and velocity mapping so I can spot gaps, overlaps, and layering at a glance.
5. **As a sound designer**, I want parameters grouped into logical sections (filter, amp, pitch, output/MIDI, effects, tuning) so I can focus on one aspect of the sound at a time.
6. **As a sound designer**, I want to open multiple programs side by side so I can compare settings or copy ideas between programs.
7. **As a sound designer**, I want the editor layout to be visually consistent with other audiocontrol editors so I do not have to relearn navigation patterns.

## Acceptance Criteria

- Editor pages are organized around editing workflows (program editor with inline keygroups/zones) rather than device memory structures.
- Users can create, rename, and delete programs from the editor.
- Users can create, edit, and delete keygroups within the program editor.
- Users can visually assign samples to keygroup zones (key range, velocity range, sample selection).
- A zone overview visualization shows the full keyboard/velocity mapping at a glance.
- Parameters are grouped into logical sections (output/MIDI, effects, tuning, filter, amp, pitch).
- Multi-editor allows side-by-side editing of multiple programs.
- Layout uses proportional flex, consistent spacing, and follows editor-core visual patterns.
- Shared patterns extracted to editor-core where they converge with Roland editor needs.

## Out of Scope

- **New device support.** No S5000, S6000, or other Akai models. This feature targets the S3000XL only.
- **Library browser changes.** The library page and browser UX are handled by the library-ux feature. The library page stays as-is in this feature.
- **New SysEx protocol commands.** This feature uses the existing device communication layer only. If CRUD operations are missing from the SysEx client, Phase 1 will identify the gap, but implementing new SysEx commands is a separate task.

## Dependencies

- **feature/library-ux branch.** The library-ux branch has unmerged library work. The library page stays as-is in this feature, but the library-ux branch should be merged first or coordinated to avoid conflicts in shared modules.
- **S3K SysEx device client.** The existing device client in sampler-devices must support program/keygroup CRUD operations (create, delete, rename). Phase 1 validates whether this support exists.

## Open Questions

1. Does the S3K device client already support create/delete program and keygroup SysEx commands, or do those need to be added?
2. What multi-editor pattern does the Roland editor use, if any? Is it a tab-based approach, split panes, or something else?
3. How much of the Roland editor's parameter grouping UI (section headers, collapsible groups, parameter row layout) is reusable for the S3K editor vs. needing S3K-specific implementations?
