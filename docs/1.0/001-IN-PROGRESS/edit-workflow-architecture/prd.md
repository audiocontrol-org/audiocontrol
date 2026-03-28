# Edit Workflow Architecture - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Edit operations in the audiocontrol sampler-editor currently use modal dialogs (`ImportSampleDialog`, `ExportToneDialog`, `ImportToneDialog`, `ExportPatchDialog`, and others in `modules/sampler-editor/src/components/library/`). These dialogs block the user from interacting with the rest of the editor while an operation is in progress, prevent multi-step editing workflows, and make it impossible to reference other parts of the editor during an operation.

The project needs non-modal "first-class workflows" with proper UX. Each workflow (loop editing, sample trimming, drum kit creation, etc.) deserves a dedicated editing experience that coexists with the rest of the editor rather than floating on top of it in a modal overlay.

Additionally, workflows must be **developable standalone** -- a developer working on the loop editor should be able to run `pnpm dev` in the loop editor module and get a fully functional editing environment without booting the sampler-editor, connecting MIDI, or loading a device context. The `sample-chopper` module already demonstrates this pattern: its `dev/` directory contains a standalone Vite config, React harness, and browser-based library adapter. This pattern must become the standard for all first-class workflows.

Finally, workflow code must not couple to browser-specific APIs (File System Access API, Web MIDI, `window.location`) or Node.js-specific APIs. The hardware platform track will run these same workflows in an Electron shell on a Raspberry Pi. If workflow code reaches past its injected interfaces into browser globals, the hardware track inherits a porting tax on every feature. All environment-specific capabilities (file I/O, audio playback, MIDI communication) must be injected through interfaces with separate browser and Node.js implementations.

## User Stories

### Workflow Developers

- As a developer creating a new workflow module (loop editor, trim/normalize, drum kit editor), I want a dev harness template I can copy and customize so that I can start iterating on workflow UX immediately without wiring up the full editor.
- As a developer, I want my workflow's algorithms to be importable separately from the UI (`@audiocontrol/<module>` for algorithms, `@audiocontrol/<module>/ui` for React components) so that consumers can use the algorithms without pulling in React dependencies.
- As a developer, I want clear interface contracts for environment capabilities (file I/O, audio playback, MIDI) so that my workflow code is testable via dependency injection and runs in both browser and Node.js contexts without modification.

### End Users

- As a user performing a sample import, I want to see the rest of the editor while the import workflow is active so that I can reference tone assignments, patch configurations, or other samples during the operation.
- As a user editing loops, I want the loop editor to be a navigable section of the editor (not a dialog that blocks everything else) so that I can switch between loop editing and other tasks without losing my work.
- As a user, I want in-progress workflow state to persist if I navigate away and come back so that I don't lose partially completed edits.

### Hardware Platform Team

- As the hardware platform developer, I want workflows that run in Electron on an RPi without code changes so that the kiosk display and the web editor share a single codebase for every workflow.
- As the hardware platform developer, I want environment capabilities to be wired up at application bootstrap (not scattered through workflow code) so that swapping browser implementations for Node.js implementations is a single configuration change.

## Success Criteria

- [ ] A defined architectural pattern for non-modal workflows (route-based, panel-based, or hybrid) with documentation and conventions
- [ ] Interface contracts for environment capabilities (file I/O, audio playback, MIDI communication) defined as TypeScript interfaces
- [ ] Browser implementations of environment capability interfaces (wrapping File System Access API, Web Audio API, Web MIDI)
- [ ] A dev harness template that new workflow modules can copy, based on the `sample-chopper/dev/` pattern (Vite config, React entry point, library adapter, environment capability wiring)
- [ ] Convention for two-part module export (algorithms at package root, UI at `/ui` subpath) documented and validated with at least one module
- [ ] One reference workflow fully implemented using the new pattern, running in both the sampler-editor and its standalone dev harness without code changes
- [ ] The reference workflow demonstrates non-modal integration in the sampler-editor (not a dialog overlay)
- [ ] Environment capability interfaces are validated to be sufficient for both browser and Node.js contexts (no browser globals leak into workflow code)

## Scope

### In Scope

