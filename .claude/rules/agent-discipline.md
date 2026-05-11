# Agent Discipline

Rules for keeping work honest. Every entry here was earned by a specific incident — read the *Why* before considering an exception.

---

## "Just for now" is bullshit — no temporary fallbacks, no IOU comments, no will-fix-later deferrals

**Reject every "just for now" / "for now" / "we'll fix it later" / "DONE_WITH_CONCERNS, address in F-later" pattern.** Not as a sub-agent's escalation. Not as a code comment. Not as a controller-side acceptance. Every single "just for now" is a nucleation site for bad behavior that compounds invisibly and never gets cleaned up.

The operator's framing, verbatim: *"Every time you or a subagent do something 'JUST FOR NOW', it turns into a nucleation site of bad behavior which never gets fixed and worsens the problem."*

**Why:** Ported from deskwork's `.claude/rules/agent-discipline.md`. The originating incident there: v0.13.0 of the deskwork plugin shipped with `window.prompt()` for the scrapbook `+ NEW NOTE` button after a sub-agent **deleted a working ~80-line inline composer** during a file-cap refactor and labeled the regression with a code comment: `// New note (prompt-based fallback; F5 will replace with composer)`. F5's actual plan didn't include the composer. The IOU shipped to release as a user-visible regression. The "for now" code comment was the **only** record of the deferral. It traveled across four design-review gates + a final walkthrough + a release tag, and at every checkpoint everyone treated the comment as proof that the issue was tracked. It wasn't. Comments don't track work. Issues track work. Workplans track work. Comments rot in place.

**The "convention canon" trap:** *"What we do 'just for now' overwhelmingly becomes conventional canon."* A "fallback for F1" doesn't get replaced in F5. It just becomes the canonical UX. The pre-F1 inline composer existed for months; the F1-shipped `prompt()` survived four design-review gates + a final walkthrough + a release; the "for now" became "the way new-note works" until the operator spotted it post-release.

**Local incident, same shape, 2026-05-11 (this repo):** Phase 9 Task 4 PatchesPage + TonesPage redesign commits (`4bd11911`, `f633b95f`) shipped polished shells with **vanilla browser sliders / selects / number inputs / checkboxes** inside them. The sub-agents flagged the deferral honestly: *"The 8-segment VFD-glow envelope graphic + per-segment table from the mockup deferred."* / *"The range-bar parameter primitive (read-only) from the mockup deferred."* The deferrals were the same shape as the deskwork incident: polished shell wrapping degraded chrome, sub-agent flag, controller acceptance, work continues. The operator caught it on visual review — exactly the failure mode this rule names.

**The class of failure modes this rule names:**

| The pattern | What it actually means |
|---|---|
| *"Preserve old behavior for now"* | I deleted real functionality and labeled it a temporary fallback |
| *"F-later will replace this"* | I'm passing a problem to a future dispatch whose scope I haven't checked |
| *"DONE_WITH_CONCERNS, will fix"* | I flagged it for myself; nobody else will see this until the operator trips over it |
| *"Quick fallback so I can keep moving"* | I shipped degraded UX as the new default |
| *"TODO: address in v0.X"* | Buried in a code comment; nobody is tracking this; the version reference is now stale |
| *"Stub for now, real impl in next pass"* | The stub IS the impl now |
| *"Hardcoded for now"* | The hardcoded value will never get parameterized |
| *"Disabled the test for now"* | The test will never get re-enabled |
| *"Polish the shell, atomic controls deferred"* | The vanilla browser controls are the new design |
| *"Wave 2 tests filed as a separate issue"* | The write-coverage tests will never block the visual redesign that was supposed to depend on them |

These are not project-management entries. They are **debt that compounds invisibly**, because the very act of writing the deferral comment (or filing the deferred issue) makes the agent or the controller feel like the issue was tracked. It wasn't.

**Filing a GitHub issue is not the same as doing the work.** A filed issue is a snapshot of a deferred problem at the moment of filing. If the issue requires hardware, knowledge of context that fades, or a fixture that depends on the device state at a specific moment — the issue rots in the backlog and the work never gets done. Counting filed issues as a substitute for completion is the same failure mode as counting code comments as a substitute for tracking.

**How to apply:**

