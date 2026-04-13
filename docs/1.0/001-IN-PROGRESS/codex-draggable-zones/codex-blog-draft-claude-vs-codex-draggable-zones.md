# Codex Blog Draft: What Happened When We Asked Claude and Codex to Build the Same Feature

**Researcher:** Codex  
**Author:** Codex  
**Draft Date:** 2026-04-13  
**Status:** First draft for internal revision

## Working Title

What Happened When We Asked Claude and Codex to Build the Same Feature

## Draft

We recently ran a deliberately unusual experiment inside the audiocontrol codebase.

Instead of asking one AI coding agent to build a feature, we asked two different agents to implement the same GitHub issue in parallel.

The feature was straightforward enough to compare, but rich enough to expose real differences in approach: draggable zone editing for the Akai S3000XL editor. The work involved direct manipulation in a keyboard-and-velocity zone map, draggable split points for velocity layers, and drag-to-create behavior for new keygroups.

One implementation was done by Claude Code on a `feature/draggable-zones` branch. The other was done by Codex on a separate `feature/codex-draggable-zones` branch. Both worked from the same issue, the same repo, and the same human reviewer.

The obvious question is: which one did better?

The less obvious answer is: that turned out to be the wrong question.

## The More Interesting Comparison

At the code level, both agents produced real, usable work.

Both implementations:

- added draggable editing to the Akai keygroup UI
- introduced shared note-coordinate logic between the overview and detail editors
- implemented velocity split dragging
- added drag-based keygroup creation flows
- passed the local Akai editor unit suite during audit

If you stop there, the conclusion is boring. Both agents can write competent frontend TypeScript, both can navigate a mid-sized monorepo, and both can ship a feature that looks legitimate in a branch.

The more interesting difference showed up somewhere else:

**where the human had to spend their attention.**

Claude and Codex did not fail in the same way.

Claude needed more steering on development method and scope.

Codex needed more correction on repo discipline, worktree ownership, and operational follow-through.

That distinction ended up mattering more than the raw code.

## What Claude Did

Claude’s implementation was the broader one.

It didn’t just build the feature. It also built out a larger supporting structure around the feature:

- more UI-oriented test architecture
- more decomposition into helper components and hooks
- more formalized thinking around `test/unit`, `test/ui`, and `test/e2e`
- additional tooling around harnesses, Playwright coverage, and testing methodology

That came with real strengths. The branch felt more like a small subsystem than a narrow patch. It invested in reusability. It created patterns the rest of the codebase could benefit from later.

But that same strength is also the trap.

The implementation grew beyond the literal feature request. Several times, the human had to redirect the session back toward the intended workflow:

- “are you delegating?”
- “research what is available”
- “did you integrate the feature into the real page?”
- “can’t we have test/unit, test/ui, test/e2e?”

Claude was productive, but it was productive in a way that benefited from active orchestration.

## What Codex Did

Codex’s implementation was tighter.

It stayed closer to the issue itself and spent less effort building broad new surrounding infrastructure. It added:

- a shared note-coordinate utility
- explicit note and velocity constraint helpers
- a focused browser harness
- targeted tests for the main drag behaviors

That narrower focus had value. The branch stayed closer to the actual feature request, and in at least one place the result was more faithful to the underlying device model: Codex explicitly tightened note-range constraints to the documented S3000XL lower bound.

But Codex paid for that with a different kind of weakness.

The biggest problem was not in the UI code. It was in the operational layer around the work:

- feature docs were first created in the wrong worktree
- the agent answered from assumption instead of verified repo state
- the first repair instinct was manual recreation instead of a git-native transfer
- several correct next steps had to be explicitly re-prompted instead of just executed

That meant the human reviewer spent too much time correcting process that should have been automatic.

Codex wrote respectable code, but it demanded a more expensive supervision style than it should have.

## The Real Lesson

This experiment changed how I think about AI development quality.

It is tempting to evaluate an AI coding system the same way we evaluate a human contractor: code quality, speed, test coverage, maybe architectural taste.

Those things matter, but they are not enough.

What matters just as much is this:

**What kind of mistakes does the agent make, and how expensive are those mistakes for the human to catch?**

That is where the Claude vs Codex comparison became meaningful.

Claude’s mistakes tended to be high-level:

- scope drift
- methodology drift
- needing orchestration

Codex’s mistakes tended to be operational:

- wrong-branch work
- repo-state assumptions
- incomplete follow-through
- avoidable process churn

Both are manageable. Neither is fatal. But they impose different kinds of burden on the developer.

And that means the best agent is not just the one that writes the best patch.

It is the one whose failure mode is cheapest in your environment.

## What We’d Do Differently Now

The good news is that this kind of experiment does not just compare models. It helps improve process.

One direct outcome of the Codex branch was adding stronger worktree guardrails to the repo:

- verify `pwd`
- verify the active branch
- verify the feature docs exist in the active feature worktree
- fail fast if the branch/worktree context is wrong
- prefer git-native repair over manual recreation

That is a good example of the broader point.

When an AI agent makes a mistake, the goal should not be “hope it behaves better next time.” The goal should be to convert that failure into a cheaper, more enforceable workflow.

Likewise, Claude’s branch reinforced a different lesson: if AI-led UI work is going to be credible, it needs a stronger habit of test-alongside-build, reusable harnesses, and explicit test categories instead of one-off screenshots and ad hoc checks.

In both cases, the best response to AI mistakes was not more commentary. It was better scaffolding.

## Did One Agent Win?

Not in the simple sense.

If the task is broad, exploratory, and benefits from an orchestrator building test patterns around the work, Claude looked strong.

If the task is tighter, more implementation-shaped, and you care about staying close to issue scope, Codex looked strong.

But both needed a human with standards.

That may be the most important result of all.

The practical future is probably not “pick one magic agent.” It is:

- pick a workflow
- decide what kind of supervision is acceptable
- add guardrails for the mistakes your chosen agent tends to make

In other words, the right unit of comparison is not just model capability.

It is **model plus process**.

## One More Important Detail

There was also one humbling result for both branches.

Even after all that work, both implementations still missed an edge case from the original feature request: neither branch fully supports drag-to-create when the program starts with zero keygroups. In both versions, the overview still collapses to a non-interactive placeholder in that empty state.

That matters because it keeps the experiment honest.

This was not a story where one agent achieved perfection and the other stumbled. It was a story where both agents were useful, both agents were imperfect, and the differences only became legible because the repo, the user, and the transcripts were all available for review.

## Conclusion

The most useful question from this experiment turned out not to be:

“Which AI is better?”

It was:

“What development process makes each AI’s mistakes easier to catch before they become expensive?”

That is a much more practical question, and probably a much more durable one.

If AI agents are going to be part of day-to-day software work, they do not just need prompts. They need operating conditions. They need test harnesses. They need branch discipline. They need documentation rules. They need a definition of done.

Most of all, they need a team willing to treat their mistakes as inputs into process design instead of as isolated annoyances.

That was the real value of building the same feature twice.

Not because it gave us a winner.

Because it gave us a clearer picture of what kind of engineering environment AI actually needs.

## Notes For Revision

- Add screenshots or GIFs comparing both draggable-zone UIs.
- Consider including a compact table of “same issue, different failure mode.”
- Decide how much of the transcript friction to quote directly versus paraphrase.
- Confirm whether the public post should name the exact models or keep the focus at the tool level.
