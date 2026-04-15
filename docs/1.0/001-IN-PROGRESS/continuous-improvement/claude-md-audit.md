# CLAUDE.md Audit: Section Classification and Refactor Plan

## Summary

| Metric | Current | Target |
|--------|---------|--------|
| Total lines | 774 | ~180 |
| Sections | 29 | ~14 (Universal only) |
| Redundant sections | 3 | 0 |
| Domain-scoped sections to extract | 12 | 0 (moved to rules/) |

**Proposed `.claude/rules/` files:** 7 rule files scoped by path glob.

**Guiding principle:** Directives that prevent PROCESS corrections (59% of all corrections) and FABRICATION (11%) stay Universal because they apply regardless of which module is active. Device-specific protocol details, E2E test infrastructure, deployment config, and session analytics tooling are Domain-scoped -- they add cognitive load in sessions that never touch those areas.

---

## Section-by-Section Classification

| # | Section | Lines | Bucket | Destination | Rationale |
|---|---------|-------|--------|-------------|-----------|
| 1 | Header + project description | 1-3 (3) | Universal | stays in CLAUDE.md | Every session needs project context |
| 2 | Session Lifecycle | 4-26 (23) | Universal | stays in CLAUDE.md | Prevents PROCESS corrections (59% of total). Start/end checklists are the #1 defense against "agent doesn't read existing docs" and "agent doesn't update workplan" |
| 3 | Project Management | 27-41 (15) | Universal | stays in CLAUDE.md | Worktree conventions, multi-machine sync, feature doc locations -- needed every session |
| 4 | Workflow Playbooks | 43-81 (39) | Domain-scoped | `.claude/rules/workflow-playbooks.md` | "Start a new feature" is universal but the other three (investigate hardware, ship bridge, add UI feature) are domain-specific. Split: keep "Start a new feature" in CLAUDE.md (~6 lines), move the rest to a rule file |
| 5 | Testing Architecture | 83-111 (29) | Domain-scoped | `.claude/rules/testing.md` | Only relevant when writing or running tests. The test category table and bug-first methodology are important but load unnecessarily for non-test sessions |
| 6 | Before Running Tests | 112-118 (7) | Domain-scoped | `.claude/rules/testing.md` | Merge into testing rule file |
| 7 | Before Committing | 119-129 (11) | Universal | stays in CLAUDE.md | Prevents PROCESS and UX corrections at commit time. Short checklist, high value |
| 8 | When to Use Sub-Agents | 131-149 (19) | Universal | stays in CLAUDE.md (merged with section 14) | Prevents the #2 correction pattern: "agent doesn't delegate." Keep the table + when-not-to list. Merge with section 14's "how to delegate" details |
| 9 | Session Analytics | 151-182 (32) | Domain-scoped | `.claude/rules/session-analytics.md` | Only relevant when running extract/analyze tools. 32 lines of commands and metrics tables that add noise in feature sessions |
| 10 | Project Structure | 184-208 (25) | Universal | stays in CLAUDE.md | Module tree is reference material needed for navigation in any session |
| 11 | Sampler Library Architecture | 210-212 (3) | Universal | stays in CLAUDE.md | 3-line pointer. Negligible cost, prevents wrong assumptions about storage model |
| 12 | Core Requirements | 214-309 (96) | Universal | stays in CLAUDE.md | Import pattern, error handling, TypeScript rules, multi-device arch, code quality, nucleation site prevention, contract enforcement, repo hygiene. These prevent PROCESS, FABRICATION, ARCHITECTURE, and UX corrections across all modules. This is the heart of the file. **However**: Nucleation Site Prevention (lines 265-278, 14 lines) and Contract Enforcement (lines 280-300, 21 lines) could be trimmed -- they are verbose expansions of principles already stated concisely in Code Quality and TypeScript subsections. Recommend condensing each to ~5 lines with a pointer to a standalone doc for the full rationale |
| 13 | Design System | 311-318 (8) | Domain-scoped | `.claude/rules/ui-development.md` | Only relevant when building/modifying UI components. The pointer to DESIGN-SYSTEM.md plus the bullet list of what it covers |
| 14 | Sub-Agent Delegation | 320-343 (24) | Redundant | delete (merge best parts into section 8) | Duplicates section 8 ("When to Use Sub-Agents"). Section 14 adds "how to delegate" details (sub-agents research/main agent executes, give complete context, instruct to write to disk). Merge those 5 bullets into section 8, delete section 14 entirely |
| 15 | Monorepo Conventions | 345-349 (5) | Universal | stays in CLAUDE.md | 5 lines, universally applicable |
| 16 | MIDI/Audio Guidelines | 351-359 (9) | Domain-scoped | `.claude/rules/midi-audio.md` | Only relevant when touching MIDI/audio code in sampler-midi, sampler-devices, etc. |
| 17 | S3000XL SysEx Exclusive Channel | 361-368 (8) | Domain-scoped | `.claude/rules/akai-s3000xl.md` | Akai-specific protocol detail. Only relevant when touching S3000XL modules |
| 18 | S3000XL SysEx Encoding | 370-378 (9) | Domain-scoped | `.claude/rules/akai-s3000xl.md` | Akai-specific encoding rules |
| 19 | S3000XL SDS Storage Behavior | 380-382 (3) | Domain-scoped | `.claude/rules/akai-s3000xl.md` | Akai-specific SDS behavior |
| 20 | URL Convention for Editors | 384-392 (9) | Universal | stays in CLAUDE.md | Short, applies to all editor modules. Condense to 3 lines (drop the example block) |
| 21 | Build System | 394-407 (14) | Universal | stays in CLAUDE.md | Every session uses `make`. Keep as-is |
| 22 | Deployment | 409-449 (41) | Domain-scoped | `.claude/rules/deployment.md` | Only relevant when deploying to Netlify. 41 lines of deploy commands, site tables, and Netlify config paths |
| 23 | Development Journal | 451-491 (41) | Universal | stays in CLAUDE.md | Template for DEVELOPMENT-NOTES.md entries. Prevents DOCUMENTATION corrections. **But**: condense to ~20 lines by removing the prose explanation of "the journal serves as" (already internalized via Session Lifecycle) |
| 24 | Documentation Standards | 493-499 (7) | Universal | stays in CLAUDE.md | Short list of don'ts. Prevents DOCUMENTATION corrections |
| 25 | Progress Indicators | 501-514 (14) | Domain-scoped | `.claude/rules/ui-development.md` | Only relevant when building UI with progress displays. Merge into ui-development rule file |
| 26 | Development Journal (DUPLICATE) | 516-532 (17) | Redundant | delete | Exact duplicate of section 23 with slightly different wording. The version in section 23 (with the template) is more useful |
| 27 | Critical Don'ts | 534-545 (12) | Redundant (partial) | condense and merge | 8 of 10 items duplicate rules already stated in Core Requirements (import pattern, error handling, mock data, hooks, file size, repo hygiene, tsx). The two unique items ("Never add Claude attribution" and "Never build ad-hoc test infra") should be absorbed into Core Requirements and Testing sections respectively. Delete this section after merging the unique items |
| 28 | E2E Testing Tenets | 547-716 (170) | Domain-scoped | `.claude/rules/e2e-testing.md` | 170 lines of E2E-specific content: make targets, SCSI provisioning pipeline, no-mocking rules, round-trip test structure, observability, timeouts. Only relevant when writing or running E2E tests. This single section is larger than the entire target CLAUDE.md |
| 29 | Hardware E2E Testing | 718-774 (57) | Domain-scoped | `.claude/rules/e2e-testing.md` | Heartbeat/watchdog architecture for roland-sxx0-editor hardware tests. Merge into e2e-testing rule file |