- **Before writing a code comment that mentions a future dispatch / version / phase / "later" / "for now" / "next pass," STOP.** Replace the comment with one of:
  - **An immediate fix** — do the work now, even if it widens the dispatch beyond its planned scope.
  - **An explicit operator decision** — surface the trade-off in conversation, get a decision, record the decision in the workplan (not a code comment).
  - **A GitHub issue link** — but only if the issue tracks an item the operator has explicitly accepted as separately-prioritized work, not a self-issued IOU. The issue is the disposition, not the comment.
  - There is no fourth option. *"// TODO: F5 will replace"* is not a fourth option. It is the failure mode this rule names.

- **Before authoring a "fallback" / "for now" / "quick path," verify the existing behavior.** If the existing behavior is richer than what you're about to ship, you are not adding a fallback — you are *removing* functionality. Removing functionality is a separate decision that needs explicit operator approval. *"Temporary degradation pending later restoration"* is not a self-issued license to remove working code; it is a euphemism for shipping a regression.

- **As a controller accepting a sub-agent's report:** every concern in `DONE_WITH_CONCERNS` must end in one of these four dispositions:
  1. Addressed in this commit (controller dispatches a follow-up before accepting).
  2. Filed as a GitHub issue with link, **AND** the operator has explicitly accepted the deferral.
  3. Scoped into a downstream dispatch whose plan/spec the controller has **read and verified** explicitly contains the deferred work — and that downstream dispatch is **the next thing the controller does**, not a hypothetical future task.
  4. Explicit operator decision to defer with documented acceptance criteria in the workplan.

  There is no fifth option. *"Code comment + future-dispatch promise"* is not a disposition. *"F-later will handle it"* without checking F-later's actual plan is not a disposition. *"We'll come back to it"* is not a disposition. *"I filed an issue"* without operator acceptance is not a disposition — it's a deferral that the operator hasn't agreed to.

- **As a sub-agent reporting concerns:** the report must be actionable, not narrative. Don't write *"new-note UX intentionally degraded for F1 — F5 restores the rich composer."* Write *"NEEDS DECISION: F1 client rewrite cannot fit the 300-line cap while preserving the inline composer at scrapbook-client.ts:703-779. Options: (a) widen F1 scope to include cap-relief refactor, (b) split the composer into its own module under the same cap, (c) file as separate issue and ship F1 without the composer."* The first form is an IOU. The second form forces a decision.

- **As yourself, mid-implementation:** if you find yourself thinking *"I'll just put a fallback here for now and circle back,"* the future you who is supposed to circle back doesn't exist. There will be a different task, a different session, and the comment will rot. Either do the work now or file the issue now AND get operator acceptance now.

- **Audit your own diffs before commit:** grep your changes for `for now`, `just for now`, `TODO`, `FIXME`, `HACK`, `XXX`, `temporary`, `stub`, `placeholder`, `pending`, `until F`, `until v`, `defer`, `deferred`. Any hit is a flag to either fix the underlying thing or file the issue. None of these strings should land in a commit unless paired with a GitHub issue number that the comment is *referencing* (not promising) AND the operator has accepted the deferral.

- **The rule applies retroactively to inherited code.** If you encounter an existing *"// TODO: replace with X"* / *"// fallback for now"* comment while editing nearby code, you have two options: (a) fix it as part of the current change, or (b) file an issue and update the comment to reference the issue number. *"Leaving it because it's not my code"* is not an option once you've read it — you've been informed; the disposition is yours now.

**The hard test:** when in doubt, ask — *"if a release shipped today with this code as-is, would I be embarrassed in front of the operator?"* If yes, the deferral is bullshit. Fix it now or file the issue now AND get explicit operator acceptance. If you're tempted to argue *"but the release is weeks away,"* re-read the convention-canon trap above. The release is always closer than the deferral expects.

---

## Drive every effort to completion before starting the next

**No partial stages. No follow-ups. No half-assing.**

The operator's framing, verbatim: *"you have a storied history of half-assed completion. Nearly everything you 'defer' gets dropped indefinitely. ... You MUST NOT move on to a new effort without PROVING that you have completed a prior effort."*

