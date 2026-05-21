---
deskwork:
  id: b5d7c26c-9668-4a60-a1b7-bdd28fbe7ee7
---
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

1. **Upfront inventory pass at feature start.** For system-wide features, the operator invokes `/scope-inventory <slug>` as an explicit step after `/dw-lifecycle:define` and `/dw-lifecycle:setup` — the skill is standalone and does not modify the `dw-lifecycle` plugin's feature-define flow. The skill fans out multi-agent discovery (UI-route enumerator, AST/grep matrix builder, clone-detector output reader, feature-shape-specific pattern hunters seeded from the PRD's stated theme) and synthesizes the findings into a strawman `scope-manifest.yaml`. The operator reviews and prunes the strawman; the confirmed manifest drives all subsequent work. The operator never authors the manifest from scratch — they don't have the codebase-level pattern knowledge to do so honestly.
2. **Mid-implementation course-correction via `/scope-widen`.** When an operator complaint surfaces an inconsistency the upfront pass missed (or that emerged during implementation), the `/scope-widen` skill runs targeted discovery agents focused on the specific complaint, audits every analogous case, and proposes a widening fix. The skill is invokable by operator or orchestrator — invocation IS the enforcement, not a directive.
3. **Sub-agent dispatch wrapper enforces sibling enumeration programmatically.** Every code-writing sub-agent dispatch (`ui-engineer`, `frontend-design`, `code-simplifier`, `backend-typescript-architect`, others) goes through a wrapper that requires the return to include a structured `Searched: / Included: / Excluded: <reason>` block. The wrapper rejects returns missing the block or with `Included: 1` while `Searched: count > 1` and no `Excluded:` reasons. The wrapper is code, not a directive — its rejection is mechanical and adversarially validated.
4. **General code-clone detector as the universal duplication gate.** A `jscpd`-style detector (or AST-equivalent) runs in pre-commit AND at sub-agent dispatch-accept time. Fails commits that introduce new clone groups or grow existing groups. Replaces the CSS-class-specific point solution with a pattern-shape-agnostic gate that catches component duplication, logic duplication, hardcoded-list duplication, type duplication, and the CSS-consumer drift case as a side-effect.
5. **Inventory artifacts on disk — manifests canonical, captures ephemeral.** The per-feature `scope-manifest.yaml` lives **in the feature docs directory** alongside `prd.md` and `workplan.md` (e.g., `docs/1.0/001-IN-PROGRESS/<feature-slug>/scope-manifest.yaml`) — committed, review-visible, and tracked through the feature's lifecycle. Hiding the manifest in a gitignored location would invite drift between the manifest and the rest of the feature documentation, which is the exact failure mode this protocol exists to prevent. The repo-level `clones.yaml` lives at `docs/scope-discovery/clones.yaml` — committed; the operator-disposition column is part of the project's review record. Per-feature ephemeral captures (screenshots, DOM-token JSON, discovery-agent raw output) live in `.scope-inventory/<feature-slug>/` — worktree-local, gitignored, regenerable. Losing the captures is recoverable (re-run the skill); losing the manifest would not be.
6. **Validation by drain.** The audiocontrol repo's existing duplication backlog IS the validation case. The feature is not done until `.scope-inventory/clones.yaml` has zero un-dispositioned entries and every `refactor`-marked entry has a merged PR.

The protocol is "done" when an operator can credibly say: *"I haven't had to point at the same class of inconsistency twice on this feature, and the duplication backlog is dispositioned to zero."*

## Acceptance Criteria