- **Workflow navigation pattern** -- define how workflows are accessed within the sampler-editor (route-based, panel-based, or hybrid). Document the pattern with conventions for URL structure, navigation state, and back/forward behavior.
- **Environment capability interfaces** -- TypeScript interfaces for file I/O (read/write files, directory listing, file picking), audio playback (play buffer, stop, seek), and MIDI communication (send/receive messages, port enumeration). These interfaces abstract over browser APIs (FSAA, Web Audio, Web MIDI) and Node.js equivalents.
- **Browser implementations** -- concrete implementations of environment capability interfaces using browser APIs. These live in a shared location (likely `editor-core` or a new `workflow-env` module).
- **Dev harness template** -- a copyable template based on `sample-chopper/dev/` that provides a standalone Vite development environment for any workflow module. Includes environment capability wiring using browser implementations.
- **Two-part export convention** -- formalize the pattern already used by `sample-chopper`: `src/index.ts` exports algorithms, `src/ui/index.ts` exports React components. Document the `tsup` config, `package.json` exports map, and peer dependency conventions.
- **Reference workflow implementation** -- migrate one existing workflow to the new pattern as proof of concept. The loop editor is the primary candidate: it is complex enough to validate the pattern (canvas rendering, audio playback, algorithmic analysis) and already exists as a component within the sampler-editor.
- **Workflow state management** -- define how in-progress workflow state is managed, including persistence across navigation within the editor.

### Out of Scope

- **Implementing all workflows** -- Phases 2-5 of the roadmap cover individual workflow implementations (trim/normalize, drum kit editor, velocity layer editor, effects chain). This feature defines the pattern; those features use it.
- **Electron integration** -- the hardware track (`electron-shell`, `kiosk-display-profiles`) will wire up Node.js implementations of environment capability interfaces. This feature defines the interfaces; the hardware track implements the Node.js side.
- **Actual hardware testing** -- validating workflows on RPi hardware is out of scope. The deliverable is interface contracts that make hardware deployment possible without workflow code changes.
- **Node.js implementations of environment interfaces** -- browser implementations are in scope; Node.js implementations belong to the hardware track or individual workflow modules that need them for testing.
- **Library common area** -- `library-common-area` is a separate Phase 1 feature. The edit workflow architecture defines how workflows navigate and access environment capabilities; the common area defines where device-agnostic samples live.
- **Migrating all existing dialogs** -- only the reference workflow is migrated. Migrating `ImportSampleDialog`, `ExportToneDialog`, and the other ~12 dialog components in `sampler-editor/src/components/library/` happens incrementally as those workflows are rebuilt in Phases 2-5.

## Dependencies

- **None** -- this is the foundation that everything else builds on. The roadmap explicitly states `edit-workflow-architecture` depends on nothing and unblocks every feature in Phases 2-5, the Akai editor track, and (via interface contracts) the hardware platform track.

### Existing Assets

These existing implementations inform the design but are not blocking dependencies:

- **`sample-chopper/dev/`** -- reference implementation of the standalone dev harness pattern (Vite config, React entry point, browser-based library adapter using FSAA)
- **`sample-chopper/package.json` + `tsup.config.ts`** -- reference implementation of the two-part export convention (`.` and `./ui` exports)
- **`sampler-editor/src/main.tsx`** -- existing route structure (`/roland/:device/editor/*`) that the workflow navigation pattern must integrate with
- **`sampler-editor/src/components/library/`** -- 12+ dialog components (`ImportSampleDialog`, `ExportToneDialog`, `LoadSetDialog`, `MoveItemDialog`, etc.) representing the current modal pattern being replaced
- **`MidiTransport` interface** -- existing transport abstraction with `WebMidiTransport`, `MockMidiTransport`, and `RuntimeMidiTransport` implementations. Demonstrates the dependency injection pattern that environment capability interfaces should follow.
- **`sampler-library` browser/Node.js backends** -- existing dual-environment library implementation that validates the interface-based approach for file I/O.

## Open Questions

