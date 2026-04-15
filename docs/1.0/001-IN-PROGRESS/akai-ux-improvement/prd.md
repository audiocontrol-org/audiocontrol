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

## Extended Scope (Phases 6-11)

8. **As a sound designer**, I want rename/clone/refresh/delete available on programs AND samples in the Library's Device Memory panel, not just the Programs page.
9. **As a sound designer**, I want to drag programs and samples from Device Memory directly into the library (common area or S3K area) so I can organize my sounds without navigating dialogs.
10. **As a sound designer**, I want promotion from the S3K library area to the common area to work reliably with clear error feedback.
11. **As a sound designer**, I want to edit sample headers (name, tuning, loop points, playback mode) using the same dense grid layout as programs and keygroups.
12. **As a sound designer**, I want the Samples page to use a list-detail layout consistent with the rest of the editor, not a dropdown selector.
13. **As a sound designer**, I want editor pages to retain their data across page reloads so I don't lose context when navigating.

### Additional Acceptance Criteria

- Device Memory panel in Library page has rename/clone/refresh/delete for programs and samples.
- Programs and samples can be dragged from Device Memory to the library tree.
- Promotion from S3K library to common area works with progress feedback and error handling.
- Sample editor uses list-detail layout with ParamKnob controls for all editable header fields.
- Compare page is removed (unused feature).
- Editor pages cache data in sessionStorage; page reload restores data and selection without re-fetching.

## Out of Scope

- **New device support.** No S5000, S6000, or other Akai models. This feature targets the S3000XL only.
- **New SysEx protocol commands.** This feature uses the existing device communication layer only.

## Dependencies

- **feature/library-ux branch.** The library-ux branch has unmerged library work. The library page stays as-is in this feature, but the library-ux branch should be merged first or coordinated to avoid conflicts in shared modules.
- **S3K SysEx device client.** The existing device client in sampler-devices must support program/keygroup CRUD operations (create, delete, rename). Phase 1 validates whether this support exists.

## Open Questions

1. Does the S3K device client already support create/delete program and keygroup SysEx commands, or do those need to be added?
2. What multi-editor pattern does the Roland editor use, if any? Is it a tab-based approach, split panes, or something else?
3. How much of the Roland editor's parameter grouping UI (section headers, collapsible groups, parameter row layout) is reusable for the S3K editor vs. needing S3K-specific implementations?