---

## Proposed `.claude/rules/` Files

### 1. `e2e-testing.md` (~227 lines)

**Source sections:** 28 (E2E Testing Tenets) + 29 (Hardware E2E Testing)

```yaml
---
paths:
  - "test/e2e/**"
  - "e2e/**"
  - "modules/e2e-infra/**"
  - "modules/roland-sxx0-editor/e2e/**"
  - "modules/roland-sxx0-editor/scripts/watchdog.ts"
  - "modules/roland-sxx0-editor/scripts/run-hardware-e2e.sh"
  - "modules/roland-sxx0-editor/playwright.hardware.config.ts"
  - "Makefile"
---
```

**Content:** All E2E testing tenets, make targets, SCSI provisioning, no-mocking, atomic round trips, observability (run-and-watch.sh), timeouts, heartbeat/watchdog architecture. This is the largest extraction and the highest-value one -- 227 lines removed from every non-E2E session.

Note: Including `Makefile` in paths ensures these rules load when editing make targets that define E2E test commands.

### 2. `testing.md` (~36 lines)

**Source sections:** 5 (Testing Architecture) + 6 (Before Running Tests)

```yaml
---
paths:
  - "test/**"
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/**/*.spec.ts"
  - "src/**/*.spec.tsx"
---
```

**Content:** Test category table (unit/UI/E2E), test migration status, UI testing workflow (test harness creation, spec-alongside-build), bug-first testing methodology, "before running tests" reminders.

