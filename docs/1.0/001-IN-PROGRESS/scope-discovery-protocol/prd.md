# scope-discovery-protocol — Product Requirements Document

**Status:** Draft
**Owner:** oletizi
**Feature Slug:** scope-discovery-protocol

## Problem Statement

When the operator requests a system-wide change — a UI redesign, an architectural refactor, a new pattern that must land in every module — the agent currently fixes only the specific instance the operator points at, then waits. The operator has to manually walk every affected surface and point at each one.

The repository's existing process literature (`.claude/rules/agent-discipline.md`, `.claude/rules/css-refactor.md`, the screaming DRY prelude in `.claude/CLAUDE.md`, the `dwss` session-start skill) targets *not deferring* and *not breaking what is already working* — none of it tells the agent how to *enumerate* the scope of a system-wide change before starting. The gap is structural, not motivational: the agent has the discipline to finish what it starts but no tool for discovering what "the whole thing" actually is.

## Motivation / Evidence

The Roland S-330/S-550 editor "v3" redesign (`feature/s550-support`, 2026-05-15 through 2026-05-20) is the documented case. The analysis in [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md) reconstructed the timeline from three session transcripts and reached a headline finding:

> The agent never performed an upfront surface-inventory pass at any session start, and it never widened a single complaint into a same-class audit. Every commit was triggered by a screenshot the operator had just taken in the running app.

Quantitatively: roughly 230 operator turns over 60 hours of wall-clock to apply about 25 redesign decisions across 5 routes × 2 devices × 2+ scenarios. The design language existed (seven page-level mockups under `docs/.../s550-support/explorations/` dated 2026-05-08) and the surfaces were knowable (the five Roland routes `/connect`, `/play`, `/patches`, `/tones`, `/library`). The agent's working unit was *"fix the thing in this screenshot,"* not *"find every instance of this class of inconsistency across all five routes."*

The analysis tallied ~32 distinct surfaces or inconsistency classes that entered scope across the redesign tail. **Zero** were proactively discovered by the agent navigating routes it had not been pointed at:

> Of the agent's 121 `browser_navigate` calls on May 17 and 67 on May 20, every single one was either to the page in the most recent operator screenshot or a back-to-the-same-page reload. No call landed on a route the operator had not just pointed at within the prior turn.

The operator's coaching language is unambiguous about how they read the failure mode:

> *"I feel like you are either not looking hard enough or deliberately ignoring me."*
>
> *"Why do you fuck that up EVERY TIME?"*
>
> *"You programmed the entire thing start to finish. How can we prevent this bullshit from happening again?"*

The counterfactual the analysis estimates: an upfront 10–15 minute inventory pass against the five known routes and the seven mockup files would have surfaced 80%+ of the work in one shot, turning the next 60 hours of brute-force discovery into confirmation-and-prioritization against an existing matrix.

## Goals

A future system-wide change — UI or architectural — that hits the agent with the same shape as the s550 redesign produces:

1. **Upfront inventory pass at session start.** When the active feature has declared itself as a system-wide change (via an explicit per-feature manifest file), the agent's first work in the session is to enumerate every in-scope surface (routes, modules, files matching a pattern), capture observable state (screenshots for UI; AST/grep matches for code), and present the inventory to the operator BEFORE the first edit lands. Operator confirms / prunes the inventory; the inventory then drives the work.
2. **Complaint-widening default.** When the operator surfaces a single instance of an inconsistency mid-session, the agent's default response is: classify the complaint → grep the codebase for analogous cases → audit every match → propose a fix that covers all of them (or justify each excluded case). A one-instance fix is acceptable only if the search produces exactly one match.
3. **Sub-agent dispatch reports siblings.** `ui-engineer` / `frontend-design` / `code-simplifier` / similar sub-agents must, before proposing a fix, report which other surfaces share the same primitive/class/pattern. The orchestrator rejects single-instance recommendations.
4. **Inventory artifact on disk.** Per-feature inventory survives across sessions and machines as `.scope-inventory/<feature-slug>/` (worktree-local, gitignored except when feature closes), so multi-machine handoffs (orion-m4 ↔ orion-m1) don't lose context.
5. **Validation gate.** The protocol is dry-run-validated against the s550 redesign timeline (does it surface all 32 documented surfaces in one upfront pass?) and live-validated against one fresh system-wide change.

The protocol is "done" when an operator can credibly say: *"I haven't had to point at the same class of inconsistency twice on this feature."*

## Acceptance Criteria

