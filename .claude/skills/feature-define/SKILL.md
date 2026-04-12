---
name: feature-define
description: "Interview the user to define a new feature: problem, scope, approach, and tasks. Writes a feature-definition.md file that /feature-setup consumes."
user_invocable: true
---

# Feature Define

Interactive interview to define a new feature before creating infrastructure. Produces a structured definition file that `/feature-setup` consumes.

**Do NOT create branches, worktrees, or docs directories.** This skill only interviews and writes the definition file.

## Interview Process

Use AskUserQuestion for structured choices. Use follow-up text questions when open-ended input is needed. Keep the interview conversational — skip questions the user has already answered.

### Step 1: Feature Identity

Ask the user:
- **What problem does this feature solve?** — One or two sentences. What's broken, missing, or painful today?
- **Feature slug** — Suggest one based on the problem description (2-4 words, lowercase, hyphen-separated). Let the user override.

### Step 2: Scope

Ask the user:
- **What does "done" look like?** — Concrete acceptance criteria. What can the user do when this ships that they can't do today?
- **What's explicitly out of scope?** — What adjacent work should NOT be part of this feature?

### Step 3: Approach

Based on the problem and scope, propose a technical approach:
- Which modules are affected?
- What's the general implementation strategy?
- Are there dependencies on other features or external systems?
- Are there open questions that need investigation before implementation?

Present the approach and ask the user to confirm, adjust, or redirect. Do NOT over-engineer — keep the approach as simple as possible.

### Step 4: Task Breakdown

Propose implementation phases and tasks:
- Each phase should have a clear deliverable
- Each task should be 1-2 days of work maximum
- Tasks start with a verb (Implement, Add, Fix, Update, Create)
- Include acceptance criteria per phase

Present the breakdown and ask the user to confirm, adjust, or redirect.

### Step 5: Write Definition File

Write the complete definition to `/tmp/feature-definition-<slug>.md` using the Write tool:

```markdown
# Feature Definition: <slug>

## Problem Statement
[From Step 1]

## Feature Slug
<slug>

## Acceptance Criteria
[From Step 2 — what "done" looks like]

## Out of Scope
[From Step 2]

## Technical Approach

### Modules Affected
- [module list]

### Strategy
[From Step 3]

### Dependencies
[From Step 3, or "None"]

### Open Questions
[From Step 3, or "None"]

## Implementation Phases

### Phase 1: [Title]
**Deliverable:** [what ships at end of this phase]

Tasks:
- [ ] [Task 1]
- [ ] [Task 2]

**Acceptance Criteria:**
- [criterion]

### Phase 2: [Title]
...

## Labels
[Suggested GitHub labels based on modules affected]
```

### Step 6: Report and Hand Off

Tell the user:
- Summary of what was defined
- Path to the definition file
- Next step: run `/feature-setup <slug>` to create infrastructure and docs from this definition

## Resuming a Partial Definition

If `/tmp/feature-definition-<slug>.md` already exists, read it and ask the user if they want to continue refining it or start fresh.

## Guidelines

- Keep the interview lean — 4-6 questions total, not 20
- If the user describes the feature upfront, extract answers from their description instead of re-asking
- Propose concrete suggestions rather than open-ended questions where possible
- The definition file is the single artifact — everything else flows from it
