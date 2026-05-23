# Project Management Standards

**Purpose:** Unified project management approach using GitHub

---

## Overview

This document establishes project management standards for the audiocontrol monorepo using GitHub as the primary tracking system.

### Core Principles

1. **Weekly milestones are primary**: All issues belong to the weekly milestone for their delivery week
2. **Issues are organized by milestone**: Maintains hierarchy and enables progress tracking
3. **Feature documentation drives implementation**: Every feature has a workplan with GitHub references
4. **Branch naming aligns with features**: Feature slugs match branch names
5. **Labels organize by domain**: Use labels to categorize work by module or type

### Engineering Quality Standards

| Standard | Requirement |
| -------- | ----------- |
| **Code Coverage (Project-Wide)** | Minimum **80%** for lines, functions, branches, and statements across all active modules |

Coverage must be enforced in each module's Vitest configuration and validated via that module's `test:coverage` script.

---

## Feature Design and Planning Workflow

### Workflow Overview

```
1. REQUIREMENTS          2. PLANNING             3. ISSUE CREATION
─────────────────        ───────────────         ──────────────────
Create PRD           →   Create workplan.md  →   Issues added to
document                                         GitHub via CLI
```

### Phase 1: Requirements Definition

1. **Create feature directory:**

   ```
   docs/<version>/<feature-slug>/
   ```

2. **Write PRD document** (`prd.md`) containing:
   - Problem statement
   - User stories / jobs to be done
   - Success criteria and metrics
   - Scope (in/out of scope)
   - Dependencies and constraints
   - Open questions

**Output:** `docs/<version>/<feature-slug>/prd.md`

### Phase 2: Implementation Planning

Once the PRD is approved, create the implementation plan.

1. **Create workplan.md** with technical approach, implementation phases, task breakdown, and target delivery week
2. **Create README.md** with status tracking links
3. **Create implementation-summary.md** (draft template for completion)

**Output:**

```
docs/<version>/<feature-slug>/
├── prd.md                      # From Phase 1
├── README.md                   # Status and tracking
├── workplan.md                 # Implementation plan
└── implementation-summary.md   # Draft for completion
```

### Phase 3: Issue Creation (via GitHub CLI)

1. **Identify or create weekly milestone**
2. **Create parent feature issue** with title `[module] Feature Name`, linking to PRD and workplan
3. **Create implementation issues** referencing the parent
4. **Update workplan.md** with GitHub issue links
5. **Update README.md** with milestone link

```bash
# Find or create weekly milestone
gh milestone list
gh milestone create "Week of Jan 27-31" --due-date 2026-01-31

# Create parent feature issue
gh issue create \
  --title "[sampler-midi] Feature Name" \
  --body "$(cat <<'EOF'
## Overview
Brief description of the feature.

## Documentation
- PRD: [link to prd.md on GitHub]
- Workplan: [link to workplan.md on GitHub]

## Implementation Tasks
- [ ] #NNN Task 1
- [ ] #NNN Task 2
EOF
)" \
  --milestone "Week of Jan 27-31" \
  --label "sampler-midi,enhancement"

# Create implementation issues
gh issue create \
  --title "Add validation logic" \
  --body "Part of #NNN" \
  --milestone "Week of Jan 27-31" \
  --label "sampler-midi"
```

### Task Decomposition Guidelines

| Guideline       | Requirement                                                |
| --------------- | ---------------------------------------------------------- |
| **Granularity** | Each issue = 1-2 days of work maximum                      |
| **Actionable**  | Issue title starts with a verb (Implement, Add, Fix, Update) |
| **Testable**    | Clear acceptance criteria in description                   |
| **Independent** | Minimize dependencies between issues where possible        |
| **Traceable**   | Links back to workplan section and PRD requirement         |

---

## GitHub Project Organization

### Module Labels

| Label                | Module                                      |
| -------------------- | ------------------------------------------- |
| `s330-editor`        | Roland S-330 web editor                     |
| `sampler-midi`       | MIDI SysEx protocol implementations         |
| `sampler-devices`    | Device communication layer                  |
| `sampler-lib`        | Shared sampler data structures              |
| `sampler-backup`     | Sampler backup/restore utilities            |
| `sampler-export`     | Audio export from sampler data              |
| `sampler-translate`  | Cross-format translation                    |
| `ardour-midi-maps`   | Ardour DAW MIDI map generation              |
| `canonical-midi-maps` | DAW-agnostic MIDI mapping format           |
| `launch-control-xl3` | Novation Launch Control XL3 support         |
| `launch-control-xl3-editor` | Launch Control XL3 web editor/prototype |
| `audiotools-cli`     | CLI tooling                                 |
| `docs`               | Documentation                               |