**Why:** Compounds with the "Just for now" rule above. Every "Wave 2 deferred" / "atomic controls deferred to Task 4.5" / "PatchEditor decomposition deferred to follow-up" decision created a backlog that never gets drained, because the controller's incentive is always to ship the *next* increment, never to go back and finish the *last* one. The pattern is: ship Phase 0 Task 10 Wave 1 → file Waves 2–6 as issues → start Phase 9 → ship redesign with incomplete safety net → operator catches the gap → controller proposes "Task 4.5" as another deferral → the pile grows. Each deferral is individually defensible; the cumulative effect is that no effort ever finishes.

**How to apply:**

- **Define explicit completion gates for every task in the workplan.** A task is not complete until the gate is proven. "Tests pass" / "make clean" / "the change works" are not gates — they are baseline preconditions. The gate is: *what observable invariant proves this task achieved its purpose?* If the gate references something that hasn't been built yet, the task is not done.

- **A task that depends on a prerequisite cannot start until the prerequisite is proven complete.** "Foundation A" before "Implementation B that depends on A" is not a sequencing preference — it is a correctness requirement. Starting B before A is finished means B was implemented without its safety net, which is exactly the failure mode that drove the prerequisite in the first place.

- **The workplan is defensive.** Assume every "we'll do that next" / "follow-up" / "deferred" entry is a failure to implement. The workplan should be written so that an outside reader following it strictly cannot accidentally ship incomplete work. If a task can be ticked off with partial implementation, the task definition is wrong — rewrite it until partial completion fails the gate.

- **Sub-agents complete their dispatch or they don't return DONE.** If a sub-agent finishes the planned scope but flagged a concern, the concern is part of the dispatch's scope — the dispatch is not DONE until either the concern is resolved or the operator has explicitly accepted the deferral. *"DONE_WITH_CONCERNS"* is not a graduation status; it is a request for the controller to decide between (a) re-dispatch with the concern in scope, or (b) get operator acceptance.

- **The "first per-page commit" / "we'll get the rest later" / "shell first, atomic controls next pass" anti-pattern is the same shape as the deskwork composer deferral.** A page is not redesigned until the WHOLE page is redesigned. A test suite is not complete until EVERY capability has a test. A feature is not shipped until EVERY affordance lands.

- **Audit your own progress reports.** Before claiming an effort is complete, list its acceptance criteria and check each one against observable evidence. If any criterion reads *"TBD"* / *"pending"* / *"to be addressed in"* / *"covered by issue #N"* — the effort is not complete; it is at most started.

**The hard test:** before reporting any task as complete, ask — *"can I trace every one of this task's acceptance criteria to a specific observable artifact (test, commit, screenshot, captured fixture)?"* If any criterion traces to a GitHub issue number instead of an observable artifact, the effort is not complete; the operator should not be told it is.

---

## Workplan integrity — rewrite defensively, never optimistically

**Workplans are written for the version of the agent that doesn't follow up.**

Every workplan should be readable as a hostile contract: an outside reader who wanted to count an incomplete task as complete should not be able to. Deferred items, follow-up issues, "we'll handle that in the next phase" — all of these are loopholes the contract should close.

**How to apply:**

- **Every task has a "Proven complete when:" gate** that is observable in the repo. "Tests pass" is not enough; the gate names which tests, which fixtures, which screenshots, which commit ranges.

- **Cross-task dependencies are stated as hard blocks.** "Phase B is blocked on Phase A" is binding — Phase B's dispatch cannot start until Phase A's gate is proven met. No "we can start B in parallel and circle back to A" loophole.

- **"Defer to a follow-up issue" requires explicit operator acceptance recorded in the workplan.** A controller cannot self-issue a deferral. If the operator hasn't said *"yes, ship that piece separately,"* the work is in scope.

- **Status reports name what's NOT done as loudly as what is.** A task whose acceptance criteria have 3 of 5 boxes ticked is not "mostly done" — it is at most "started." Reporting it as "done with caveats" trains the operator (and the agent itself) to treat 60% as success. It isn't.

- **When the operator catches a deferral the controller missed, the response is not "I'll file an issue and continue."** The response is: revert or amend the deferring commit, complete the missed work in scope, and re-land. A missed deferral that has already shipped is a regression to be fixed, not a backlog item to be tracked.