### 3. `akai-s3000xl.md` (~20 lines)

**Source sections:** 17 + 18 + 19 (S3000XL SysEx Exclusive Channel, Encoding, SDS Storage)

```yaml
---
paths:
  - "modules/sampler-midi/src/**/s3000*"
  - "modules/sampler-midi/src/**/akai*"
  - "modules/sampler-devices/src/**/s3000*"
  - "modules/sampler-devices/src/**/akai*"
  - "modules/e2e-infra/src/**/s3k*"
  - "modules/e2e-infra/src/**/akai*"
---
```

**Content:** Exclusive channel semantics, 7-bit vs nibble encoding rules, SDS overwrite-vs-create behavior. Hard-won protocol knowledge that prevents silent data corruption but is irrelevant outside Akai modules.

### 4. `midi-audio.md` (~9 lines)

**Source sections:** 16 (MIDI/Audio Guidelines)

```yaml
---
paths:
  - "modules/sampler-midi/**"
  - "modules/sampler-devices/**"
  - "modules/ardour-midi-maps/**"
  - "modules/canonical-midi-maps/**"
  - "modules/launch-control-xl3/**"
  - "modules/live-max-cc-router/**"
---
```

**Content:** MIDI spec standards, 7-bit/14-bit CC, NRPN/RPN, allocation-free real-time code, midisnoop usage.

### 5. `ui-development.md` (~22 lines)

**Source sections:** 13 (Design System) + 25 (Progress Indicators)

```yaml
---
paths:
  - "modules/*/src/**/*.tsx"
  - "modules/*/src/**/*.css"
  - "modules/editor-core/**"
  - "modules/s330-editor/**"
  - "modules/roland-sxx0-editor/**"
---
```

**Content:** Pointer to DESIGN-SYSTEM.md with summary of what it covers, progress indicator requirements (byte-based, elapsed time, ETA, consistency).

### 6. `deployment.md` (~41 lines)

**Source sections:** 22 (Deployment)

```yaml
---
paths:
  - "netlify/**"
  - "deploy/**"
---
```

**Content:** Netlify site table, deploy commands, configuration file locations, build commands.

### 7. `session-analytics.md` (~32 lines)

**Source sections:** 9 (Session Analytics)

```yaml
---
paths:
  - "tools/extract-sessions*"
  - "tools/analyze-sessions*"
  - "data/sessions/**"
---
```

**Content:** Extract/analyze commands, per-session metrics template, metrics table.

### 8. `workflow-playbooks.md` (~33 lines)

**Source sections:** 4 (Workflow Playbooks, minus "Start a new feature")

```yaml
---
paths:
  - "services/scsi-midi-bridge/**"
  - "modules/e2e-infra/**"
  - "modules/*/src/**/*.tsx"
---
```

**Content:** "Investigate a hardware protocol question," "Ship a bridge change," "Add a UI feature" playbooks. The "Start a new feature" playbook (~6 lines) stays in CLAUDE.md since it is universal.

---

## Estimated Post-Refactor CLAUDE.md

What stays, in order, with estimated line counts:

| Section | Est. Lines | Notes |
|---------|-----------|-------|
| Header + project description | 3 | As-is |
| Session Lifecycle | 23 | As-is |
| Project Management | 15 | As-is |
| Start a New Feature (from Workflow Playbooks) | 8 | Just the "Start a new feature" playbook, extracted from section 4 |
| Before Committing | 11 | As-is |
| When to Use Sub-Agents (merged) | 28 | Merged sections 8 + 14. Table + when-not-to + how-to-delegate bullets |
| Project Structure | 25 | As-is |
| Sampler Library Architecture | 3 | As-is |
| Core Requirements | 70 | Condensed from 96. Nucleation Site Prevention trimmed from 14 to 5 lines (pointer to standalone doc). Contract Enforcement trimmed from 21 to 8 lines (pointer to standalone doc). Absorb "never add Claude attribution" and "never build ad-hoc test infra" from Critical Don'ts |
| URL Convention for Editors | 3 | Condensed from 9 (drop code block example) |
| Monorepo Conventions | 5 | As-is |
| Build System | 14 | As-is |
| Development Journal | 25 | Condensed from 41. Remove "the journal serves as" prose (3 bullets), keep template |
| Documentation Standards | 7 | As-is |
| **Total** | **~240** | |

