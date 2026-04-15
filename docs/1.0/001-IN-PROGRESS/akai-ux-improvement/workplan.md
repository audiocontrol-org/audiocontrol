# Workplan: Akai S3000XL Editor UX Improvement

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | #216 |
| Milestone | TBD |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | #217 | Audit S3K SysEx CRUD support and Roland editor patterns |
| Phase 2 | #218 | Implement unified program editor with CRUD and parameter grouping |
| Phase 3 | #219 | Build keygroup CRUD and visual zone mapping UI |
| Phase 4 | #220 | Add multi-editor for side-by-side program editing |
| Phase 5 | #221 | Polish layout and extract shared components to editor-core |
| Phase 6 | #272 | Memory Browser CRUD parity — rename/clone/refresh/delete |
| Phase 7 | #273 | Memory-to-Library drag & drop for programs and samples |
| Phase 8 | #274 | Fix silent failure when promoting S3K items to common area |
| Phase 9 | #275 | Build sample header editor with list-detail layout |
| Phase 10 | #276 | Remove Compare page (unused feature) |
| Phase 11 | #277 | Persistent editor cache — sessionStorage for data |
| Phase 12 | #278 | Fix program download expandability and atomic sample rename |
| Phase 13 | #279 | Implement sample clone in device client and UI |

## Technical Approach

### Modules Affected