- [ ] `/scope-inventory` skill at `.claude/skills/scope-inventory/SKILL.md` exists, fans out multi-agent discovery in parallel, synthesizes findings into a strawman `scope-manifest.yaml` written to the feature docs directory (`docs/<version>/<status>/<feature-slug>/scope-manifest.yaml`, committed), and writes ephemeral per-surface capture artifacts to `.scope-inventory/<feature-slug>/` (gitignored).
- [ ] `/scope-widen` skill at `.claude/skills/scope-widen/SKILL.md` exists, runs targeted discovery agents for a surfaced complaint, and produces a widening proposal.
- [ ] Sub-agent dispatch wrapper at `tools/scope-discovery/dispatch-wrapper.ts` parses returns for the required grammar (`Searched: / Included: / Excluded: <reason>`) and rejects malformed returns. Adversarial validator harness at `tools/scope-discovery/dispatch-wrapper.validate.ts` plants known-bad and known-good returns and asserts correct rejection/acceptance behavior. If the wrapper's logic is gutted, the harness fails CI.
- [ ] General clone detector wired into `.githooks/pre-commit` and the dispatch wrapper. Adversarial validator harness plants a known clone (introduced beyond the dispositioned baseline) and asserts the gate fails the commit. If the gate's logic is gutted, the validator fails CI.
- [ ] `/scope-inventory` is a **standalone skill, NOT integrated into `dw-lifecycle:define`**. The operator invokes it as an explicit step after `/dw-lifecycle:define <slug>` and `/dw-lifecycle:setup <slug>` for any feature flagged system-wide. The skill produces a working strawman manifest from the feature stub (`prd.md` skeleton + `workplan.md` skeleton), not a placeholder. **No edits to files inside the installed `dw-lifecycle` plugin directory** — verified by `git status` against the plugin's install path after Phase 3 lands. To mitigate the "operator forgets to invoke" risk, `.dw-lifecycle/config.json`'s `session.start.preamble` field is updated to carry a one-line reminder: *"If this is a system-wide feature, run `/scope-inventory <slug>` before the first edit."* Upstream contribution to `dw-lifecycle:define` (adding a first-class system-wide-question hook) is deferred to a future feature, conditional on Option 1 surfacing what the upstream contribution should look like — same calibration as Q4's plugin-promotion answer.
- [ ] Paper-test report against the s550 redesign timeline identifies which of the ~32 documented surfaces the protocol catches via the upfront pass, which via `/scope-widen`, and which would still require operator iteration. Target: ≥85% combined coverage.
- [ ] **Validation by drain:** the tooling has been run against `modules/*/src/` in the audiocontrol repo; `.scope-inventory/clones.yaml` exists with every detected clone group dispositioned as `refactor | keep-with-reason | ignore-with-justification`. Zero un-dispositioned entries remain. Every `refactor`-marked entry has a merged PR. Every `keep-with-reason` and `ignore-with-justification` entry has a one-line justification committed alongside.
- [ ] Per-feature `scope-manifest.yaml` is committed (review-visible, persistent across sessions and machines); repo-level `clones.yaml` is committed at `docs/scope-discovery/clones.yaml`; ephemeral `.scope-inventory/<feature-slug>/` capture directories are gitignored and regenerable from the manifest (verified by running inventory on one machine, deleting `.scope-inventory/`, and re-running — output is byte-equivalent modulo timestamps).

## Out of Scope

- **Visual-regression pre-commit gates.** The operator has explicitly rejected this in spirit (*"Gates are workarounds for not reading docs."*). Out of scope unless the protocol itself fails to prevent the iteration pattern. The s550 redesign analysis includes this as countermeasure 5.4 but flags it as the weakest of the six and recommends landing the upstream skills first.
- **Backfilling missing tests/docs/inventories for completed work** (s550-support, akai-ux-improvement, etc.). Forward-looking only.
- **Implementing the s550 redesign itself.** Already done; serves only as the paper-test fixture.
- **Generalizing beyond audiocontrol.** Other projects may inherit the skill via plugin export later, but that is not a deliverable here.
- **Replacing existing skills** (`dwss`, `frontend-design`, `code-simplifier`). Additive only — the new skills compose with the existing ones, they do not displace them.

## Resolved Questions