- [ ] **Route-based vs panel-based vs hybrid workflow navigation?** Route-based means each workflow is a URL (`/roland/s330/editor/workflows/loop-editor`). Panel-based means workflows open in a dedicated panel area within the existing page layout. Hybrid means top-level workflows are routes but lightweight operations stay inline. The choice affects URL structure, browser back/forward behavior, deep linking, and kiosk navigation (no URL bar).
- [ ] **Which existing workflow to migrate as the reference implementation?** The loop editor is the leading candidate -- it is complex enough to validate the pattern (canvas-based waveform rendering, audio playback, algorithmic analysis with NCC scoring and spectral analysis) and already exists as a component. However, `loop-editor-fixes` is a separate Phase 2 feature that addresses broken splice-point detection. The reference migration should use the loop editor as-is (bugs and all) to validate the architectural pattern, with algorithmic fixes deferred to `loop-editor-fixes`.
- [ ] **Should environment capability interfaces live in `editor-core` or a new module?** `editor-core` already provides shared UI primitives (Tailwind preset, CSS tokens, utility functions). Adding environment capability interfaces there keeps the dependency graph simple but may overload the module's purpose. A dedicated `workflow-env` or `editor-env` module keeps concerns separate but adds a new package to manage.
- [ ] **How does workflow state persistence work across navigation?** Options include React context (lost on page refresh), URL search params (limited size), IndexedDB (browser-specific), or the library storage layer (already has dual-environment implementations). The choice affects whether users can bookmark a workflow in progress and whether workflows survive browser refresh.
- [ ] **Should the dev harness template be a separate module or a directory template?** The `sample-chopper/dev/` pattern is a directory within the workflow module. An alternative is a `create-workflow` generator script. The directory-copy approach is simpler but risks drift between modules over time.
- [ ] **What granularity for environment capability interfaces?** A single `WorkflowEnvironment` interface with all capabilities, or separate `FileIO`, `AudioPlayback`, and `MidiAccess` interfaces that are composed? Separate interfaces are more flexible (a workflow that doesn't need MIDI shouldn't require a MIDI implementation) but add wiring complexity.

## Appendix

### Current Dialog Components in sampler-editor

The following modal dialog components exist in `modules/sampler-editor/src/components/library/` and represent the pattern being replaced:

| Component | Purpose |
|-----------|---------|
| `ImportSampleDialog` | Import WAV file to device tone slot |
| `ImportSamplesDialog` | Batch import multiple WAV files |
| `ImportToneDialog` | Import tone configuration |
| `ImportLibraryToneDialog` | Import tone from library |
| `ImportLibraryPatchDialog` | Import patch from library |
| `ExportToneDialog` | Export tone to library |
| `ExportPatchDialog` | Export patch to library |
| `LoadSetDialog` | Load a saved set |
| `SaveSetDialog` | Save current state as a set |
| `MoveItemDialog` | Move library item between directories |
| `RenameDirectoryDialog` | Rename a library directory |
| `CreateDirectoryDialog` | Create a new library directory |
| `DeleteDirectoryDialog` | Delete a library directory |

Simple CRUD dialogs (create/rename/delete directory) may remain as dialogs since they are single-action confirmations. The import/export workflows and any multi-step operations are candidates for migration to the non-modal pattern.

### Sample Chopper Reference Architecture

The `sample-chopper` module demonstrates the target architecture for workflow modules:

**Module structure:**
- `src/index.ts` -- algorithm exports (transient detection, silence detection, slice operations)
- `src/ui/index.ts` -- React component exports (`SampleChopperDialog`, types)
- `dev/` -- standalone dev harness (Vite config, React entry point, library adapter, styles)

**Package exports (`package.json`):**
- `.` -- algorithms (`dist/index.js`)
- `./ui` -- UI components (`dist/ui/index.js`)

**Build config (`tsup.config.ts`):**
- Two entry points: `src/index.ts` and `src/ui/index.ts`
- React and Radix UI as external peer dependencies

**Dev harness (`dev/`):**
- Own Vite config with `@/` alias pointing to `../src`
- `main.tsx` -- standalone React app with file picker, drag-and-drop, library browser
- `library.ts` -- browser-based library adapter using File System Access API
- Runs independently via `pnpm dev`

The key insight: the dev harness's `library.ts` directly uses browser APIs (FSAA), while the workflow components in `src/ui/` receive capabilities through props and callbacks. The new architecture formalizes this separation by defining explicit environment capability interfaces that the dev harness wires up with browser implementations.
