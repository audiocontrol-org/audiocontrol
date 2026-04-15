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
| Phase 3 | [#190](https://github.com/audiocontrol-org/audiocontrol/issues/190) | ~~Session log analyzer~~ (superseded by Phase 6) |
| Phase 4 | [#191](https://github.com/audiocontrol-org/audiocontrol/issues/191) | Agents and workflow skills |
| Phase 6 | [#195](https://github.com/audiocontrol-org/audiocontrol/issues/195) | Session data extraction (TypeScript, replaces Phase 3) |
| Phase 7 | [#196](https://github.com/audiocontrol-org/audiocontrol/issues/196) | Session data analyzer (local, code-only, future LLM) |
| Phase 5 | [#192](https://github.com/audiocontrol-org/audiocontrol/issues/192) | Library-ux feature docs and roadmap |
| Phase 8 | [#285](https://github.com/audiocontrol-org/audiocontrol/issues/285) | CLAUDE.md audit — classify directives by impact and path scope |
| Phase 9 | [#286](https://github.com/audiocontrol-org/audiocontrol/issues/286) | CLAUDE.md refactoring — migrate domain rules to `.claude/rules/` |

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

## Phase 6: Session Data Extraction

### Context

1,771 Claude Code session logs (544MB) across two machines contain valuable data about how the project is built — but they're ephemeral, stored in `~/.claude/projects/` on developer laptops, vulnerable to deletion, and not portable. Extract structured records into a committed, version-controlled format that survives laptop failures and enables analysis over time.

This is data extraction and persistence, not analysis. Analysis can happen later from anyone with the data.

### Task 6.1: Create session data extractor

TypeScript script that parses Claude Code JSONL session logs and extracts one structured record per session.

**Fields to extract per session:**

| Field | Source | Description |
|-------|--------|-------------|
| session_id | JSONL filename | Session UUID |
| project | parent directory name | e.g., `audiocontrol-library-ux` |
| machine | hostname at extract time | `orion-m4` or `orion-m1` |
| start_time | first entry timestamp | ISO 8601 |
| end_time | last entry timestamp | ISO 8601 |
| duration_minutes | computed | end - start |
| user_messages | count type=user | Total user prompts |
| assistant_messages | count type=assistant | Total assistant responses |
| tool_calls | count tool_use in assistant content | Total tool invocations |
| tool_types | distinct tool names | e.g., `["Read","Edit","Bash","Agent"]` |
| agent_spawns | count of Agent tool uses | Sub-agent delegations |
| input_tokens | sum from usage.input_tokens | Total input tokens |
| output_tokens | sum from usage.output_tokens | Total output tokens |
| commits | count of Bash calls containing "git commit" | Approximate commits |
| branch | from gitBranch field | Feature branch name |
| model | from assistant message.model | Model used |

**Output:**
- `data/sessions/sessions.jsonl` — one JSON line per session, append-only, committed to git
- `data/sessions/summary.csv` — regenerated from JSONL on each run, for spreadsheet import

**Implementation:**
- Single file: `tools/extract-sessions.ts`
- Uses `node:fs` and `node:readline` to stream-parse JSONL (some files are 100MB+)
- Reads from `~/.claude/projects/` by default, `--data-dir` flag for remote data
- `--machine` flag to tag records from remote machine
- Skips sessions already in output (by session_id) — idempotent
- Run: `tsx tools/extract-sessions.ts`
- Remote: `rsync -az orion@orion-m1.local:~/.claude/projects/*audiocontrol* /tmp/m1-data/ && tsx tools/extract-sessions.ts --data-dir /tmp/m1-data --machine orion-m1`

No Python. No Docker. No external dependencies. Just tsx.

**Files:**
- Create: `tools/extract-sessions.ts`
- Create: `data/sessions/.gitkeep`
- Modify: `.gitignore` — ensure `data/sessions/` is tracked

**Acceptance Criteria:**
- [x] Extracts all local sessions into `data/sessions/sessions.jsonl`
- [x] Each record has all fields from the table above
- [x] Running twice produces no duplicate records (idempotent)
- [x] `summary.csv` is readable in a spreadsheet
- [x] Remote machine data can be extracted with `--data-dir` and `--machine` flags

### Task 6.2: Remove Python/Docker analyzer

Replace with the TypeScript extractor.

**Files:**
- Remove: `tools/Dockerfile.analyzer`
- Remove: `tools/analyze-session.sh`
- Remove: `tools/session-analyzer/` (git-cloned, not tracked)
- Remove: `tools/.analyzer-data/`

**Acceptance Criteria:**
- [x] No Python or Docker dependencies for session data extraction

### Task 6.3: Extract baseline data and commit

Run the extractor on both machines, commit the resulting data files.

**Files:**
- Create: `data/sessions/sessions.jsonl` (extracted data)
- Create: `data/sessions/summary.csv` (generated)

**Acceptance Criteria:**
- [x] Data from orion-m4 extracted and committed (orion-m1 pending local run)
- [x] Data is version-controlled and portable

### Task 6.4: Update CLAUDE.md analytics section

Replace the Python analyzer references with the tsx extractor.

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [x] Analytics section references `tsx tools/extract-sessions.ts`
- [x] Cadence documented (run after each session or periodically)

**Phase 6 Status:** COMPLETE (`df0e591f`, `00615efb`)

**Phase 6 Verification:** `tsx tools/extract-sessions.ts` produces valid JSONL and CSV. Data committed to git. Running again is idempotent. Content extraction produces age-encrypted per-session files with passphrase recovery key.

---

## Phase 7: Session Data Analyzer

### Context

Phase 6 extracts raw session data into `data/sessions/sessions.jsonl`. Phase 7 analyzes that data and produces human-readable reports suitable for appending to DEVELOPMENT-NOTES.md. The first implementation uses pure TypeScript (no LLM). Future iterations can add LLM-powered classification (e.g., arc type detection, correction pattern recognition).

### Task 7.1: Create session data analyzer

TypeScript script that reads `data/sessions/sessions.jsonl` and produces analysis reports.

**Analysis (v1 — code only, no LLM):**

| Metric | Computation | Purpose |
|--------|------------|---------|
| Sessions by project | group by project, count | Where is effort concentrated |
| Sessions by machine | group by machine, count | Cross-machine distribution |
| Total tokens consumed | sum input_tokens + output_tokens | Cost proxy |
| Average session duration | mean of duration_minutes | Session length trends |
| Average user messages per session | mean of user_messages | Interaction intensity |
| Agent spawn rate | agent_spawns / sessions | Are we delegating enough |
| Tool distribution | aggregate tool_types across sessions | What tools are used most |
| Sessions over time | group by week/month | Activity trends |
| Longest sessions | top 10 by duration | Where did we spend the most time |
| Token-heaviest sessions | top 10 by total tokens | Most expensive sessions |

**Output formats:**
- Markdown report to stdout (can be piped or appended to DEVELOPMENT-NOTES.md)
- Optional `--json` flag for machine-readable output
- Optional `--since YYYY-MM-DD` flag to limit analysis window

**Implementation:**
- Single file: `tools/analyze-sessions.ts`
- Reads from `data/sessions/sessions.jsonl`
- Pure computation — no network, no API keys, no external dependencies
- Run: `tsx tools/analyze-sessions.ts`
- Append to journal: `tsx tools/analyze-sessions.ts >> DEVELOPMENT-NOTES.md`
- Recent only: `tsx tools/analyze-sessions.ts --since 2026-04-01`

**Files:**
- Create: `tools/analyze-sessions.ts`

**Acceptance Criteria:**
- [x] Reads `data/sessions/sessions.jsonl` and produces markdown report
- [x] All metrics from the table above included
- [x] `--since` flag filters by date
- [x] `--json` flag produces machine-readable output
- [x] Output is valid markdown suitable for DEVELOPMENT-NOTES.md
- [x] Runs with no external dependencies (just tsx)

### Task 7.2: Document analysis cadence

Add analysis cadence to CLAUDE.md and the session-end skill.

**Files:**
- Modify: `.claude/CLAUDE.md` (analytics section)
- Modify: `.claude/skills/session-end.md`

**Acceptance Criteria:**
- [x] CLAUDE.md documents when to run the analyzer (periodically, or on request)
- [x] /session-end skill optionally runs analyzer and includes summary in journal entry

### Future: Task 7.3 (not for v1): LLM-powered analysis

Add optional LLM classification to the analyzer:
- Arc type detection (feature, debug, review, exploration)
- Correction pattern recognition from DEVELOPMENT-NOTES.md entries
- Trend narrative generation ("corrections are decreasing in [UX] category")

Requires API key. Deferred — the code-only version provides the foundation data.

**Phase 7 Status:** COMPLETE (`eb49a690`, `5dcfe079`) — v1 code-only analysis done. LLM-powered analysis (Task 7.3) blocked on API credits.

**Phase 7 Verification:** `tsx tools/analyze-sessions.ts` produces a readable markdown report from extracted session data. Report includes all specified metrics. Correction detection via regex included (LLM replacement pending).

---

## Phase 8: CLAUDE.md Audit and Classification

### Context

CLAUDE.md is 773 lines / 42KB — nearly 4x the recommended 200-line limit. It's loaded in full on every conversation turn regardless of what the agent is working on. Claude Code supports `.claude/rules/` with `paths:` YAML frontmatter for glob-scoped conditional loading, but we're not using it. Session analysis (54 corrections across 37 sessions) shows PROCESS corrections dominate at 59%, meaning the highest-leverage directives are workflow and decision-making rules, not domain-specific protocol details.

### Task 8.1: Review session analysis data

Read the existing analysis reports (`data/sessions/report-all.md`) and decrypt a sample of high-correction sessions to identify which CLAUDE.md directives actually prevented (or would have prevented) mistakes.

**Files:**
- Read: `data/sessions/report-all.md`
- Read: `data/sessions/analysis/*.json.age` (decrypt and review top-correction sessions)

**Acceptance Criteria:**
- [x] Top 5 high-correction sessions reviewed
- [x] Each correction mapped to the CLAUDE.md directive that addresses it (or should)
- [x] List of directives ranked by impact (how many corrections they prevent)

### Task 8.2: Classify CLAUDE.md sections

Categorize every section of CLAUDE.md into one of three buckets:

| Bucket | Criteria | Destination |
|--------|----------|-------------|
| Universal | Needed every session regardless of module | Stays in CLAUDE.md |
| Domain-scoped | Only relevant when touching specific modules/paths | `.claude/rules/<topic>.md` with `paths:` frontmatter |
| Redundant | Already encoded in skills, agents, or referenced docs | Delete |

**Files:**
- Read: `.claude/CLAUDE.md`
- Create: `docs/1.0/001-IN-PROGRESS/continuous-improvement/claude-md-audit.md`

**Acceptance Criteria:**
- [x] Every section of CLAUDE.md classified with rationale
- [x] Migration plan: what stays, what moves, what gets deleted
- [x] Proposed `.claude/rules/` file list with path globs
- [x] Estimated post-refactor CLAUDE.md line count (target: under 200)

**Phase 8 Status:** COMPLETE

---

## Phase 9: CLAUDE.md Refactoring

### Context

Using the audit from Phase 8, refactor CLAUDE.md into a lean universal file plus path-scoped rule files. The goal is to reduce context consumption without losing directive effectiveness.

### Task 9.1: Create `.claude/rules/` directory with path-scoped rules

Create rule files for each domain-scoped topic identified in the audit.

**Rule files created (refined from Phase 8 audit):**

| Rule file | Lines | Content |
|-----------|-------|---------|
| `e2e-testing.md` | 240 | E2E tenets, make targets, SCSI provisioning, heartbeat/watchdog |
| `testing.md` | 44 | Test categories, bug-first methodology, before-running-tests |
| `akai-s3000xl.md` | 33 | SysEx encoding, exclusive channel, SDS storage |
| `midi-audio.md` | 19 | MIDI spec standards, midisnoop |
| `ui-development.md` | 34 | Design system pointer, progress indicators |
| `deployment.md` | 39 | Netlify sites, deploy commands, config |
| `session-analytics.md` | 41 | Extract/analyze commands, metrics |
| `workflow-playbooks.md` | 39 | Hardware protocol, bridge, UI feature playbooks |

**Files:**
- Create: `.claude/rules/e2e-testing.md`
- Create: `.claude/rules/testing.md`
- Create: `.claude/rules/akai-s3000xl.md`
- Create: `.claude/rules/midi-audio.md`
- Create: `.claude/rules/ui-development.md`
- Create: `.claude/rules/deployment.md`
- Create: `.claude/rules/session-analytics.md`
- Create: `.claude/rules/workflow-playbooks.md`

**Acceptance Criteria:**
- [x] Each rule file has `paths:` YAML frontmatter with appropriate globs
- [x] Content moved verbatim — no rewriting or summarizing during migration
- [x] Rule files load only when matching paths are touched

### Task 9.2: Trim CLAUDE.md to universal directives

Remove migrated sections from CLAUDE.md. Keep only rules that apply to every session.

**Universal directives (expected to stay):**
- Project structure overview
- Import pattern (`@/`)
- Error handling (no fallbacks, no mock data)
- TypeScript architecture (composition, DI, no `any`)
- Multi-device architecture (factories, not conditionals)
- Code quality (file size limits, testing, DI)
- Repository hygiene (build artifacts, hooks, pnpm, tsx)
- Session lifecycle (start/end checklists)
- Project management workflow
- Build system (`make` commands)
- Sub-agent delegation guidance
- Critical don'ts list
- Development journal template

**Files:**
- Modify: `.claude/CLAUDE.md`

**Acceptance Criteria:**
- [x] CLAUDE.md is under 200 lines (198 lines, down from 774)
- [x] No domain-specific content remains (Akai SysEx, E2E heartbeat, SCSI provisioning)
- [x] All universal directives preserved — nothing important deleted
- [x] Build passes (`make`)

### Task 9.3: Validate rule loading

Verify that the refactoring works correctly — rules load when expected, don't load when not relevant.

**Files:**
- No new files

**Acceptance Criteria:**
- [x] Opening an Akai editor file loads `akai-s3000xl.md` rules
- [x] Opening a UI component file loads `ui-development.md` rules
- [x] Working on tools/ loads `session-analytics.md` rules
- [x] Working on a file outside all scopes loads only CLAUDE.md (under 200 lines)

### Task 9.4: Update issue #283

Close the GitHub issue with a summary of what was done.

**Acceptance Criteria:**
- [x] Issue #283 commented with before/after line counts and rule file list
- [x] Issue closed

**Phase 9 Status:** COMPLETE

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

Phase 6 (session data extraction) — replaces Phase 3 analyzer
  6.1 → 6.2 → 6.3 → 6.4

Phase 7 (session data analysis) — depends on Phase 6
  7.1 → 7.2 → (future: 7.3 LLM analysis)

Phase 8 (CLAUDE.md audit) — depends on Phase 7 (uses analysis data)
  8.1 → 8.2

Phase 9 (CLAUDE.md refactoring) — depends on Phase 8 (uses audit results)
  9.1 → 9.2 → 9.3 → 9.4
```

Phases 1, 2, 5 are independent and can be worked in parallel.
Phase 4 benefits from Phase 1 (playbooks inform skill design).
Phase 6 replaces Phase 3 (Python/Docker analyzer → TypeScript extractor).
Phase 7 depends on Phase 6 (needs extracted data to analyze).
Phase 8 depends on Phase 7 (uses session analysis to rank directive impact).
Phase 9 depends on Phase 8 (uses audit classification to execute migration).