- **modules/s3k-editor/** -- Primary target. Page routing, component structure, and parameter UI all change significantly.
- **modules/sampler-devices/** -- S3K device client. Phase 1 audits CRUD support; may need new operations if create/delete program/keygroup SysEx is missing.
- **modules/sampler-midi/** -- S3K SysEx protocol layer. Same audit scope as sampler-devices.
- **modules/editor-core/** -- Extraction target for shared patterns (parameter sections, zone visualization, multi-editor shell) that converge with Roland editor needs.

### Strategy

The current editor mirrors device memory layout: separate pages for programs, keygroups, and samples. This restructuring pivots to workflow-oriented editing where the program editor is the primary workspace, with keygroups and zone mappings presented inline.

The approach is incremental -- each phase delivers a working editor state. Phase 1 is pure research with no code changes. Phases 2-3 build the core editing experience. Phase 4 adds multi-editor. Phase 5 polishes and extracts shared components.

### Dependencies

- The library-ux branch should be merged before Phase 2 begins to avoid conflicts in shared modules.
- Phase 1 determines whether sampler-devices needs new CRUD operations. If it does, that work must happen before Phase 2.

---

## Phase 1: Audit and Plan

**Goal:** Understand what exists, what is missing, and what can be reused.

### Tasks

- [x] Audit the S3K SysEx device client for program CRUD support (create, delete, rename program)
- [x] Audit the S3K SysEx device client for keygroup CRUD support (create, delete keygroup within program)
- [x] Map all S3K program and keygroup parameters against the Akai SysEx spec; identify which are exposed in the current UI and which are missing
- [x] Review the Roland editor's parameter grouping UI -- identify components, patterns, and layout conventions
- [x] Review the Roland editor's multi-editor implementation (if any)
- [x] Identify editor-core components that could be shared (parameter sections, navigation patterns, layout primitives)
- [x] Document findings in a Phase 1 audit report within this feature's docs directory

### Acceptance Criteria

- Written audit of SysEx CRUD coverage with specific gaps identified
- Parameter mapping document showing all S3K parameters grouped by workflow category
- List of editor-core extraction candidates with rationale
- Clear go/no-go for Phase 2 (are CRUD operations available or do they need to be built first?)

---

## Phase 2: Program Editor Workflow

**Goal:** Restructure the editor around program-centric editing with CRUD and parameter grouping.

### Tasks

- [x] Restructure page routing so the program editor is the primary workspace (not a flat list of programs)
- [x] Implement program CRUD in the editor UI (create, rename, delete)
- [x] Display keygroups inline within the program editor (read-only in this phase)
- [x] Group program parameters into logical sections: output/MIDI, effects, tuning
- [x] Add program navigation (list/selector to switch between programs)
- [x] Wire program CRUD operations to the device client
- [x] Write unit tests for program CRUD operations and parameter grouping logic

### Acceptance Criteria

- Users can create, rename, and delete programs from the editor
- Program editor shows keygroups inline (read-only)
- Parameters are grouped into named sections
- Program navigation allows switching between programs without leaving the editor
- All CRUD operations round-trip correctly with the S3000XL hardware

---

## Phase 3: Keygroup and Zone Mapping

**Goal:** Full keygroup editing with visual zone assignment.

### Tasks

- [x] Implement keygroup CRUD within the program editor (create, delete)
- [x] Build sample-to-zone assignment UI (sample selection, key range, velocity range per zone)
- [x] Build key range editor (visual or numeric input for low/high key)
- [x] Build velocity range editor (visual or numeric input for low/high velocity)
- [x] Build zone overview visualization showing all keygroups mapped across keyboard and velocity
- [x] Group keygroup parameters into logical sections: filter, amp, pitch
- [x] Wire keygroup CRUD and zone changes to the device client
- [x] Write unit tests for keygroup CRUD, zone assignment, and parameter grouping

### Acceptance Criteria

- Users can create and delete keygroups within the program editor
- Users can assign samples to keygroup zones with key range and velocity range controls
- Zone overview visualization shows the full keyboard/velocity mapping
- Keygroup parameters are grouped into filter, amp, and pitch sections
- All keygroup operations round-trip correctly with the S3000XL hardware

---

## Phase 4: Multi-Editor

**Goal:** Side-by-side editing of multiple programs.

### Tasks

- [x] Investigate the Roland editor's multi-editor pattern (if any) and document findings
- [x] Design multi-editor layout (split panes, tabs, or other approach)
- [x] Implement split view with independent program selection per pane
- [x] Ensure each pane maintains its own scroll position and edit state
- [x] Evaluate whether the multi-editor shell can be extracted to editor-core
- [x] If extractable, move the shell to editor-core and wire both S3K and Roland editors to use it
- [x] Write tests for multi-editor state management

### Acceptance Criteria

- Users can open two or more programs side by side
- Each pane allows independent program selection and editing
- Multi-editor layout is responsive and uses proportional flex
- If the pattern is shared, it lives in editor-core

---

## Phase 5: Visual Polish and Cross-Editor Consistency

**Goal:** Consistent, polished layout that follows editor-core conventions.

### Tasks

- [x] Audit all editor pages for pixel-based widths and replace with proportional flex
- [x] Apply consistent spacing, padding, and typography following editor-core patterns
- [x] Extract shared components to editor-core where they converge with Roland editor needs
- [x] Verify responsive layout at common viewport sizes
- [x] Cross-editor review: compare S3K and Roland editors for visual consistency
- [x] Fix any inconsistencies found in the cross-editor review
- [ ] Final round of manual testing against hardware

### Acceptance Criteria

- No hardcoded pixel widths in layout (proportional flex throughout)
- Visual style is consistent with Roland editor (spacing, typography, section headers)
- Shared components live in editor-core, not duplicated across editors
- Layout is usable at viewport widths from 1024px to ultrawide

---

## Phase 6: Memory Browser CRUD Parity

**Goal:** Device Memory panel in the Library page has the same CRUD affordances as the Programs list.

### Tasks

- [x] Add rename (double-click), clone, refresh, delete hover actions to programs in DeviceMemoryPanel
- [x] Add rename, refresh, delete hover actions to samples in DeviceMemoryPanel
- [x] Wire CRUD operations to the S3K device client (renameProgram, cloneProgram, deleteProgram, renameSample, deleteSample)
- [x] Use ConfirmDialog for destructive actions, optimistic updates for rename
- [x] Write tests for DeviceMemoryPanel CRUD interactions

### Acceptance Criteria

- Programs in Device Memory can be renamed (double-click), cloned, refreshed, deleted
- Samples in Device Memory can be renamed, refreshed, deleted
- All operations use the established design system patterns (ac-list-action-btn, ConfirmDialog, optimistic updates)

---

## Phase 7: Memory-to-Library Drag & Drop

**Goal:** Drag programs and samples from Device Memory to the library tree.

### Tasks

- [x] Implement drag source on DeviceMemoryPanel items (programs and samples)
- [x] Accept drops in both the common area and S3K-specific library sections
- [x] Show SteppedProgressDrawer for transfer operations (export program, receive sample via SDS)
- [x] Refresh library tree after successful drop
- [x] Handle errors with ErrorBanner

### Acceptance Criteria

- Programs can be dragged from Device Memory to the S3K programs section or common area
- Samples can be dragged from Device Memory to the samples section
- Drop operations show progress and complete reliably

---

## Phase 8: Library Promotion Fix

**Goal:** Fix silent failure when promoting items from S3K library to common area.

### Tasks

- [ ] Diagnose why promotion fails silently (check program-promotion.ts, saveDeviceProgramToCommonArea)
- [ ] Add error handling and user feedback for promotion failures
- [ ] Verify round-trip: promote to common area, then import back to device
- [ ] Write tests for the promotion path

### Acceptance Criteria

- Promotion from S3K library to common area succeeds with progress feedback
- Promotion failures show actionable error messages
- Promoted programs can be re-imported to the device

---

## Phase 9: Sample Editor

**Goal:** Build a proper sample header editor replacing the current SamplesPage.

### Tasks

- [ ] Audit S3K sample header fields (name, tuning, loop points, playback mode, sample rate, bandwidth)
- [ ] Build SampleEditor component using ParamKnob/ParamSelect dense grid layout
- [ ] Build SampleList component matching ProgramList pattern (list with hover actions)
- [ ] Replace SamplesPage with list-detail layout (SampleList + SampleEditor)
- [ ] Wire sample header reads/writes to the device client
- [ ] Add rename (double-click), refresh, delete to sample list items
- [ ] Write tests for SampleEditor and SampleList

### Acceptance Criteria

- Sample editor shows all editable header fields in dense grid layout
- Sample list uses the same pattern as program/keygroup lists
- Sample parameters round-trip correctly with the device
- No dropdown selector — uses list view for sample selection

---

## Phase 10: Remove Compare Page

**Goal:** Remove unused multi-editor compare feature.

### Tasks

- [x] Remove MultiProgramPage component
- [x] Remove ComparePane, ProgramSelector, usePaneKeygroups
- [x] Remove "Compare" from navigation in Layout.tsx
- [x] Remove /compare route from App.tsx
- [x] Remove compare-grid CSS from index.css
- [x] Update tests that reference Compare components

### Acceptance Criteria

- No Compare nav item, route, or components in the codebase
- Build clean, all tests pass

---

## Phase 11: Persistent Editor Cache

**Goal:** Editor pages retain data across page reloads, matching the library's caching pattern.

### Tasks

- [ ] Cache program names and headers in sessionStorage (programStore)
- [ ] Cache keygroup headers in sessionStorage (keygroupStore)
- [ ] Cache sample names and headers in sessionStorage
- [ ] Lazy-load from device only when cache is stale or missing
- [ ] Show cached data immediately on page load, refresh in background
- [ ] Add a cache age indicator or "last refreshed" timestamp

### Acceptance Criteria

- Page reload restores both selection AND data without re-fetching from device
- Stale data is refreshed automatically in the background
- User can force-refresh via the refresh affordance on the list title

---

## Phase 12: Program Download Fix and Atomic Sample Rename

**Goal:** Fix downloaded programs not being expandable in the library, and ensure sample renames inside program directories atomically update the program YAML.

### Tasks

- [ ] Diagnose why downloaded programs are stored as non-expandable (check ExportProgramDialog, program-serialization, program-storage)
- [ ] Fix program download to store as an expandable directory with constituent samples
- [ ] Implement atomic sample rename: renaming a sample file inside a program directory updates the program YAML's zone references
- [ ] Add rollback on failure: if either the file rename or YAML update fails, revert both
- [ ] Verify fix works across all MIDI transports (serial, HTTP, SCSI)
- [ ] Write tests for the download and rename paths

### Acceptance Criteria

- Downloaded programs appear as expandable directories showing their samples
- Renaming a sample inside a program directory updates the program YAML's zone references
- Rename + YAML update is atomic with rollback on failure
- Works regardless of MIDI transport

---

## Phase 13: Sample Clone

**Goal:** Implement sample duplication in device memory.

### Tasks

- [ ] Implement cloneSample in s3000xl-client (fetch header + SDS data, send to new slot, rename)
- [ ] Add clone action to sample list items in DeviceMemoryPanel
- [ ] Add clone action to sample list in SamplesPage (when built)

### Acceptance Criteria

- Samples can be cloned in device memory
- Clone appears as a hover action icon on sample list items
- Cloned sample gets a " CPY" suffix name