### Type Labels

| Label           | Meaning                |
| --------------- | ---------------------- |
| `bug`           | Bug fix                |
| `enhancement`   | New feature or improvement |
| `documentation` | Documentation change   |
| `refactor`      | Code restructuring     |

### Priority Labels

| Label             | Meaning  |
| ----------------- | -------- |
| `priority:high`   | Critical |
| `priority:medium` | Standard |
| `priority:low`    | Nice to have |

---

## Weekly Milestone Structure

### Milestone Naming Convention

**Format:** `Week of [Mon Date]-[Fri Date]`

**Examples:**

- `Week of Jan 27-31`
- `Week of Feb 3-7`
- `Week of Feb 10-14`

### One Milestone Per Week Rule

There should be exactly one milestone per week that all features for that week attach to.

### Issue Hierarchy Under Milestones

```
Week of Jan 27-31 (milestone)
├── [sampler-midi] SysEx Refactor (#42) - parent feature
│   ├── Extract message parser (#43) - references #42
│   ├── Add integration tests (#44) - references #42
│   └── Update protocol docs (#45) - references #42
├── [s330-editor] Patch Copy (#46) - parent feature
│   └── Implement copy UI (#47) - references #46
└── [docs] Update getting started (#48) - standalone
```

| Level                | What Goes Here                          | Naming Convention                            |
| -------------------- | --------------------------------------- | -------------------------------------------- |
| Milestone            | Weekly delivery target                  | `Week of [Mon Date]-[Fri Date]`              |
| Parent Feature Issue | One per feature, assigned to milestone  | `[module] Feature Name`                      |
| Implementation Issue | Work items, reference parent in body    | Action-focused (e.g., "Add message parser")  |

---

## Feature Documentation Standards

### Directory Structure

```
docs/
└── <version>/
    └── <feature-slug>/
        ├── prd.md                     # Product requirements
        ├── README.md                  # Status + tracking links
        ├── workplan.md                # Implementation plan + GitHub refs
        └── implementation-summary.md  # Post-completion report
```

### Feature Slug Requirements

| Rule              | Example                |
| ----------------- | ---------------------- |
| 2-4 words maximum | `sysex-refactor`       |
| Lowercase only    | `patch-copy`           |
| Hyphen-separated  | `tone-export`          |

### Workplan Reminder — Primitive Extraction Updates the Regime-Holdout Registries

When a phase or task in `workplan.md` EXTRACTS or PROMOTES a primitive (component, hook, util) to a shared location, the same commit (or its sibling) should append entries to the scope-discovery regime-holdout registries:

- `docs/scope-discovery/anti-patterns.yaml` — fingerprint the legacy shape the primitive replaces so reimplementations are flagged by the pre-commit gate.
- `docs/scope-discovery/adopter-manifests.yaml` — declare the expected adopter glob so non-adopters are flagged by the pre-commit gate.
- Regenerate `docs/scope-discovery/editor-symmetry.md` (`make check-editor-symmetry-write`) when the manifest targets `modules/*-editor/`.

See [`docs/scope-discovery/README.md`](./docs/scope-discovery/README.md) §"Regime-holdout discovery" for the conceptual model and [`docs/scope-discovery/LAYOUT.md`](./docs/scope-discovery/LAYOUT.md) §"Phase 6 regime-holdout artifacts" for the per-artifact schemas.

---

## Branch and Workplan Requirements

> **See also:** [BRANCHING-AND-RELEASES.md](./BRANCHING-AND-RELEASES.md) for the full branching model, deployment workflow, and versioning scheme.

### Feature Branch Naming

**Format:** `feature/<feature-slug>`

Branch names must match the feature slug in documentation.

### Workplan Requirements

Every feature workplan.md must include:

1. **GitHub tracking section** (at top) with milestone and issue links
2. **Implementation phases** with issue references
3. **Success criteria** per phase
4. **Dependencies** (if any)

### Linking Code to Issues

Each GitHub issue description must include GitHub links to feature documentation (PRD, workplan). Use GitHub URLs, not file paths — GitHub links are portable and accessible without a local clone.

### Deploy Branch Naming

Deploy branches trigger Netlify deployments. Use the full editor module name.

**Format:** `deploy/<module-name>`

