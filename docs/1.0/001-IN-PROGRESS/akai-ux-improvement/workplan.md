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

- [ ] Audit the S3K SysEx device client for program CRUD support (create, delete, rename program)
- [ ] Audit the S3K SysEx device client for keygroup CRUD support (create, delete keygroup within program)
- [ ] Map all S3K program and keygroup parameters against the Akai SysEx spec; identify which are exposed in the current UI and which are missing
- [ ] Review the Roland editor's parameter grouping UI -- identify components, patterns, and layout conventions
- [ ] Review the Roland editor's multi-editor implementation (if any)
- [ ] Identify editor-core components that could be shared (parameter sections, navigation patterns, layout primitives)
- [ ] Document findings in a Phase 1 audit report within this feature's docs directory

### Acceptance Criteria

- Written audit of SysEx CRUD coverage with specific gaps identified
- Parameter mapping document showing all S3K parameters grouped by workflow category
- List of editor-core extraction candidates with rationale
- Clear go/no-go for Phase 2 (are CRUD operations available or do they need to be built first?)

---

## Phase 2: Program Editor Workflow

**Goal:** Restructure the editor around program-centric editing with CRUD and parameter grouping.

### Tasks

- [ ] Restructure page routing so the program editor is the primary workspace (not a flat list of programs)
- [ ] Implement program CRUD in the editor UI (create, rename, delete)
- [ ] Display keygroups inline within the program editor (read-only in this phase)
- [ ] Group program parameters into logical sections: output/MIDI, effects, tuning
- [ ] Add program navigation (list/selector to switch between programs)
- [ ] Wire program CRUD operations to the device client
- [ ] Write unit tests for program CRUD operations and parameter grouping logic

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

- [ ] Implement keygroup CRUD within the program editor (create, delete)
- [ ] Build sample-to-zone assignment UI (sample selection, key range, velocity range per zone)
- [ ] Build key range editor (visual or numeric input for low/high key)
- [ ] Build velocity range editor (visual or numeric input for low/high velocity)
- [ ] Build zone overview visualization showing all keygroups mapped across keyboard and velocity
- [ ] Group keygroup parameters into logical sections: filter, amp, pitch
- [ ] Wire keygroup CRUD and zone changes to the device client
- [ ] Write unit tests for keygroup CRUD, zone assignment, and parameter grouping

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

- [ ] Investigate the Roland editor's multi-editor pattern (if any) and document findings
- [ ] Design multi-editor layout (split panes, tabs, or other approach)
- [ ] Implement split view with independent program selection per pane
- [ ] Ensure each pane maintains its own scroll position and edit state
- [ ] Evaluate whether the multi-editor shell can be extracted to editor-core
- [ ] If extractable, move the shell to editor-core and wire both S3K and Roland editors to use it
- [ ] Write tests for multi-editor state management

### Acceptance Criteria

- Users can open two or more programs side by side
- Each pane allows independent program selection and editing
- Multi-editor layout is responsive and uses proportional flex
- If the pattern is shared, it lives in editor-core

---

## Phase 5: Visual Polish and Cross-Editor Consistency

**Goal:** Consistent, polished layout that follows editor-core conventions.

### Tasks

- [ ] Audit all editor pages for pixel-based widths and replace with proportional flex
- [ ] Apply consistent spacing, padding, and typography following editor-core patterns
- [ ] Extract shared components to editor-core where they converge with Roland editor needs
- [ ] Verify responsive layout at common viewport sizes
- [ ] Cross-editor review: compare S3K and Roland editors for visual consistency
- [ ] Fix any inconsistencies found in the cross-editor review
- [ ] Final round of manual testing against hardware

### Acceptance Criteria

- No hardcoded pixel widths in layout (proportional flex throughout)
- Visual style is consistent with Roland editor (spacing, typography, section headers)
- Shared components live in editor-core, not duplicated across editors
- Layout is usable at viewport widths from 1024px to ultrawide
