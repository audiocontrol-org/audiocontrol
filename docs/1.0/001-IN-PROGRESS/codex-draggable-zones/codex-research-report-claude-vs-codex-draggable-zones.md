# Codex Research Report: Claude vs Codex on Draggable Zones

**Researcher:** Codex  
**Author:** Codex  
**Date:** 2026-04-13  
**Scope:** Compare the parallel Claude Code and Codex implementations of GitHub issue [#252](https://github.com/audiocontrol-org/audiocontrol/issues/252), including both shipped code and the local session transcripts that produced them.

## Purpose

This report is intended to support two follow-on decisions:

1. how audiocontrol should structure future feature-development sessions with AI agents
2. how to frame a public retrospective for audiocontrol.org about the experience of running two parallel implementations of the same feature

The comparison covers:

- implementation scope and code shape
- verification quality
- feature-documentation discipline
- user-agent interaction patterns
- practical lessons for future work

## Compared Artifacts

### Claude implementation

- Branch: `feature/draggable-zones`
- Worktree: `/Users/orion/work/audiocontrol-work/audiocontrol-draggable-zones`
- Primary transcript: `/Users/orion/.claude/projects/-Users-orion-work-audiocontrol-work-audiocontrol-draggable-zones/5bd0b7a6-3bef-426e-8a82-6e9bc50f9038.jsonl`

### Codex implementation

- Branch: `feature/codex-draggable-zones`
- Worktree: `/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones`
- Primary transcript set:
  - `/Users/orion/.codex/sessions/2026/04/13/rollout-2026-04-13T11-18-44-019d8811-3d70-77f2-9852-bc226eca1383.jsonl`
  - `/Users/orion/.codex/sessions/2026/04/13/rollout-2026-04-13T11-23-30-019d8815-9976-73c2-8e3a-c0ca45d79c1f.jsonl`
  - `/Users/orion/.codex/sessions/2026/04/13/rollout-2026-04-13T11-27-24-019d8819-2b35-7011-aaed-3673f321fab3.jsonl`
  - `/Users/orion/.codex/sessions/2026/04/13/rollout-2026-04-13T11-47-06-019d882b-35fa-77c2-92d1-f7ce57c55e26.jsonl`

## Executive Summary

Both agents produced credible implementations of the same feature request, and both passed the local Akai editor unit suite at audit time. The differences were less about raw competence and more about where each approach spent scope and where the user had to intervene.

Claude produced the broader implementation. It expanded beyond the literal issue scope into a larger UI testing architecture, explicit zoom controls, and a more decomposed component/hook structure. That gave the branch a stronger “productized testing story” and more reusable UI scaffolding, but it also widened the scope considerably.

Codex produced the narrower implementation. It stayed closer to the core draggable-zones feature, added explicit note and velocity constraint helpers, and built a browser-only harness plus targeted tests. That kept the branch more issue-shaped, but the user had to spend more effort correcting repo/process failures around worktrees, branch ownership, and follow-through.

The most important conclusion is this: the biggest differentiator was not “which agent wrote better code.” It was “what kind of user supervision each agent demanded.” Claude needed steering on method and scope. Codex needed heavier correction on operational discipline and execution follow-through.

## High-Level Outcome Comparison

| Dimension | Claude | Codex |
|-----------|--------|-------|
| Feature breadth | Broader than issue scope | Closer to issue scope |
| Architectural extraction | Higher | Moderate |
| Explicit constraint handling | Weaker on S3000XL min-note discipline | Stronger |
| Testing story | Stronger and broader | Focused and pragmatic |
| Documentation discipline | Weaker implementation-summary upkeep | Stronger feature-summary upkeep |
| Process burden on user | Method/scope corrections | Worktree/process corrections |
| Branch hygiene during work | Better | Worse initially, later repaired |

## Implementation Footprint

### Claude branch

- 10 feature commits on top of the shared base
- 22 Akai editor files changed
- broader changeset including:
  - `ZoneOverviewToolbar.tsx`
  - `ZoneOverviewZone.tsx`
  - `use-zone-drag.ts`
  - `use-zone-overview-drags.ts`
  - `TestKeygroupsPage.tsx`
  - Playwright harness config and scripts
  - `TESTING.md`, `TESTING-UI.md`, `TESTING-E2E.md`, `TESTING-UNIT.md`

### Codex branch

- 6 feature commits on top of the shared base
- 18 Akai editor files changed
- more focused changeset including:
  - `note-coordinate.ts`
  - `zone-constraints.ts`
  - `keygroup-creation.ts`
  - `DraggableZonesHarnessPage.tsx`
  - `draggable-zone-fixtures.ts`
  - `library-draggable-zones-harness.spec.ts`
  - `TESTING-UI-CODEX.md`

## Code Review Findings

### Finding 1: Both branches miss the “create the first keygroup” case

This is the most important shared product gap.

In both implementations, `ZoneOverview` returns a non-interactive placeholder when `keygroupCount === 0`. That means drag-to-create cannot create the first keygroup in an empty program, even though issue `#252` Phase 4 describes dragging in empty space to create keygroups.

References:

- [Claude `ZoneOverview.tsx`](/Users/orion/work/audiocontrol-work/audiocontrol-draggable-zones/modules/akai-s3k-editor/src/components/keygroups/ZoneOverview.tsx:131)
- [Codex `ZoneOverview.tsx`](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/src/components/keygroups/ZoneOverview.tsx:132)

Impact:

- The feature works for adding zones into already-populated programs.
- It does not fully satisfy the empty-state creation story implied by the issue.

### Finding 2: Claude allows translated zones below the documented S3000XL floor

The Claude branch’s zone translation logic clamps translated note ranges to `0..127`, not the S3000XL keygroup note floor of `21..127`.

Reference:

- [Claude `use-zone-overview-drags.ts`](/Users/orion/work/audiocontrol-work/audiocontrol-draggable-zones/modules/akai-s3k-editor/src/components/keygroups/use-zone-overview-drags.ts:152)

By contrast, the Codex branch explicitly encoded the lower bound:

- [Codex `zone-constraints.ts`](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/src/components/keygroups/zone-constraints.ts:3)

Impact:

- Claude’s translation behavior is potentially out of bounds relative to the device model.
- Codex’s implementation is stronger on constraint fidelity.

### Finding 3: Claude’s implementation summary is stale

The Claude feature’s implementation summary still says “Not Started,” which weakens session pickup and post-implementation traceability.

Reference:

- [Claude `implementation-summary.md`](/Users/orion/work/audiocontrol-work/audiocontrol-draggable-zones/docs/1.0/001-IN-PROGRESS/draggable-zones/implementation-summary.md:1)

The Codex implementation summary is materially more complete:

- [Codex `implementation-summary.md`](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/docs/1.0/001-IN-PROGRESS/codex-draggable-zones/implementation-summary.md:1)

Impact:

- Claude’s code is not invalidated by this, but the feature is less auditable from its docs alone.

## Verification Comparison

### Claude verification

At audit time:

- `pnpm --filter @audiocontrol/akai-s3k-editor test` passed
- 15 test files passed
- 135 tests passed
- same pre-existing `ComparePane` `act(...)` warnings seen in Codex

Strengths:

- larger formal UI test architecture
- explicit category thinking around unit/ui/e2e
- more substantial test-infrastructure investment

Tradeoff:

- some of that test architecture goes beyond the immediate feature request

### Codex verification

At audit time:

- `pnpm --filter @audiocontrol/akai-s3k-editor test` passed
- 16 test files passed
- 114 tests passed
- same pre-existing `ComparePane` `act(...)` warnings seen in Claude

Strengths:

- focused harness-based verification
- explicit documentation of what was verified and how
- stronger tie between constraints and tests

Tradeoff:

- narrower testing architecture
- less ambitious than Claude on overall test-system evolution

## Interaction Comparison

### Claude interaction pattern

The Claude transcript shows a feature session that became productive after repeated user steering on development method:

- the user had to push delegation explicitly: “are you delegating?”
- the user rejected premature testing proposals and required research first
- the user pushed the agent toward reusable test specs instead of ad hoc screenshots
- the user pushed for explicit `test/unit`, `test/ui`, `test/e2e` structure
- the user corrected an incomplete real-app integration after the harness existed

This produced a strong result, but it took repeated supervision to turn the session into a disciplined orchestrator workflow.

### Codex interaction pattern

The Codex transcripts show a different weakness profile:

- worktree/branch ownership mistakes
- wrong assumptions about where feature docs existed
- repair attempts that initially chose manual recreation over git-native transfer
- repeated advisory answers where execution should have happened automatically
- a prolonged corrective thread before the repo/worktree state was repaired

The code result was solid, but the user had to pay a large “operational discipline tax” to get there.

### Overall interaction conclusion

Claude consumed more user effort on *how to develop the feature*.  
Codex consumed more user effort on *how to behave correctly in the repo and workflow*.

That distinction matters for future planning:

- if the problem is ambiguous product work with substantial testing-method discovery, Claude’s orchestrator style may be advantageous
- if the problem is bounded implementation work, Codex can be effective, but only with stronger process guardrails than the default session originally had

## What Each Agent Did Better

### Claude was stronger at

- decomposing the UI into smaller dedicated pieces
- building a broader testing architecture around the feature
- turning the work into a larger reusable pattern
- using delegation heavily once corrected into that mode

### Codex was stronger at

- staying closer to the issue-shaped feature request
- writing explicit device-aligned constraints
- documenting the implementation summary more concretely
- building a focused harness without as much surrounding scope expansion

## What Each Agent Did Worse

### Claude was weaker at

- respecting the strict documented device range in translated note movement
- keeping the implementation summary current
- resisting scope expansion once testing architecture became part of the conversation

### Codex was weaker at

- worktree and branch discipline
- reliable follow-through without repeated prompting
- choosing git-native repair mechanisms quickly enough
- avoiding user time sinks created by preventable operational errors

## Recommendations For Future AI Feature Development

### 1. Keep explicit worktree verification as a hard gate

Codex’s process failure was serious enough that the new `tools/verify-feature-context.ts` guard should remain part of the workflow.

### 2. Separate “feature scope” from “tooling uplift”

Claude’s branch shows the value of better testing infrastructure, but it also shows how easily a bounded issue turns into a larger architecture effort. Future sessions should explicitly decide whether test infrastructure is in scope or not.

### 3. Require doc completion as part of done

The stale Claude implementation summary and the earlier Codex worktree-doc failure are different symptoms of the same truth: AI feature work needs a stricter definition of done that includes doc state.

### 4. Prefer git-native repairs, always

When branch/worktree placement is wrong, the default should be commit/cherry-pick/merge, not manual recreation.

### 5. Preserve two workflows

The experiment suggests audiocontrol should keep two patterns available:

- **orchestrated expansion mode** for larger, test-heavy, exploratory features
- **tight issue-execution mode** for bounded implementation work

## Recommended Blog Thesis

The most credible public takeaway is not “which model won.”

A better thesis is:

> Running two AI agents on the same feature exposed a more useful distinction than raw coding quality: different agents fail in different places. One needed more product-method steering. The other needed stronger operational guardrails. The lesson was not just about models; it was about designing a development process that makes AI mistakes cheaper and easier to catch.

## Suggested Next Internal Steps

1. Fix the shared empty-program creation gap in both branches.
2. Fix Claude’s note-floor translation constraint.
3. Keep the Codex worktree guardrails on `main`.
4. Decide whether the broader Claude testing architecture should be adopted independently of the feature branch.
5. Use this comparison format again on future parallel experiments, but add a standardized metrics script up front so transcript comparison is less manual.