| Branch | Deploys |
| ------ | ------- |
| `deploy/s330-editor` | S-330 editor to Netlify |
| `deploy/d110-editor` | D-110 editor to Netlify |
| `deploy/jv1080-editor` | JV-1080 editor to Netlify |

To deploy the latest main:

```bash
git fetch origin main
git push origin origin/main:refs/heads/deploy/<module-name> --force
```

---

## Git Worktree Structure

### Directory Layout

**Format:** `~/work/audiocontrol-work/audiocontrol-<feature-slug>`

```
~/work/audiocontrol-work/
├── audiocontrol/                         # Main clone (main branch)
├── audiocontrol-sysex-refactor/          # feature/sysex-refactor
├── audiocontrol-patch-copy/              # feature/patch-copy
└── audiocontrol-tone-export/             # feature/tone-export
```

### Managing Worktrees

```bash
# Create a worktree for a feature
cd ~/work/audiocontrol-work/audiocontrol
git worktree add ~/work/audiocontrol-work/audiocontrol-<feature-slug> -b feature/<feature-slug>

# List all worktrees
git worktree list

# Remove after merge
git worktree remove ~/work/audiocontrol-work/audiocontrol-<feature-slug>
git worktree prune
```

---

## Issue Naming Conventions

### Issue Title Format

**Parent issues:** `[module] Feature Name`
**Implementation issues:** Action-focused (e.g., "Add database schema")

| Issue Title                                    | Why It Works                      |
| ---------------------------------------------- | --------------------------------- |
| `[sampler-midi] SysEx Message Refactor`        | Clear module and feature          |
| `[s330-editor] Patch Copy/Swap`                | Immediately identifies scope      |
| `Extract message parser from protocol handler` | Specific action for impl issue    |

---

## Status Tracking

### Status Labels

| Label                | Meaning               |
| -------------------- | --------------------- |
| `status:planning`    | Not yet started       |
| `status:in-progress` | Active work           |
| `status:blocked`     | Waiting on dependency |
| `status:review`      | Ready for review      |

### Milestone Completion Checklist

When a weekly milestone completes:

1. Verify all issues are closed or moved to next milestone
2. Update feature README.md status
3. Fill in implementation-summary.md
4. Update milestone description with summary
5. Close the GitHub milestone
6. Remove feature worktrees for completed/merged features
7. Prune stale worktree references

---

## Validation Checklist

### Requirements Phase

- [ ] Feature slug chosen (2-4 words, lowercase, hyphen-separated)
- [ ] Feature directory created
- [ ] PRD created with all required sections
- [ ] PRD reviewed and approved

### Planning Phase

- [ ] workplan.md created with implementation phases
- [ ] Target delivery week identified
- [ ] Module labels determined
- [ ] Worktree created
- [ ] Feature branch created

### Issue Creation Phase

- [ ] Weekly milestone exists or created
- [ ] Parent feature issue created with GitHub links to PRD and workplan
- [ ] Implementation issues created referencing parent
- [ ] Issues assigned to milestone with appropriate labels
- [ ] workplan.md updated with GitHub issue links

---

## Roadmap Queue Management

The roadmap queue is the source of truth for what to work on next.

### Finding the Queue

**Location:** `audiocontrol-docs-roadmap/docs/1.0/ROADMAP.md`

The ROADMAP.md contains:
- **What's Next** — Full queue organized by readiness
- **Feature Index** — All features by state directory

### Using the Queue

The "What's Next" section has three categories:

| Category | Meaning |
|----------|---------|
| **Ready to Work (Parallel)** | No blockers, can be started immediately |
| **Serial Dependencies** | Must wait for another feature to complete |
| **Blocked** | Cannot proceed until blocker resolved |

### Picking Work

1. Check "Ready to Work (Parallel)" first
2. Pick any feature from this list — they're independent
3. If all parallel work is claimed, check "Serial Dependencies" for newly unblocked items

### Completing Work

When a feature is complete:

1. Move feature directory from `001-IN-PROGRESS/` to `003-COMPLETE/`
2. Update ROADMAP.md:
   - Move row from "Ready to Work" to Feature Index under "003-COMPLETE"
   - Check "Serial Dependencies" — move newly unblocked items to "Ready to Work"
3. Update implementation-summary.md with completion details
4. Commit: `docs: complete <feature-slug>`

### Blocking Work

If work becomes blocked:

1. Move feature directory to `002-BLOCKED/`
2. Update ROADMAP.md "Blocked" table with blocker description
3. Document blocker in feature's README.md
