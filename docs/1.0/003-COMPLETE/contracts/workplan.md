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

- [x] Audit all shared hooks in `editor-core` for bare callback parameters (18 findings)
- [x] Audit `LibraryOperationsStrategy` interface for boolean return values (6 findings)
- [x] Scan both editors for `window.prompt`, `window.confirm`, `window.alert` calls (13 findings)
- [x] Scan both editors for hardcoded pixel widths in layout code (2 findings)
- [x] Scan for duplicated type definitions across editor-core, roland-sxx0-editor, and akai-s3k-editor (16 findings)
- [x] Document all findings in `phase1-audit.md` with file paths, line numbers, and categorization

### Acceptance Criteria

- `phase1-audit.md` exists with a complete inventory of violations
- Every bare callback, boolean return, window.prompt/confirm/alert, pixel width, and duplicated type is listed
- Each violation has a file path and description

---

## Phase 2: Compiler Contracts

Replace implicit conventions with typed interfaces that the compiler enforces.

### Tasks

- [x] Define `ErrorReporter` interface (already exists from library-ux)
- [x] Define `RefreshNotifier` interface for notifying callers when data has changed
- [x] Define `ProgressReporter` interface for long-running operations
- [x] Update all shared hooks in editor-core to accept typed capability objects instead of bare callbacks
- [x] Replace boolean return values in `LibraryOperationsStrategy` with `StrategyResult` discriminated union
- [x] Update all callers in `roland-sxx0-editor` to handle `StrategyResult`
- [x] Update all callers in `akai-s3k-editor` to handle `StrategyResult`
- [x] Verify both editors compile with `make`
- [x] Verify both editors pass all tests with `pnpm test` (6 pre-existing failures in sampler-library, no regressions)

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

- [x] Add Design System section to `.claude/CLAUDE.md` (points to DESIGN-SYSTEM.md as single source of truth)
- [x] Document dialog standards in `DESIGN-SYSTEM.md`: ConfirmDialog, SlideDrawer, SteppedProgressDrawer, SaveDialog, MoveDialog
- [x] Document layout conventions in `DESIGN-SYSTEM.md`: flex ratios, grid fractions, design tokens, no pixel widths
- [x] Document anti-patterns with corrections in `DESIGN-SYSTEM.md`: window.prompt/confirm/alert replacements
- [x] Document typed contract patterns in `DESIGN-SYSTEM.md` with import examples for ErrorReporter, RefreshNotifier, ProgressReporter
- [x] Document discriminated union pattern in `DESIGN-SYSTEM.md` (StrategyResult with usage example)

### Acceptance Criteria

- CLAUDE.md Design System section exists and covers dialogs, layout, anti-patterns, and typed contracts
- Import examples use the `@/` pattern
- Every anti-pattern has a documented replacement
- An agent reading only CLAUDE.md would know the correct component for any dialog or layout task

---

## Phase 4: Fix Violations

Eliminate all violations found in the Phase 1 audit.

### Tasks

- [x] Replace every `window.prompt()` call with inline editing (2 calls in S3K → inline rename in DeviceMemoryPanel)
- [x] Replace every `window.confirm()` call (5 calls removed — context menu "Delete" is the confirmation)
- [x] Replace every `window.alert()` call with thrown errors (6 calls in Roland)
- [x] Replace every hardcoded pixel width with rem (1 CSS fix: 560px → 35rem)
- [x] Deduplicate shared types: VfdGlowVariant, BackupProgress, useS330Store, cn(), MIDI note parsing (5/16 resolved; 11 architectural items deferred)
- [x] Verify both editors compile with `make`
- [x] Verify both editors pass all tests with `pnpm test` (pre-existing failures only, no regressions)
- [ ] Manual smoke test of both editors in browser

### Acceptance Criteria

- Zero `window.prompt`, `window.confirm`, or `window.alert` calls in editor code
- Zero hardcoded pixel widths in layout code
- Zero duplicated type definitions
- Both editors compile and pass tests
- Manual smoke test confirms dialogs and layouts work correctly

---

## Phase 5: Architectural Type Deduplication

Resolve the 11 deferred type duplication findings from the Phase 1 audit.

### Tasks

#### High severity
- [x] Unify `WavFileInfo` — shared `WavFileMetadata` in editor-core, both editors extend
- [x] Converge `TreeSectionProps` — deleted Roland's 460-line LibraryTreeNode.tsx, use editor-core TreeSection with adapter hook
- [x] Enforce `OperationProgress` — canonical in sampler-library, editor-core re-exports
- [x] Create `createEditorStoreSlice()` factory — shared base in editor-core, both stores extend
- [x] Converge `LibraryDragPayload` / `LibraryDragData` — eliminated LibraryDragData, Roland uses LibraryDragPayload with meta helpers

#### Medium severity
- [x] Create shared `BaseKitConfig` — generic in editor-core, S330 extends, S3K aliases
- [x] Create generic `KitOutputConfigProps<T>` — shared in editor-core
- [x] Replace `SdsTransferProgress` ambient re-declaration — deleted .d.ts, removed tsconfig path redirect
- [x] Make `DrumKitImportProgress` / `InstrumentImportProgress` extend `OperationProgress`
- [x] Replace `SaveProgress` with `OperationProgress & { startTime }` — field names aligned
- [x] Promote S3K `Dialog` primitives to editor-core — ConfirmDialog composes shared Dialog

### Acceptance Criteria

- Zero duplicated type definitions across editor-core, roland-sxx0-editor, and akai-s3k-editor
- Both editors compile with `make`
- All existing tests pass