- [ ] An operator-authored `scope-manifest.yaml` for a sample feature drives a `make scope-inventory FEATURE=<slug>` run that produces a `.scope-inventory/<slug>/` directory containing per-surface artifacts (screenshots + DOM tokens for UI; AST/grep match lists for code) and an `inventory.md` divergence matrix.
- [ ] The complaint-widening rule loads at session start (verified by inspecting a fresh session's CLAUDE.md-derived context) and is referenced from `.claude/CLAUDE.md`.
- [ ] Dispatching `ui-engineer` against a cross-cutting class (e.g., `.ac-page-title-row`) for a single page returns a recommendation that names every sibling route consuming the class, not just the requested page.
- [ ] Paper-test report against the s550 redesign timeline identifies which of the ~32 documented surfaces the protocol catches via upfront inventory, which via complaint-widening, and which would still require operator iteration. Target: ≥85% combined coverage.
- [ ] Live-test against a fresh system-wide change produces a measurably lower operator-turn count for the equivalent scope vs. the s550 baseline; gaps surfaced by the live-test are filed as follow-up issues, not deferred silently.
- [ ] `.scope-inventory/` is gitignored by default and survives a multi-machine handoff (verified by running inventory on one machine, fetching on another, reading without regeneration).

## Out of Scope

- **Visual-regression pre-commit gates.** The operator has explicitly rejected this in spirit (*"Gates are workarounds for not reading docs."*). Out of scope unless the protocol itself fails to prevent the iteration pattern. The s550 redesign analysis includes this as countermeasure 5.4 but flags it as the weakest of the six and recommends landing the upstream skills first.
- **Backfilling missing tests/docs/inventories for completed work** (s550-support, akai-ux-improvement, etc.). Forward-looking only.
- **Implementing the s550 redesign itself.** Already done; serves only as the paper-test fixture.
- **Generalizing beyond audiocontrol.** Other projects may inherit the skill via plugin export later, but that is not a deliverable here.
- **Replacing existing skills** (`dwss`, `frontend-design`, `code-simplifier`). Additive only — the new skills compose with the existing ones, they do not displace them.

## Open Questions

These are unresolved in the feature definition and must be answered during Phase 1 (Refinement). Each answer must land in the workplan and be reflected in this PRD before Phase 2 starts.

1. **One skill or two?** Should the upfront inventory and the mid-session widening response live in one skill or two? The upfront pass is heavy (Playwright + screenshots); the mid-session widening is light (grep + read). Initial hypothesis: two distinct skills. Decision to be made in Phase 1.
2. **UI-only or universal?** The s550 evidence is all UI. The operator's framing explicitly includes *"architectural redesign/update."* How does the protocol handle non-UI system-wide changes (e.g., *"convert all `as Type` casts to typed guards across modules"*)? Phase 1 must propose a unified manifest schema with `kind: ui | code | hybrid` and define what *"inventory capture"* means for each kind.
3. **Manifest authorship.** Who writes the per-feature `scope-manifest.yaml`? Probable answer: the operator at feature-define time, with a strawman generated from the feature's `prd.md` and `workplan.md`. The `dwd` (feature-define) skill should be extended to ask *"is this a system-wide change? If yes, declare scope manifest now."* Phase 1 confirms.
4. **Plugin vs. project-local placement.** Should the skill live in `.claude/skills/` (audiocontrol-only) or in a plugin (deskwork-style, reusable)? Default for v1: project-local; promote to plugin after a second project adopts it. Same calibration as `dwss`. Phase 1 confirms.
5. **What "the agent considered widening and decided against it" looks like as a recoverable signal.** Some changes legitimately are single-instance. The widening rule cannot be absolute. Phase 3 needs an escape valve: when the agent's search returns >1 match but the agent judges the additional matches are out-of-scope, it must say so in chat *before* fixing the one, not after the operator catches it. Phase 1 drafts the exact wording.

## Risks

- **Operator rejects the upfront pass as paperwork.** The May 17 mothballing decision (*"I don't want to hear any bullshit about things being out of scope"*) is load-bearing context. The skill must be a single 10–15 minute upfront cost with no ongoing process tax, not a recurring procedural overhead. If Phase 2's first dry-run feels heavy, the manifest schema is wrong — iterate.
- **The protocol fires too rarely.** A skill that requires explicit `scope-manifest.yaml` authorship before it activates is safe (it never fires when not declared) but also easy to skip. The `dwd` hook in Phase 3 mitigates this by surfacing the question at feature-define time.
- **The complaint-widening rule produces false-positive sweeps.** Some cross-class matches are intentional (e.g., two pages legitimately use different chevron sizes). The escape-valve wording (Open Question 5) is the safety net; if it ships ambiguous, the rule will train the agent to over-sweep and the operator will reject it.
- **Sub-agent prompt updates depend on canonical-source location.** The Modules Affected list includes `~/.claude/agents/` *or* `.claude/agents/` *(TBD which surface)*. Phase 3 must confirm which file the sub-agents actually read at dispatch time and update *that* surface — not the wrong one.
- **Dry-run against s550 may overstate coverage.** The paper-test is performed against a known historical transcript where the surfaces are already enumerated in the analysis report. A green paper-test does not guarantee the protocol generalizes; the live-test in Phase 4 is the load-bearing validation.
- **Inventory artifact growth.** Per-feature `.scope-inventory/` directories accumulate screenshots that can be megabytes. Gitignoring by default keeps the repo clean, but multi-machine handoffs require either a deterministic re-generation step or an explicit sync mechanism. Phase 2 must decide which.

## Appendix — Source Documents

- Background analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)
- Workplan: [`workplan.md`](workplan.md)
- Feature README: [`README.md`](README.md)
