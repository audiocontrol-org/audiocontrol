# Edit Workflow Architecture - Workplan

**Status:** Approved
**GitHub Milestone:** [Week of Mar 16-20](https://github.com/audiocontrol-org/audiocontrol/milestone/5)
**GitHub Issues:**

- [Parent: Edit Workflow Architecture (#61)](https://github.com/audiocontrol-org/audiocontrol/issues/61)
- [Design environment capability interfaces (#63)](https://github.com/audiocontrol-org/audiocontrol/issues/63)
- [Implement browser environment capability adapters (#64)](https://github.com/audiocontrol-org/audiocontrol/issues/64)
- [Define workflow navigation pattern (#65)](https://github.com/audiocontrol-org/audiocontrol/issues/65)
- [Migrate reference workflow (#66)](https://github.com/audiocontrol-org/audiocontrol/issues/66)
- [Extract dev harness template and document conventions (#67)](https://github.com/audiocontrol-org/audiocontrol/issues/67)

---

## Overview

This workplan implements the edit workflow architecture defined in the PRD. It is organized into phases that build on each other: interfaces first, then implementations, then the reference workflow, then documentation and template extraction.

**Note:** This workplan is a draft structure. Phases and tasks need to be reviewed and refined after the PRD is approved and open questions are resolved. GitHub issue links will be added during Phase 3 of the planning workflow.

---

## Phase 1: Environment Capability Interfaces

Define the TypeScript interfaces that abstract environment-specific capabilities away from workflow code.

### Tasks

- [ ] Design `FileIO` interface (read/write files, directory listing, file/directory picking)
- [ ] Design `AudioPlayback` interface (play buffer, stop, seek, playback state)
- [ ] Design `MidiAccess` interface (send/receive messages, port enumeration) -- or determine if existing `MidiTransport` is sufficient
- [ ] Design `WorkflowEnvironment` composition pattern (how interfaces are provided to workflows -- React context, constructor injection, or both)
- [ ] Write unit tests for interface contracts (test harness that validates any implementation)

### Success Criteria

- Interfaces are defined with no imports from browser-specific or Node.js-specific modules
- A mock implementation exists for each interface (for testing)
- Interface contracts are validated by test suite

### Open Questions to Resolve First

- Single `WorkflowEnvironment` vs separate interfaces? (PRD open question)
- Where do interfaces live -- `editor-core` or new module? (PRD open question)

---

## Phase 2: Browser Implementations

Implement the environment capability interfaces using browser APIs.

### Tasks

- [ ] Implement `BrowserFileIO` wrapping File System Access API (based on patterns in `sample-chopper/dev/library.ts` and `sampler-library/browser`)
- [ ] Implement `BrowserAudioPlayback` wrapping Web Audio API
- [ ] Implement `BrowserMidiAccess` wrapping Web MIDI API (or adapt existing `WebMidiTransport`)
- [ ] Integration tests for browser implementations (may require browser test runner or manual validation)

### Success Criteria

- Each browser implementation passes the interface contract tests from Phase 1
- No browser globals are referenced outside of the implementation files

---

## Phase 3: Workflow Navigation Pattern

Define and implement how workflows are accessed within the sampler-editor.

### Tasks

- [ ] Resolve route-based vs panel-based vs hybrid navigation (PRD open question)
- [ ] Implement navigation infrastructure in sampler-editor (routes, layout areas, or both)
- [ ] Define workflow state management pattern (how in-progress state persists across navigation)
- [ ] Define URL/navigation conventions for workflows
- [ ] Document the pattern with examples

### Success Criteria

- A workflow can be navigated to and from without losing state
- The pattern works with the existing `/roland/:device/editor/*` route structure
- Navigation works without a URL bar (required for kiosk/Electron deployment)

### Open Questions to Resolve First

- Route-based vs panel-based vs hybrid? (PRD open question)
- State persistence mechanism? (PRD open question)

---

## Phase 4: Reference Workflow Migration

Migrate one existing workflow to the new pattern as proof of concept.

### Tasks

- [ ] Select reference workflow (loop editor is the leading candidate)
- [ ] Extract workflow into its own module with two-part export (algorithms + UI)
- [ ] Create standalone dev harness for the workflow module
- [ ] Wire up browser environment implementations in the dev harness
- [ ] Integrate the workflow as a non-modal route/panel in sampler-editor
- [ ] Verify the workflow runs identically in both the dev harness and the sampler-editor

### Success Criteria

- Reference workflow runs standalone via `pnpm dev` in its module directory
- Reference workflow is accessible non-modally in the sampler-editor
- No browser globals are imported by the workflow's `src/` code
- Algorithms are importable without React (`@audiocontrol/<module>`)
- UI components are importable with React (`@audiocontrol/<module>/ui`)

---

## Phase 5: Dev Harness Template and Documentation

Extract the dev harness pattern into a reusable template and document all conventions.

### Tasks

- [ ] Extract dev harness template from the reference workflow (Vite config, entry point, environment wiring)
- [ ] Document the two-part export convention (tsup config, package.json exports, peer dependencies)
- [ ] Document the workflow module directory structure
- [ ] Document environment capability interface usage patterns
- [ ] Document how to add a new workflow module (step-by-step guide)
- [ ] Update ROADMAP.md to reflect completed architecture

### Success Criteria

- A developer can copy the template and have a working dev harness for a new workflow module within minutes
- All conventions are documented with examples
- The template includes environment capability wiring that works out of the box

---

## GitHub Tracking

### Parent Issue

- [#61 — Edit Workflow Architecture](https://github.com/audiocontrol-org/audiocontrol/issues/61)

### Implementation Issues

- [#63 — Design environment capability interfaces](https://github.com/audiocontrol-org/audiocontrol/issues/63) (Phase 1)
- [#64 — Implement browser environment capability adapters](https://github.com/audiocontrol-org/audiocontrol/issues/64) (Phase 2)
- [#65 — Define workflow navigation pattern](https://github.com/audiocontrol-org/audiocontrol/issues/65) (Phase 3)
- [#66 — Migrate reference workflow](https://github.com/audiocontrol-org/audiocontrol/issues/66) (Phase 4)
- [#67 — Extract dev harness template and document conventions](https://github.com/audiocontrol-org/audiocontrol/issues/67) (Phase 5)

---

## Dependencies

None -- this is the foundation feature.

## Risks

- **Navigation pattern decision** -- the route-based vs panel-based question significantly affects implementation. If the wrong pattern is chosen, rework could be substantial. Mitigated by implementing the reference workflow first and validating before documenting as the standard.
- **Interface granularity** -- too many interfaces add wiring complexity; too few create unnecessary dependencies. Mitigated by starting with the reference workflow's actual needs and generalizing from there.
- **Scope creep into library-common-area** -- the workflow architecture and common area are closely related. Clear scope boundaries in the PRD help, but the reference workflow implementation may surface common-area requirements. Those should be deferred to the `library-common-area` feature.
