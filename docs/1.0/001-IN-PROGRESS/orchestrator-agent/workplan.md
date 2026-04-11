# Orchestrator Agents — Workplan

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-04-11

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Parent Issue** | [#208 — Orchestrator agent and supporting skills](https://github.com/audiocontrol-org/audiocontrol/issues/208) |

### Implementation Issues

| Phase | Issue | Description |
|-------|-------|-------------|
| Phase 1 | [#209](https://github.com/audiocontrol-org/audiocontrol/issues/209) | Rewrite project-orchestrator agent definition |
| Phase 2 (feature-setup) | [#210](https://github.com/audiocontrol-org/audiocontrol/issues/210) | Create feature-setup skill |
| Phase 2 (feature-issues) | [#211](https://github.com/audiocontrol-org/audiocontrol/issues/211) | Create feature-issues skill |
| Phase 2 (feature-complete) | — | Create feature-complete skill |
| Phase 2 (feature-teardown) | — | Create feature-teardown skill |
| Phase 3 | [#213](https://github.com/audiocontrol-org/audiocontrol/issues/213) | Create feature-orchestrator agent definition |
| Phase 4 | [#212](https://github.com/audiocontrol-org/audiocontrol/issues/212) | Update project.yaml orchestrator entries |

---

## Phase 1: Rewrite Project-Orchestrator Agent Definition

Replace the generic boilerplate in `.claude/agents/orchestrator.md` with a project-specific project-orchestrator that encodes the actual audiocontrol planning and delegation workflow. The output file is `.claude/agents/project-orchestrator.md`.

### Task 1.1: Define project-orchestrator role and boundaries

Write the core identity section: the project-orchestrator plans, investigates, and delegates. It does NOT implement code changes. It operates on `main` and hands off to implementation teams.

**Files:**
- Create: `.claude/agents/project-orchestrator.md`

**Acceptance Criteria:**
- [ ] Role boundary is explicit: project-orchestrator plans and delegates, never implements code
- [ ] References PROJECT-MANAGEMENT.md workflow: PRD -> workplan -> GitHub issues -> implementation -> implementation-summary
- [ ] Lists available delegation targets: documentation-engineer, Explore agent, hardware-protocol-engineer
- [ ] Operates on `main` branch — never in feature worktrees
- [ ] Session ends when feature infrastructure is ready for the feature-orchestrator

### Task 1.2: Add investigation capabilities

Document the project-orchestrator's investigation toolkit: reading code, session transcripts, git history, DEVELOPMENT-NOTES.md.

**Files:**
- Modify: `.claude/agents/project-orchestrator.md`

**Acceptance Criteria:**
- [ ] Session transcript forensics documented: `age -d -i ~/.config/age/audiocontrol.key` for decryption
- [ ] Git history investigation: `git log`, `git diff`, blame
- [ ] Codebase research via Explore agent delegation
- [ ] DEVELOPMENT-NOTES.md and workplan reading for context

### Task 1.3: Add feature lifecycle workflow

Encode the step-by-step workflow for planning and setting up a new feature.

**Files:**
- Modify: `.claude/agents/project-orchestrator.md`

**Acceptance Criteria:**
- [ ] Feature setup steps: branch, worktree, docs directory, PRD, workplan, README
- [ ] References feature-setup and feature-issues skills
- [ ] Naming conventions match PROJECT-MANAGEMENT.md (feature slugs, branch names, worktree paths)
- [ ] Worktree path: `~/work/audiocontrol-work/audiocontrol-<slug>`
- [ ] Branch name: `feature/<slug>`
- [ ] Docs path: `docs/<version>/001-IN-PROGRESS/<slug>/`

### Task 1.4: Add GitHub issue creation workflow

Document how the project-orchestrator creates issues from workplans.

**Files:**
- Modify: `.claude/agents/project-orchestrator.md`

**Acceptance Criteria:**
- [ ] Parent issue format: `[module] Feature Name` with links to PRD and workplan on GitHub
- [ ] Implementation issue format: action-focused titles, `Part of #NNN` reference, acceptance criteria
- [ ] GitHub links use format: `https://github.com/audiocontrol-org/audiocontrol/blob/<branch>/path/to/file`
- [ ] Workplan update step: backfill issue numbers after creation

### Task 1.5: Add delegation patterns

Document when and how to delegate to specific agents.

**Files:**
- Modify: `.claude/agents/project-orchestrator.md`

**Acceptance Criteria:**
- [ ] Delegation table: task type -> agent mapping
- [ ] Context requirements for each delegation (what to include so sub-agents have full context)
- [ ] Anti-pattern: project-orchestrator must not implement code changes itself
- [ ] Handoff point to feature-orchestrator is clearly defined

**Phase 1 Status:** Not started

---

## Phase 2: Create Project-Orchestrator Skills

Create the four project-orchestrator skills that automate feature lifecycle operations. Each skill lives in its own directory under `.claude/skills/` with a `SKILL.md` file containing YAML frontmatter.

### Task 2.1: Create feature-setup skill

Create `.claude/skills/feature-setup/SKILL.md` that automates the infrastructure setup for a new feature.

**Files:**
- Create: `.claude/skills/feature-setup/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Skill accepts feature slug from context (worktree name, branch name, or user input)
- [ ] Creates branch: `git worktree add ~/work/audiocontrol-work/audiocontrol-<slug> -b feature/<slug>`
- [ ] Creates docs directory: `docs/1.0/001-IN-PROGRESS/<slug>/`
- [ ] Delegates doc creation (prd.md, workplan.md, README.md) to documentation-engineer agent
- [ ] Reports what was created

### Task 2.2: Create feature-issues skill

Create `.claude/skills/feature-issues/SKILL.md` that creates GitHub issues from a completed workplan.

**Files:**
- Create: `.claude/skills/feature-issues/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Reads workplan.md to extract phases and tasks
- [ ] Reads prd.md for the problem statement (used in parent issue description)
- [ ] Creates parent feature issue via `gh issue create` with GitHub links to PRD and workplan
- [ ] Creates implementation issues referencing the parent (`Part of #NNN`)
- [ ] Updates workplan.md GitHub Tracking section with created issue numbers and links
- [ ] Reports all created issues with URLs

### Task 2.3: Create feature-complete skill

Create `.claude/skills/feature-complete/SKILL.md` that marks a feature as complete by moving docs, updating the roadmap, and closing issues.

**Files:**
- Create: `.claude/skills/feature-complete/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Moves feature docs from `docs/<version>/001-IN-PROGRESS/<slug>/` to `docs/<version>/003-COMPLETE/<slug>/`
- [ ] Updates ROADMAP.md: moves feature from "Ready to Work" (or current section) to "003-COMPLETE" in Feature Index, checks if anything is unblocked
- [ ] Closes related GitHub issues and milestone
- [ ] Reports what was updated

### Task 2.4: Create feature-teardown skill

Create `.claude/skills/feature-teardown/SKILL.md` that removes local feature infrastructure (worktree, branch) without implying anything about feature status.

**Files:**
- Create: `.claude/skills/feature-teardown/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Removes worktree: `git worktree remove ~/work/audiocontrol-work/audiocontrol-<slug>`
- [ ] Deletes local branch: `git branch -d feature/<slug>`
- [ ] Prunes stale references: `git worktree prune`
- [ ] Infrastructure-only — no opinion on feature status (might teardown because merged, freeing disk, or abandoning approach)
- [ ] Reports what was removed

**Phase 2 Status:** Not started

---

## Phase 3: Create Feature-Orchestrator Agent Definition

Create `.claude/agents/feature-orchestrator.md` — the agent that picks up where the project-orchestrator leaves off and drives implementation to completion via sub-agent delegation.

> This phase defines the agent definition and all feature-orchestrator skills: the core loop (`feature-implement`) plus the lifecycle skills (`feature-pickup`, `feature-review`, `feature-ship`).

### Task 3.1: Define feature-orchestrator role and boundaries

Write the core identity section: the feature-orchestrator operates in feature worktrees, reads workplans and GitHub issues created by the project-orchestrator, and deploys sub-agents to implement code. It does NOT write code directly.

**Files:**
- Create: `.claude/agents/feature-orchestrator.md`

**Acceptance Criteria:**
- [ ] Role boundary is explicit: feature-orchestrator delegates implementation, never writes code directly
- [ ] Operates in feature worktrees (`audiocontrol-<slug>`), not on `main`
- [ ] Reads workplan + GitHub issues created by project-orchestrator as its input
- [ ] Deploys sub-agents for implementation: typescript-pro, ui-engineer, hardware-protocol-engineer, code-reviewer, etc.
- [ ] Reviews sub-agent output, manages phase transitions within the feature
- [ ] Tools: Read, Bash, Agent (all implementation agents) — no direct Edit/Write on code files
- [ ] Session ends when feature is implemented and PR-ready

### Task 3.2: Add implementation workflow

Document how the feature-orchestrator picks up a feature and drives it to completion.

**Files:**
- Modify: `.claude/agents/feature-orchestrator.md`

**Acceptance Criteria:**
- [ ] How to pick up a feature from the project-orchestrator's output (read workplan, check issue status)
- [ ] How to break workplan phases into agent delegations
- [ ] How to review agent output before accepting (code-reviewer delegation, test execution)
- [ ] How to update workplan progress and close issues as phases complete
- [ ] How to handle partial completion and session resumption

### Task 3.3: Add delegation patterns for implementation agents

Document which agent to use for which task, what context to provide, and how to handle failures.

**Files:**
- Modify: `.claude/agents/feature-orchestrator.md`

**Acceptance Criteria:**
- [ ] Delegation table: task type -> agent mapping (typescript-pro for logic, ui-engineer for UI, hardware-protocol-engineer for device/protocol, code-reviewer for review)
- [ ] Context requirements for each agent (file paths, acceptance criteria, relevant interfaces, test expectations)
- [ ] How to handle agent failures or poor output (re-delegate with more context, break into smaller tasks, escalate to user)
- [ ] Anti-pattern: feature-orchestrator must not write code itself, even for "small fixes"

### Task 3.4: Create feature-implement skill

Create `.claude/skills/feature-implement/SKILL.md` — the core operational skill that codifies the feature-orchestrator's main loop: select next task, choose delegate, dispatch, review, update progress.

**Files:**
- Create: `.claude/skills/feature-implement/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Reads workplan to identify next uncompleted phase/task
- [ ] Reads task's acceptance criteria and determines relevant code context (file paths, interfaces)
- [ ] Selects appropriate agent based on task type (typescript-pro for logic, ui-engineer for UI, hardware-protocol-engineer for device/protocol)
- [ ] Delegates with full context: file paths, acceptance criteria, relevant interfaces, test expectations
- [ ] Reviews output: runs tests, optionally delegates to code-reviewer
- [ ] Updates workplan progress (checks off completed criteria), closes GitHub issue if task is complete
- [ ] Reports what was accomplished and what's next

### Task 3.5: Create feature-pickup skill

Create `.claude/skills/feature-pickup/SKILL.md` — bootstraps a feature-orchestrator session by reading the workplan, checking issue status, and reporting current state and next steps.

**Files:**
- Create: `.claude/skills/feature-pickup/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Identifies feature from worktree name and branch
- [ ] Reads workplan.md — determines current phase, completed tasks, next tasks
- [ ] Checks GitHub issue status: `gh issue list` for open issues related to this feature
- [ ] Reads DEVELOPMENT-NOTES.md for last session context
- [ ] Reports to user: feature status, next task, proposed approach
- [ ] Does NOT start implementation — waits for user confirmation

### Task 3.6: Create feature-review skill

Create `.claude/skills/feature-review/SKILL.md` — delegates code review of recent changes to the code-reviewer agent and reports findings.

**Files:**
- Create: `.claude/skills/feature-review/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Determines what to review: uncommitted changes (`git diff`), or recent commits since branch point (`git log main..<branch>`)
- [ ] Delegates to code-reviewer agent with: changed file paths, project guidelines (CLAUDE.md), specific concerns if any
- [ ] Optionally delegates to codebase-auditor for guideline compliance check
- [ ] Reports findings: issues found, severity, recommendations
- [ ] Does NOT fix issues itself — reports them for the feature-orchestrator to delegate fixes

### Task 3.7: Create feature-ship skill

Create `.claude/skills/feature-ship/SKILL.md` — prepares a feature for PR creation: final review, test run, PR creation, and progress update.

**Files:**
- Create: `.claude/skills/feature-ship/SKILL.md`

**Acceptance Criteria:**
- [ ] YAML frontmatter with name, description, user_invocable: true
- [ ] Verifies all workplan acceptance criteria are checked off
- [ ] Runs full test suite for affected modules: `pnpm --filter <module> test`
- [ ] Delegates final code review via `/feature-review`
- [ ] Creates PR via `gh pr create` with summary from workplan, test plan from acceptance criteria
- [ ] Updates workplan status and README.md
- [ ] Reports: PR URL, any remaining issues, next steps (merge, feature-complete, feature-teardown)

**Phase 3 Status:** Not started

---

## Phase 4: Update project.yaml

Update the orchestrator entries in `.claude/project.yaml` to reflect both orchestrator roles.

### Task 4.1: Update project.yaml with both orchestrator entries

**Files:**
- Modify: `.claude/project.yaml`

**Acceptance Criteria:**
- [ ] Project-orchestrator entry: role description reflects planning, investigation, feature setup, and delegation
- [ ] Feature-orchestrator entry: role description reflects implementation delegation, phase management, and PR delivery
- [ ] Focus areas list for project-orchestrator: feature planning, workplan creation, GitHub issue management, agent delegation
- [ ] Focus areas list for feature-orchestrator: implementation delegation, sub-agent coordination, workplan progress, issue closure
- [ ] Neither entry says just "Workflow Coordinator"

**Phase 4 Status:** Not started

---

## Dependency Graph

```
Phase 1 (project-orchestrator rewrite) — no deps, highest leverage
  1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5

Phase 2 (project-orchestrator skills) — benefits from Phase 1
  2.1, 2.2, 2.3, 2.4 (all independent of each other)

Phase 3 (feature-orchestrator definition + all skills) — independent of Phases 1-2, can run in parallel with Phase 1
  3.1 -> 3.2 -> 3.3 -> 3.4
  3.5, 3.6, 3.7 (independent of each other, depend on 3.1)

Phase 4 (project.yaml) — depends on Phase 1 and Phase 3
  4.1
```

Phases 1 and 3 can be worked in parallel (different files, different roles).
Phase 2 tasks are all independent of each other and can be worked in parallel.
Phase 4 should be done last since it references both orchestrator definitions.
