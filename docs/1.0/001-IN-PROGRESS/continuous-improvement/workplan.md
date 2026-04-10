# Continuous Improvement Process — Workplan

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-10

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Parent Issue** | [#187 — Continuous improvement: session lifecycle, analytics, agents](https://github.com/audiocontrol-org/audiocontrol/issues/187) |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | [#188](https://github.com/audiocontrol-org/audiocontrol/issues/188) | Session lifecycle checklists in CLAUDE.md |
| Phase 2 | [#189](https://github.com/audiocontrol-org/audiocontrol/issues/189) | Restructure DEVELOPMENT-NOTES.md |
| Phase 3 | [#190](https://github.com/audiocontrol-org/audiocontrol/issues/190) | Session log analyzer and baseline |
| Phase 4 | [#191](https://github.com/audiocontrol-org/audiocontrol/issues/191) | Agents and workflow skills |
| Phase 5 | [#192](https://github.com/audiocontrol-org/audiocontrol/issues/192) | Library-ux feature docs and roadmap |

---

## Phase 1: CLAUDE.md — Session Lifecycle and Project Awareness

### Task 1.1: Add session start/end checklists

Add "Session Lifecycle" section with bootstrap (7 steps) and completion (6 steps) checklists.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] Session start checklist includes reading workplan, DEVELOPMENT-NOTES.md, and open issues
- [ ] Session end checklist includes updating workplan, writing journal entry, committing docs
- [ ] DEVELOPMENT-NOTES.md is explicitly called out as critical context

### Task 1.2: Add project management reference

Add pointer to PROJECT-MANAGEMENT.md, roadmap, feature doc structure, and worktree conventions.

**Files:**
- Modify: `.claude/CLAUDE.md`
- Modify: `~/work/CLAUDE.md` (propagates to all projects)

**Acceptance Criteria:**
- [ ] CLAUDE.md references ~/work/PROJECT-MANAGEMENT.md
- [ ] Roadmap location documented
- [ ] Feature doc and worktree naming conventions documented

### Task 1.3: Add workflow playbooks

Encode repeatable patterns: start a feature, investigate hardware protocol, ship a bridge change, add a UI feature.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] At least 4 playbooks covering common operations
- [ ] Hardware protocol playbook covers all transports (serial MIDI, HTTP, SCSI, SDS)
- [ ] Each playbook is 5-7 concrete steps

### Task 1.4: Add pre-commit self-review

Checklist of project standards to verify before committing.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] Covers progress indicators, layout values, sleeps, fabrication, error messages, workplan updates
- [ ] Includes agent delegation check

### Task 1.5: Add multi-machine documentation

Document the two-machine setup and how to maintain continuity.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] Both machines documented (orion-m4, orion-m1)
- [ ] Session log locations documented
- [ ] Guidance on picking up context across machines

**Phase 1 Status:** COMPLETE (`3e302fff`)

**Phase 1 Verification:** Read CLAUDE.md end-to-end and verify all sections are present and internally consistent.

---

## Phase 2: DEVELOPMENT-NOTES.md — Structured Journal

### Task 2.1: Restructure journal template

Add correction categories, quantitative section, feature/worktree fields.

**Files:**
- Modify: `DEVELOPMENT-NOTES.md`

**Acceptance Criteria:**
- [ ] Template has tagged correction categories: [COMPLEXITY] [UX] [FABRICATION] [DOCUMENTATION] [PROCESS]
- [ ] Quantitative section with message counts, commit counts, correction counts
- [ ] Feature and worktree fields
- [ ] Existing first entry updated to new format

**Phase 2 Status:** COMPLETE (`fa09a31f`)

**Phase 2 Verification:** Journal entry template is clear and actionable.

---

## Phase 3: Session Log Analysis

### Task 3.1: Set up analyzer

Clone claude-code-log-analyzer, create wrapper script.

**Files:**
- Create: `tools/session-analyzer/` (clone or submodule)
- Create: `tools/analyze-session.sh` (wrapper)
- Modify: `.gitignore` (exclude venv)

**Acceptance Criteria:**
- [ ] Analyzer cloned and dependencies installed
- [ ] Wrapper script runs agent analysis with one command
- [ ] Works with local session logs

### Task 3.2: Establish baseline metrics

Run analyzer on current session logs, document baseline.

**Files:**
- Create: `docs/1.0/001-IN-PROGRESS/continuous-improvement/baseline-metrics.md`

**Acceptance Criteria:**
- [ ] Total sessions, messages, autonomous hours counted
- [ ] Arc distribution documented
- [ ] Baseline saved for future comparison

### Task 3.3: Add analytics section to CLAUDE.md

Document how to run analysis, what metrics to track, cadence.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] Per-session metrics documented
- [ ] Weekly/monthly analysis cadence documented
- [ ] Metrics table with target directions

