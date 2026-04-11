# Build Source Dependencies — Workplan

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-11

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Parent Issue** | [#173 — Build stamps should be sensitive to source code changes](https://github.com/audiocontrol-org/audiocontrol/issues/173) |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | [#204](https://github.com/audiocontrol-org/audiocontrol/issues/204) | Add CSS files to Makefile source dependency tracking |
| Phase 1 | [#205](https://github.com/audiocontrol-org/audiocontrol/issues/205) | Add inline documentation to Makefile explaining source change detection |
| Phase 1 | [#206](https://github.com/audiocontrol-org/audiocontrol/issues/206) | Add build system note to CLAUDE.md |

---

## Phase 1: CSS Tracking and Documentation

This is a single-phase feature. All tasks are small and closely related.

### Task 1.1: Add CSS to Makefile source file lists

Add `-o -name '*.css'` to every `$(shell find ...)` pattern in the Makefile source file list section (lines 53-78). All modules that contain CSS files in their `src/` directories will then trigger rebuilds on CSS changes.

**Affected modules (9 CSS files across 5 modules):**

| Module | CSS Files |
|--------|-----------|
| editor-core | `src/design/library.css`, `src/design/primitives.css`, `src/design/styles.css`, `src/design/tokens.css`, `src/dev/styles.css` |
| akai-s3k-editor | `src/index.css` |
| d110-editor | `src/index.css` |
| jv1080-editor | `src/index.css` |
| roland-sxx0-editor | `src/index.css` |

**Files:**
- Modify: `Makefile` (source file list section, lines 53-78)

**Acceptance Criteria:**
- [x] Every `$(shell find ...)` line includes `-o -name '*.css'`
- [x] `touch modules/editor-core/src/design/tokens.css && make` triggers a rebuild of editor-core and its dependents
- [x] `touch modules/roland-sxx0-editor/src/index.css && make` triggers a rebuild of roland-sxx0-editor

### Task 1.2: Add inline documentation to Makefile

Add a prominent comment block near the stamp file targets explaining:
- Source file changes are detected automatically via `$(shell find ...)`
- `make` alone is sufficient for routine development — do NOT delete stamp files
- `make clean` exists for full rebuilds from scratch, not for routine development
- The specific file types tracked (`.ts`, `.tsx`, `.css`)

The documentation must be positioned where an agent scanning the Makefile will encounter it before learning the stamp file pattern. The goal is to prevent the cargo-cult `rm -f .build-stamp && make` behavior.

**Files:**
- Modify: `Makefile` (add comment block near source file lists and stamp targets)

**Acceptance Criteria:**
- [x] Comment block appears before the first stamp target rule
- [x] Explicitly states: do NOT delete stamp files for routine development
- [x] Explains what file types trigger rebuilds
- [x] Explains when `make clean` is actually appropriate

### Task 1.3: Add build system note to CLAUDE.md

Add a brief note to the Build System section of `.claude/CLAUDE.md` reinforcing that `make` detects source changes automatically. This catches agents that read CLAUDE.md but not the Makefile.

**Files:**
- Modify: `.claude/CLAUDE.md` (Build System section)

**Acceptance Criteria:**
- [x] Build System section states that source changes (`.ts`, `.tsx`, `.css`) are detected automatically
- [x] Explicitly says: do not delete stamp files for routine development
- [x] Does not duplicate the full Makefile documentation — just a brief reinforcement with a pointer to the Makefile comments

### Task 1.4: Close issue #173

After all changes are committed and verified, close the parent GitHub issue.

**Acceptance Criteria:**
- [ ] Issue #173 is closed with a comment referencing the implementing commits

---

## Phase 1 Success Criteria

- CSS file changes trigger automatic rebuilds
- Makefile has clear inline documentation preventing stamp-deletion cargo-culting
- CLAUDE.md reinforces correct build behavior
- Issue #173 closed

---

## Dependency Graph

```
Task 1.1 (CSS tracking) ─┐
Task 1.2 (Makefile docs) ─┼──► Task 1.4 (close issue)
Task 1.3 (CLAUDE.md note) ┘
```

Tasks 1.1, 1.2, and 1.3 are independent and can be done in parallel or in any order. Task 1.4 depends on all three being committed.
