# Workplan: Compiler-Enforced Contracts and Design System Documentation

## GitHub Tracking

| Item | Link |
|------|------|
| Parent Issue | #240 |
| Milestone | TBD |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | #241 | Audit shared hooks, browser API usage, pixel widths, and duplicated types |
| Phase 2 | #242 | Define typed capability contracts and update all shared hooks and callers |
| Phase 3 | #243 | Add Design System section to CLAUDE.md with dialog, layout, and contract standards |
| Phase 4 | #244 | Fix all audit violations: browser dialogs, pixel widths, duplicated types |

## Technical Approach

### Modules Affected

| Module | Changes |
|--------|---------|
| `editor-core` | Replace bare callbacks with typed capability interfaces; update `LibraryOperationsStrategy` return types to discriminated unions |
| `akai-s3k-editor` | Update all callers to provide capability objects; handle discriminated union results |
| `roland-sxx0-editor` | Update all callers to provide capability objects; handle discriminated union results |
| `.claude/CLAUDE.md` | Add Design System section with dialog standards, layout conventions, anti-patterns |

### Strategy

1. **Audit first** -- Catalog every violation before changing anything. The audit produces a concrete checklist that drives the remaining phases.
2. **Contracts before fixes** -- Change the interfaces and type signatures first so that the compiler identifies every call site that needs updating. Let the compiler do the work.
3. **Documentation alongside code** -- Write the Design System section in CLAUDE.md as contracts are defined, so the documentation reflects the actual interfaces.
4. **Fix violations last** -- With contracts in place and documentation written, fix remaining violations (window.prompt, pixel widths, duplicated types) as a cleanup pass.

### Dependencies

- Requires `feature/library-ux` to be merged or rebased against, since it introduces `ErrorReporter` and the latest hook signatures in editor-core.
- `feature/akai-ux-improvement` should consume these contracts. Coordinate to avoid merge conflicts in shared hooks.

---

## Phase 1: Audit

Catalog all violations and document findings.

### Tasks

- [ ] Audit all shared hooks in `editor-core` for bare callback parameters (e.g., `onError?: (e: Error) => void`, `onSuccess?: () => void`)
- [ ] Audit `LibraryOperationsStrategy` interface for boolean return values
- [ ] Scan both editors for `window.prompt`, `window.confirm`, `window.alert` calls
- [ ] Scan both editors for hardcoded pixel widths in layout code (e.g., `width: 200px`, `min-width: 300px`)
- [ ] Scan for duplicated type definitions across editor-core, roland-sxx0-editor, and akai-s3k-editor
- [ ] Document all findings in `phase1-audit.md` with file paths, line numbers, and categorization

### Acceptance Criteria

- `phase1-audit.md` exists with a complete inventory of violations
- Every bare callback, boolean return, window.prompt/confirm/alert, pixel width, and duplicated type is listed
- Each violation has a file path and description

---

## Phase 2: Compiler Contracts

Replace implicit conventions with typed interfaces that the compiler enforces.

### Tasks

- [ ] Define `ErrorReporter` interface (if not already from library-ux) with required error reporting method
- [ ] Define `RefreshNotifier` interface for notifying callers when data has changed
- [ ] Define `ProgressReporter` interface for long-running operations
- [ ] Update all shared hooks in editor-core to accept typed capability objects instead of bare callbacks
- [ ] Replace boolean return values in `LibraryOperationsStrategy` with discriminated unions: `{ ok: true; value: T } | { ok: false; error: string }`
- [ ] Update all callers in `roland-sxx0-editor` to provide capability objects and handle discriminated unions
- [ ] Update all callers in `akai-s3k-editor` to provide capability objects and handle discriminated unions
- [ ] Verify both editors compile with `make`
- [ ] Verify both editors pass all tests with `pnpm test`

### Acceptance Criteria

- Zero bare callbacks in shared hook signatures
- Zero boolean return values in `LibraryOperationsStrategy`
- Both editors compile without errors
- All existing tests pass
- Omitting a required capability is a compile error

---

## Phase 3: Design System Documentation

Document patterns and anti-patterns in CLAUDE.md so agents use correct approaches from the start.

### Tasks

- [ ] Add Design System section to `.claude/CLAUDE.md`
- [ ] Document dialog standards: ConfirmDialog for confirmations, SlideDrawer for complex forms, SteppedProgressDrawer for multi-step operations, inline editing for simple value changes
- [ ] Document layout conventions: flex ratios and grid fractions only, no pixel-based widths, proportional panel sizing
- [ ] Document anti-patterns with corrections: `window.prompt` -> inline editing or SlideDrawer, `window.confirm` -> ConfirmDialog, `window.alert` -> toast notification, pixel widths -> flex/grid
- [ ] Document typed contract patterns with `@/` import examples for ErrorReporter, RefreshNotifier, ProgressReporter
- [ ] Document discriminated union pattern with example usage showing exhaustive handling

### Acceptance Criteria

- CLAUDE.md Design System section exists and covers dialogs, layout, anti-patterns, and typed contracts
- Import examples use the `@/` pattern
- Every anti-pattern has a documented replacement
- An agent reading only CLAUDE.md would know the correct component for any dialog or layout task

---

## Phase 4: Fix Violations

Eliminate all violations found in the Phase 1 audit.

### Tasks

- [ ] Replace every `window.prompt()` call with inline editing or SlideDrawer
- [ ] Replace every `window.confirm()` call with ConfirmDialog
- [ ] Replace every `window.alert()` call with toast notification
- [ ] Replace every hardcoded pixel width with flex ratios or grid fractions
- [ ] Deduplicate shared types: move to canonical location, update all imports
- [ ] Verify both editors compile with `make`
- [ ] Verify both editors pass all tests with `pnpm test`
- [ ] Manual smoke test of both editors in browser

### Acceptance Criteria

- Zero `window.prompt`, `window.confirm`, or `window.alert` calls in editor code
- Zero hardcoded pixel widths in layout code
- Zero duplicated type definitions
- Both editors compile and pass tests
- Manual smoke test confirms dialogs and layouts work correctly