This is above the 200-line target but within striking distance. Further compression options:

- **Project Structure tree** (25 lines): Could move to a rule file scoped to `modules/**` but the tree is genuinely useful for navigation in any session. Consider trimming to only actively-developed modules (~15 lines).
- **Core Requirements** (70 lines): The largest remaining section. The Import Pattern and Error Handling subsections include code examples that could be dropped (the rules are clear without them), saving ~12 lines. That brings the total to ~228.
- **Development Journal template** (25 lines): The markdown template inside a code fence is bulky. Could be moved to a standalone template file and referenced with a 3-line pointer, saving ~20 lines. That brings the total to ~208.

With all three optimizations applied: **~208 lines**.

---

## Redundant Sections to Delete

### 1. Sub-Agent Delegation (section 14, lines 320-343, 24 lines)

**Why:** Duplicates section 8 ("When to Use Sub-Agents"). Both sections say "delegate proactively" and "don't wait for the user to ask." Both list what not to delegate (simple reads, git ops, user decisions). Section 14 adds useful "how to delegate" guidance that section 8 lacks. **Action:** Merge the 5 "how to delegate" bullets into section 8, delete section 14.

### 2. Development Journal duplicate (section 26, lines 516-532, 17 lines)

**Why:** Second copy of journal guidance. Section 23 (lines 451-491) has the full template with course correction categories; section 26 has a slightly different numbered list without the template. They contradict on structure (template vs. numbered list). **Action:** Keep section 23 (has the template), delete section 26.

### 3. Critical Don'ts (section 27, lines 534-545, 12 lines)

**Why:** 8 of 10 items are restated elsewhere:
- "Never implement fallbacks or mock data" -- Core Requirements > Error Handling
- "Never stub modules" -- Core Requirements > TypeScript
- "Never bypass pre-commit/pre-push hooks" -- Core Requirements > Repository Hygiene
- "Never use relative imports" -- Core Requirements > Import Pattern
- "Never create files larger than 500 lines" -- Core Requirements > Code Quality
- "Never commit temporary files" -- Core Requirements > Repository Hygiene
- "Never use ts-node" -- Core Requirements > Repository Hygiene
- "Never call builds production-ready" -- Documentation Standards

Two unique items need a home before deletion:
- "Never add Claude attribution to git commits or pull requests" -- move to Core Requirements > Repository Hygiene
- "Never build ad-hoc infrastructure to test against hardware" -- move to a 1-line mention in Before Committing checklist, with detail in `.claude/rules/e2e-testing.md`

**Action:** Relocate the 2 unique items, then delete the section.

---

## Line Budget Summary

| Category | Lines Removed | Sections |
|----------|--------------|----------|
| Domain-scoped (to rules/) | ~467 | 4 (partial), 5, 6, 9, 13, 16, 17, 18, 19, 22, 25, 28, 29 |
| Redundant (deleted) | ~53 | 14, 26, 27 |
| Condensed (trimmed in place) | ~54 | 4 (partial), 12, 20, 23 |
| **Total removed from CLAUDE.md** | **~574** | |
| **Remaining in CLAUDE.md** | **~208** | |

---

## Implementation Sequence

The refactor should be done in phases to avoid breaking the agent's context mid-session:

1. **Create rule files** -- write all 8 `.claude/rules/*.md` files with content copied from CLAUDE.md. Verify path globs match actual repo structure.
2. **Delete redundant sections** -- remove sections 14, 26, 27 (after merging unique items).
3. **Extract domain-scoped sections** -- remove extracted content from CLAUDE.md now that it lives in rule files.
4. **Condense remaining sections** -- trim Nucleation Site Prevention, Contract Enforcement, Development Journal, URL Convention, Project Structure.
5. **Validate** -- run a session and verify that touching an E2E test file loads the e2e-testing rules, touching a .tsx file loads ui-development rules, etc.

Each phase should be a separate commit so any breakage can be bisected.
