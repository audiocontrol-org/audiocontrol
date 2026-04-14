---
name: feature-define
description: Interview the user to define a feature, then write a single feature definition file that downstream setup steps can consume.
---

# Feature Define

Use this when a feature is not yet structured.

## Goals

- clarify the problem
- define success criteria
- set scope boundaries
- outline a practical implementation breakdown

## Workflow

1. Gather:
   - problem statement
   - proposed slug
   - acceptance criteria
   - out-of-scope items
2. Propose a technical approach:
   - affected modules
   - dependencies
   - open questions
3. Propose implementation phases and task groupings.
4. Write `/tmp/feature-definition-<slug>.md`.
5. Tell the user the next step is `feature-setup`.

Keep the interview lean. Reuse answers the user already gave instead of re-asking them.