Phase 1's Refinement work resolved each question to a definitive answer. The resolutions below are load-bearing — they shape Phases 2/3/4 and the acceptance criteria.

1. **Two skills, not one.** `/scope-inventory` runs the upfront discovery pass once per system-wide feature. `/scope-widen` handles mid-implementation course-correction when an operator complaint surfaces. Segregating the two purposes prevents conflating the heavyweight upfront walk with the lighter focused widening audit and gives the operator (or orchestrator) two distinct invocation points for two distinct moments in a feature's lifecycle. A separate programmatic dispatch wrapper sits underneath both and enforces structured sibling-enumeration on every code-writing sub-agent return — see resolution 5.

2. **Universal: `kind: ui | code | hybrid`, all three implemented in v1.** Each kind has a working capture mode:
   - `ui`: Playwright route walk + DOM-token snapshot per (route, device, scenario) tuple.
   - `code`: AST + clone-detector matrix across module file globs.
   - `hybrid`: union of both, deduplicated by file-path key.

   The s550 paper-test validates `ui`. The `code` validation uses the audiocontrol repo itself per resolution 6; the validator harness asserts that the May 17–20 patches/tones JSX drift and the duplicated S-330/S-550 wave-addressing logic surface in the detector's output.

3. **Multi-agent discovery generates the strawman manifest.** The operator does not author the manifest from scratch — they don't have the codebase-level pattern knowledge to do that honestly. `/scope-inventory`'s first phase fans out N discovery agents in parallel:
   - UI-route enumerator (walks the dev server, captures route map).
   - AST/grep matrix builder (cross-module pattern usage).
   - Clone-detector output reader (consumes the general clone-detector's findings).
   - PRD-themed targeted-pattern hunters (seeded from the PRD's stated theme — e.g., for a redesign feature, hunt for `.ac-*` class consumers; for a typing-cleanup feature, hunt for `as Type` casts).

   Their findings are synthesized into a strawman `scope-manifest.yaml`. The operator's role is curation: review the strawman, prune false positives, confirm scope. `/scope-widen` follows the same model on a smaller surface: targeted discovery agents focused on the surfaced complaint, results synthesized into a widening proposal.

4. **Project-local first.** `.claude/skills/scope-inventory/` and `.claude/skills/scope-widen/` in this repo. Promote to `dw-lifecycle` plugin only after we've found out what works and what doesn't in audiocontrol. The plugin promotion has its own scope-discovery cost; deferring it is honest because we don't yet know which parts of the skill are audiocontrol-specific (Playwright config, dev-server port detection, `make scope-inventory` integration) vs. genuinely general (the multi-agent discovery pattern, the manifest schema, the dispatch wrapper, the clone detector). Refine first, promote second.

5. **Dispatch wrapper enforces a structured return grammar.** Every code-writing sub-agent dispatch goes through `tools/scope-discovery/dispatch-wrapper.ts`. The wrapper requires the sub-agent's return to include this block:

   ```
   Searched: <pattern> — <N matches>
   Included: <file:line>, <file:line>, ...
   Excluded: <file:line> — <one-line reason that is not a deferral>
              [, <file:line> — <reason>, ...]
   ```

   The wrapper rejects returns missing the block OR returns with `Included: 1` while `Searched: count > 1` and no `Excluded:` reasons. The block is the recoverable signal — grep-able in session transcripts and PR diffs, so the operator (or a code-reviewer) can verify after the fact that the audit happened. The "for later" / "TODO" / "we'll get to it" phrasings are explicitly forbidden in `Excluded:` reasons per [`agent-discipline.md`](../../../.claude/rules/agent-discipline.md)'s *"Just for now is bullshit"* rule. An adversarial validator harness asserts that rejection fires on known-bad returns and acceptance fires on known-good returns; if the wrapper's logic is gutted, the harness fails CI.

6. **The existing audiocontrol duplication backlog IS the validation case.** This feature ships the tooling AND runs it against `modules/*/src/` AND drains the resulting `.scope-inventory/clones.yaml` to zero un-dispositioned entries. Every clone group is dispositioned as `refactor | keep-with-reason | ignore-with-justification`. The `refactor`-marked entries become PRs in this feature's branch (or a series of dependent PRs queued by this feature). The feature is not done until clones.yaml has zero un-dispositioned entries. **No separate follow-up feature; no "we'll get to the cleanup later" deferral.** Validation by drain is the load-bearing acceptance criterion; the s550 paper-test is the secondary signal.

## Risks

- **Operator rejects the upfront pass as paperwork.** The May 17 mothballing decision (*"I don't want to hear any bullshit about things being out of scope"*) is load-bearing context. The multi-agent discovery in `/scope-inventory` must complete in a single upfront 10–15 minute cost with no ongoing process tax. If Phase 3's first dry-run feels heavy, the discovery-agent fan-out is wrong — iterate.
- **The protocol fires too rarely.** A skill that requires an explicit `scope-manifest.yaml` before it activates is safe (it never fires when not declared) but also easy to skip. The `dwd` hook (resolution 3's automatic strawman generation) is the mitigation — every feature-define produces a candidate manifest by default; opting out requires explicit operator action.
- **Multi-agent discovery produces noisy or conflicting findings.** N parallel agents may report overlapping surfaces, miss patterns, or hallucinate. Mitigation: a synthesis pass deduplicates and ranks; the operator's curation step prunes; the manifest schema's `kind` typing constrains what each agent can contribute. Adversarial fixtures in Phase 3 (a known feature with a known surface set) validate the synthesis.
- **The general clone detector produces false-positives on legitimate near-duplicates.** Mitigation: `ignore-with-justification` disposition per group; the validator harness includes a known-legitimate-near-duplicate fixture to assert the ignore list is honored.
- **Dispatch wrapper itself is code the agent might pathology-introduce into.** Mitigation: adversarial validator harness; pre-commit hook validates the wrapper's own logic against planted bad/good fixtures; if the validator is gutted, CI fails.
- **Existing-duplication backlog drain is open-ended in size.** Until the detector runs, we don't know how many clone groups exist. Mitigation: dispositioning a group as `keep-with-reason` or `ignore-with-justification` is a valid completion (it doesn't require refactor PRs); only `refactor`-marked entries become PR work. The operator's curation determines how much refactor work this feature carries — but the curation itself is unavoidable.
- **Dry-run against s550 may overstate coverage.** The paper-test is performed against a known historical transcript where the surfaces are already enumerated in the analysis report. A green paper-test does not guarantee the protocol generalizes; the backlog drain (resolution 6) is the load-bearing validation.
- **Capture artifact growth.** Per-feature `.scope-inventory/` directories accumulate screenshots and DOM-token JSON that can be megabytes. Gitignoring the captures by default keeps the repo clean; multi-machine handoffs rely on regenerating captures from the committed manifest at `docs/<version>/<status>/<feature-slug>/scope-manifest.yaml`. Regeneration must be deterministic — Phase 2 decides whether discovery-agent ordering, Playwright timing jitter, or other sources of non-determinism need normalization.
- **Operator forgets to invoke `/scope-inventory`.** The skill is standalone (no `dwd` integration) and easy to skip for a system-wide feature that would have benefited. Mitigations: (a) one-line reminder in `.dw-lifecycle/config.json`'s `session.start.preamble`, displayed at every session start; (b) future upstream contribution to `dw-lifecycle:define` that builds the system-wide question into the feature-define flow first-class. If the "forgets" risk surfaces repeatedly in practice, the upstream-contribution path becomes load-bearing rather than deferred.

## Appendix — Source Documents

- Background analysis: [`../../../analysis/s550-redesign-scope-discovery.md`](../../../analysis/s550-redesign-scope-discovery.md)
- Workplan: [`workplan.md`](workplan.md)
- Feature README: [`README.md`](README.md)
