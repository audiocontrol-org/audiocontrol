# PRD: Compiler-Enforced Contracts and Design System Documentation

## Problem Statement

Agents repeatedly make the same categories of mistakes because consistency rules exist only as prose in CLAUDE.md or as implicit patterns in the codebase. Bare callback parameters in shared hooks allow silent failures that the compiler cannot catch. Agents use `window.prompt()` and pixel widths because the correct patterns are not documented where they look. PROCESS corrections account for 59% of all corrections across 35 sessions.

This feature codifies patterns as compiler-enforced contracts and documented design standards so agents get it right the first time.

The root causes:

1. **Silent failures** -- Shared hooks in editor-core accept bare callbacks (`onError?: (e: Error) => void`). When a caller forgets error handling or refresh notification, nothing breaks at compile time. The bug surfaces later as a missing toast or stale UI.
2. **Undocumented patterns** -- The correct way to show a dialog, lay out a panel, or report progress exists in code but not in any reference agents read before implementing. Agents default to `window.prompt()` and hardcoded pixel widths because those are the patterns they know.
3. **Duplicated types** -- The same concept (e.g., operation result, error shape) is defined independently in multiple modules, leading to drift and confusion about which is canonical.
4. **Boolean return values** -- `LibraryOperationsStrategy` methods return `boolean` for success/failure, discarding error context and forcing callers to guess what went wrong.

## User Stories

### US-1: Typed capability objects for shared hooks
As a developer calling a shared hook in editor-core, I want the hook to require a typed capability object (e.g., `ErrorReporter`, `RefreshNotifier`) so that forgetting error handling or refresh notification is a compile error, not a silent failure.

**Acceptance criteria:**
- All shared hooks in editor-core accept typed capability objects instead of bare callbacks
- Omitting a required capability produces a TypeScript compile error
- Both editors (roland-sxx0-editor, akai-s3k-editor) compile and pass tests with the new signatures

### US-2: Discriminated unions for operation results
As a developer implementing library operations, I want `LibraryOperationsStrategy` methods to return discriminated unions (`{ ok: true, value: T } | { ok: false, error: string }`) so that error context is preserved and I am forced to handle both cases.

**Acceptance criteria:**
- All `LibraryOperationsStrategy` methods use discriminated unions instead of boolean return values
- Callers in both editors handle both success and error variants
- No boolean return values remain in the strategy interface

### US-3: Design system documentation
As an agent starting a UI task, I want a Design System section in CLAUDE.md that documents dialog standards, layout conventions, and anti-patterns so that I use the correct components and patterns from the start.

**Acceptance criteria:**
- CLAUDE.md contains a Design System section covering dialog standards (ConfirmDialog, SlideDrawer, SteppedProgressDrawer, inline editing), layout conventions (flex/grid, no pixel widths), and anti-patterns (no window.prompt/confirm/alert)
- The section includes import examples using the `@/` pattern
- Anti-patterns are listed with their correct replacements

### US-4: No window.prompt/confirm/alert in editor code
As a user, I want all dialogs to use the project's dialog components so that the experience is consistent and accessible.

**Acceptance criteria:**
- Zero `window.prompt()`, `window.confirm()`, or `window.alert()` calls in editor code
- All replaced with ConfirmDialog, SlideDrawer, or inline editing as appropriate
- Both editors compile and pass tests

### US-5: No pixel-based widths in layout code
As a user on any screen size, I want layouts to use proportional sizing so that panels scale correctly.

**Acceptance criteria:**
- Zero hardcoded pixel widths in layout code (flex ratios or grid fractions only)
- Both editors compile and pass tests

### US-6: No duplicated types across modules
As a developer, I want each concept to have a single canonical type definition so that I know which import to use.

**Acceptance criteria:**
- Shared types exist in exactly one module
- No duplicate type definitions for the same concept across editor-core and editor modules
- All imports point to the canonical location

## Out of Scope

- **New UI components** -- This feature documents and enforces existing patterns, not new ones.
- **Library browser plugin architecture changes** -- The plugin system is out of scope; only the contracts between plugins and the host are in scope.
- **Device protocol or SysEx changes** -- No MIDI, SCSI, or SDS protocol work.
- **New editor features** -- No new user-facing functionality beyond fixing violations.

## Dependencies

- **feature/library-ux** -- Contains the latest editor-core hooks, including the `ErrorReporter` interface introduced there. Contracts work builds on those interfaces.
- **feature/akai-ux-improvement** -- Building new UI that should follow these patterns. Contracts should land first or in parallel so the Akai editor uses them from the start.

## Open Questions

1. **Separate module or editor-core?** Should typed contracts (interfaces like `ErrorReporter`, `RefreshNotifier`, `ProgressReporter`) live in a dedicated `contracts` module or stay in editor-core? A separate module avoids circular dependencies but adds a build step.

2. **Granularity of capability objects.** Should each concern be a separate interface (`ErrorReporter`, `RefreshNotifier`, `ProgressReporter`) or combined into a single `EditorCapabilities` bag? Separate interfaces follow interface segregation but increase parameter count.

3. **CSS lint enforcement.** Should layout conventions (no pixel widths) be enforced via a CSS/style linting rule, or is documentation in CLAUDE.md sufficient? Linting catches violations automatically but adds tooling complexity.