**Phase 3 Status:** PARTIAL — analyzer cloned and wrapper created (`5adb8270`). Baseline metrics pending (needs venv setup + Gemini API key for arc analysis).

**Phase 3 Verification:** `tools/analyze-session.sh` produces output. Baseline documented.

---

## Phase 4: Agents and Skills

### Task 4.1: Create hardware-protocol-engineer agent

Replaces and broadens vintage-midi-sysex-engineer. Covers all device transports.

**Files:**
- Create: `.claude/agents/hardware-protocol-engineer.md`

**Acceptance Criteria:**
- [ ] Covers serial MIDI, HTTP MIDI, SCSI MIDI, SDS, ASPACK, Roland SysEx
- [ ] References protocol docs, SCSI-NOTES.md, MESA findings
- [ ] Description includes example trigger patterns

### Task 4.2: Create library-ux-engineer agent

For library browser UI work.

**Files:**
- Create: `.claude/agents/library-ux-engineer.md`

**Acceptance Criteria:**
- [ ] Knows PluginLibraryBrowser, TreeView, drag-drop, progress indicators
- [ ] References four-zone storage model, design system
- [ ] Description includes example trigger patterns

### Task 4.3: Create workflow skills

Slash commands for repeatable operations.

**Files:**
- Create: `.claude/skills/session-start.md`
- Create: `.claude/skills/session-end.md`
- Create: `.claude/skills/deploy-bridge.md`
- Create: `.claude/skills/analyze-session.md`

**Acceptance Criteria:**
- [ ] Each skill executes a complete workflow playbook
- [ ] /session-start reads workplan, journal, issues and reports context
- [ ] /session-end updates workplan, writes journal, commits

### Task 4.4: Add agent selection guidance to CLAUDE.md

Task-to-agent mapping table and delegation guidance.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [ ] Table maps task patterns to specific agents
- [ ] "When NOT to use agents" section included
- [ ] Pre-commit review includes delegation check

**Phase 4 Status:** COMPLETE (`a027645f`, `f0d86060`)

**Phase 4 Verification:** Agents and skills are loadable by Claude Code. `/session-start` produces useful output.

---

## Phase 5: Feature Doc Updates

### Task 5.1: Update library-ux feature docs

Bring README.md and workplan.md current with this session's work.

**Files:**
- Modify: `docs/1.0/001-IN-PROGRESS/library-ux/README.md`
- Modify: `docs/1.0/001-IN-PROGRESS/library-ux/workplan.md`

**Acceptance Criteria:**
- [ ] Status table reflects disk browser, drag-drop, SDS batching, ASPACK
- [ ] New phases added for SCSI disk browser, SDS optimization, ASPACK exploration
- [ ] GitHub issues #183, #184, #185, #186 linked

### Task 5.2: Update roadmap

Reflect library-ux progress and ASPACK as blocked/future.

**Files:**
- Modify: `docs/1.0/ROADMAP.md`

**Acceptance Criteria:**
- [ ] library-ux status updated
- [ ] ASPACK noted as future optimization

**Phase 5 Verification:** Feature docs are accurate and current.

---

## Dependency Graph

```
Phase 1 (CLAUDE.md) — no deps, highest leverage
  1.1 → 1.2 → 1.3 → 1.4 → 1.5

Phase 2 (journal template) — no deps
  2.1

Phase 3 (analytics) — no deps
  3.1 → 3.2 → 3.3

Phase 4 (agents/skills) — benefits from Phase 1 playbooks
  4.1, 4.2 (parallel) → 4.3 → 4.4

Phase 5 (feature docs) — no deps, can be done anytime
  5.1, 5.2 (parallel)
```

Phases 1, 2, 3, 5 are independent and can be worked in parallel.
Phase 4 benefits from Phase 1 (playbooks inform skill design).
