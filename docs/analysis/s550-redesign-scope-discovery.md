# s550 Redesign: Why Scope Discovery Took Five Days

Analysis of three Claude Code session transcripts (2026-05-15, 2026-05-17, 2026-05-20) that drove the Roland S-330/S-550 editor "v3" redesign on `feature/s550-support`. Source transcripts at `/Users/orion/work/audiocontrol-work/audiocontrol/.tmp/s550-decrypt/`. Filtered operator-text counts: 22 / 154 / 58 real messages respectively (the "2,704 user messages" figure in the analysis brief was inflated by synthetic `<task-notification>` and tool-result entries — the actual operator turn count for the brute-force session is ~110 unique prompts including screenshots).

## 1. Headline finding

**The agent never performed an upfront surface-inventory pass at any session start, and it never widened a single complaint into a same-class audit. Every commit was triggered by a screenshot the operator had just taken in the running app.** The design language existed (seven page-level mockups under `docs/.../s550-support/explorations/` from 2026-05-08) and the surfaces were knowable (five Roland routes: `/connect`, `/play`, `/patches`, `/tones`, `/library`), but the agent's working unit was "fix the thing in this screenshot," not "find every instance of this class of inconsistency across all five routes." The 5-day brute-force tail is the cost of that O(1) read-window applied to an O(N) problem.

## 2. Evidence — timeline of surfaces entering scope

Each row records a distinct UI surface or class of inconsistency, the timestamp it first surfaced in the transcripts, whether the *agent* discovered it (proactively navigated, grepped, or audited) or the *operator* surfaced it (screenshot + complaint), and the agent's immediate response pattern.

| t | Surface / Inconsistency | Surfaced by | Agent's first response |
|---|---|---|---|
| 2026-05-17 20:45 | "Mothball workplan, brute-force everything broken" — operator opens the session by saying *"I don't think the process we've been following so far works, so I'm going to brute force it. … I don't want to hear any bullshit about things being out of scope."* | Operator | Mothballs structured plan; "Walk me through what's broken." Does **not** propose a 5-route inventory pass first. |
| 20:48 | PlayPage sticky header occludes CRT + Part A | Operator (image #4) | Reads PlayPage component, finds legacy `.ac-page-sticky-header`, fixes that page only. |
| 20:56 | *"did you check to see if it worked?"* | Operator (correction) | Re-navigates, screenshots, confirms — but only the page just touched. |
| 21:00 | *"The same pathology exists on the library page"* | Operator | First explicit cross-page generalization — and it comes from the operator, not the agent. The agent does NOT then check `/connect`, `/patches`, `/tones`. |
| 21:07 | TonesList shows "(unnamed)" while selected tone is named | Operator (image #5) | Reads TonesList component; data-binding bug, fixes in place. |
| 22:47 | TonesPage tab redundantly labels itself below the tab strip | Operator (image #8) | Removes the label on Tones. Does not check PatchesPage for the same anti-pattern. |
| 22:53 | TonesPage parameter controls are wrong primitive kinds (dropdown for polarity, dropdown for stepped level curve, text input for ranges) | Operator (image #9) — *"You need to rethink all of these controls"* | Reworks per-control on TonesPage. The same control vocabulary on PatchesPage is not audited until 36 hours later. |
| 23:09 | TonesPage still inefficient — room for 2-3 controls per row | Operator (image #10) | Repacks the grid on Tones only. |
| 2026-05-18 00:16 | TonesPage two-value bank uses dropdown, four-pole loop-mode uses dropdown | Operator (image #11) — *"can you spend some effort to make this look carefully designed instead of haphazardly tossed together"* | Reaches for new `AcToggle` primitive on Tones. No corresponding sweep on Patches. |
| 03:59 | *"the patches list is wider than the tones list. You adjusted the tones page layout without adjusting the other pages accordingly. Is there DRY-violating layout code duplication across pages that need to be fixed?"* | Operator | First explicit cross-page width inquiry. Agent acknowledges, fixes pair. Does not audit all primitives. |
| 04:22 | *"Because the library code is shared across devices, you MUST not create DRY-violating code duplication."* | Operator (correction after agent over-consolidates Roland+Akai styles) | Agent backs out the over-consolidation. |
| 05:55 | DeviceMemoryPanel on Library page should match Tones/Patches list affordances | Operator (image #40) — *"it should feel like the same app"* | Rewrites DeviceMemoryPanel against `.ac-list-*` primitives. |
| 06:28 | DeviceMemoryPanel tones-bank expansion shoves patches header | Operator (images #43-44) | Adds collapse affordance. |
| 06:30 | Sets tree in library pane still inconsistent with other tree controls — *"Look carefully at it."* | Operator (image #45) | Aligns SetItem with `.ac-tree-*`. |
| 07:13 | VideoCapture stopped state is a black rectangle; sizes don't match running state | Operator (images #63-64) | Builds a skeleton state. |
| 19:39 | Connect-page transport configuration panels different heights with same number of controls | Operator (images #67-68) | Aligns Connect panels. |
| 19:48 | *"does this look like it comports with the new design language to you?"* (Connect page) | Operator (image #70) | Rebuilds Connect chrome. |
| 19:50 | *"what does 'OVERRIDE AUTO-DETECT' mean?"* | Operator (image #71) | Removes vestigial verbiage. |
| 2026-05-19 18:54 | After a `make`/dev-server restart: scroll bar on items list is white background (regressed); three connect-page expandable sections unstyled | Operator (images #1-2) — *"a few things are broken that were working"* | Hunts CSS regressions. |
| 19:48 | Patch controls clipped below the pane; tabbed structure for patch panel like tones | Operator (image #3) | Re-applies tabbed shell (lost in earlier revert). |
| 20:14 | Patch dropdowns should use AcToggle paradigm (established on tones a day ago) | Operator (images #4-5) | Migrates patch controls. **This is the same audit the operator had to ask for three times: every page-specific control survey was operator-initiated.** |
| 20:27 | *"why are the elements across the patches and tones pages slightly different widths and heights? You almost certainly have DRY-violations across those pages that make this app look amateurish"* | Operator (images #7-8) | Begins consolidation. |
| 21:37 | *"Just revert the recent changes. You completely broke the UI. It is absolutely unusable."* | Operator | Full revert. The sweep refactor had landed without per-page screenshot verification. |
| 21:41 | Even after revert: row heights and margins slightly different between Patches and Tones | Operator (images #9-10) — *"Do they violate DRY principles?"* | Yes, then refactors. |
| 21:46 | *"Does this kind of duplication comport with best practices?"* | Operator (rhetorical) | |
| 21:47 | *"You programmed the entire thing start to finish. How can we prevent this bullshit from happening again?"* | Operator (process question) | Agent proposes the `check-css-duplication.ts` pre-commit gate. |
| 21:49 | *"BEFORE you declare victory, you MUST PROVE that it finds the problem and that you didn't just write a bunch more bullshit that pretends to fix the first bullshit."* | Operator | Adversarial harness `check-css-duplication.validate.ts` added. |
| 22:51 | *"NOT JUST THE WIDTH — YOU SHOULD IMPLEMENT DRY!!! USE DRY PRINCIPLES… STOP FLOODING THIS PROJECT WITH SEWAGE!!!"* | Operator (full caps) | This message is verbatim what the operator pasted into `.claude/CLAUDE.md` as a 200-line screaming prelude later that day. |
| 2026-05-20 00:39 | Patches+Tones detail panel headers slightly different — *"The tones page should be considered canonical… refactor both pages to use the same css classes so that the heights, widths and margin/padding of the container and its elements is pixel perfect. While you're at it, remove the import/export/etc affordances on the tones header that are vestigial duplicates of functionality that's in the library — that shouldn't be here anymore."* | Operator (images #12-13) | Refactors `.ac-detail-head`. The vestigial-affordance removal had to be requested explicitly *again* — earlier passes had only removed list-row buttons. |
| 04:38 | *"the height of each list item is STILL slightly different across the patches and tones pages. … I feel like you are either not looking hard enough or deliberately ignoring me"* | Operator (images #16-17) | Discovers and fixes 3-pixel row-height drift (38 / 35 / 35.8 → 40px). |
| 04:51 | List scrollbar pushes items left when present; rows reposition on menu-bar appear/disappear | Operator (image #18) | Switches to overlay scrollbar. |
| 05:09 | Tone-mapping panel zone-edge clipped at min/max | Operator (images #20-21) | Switches outer-shadow ring to inset outline. |
| 05:12 | Multi-zone panel: unselected zones read as empty | Operator (image #22) | Per-zone HSL fill via `--ac-zone-hue`. |
| 08:14 | *"the auto probe action doesn't actually send out a midi SYN message… It's supposed to send SYN messages out to all the ports (except loopbacks…) and listen for an ACK"* | Operator | Begins building a real probe. Agent's first probe is Universal Identity Request — fails on the S-330 because it predates the spec. |
| 08:28 | *"e2e test code does NOT belong in the source tree. FIX IT"* | Operator (caps) | Moves into e2e-infra. |
| 08:29 | *"HOW DID YOU NOT READ THE FUCKING DOCUMENTATION FIRST!!!!! ./TESTING-E2E.md"* | Operator (caps) | Loads the doc. |
| 09:07 | Connect-page wasted vertical space — operator suggests two-column layout | Operator (image #23) | Builds the column. Six follow-on regressions (VFD top-alignment, eyebrow wrap, side-column header inside vs outside border, chevron size, etc.) — each surfaced by an operator screenshot. |
| 09:13 | *"Did you notice the accessibility standards you violate every time you create a new collapse/expand chevron affordance? Why do you fuck that up EVERY TIME?"* | Operator | |
| 09:14 | *"it's way too small and doesn't match the rest of the UI. Why do I have to point that out to you?"* (chevron size on connect-page details) | Operator | Snaps chevron to `.ac-list-bank-chevron` canonical 1.1rem. |
| 09:22 | Connect-page side column has no header / not aligned with VFD top | Operator (image #25) | |
| 09:27 | *"'more options' isn't really what this is about. Maybe 'Details' is a better choice. Also, we've established pattern of bounding headers with border (e.g. \[Image #27\]). We should be consistent across pages"* | Operator (images #26-27) — explicit cross-page consistency citation | Adopts `.ac-detail-head` pattern on Connect. |

**Tally.** Counted by surface-of-first-discovery: ~32 distinct surfaces or inconsistency classes entered scope across the redesign tail. **Zero** were proactively discovered by the agent navigating routes it had not been pointed at. Of the agent's 121 `browser_navigate` calls on May 17 and 67 on May 20, every single one was either to the page in the most recent operator screenshot or a back-to-the-same-page reload. No call landed on a route the operator had not just pointed at within the prior turn.

The operator's coaching language is unambiguous about how they read the failure mode:

- *"I feel like you are either not looking hard enough or deliberately ignoring me."*
- *"Why do you fuck that up EVERY TIME?"*
- *"You programmed the entire thing start to finish. How can we prevent this bullshit from happening again?"*

That last one isn't a complaint — it's an invitation to write enforcement. The agent answered it for CSS duplication (the pre-commit gate landed) but not for the prior class of failure: scope discovery.

## 3. Counterfactual — what could have been done at session-start

The brute-force session opened at 2026-05-17 20:45 with the operator's *"walk me through what's broken in real time."* The agent acknowledged and stood by. A different opening turn — taking ~10 minutes before the first commit — would have produced an inventory that closed the loop on 80%+ of the operator-surfaced items in one pass:

**Proposed session-start sequence (concrete tool plan):**

1. `Read DESIGN-SYSTEM.md, ux-audit.md, explorations/01-design-language.html` — establish the *new* language vocabulary in tokens, primitives, and approved chrome shapes.
2. `grep -rn 'className=' modules/roland-sxx0-editor/src/pages modules/editor-core/src/design` → produce a class-usage matrix of which page consumes which `.ac-*` primitive.
3. Launch Playwright. For each of the five Roland routes (`/connect`, `/play`, `/patches`, `/tones`, `/library`) and for both devices (`/roland/s330/editor/*`, `/roland/s550/editor/*`) with at least two scenarios per route (`?midi=simulated&scenario=...`):
   - `browser_navigate` to the route
   - `browser_resize` to a canonical viewport (1440×900)
   - `browser_take_screenshot` to `.tmp/inventory/<route>-<scenario>.png`
   - `browser_evaluate` a small script that walks the DOM and reports: `(a)` every distinct `className=` token used, `(b)` `getBoundingClientRect` for every element with class `ac-page-title-row`, `ac-detail-head`, `ac-list-row`, `ac-list-bank-header`, `.ac-tree-node`, `.ac-toolbar-btn`, `.ac-card`, `.ac-vfd`, `(c)` computed font-family / font-size / border-radius / padding token for each.
4. Diff the per-route matrices against each other and against the design-language reference. The diff produces the inventory — every cross-page divergence (header alignment, row height, list-bank chevron size, button family, scrollbar style, panel border treatment) is a row in the report, ranked by visibility.
5. Present the inventory to the operator BEFORE the first commit lands. *"I see N divergences across these 10 route×scenario combinations. Walking through screenshots: …"*

This is ~30 tool calls and 8-12 minutes of work. By the end the agent has the same screenshot set the operator was about to produce one-at-a-time across the next 60 hours. The brute-force loop becomes confirmation/prioritization, not discovery.

Beyond session-start, the same shape applies to *every* operator complaint that lands a screenshot. The agent's default response should be:

**Operator complaint → grep + multi-route audit → fix-all-instances → screenshot every affected route → commit.**

Not:

**Operator complaint → fix the screenshot → commit → wait.**

The May 19 sequence between 20:14 (patch dropdowns to AcToggle, established on tones a day prior) and 20:27 (patch+tone width/height drift) is the clearest signature of the missing audit step: the agent applied a primitive sweep to one page, and the operator had to come back and explicitly ask for the same sweep on the next.

## 4. Why the existing rules didn't catch it

The repo already has substantial process literature. None of it targets this failure mode:

- **`.claude/rules/agent-discipline.md`** — focuses on *not deferring* (the "just for now" prohibition) and *finishing what you start*. It assumes the scope is known. Says nothing about how to enumerate scope.
- **`.claude/rules/css-refactor.md`** — landed *during* this incident (2026-05-19) and was specifically about not breaking visuals during sweep refactors. It enforces "screenshot every page after a CSS change" but only *after* the change. It does not require a pre-change inventory.
- **`.claude/CLAUDE.md`** — the operator's screaming DRY prelude (added 2026-05-19) is enforcement for *what* to look for (duplication) not *where* to look (all routes).
- **The Session Lifecycle / `dwss` skill** — reads docs and reports state. It never opens a browser. Its "what to do next" affordance is *select a workplan task*, not *audit a UI*.
- **The `frontend-design` skill** (invoked ~30 times across the May 17 brute-force) — design judgement on whichever component is in the current screenshot. No scope-expansion hook.
- **`agent-discipline.md` §"Drive every effort to completion"** — applies to known tasks. It says "a page is not redesigned until the WHOLE page is redesigned." Implicitly assumes you can recognize "the whole page" — but with cross-page primitives, "the whole page" includes every other page that consumes the same primitive. The rule doesn't say that.

The closest match is the rule's own example: *"A test suite is not complete until EVERY capability has a test. A feature is not shipped until EVERY affordance lands."* That should generalize to: **a redesign is not shipped until EVERY route has been visited and audited against the design language.** The generalization is missing.

A second contributing factor: the project's `frontend-design` and `ui-engineer` sub-agents are *component*-scoped. The operator can hand a screenshot of one card to a sub-agent and get a polished card back. Nothing in the delegation pattern asks the sub-agent — or the orchestrator — to enumerate sibling cards on other pages.

## 5. Recommended countermeasures (ranked by leverage)

### 5.1 New skill: `redesign-scope` (highest leverage)

**What:** A skill invoked by the orchestrator at the start of any session whose feature includes a redesign or visual-overhaul phase. Hard-stops the agent from making any UI edit until an inventory report exists.

**Where:** `.claude/skills/redesign-scope/SKILL.md` (project-local; also published as a plugin skill so it can be invoked as `/redesign-scope`).

**What it does:**
1. Reads `docs/<version>/<feature-slug>/explorations/*` to find approved mockups and the active design language.
2. Detects the dev server's port (or starts it), then drives Playwright through every route declared in `<feature-slug>/redesign-routes.yaml` (a new operator-authored file: `[{path, device, scenarios}]`).
3. For each route, captures a screenshot to `.tmp/redesign-scope/<feature>/<route>-<scenario>.png` AND a DOM-token snapshot (computed style + bounding rects for known primitive classes).
4. Compares snapshots pair-wise and against the design-language reference; emits `inventory.md` with one row per divergence, ranked by route-pair visibility.
5. Posts the inventory to the operator in chat and writes it into the feature workplan as a `Surfaces in scope` table the agent must keep current as items are fixed.

**How it would have changed the s550 redesign:** On 2026-05-17 20:45, the agent would have asked the operator to confirm the route list (`/connect /play /patches /tones /library` × `s330 s550` × at least two scenarios each), spent 10-15 minutes, and produced a 25-row inventory. The next 60 hours of brute-force would have been the operator walking the inventory in priority order, not discovering it.

**Cost on smaller tasks:** Doesn't fire. The skill is gated by an explicit `<feature-slug>/redesign-routes.yaml` file — features that haven't declared themselves as redesigns don't pay any cost.

### 5.2 CLAUDE.md addition: "complaint-widening default"

**What:** A new section in `/Users/orion/work/audiocontrol-work/audiocontrol/.claude/CLAUDE.md` (close to the existing DRY screaming prelude, since both are scope-discovery rules) that codifies the response shape for visual complaints.

**Proposed text:**

> ## Widen every visual complaint before fixing it
>
> When the operator surfaces a UI inconsistency, the agent's default is NOT to fix the specific instance. The default is:
>
> 1. **Classify the complaint** — header alignment, list row height, button family, chevron size, primitive choice, etc.
> 2. **Search the codebase** — `grep -rn` for every consumer of the same primitive / class / pattern across all editor modules.
> 3. **Visit every route** that consumes it — `browser_navigate` + screenshot per route.
> 4. **Diff and report** — propose a fix that covers every instance, then ask the operator if any should be excluded.
> 5. **Only then** fix.
>
> A one-instance fix is acceptable only if step 2 produces exactly one match. If step 2 produces zero matches, the complaint targets dead or unreferenced code — surface that finding instead of fixing.
>
> *Anti-pattern this rule names:* "the operator pointed at the Tones header; I fixed the Tones header; the operator pointed at the Patches header next; I fixed that too." Pointing twice at the same class is the operator doing the agent's job. Once is acceptable; twice means the audit pass was skipped.

**How it would have changed the s550 redesign:** The 2026-05-17 22:47 "redundant tab label" complaint would have spawned an audit and caught the same anti-pattern on Patches in the same commit. The 2026-05-19 20:14 "patch dropdowns should use AcToggle" complaint never needed to exist — it should have been triggered automatically by the 2026-05-18 00:16 TonesPage AcToggle work.

**Cost on smaller tasks:** Negligible. A `grep -rn` over `modules/*/src` runs in <1s. The cost is "one extra search per visual complaint." Most one-off bugs will pass the search-returns-one-match exit; only cross-cutting issues will trigger the multi-route audit.

### 5.3 Workplan template: "Surfaces in scope" table required for any UX/UI phase

**What:** Modify the `dwd` / feature-definition skill so that any phase whose title or scope contains "UX", "UI", "redesign", "polish", "design language" must include a table of the form:

| Surface | Route | Device(s) | Mockup | Status |
|---|---|---|---|---|
| Patches list | `/roland/s550/editor/patches` | s330, s550 | explorations/03-patches.html | Pending |
| Tones list | `/roland/s550/editor/tones` | s330, s550 | explorations/04-tones.html | Pending |
| ... | ... | ... | ... | ... |

**Where:** `~/.claude/plugins/dw-lifecycle/skills/feature-define/SKILL.md` (or its template). The skill should refuse to write the workplan if the table is missing or has fewer rows than the feature's `redesign-routes.yaml`.

**How it would have changed the s550 redesign:** Phase 9 already had per-page mockups — `explorations/02-homepage.html` through `07-library.html` — but the workplan's Phase 9 task list referenced them only in passing. A required, visible table would have made it operationally obvious which surfaces still had divergences. The 2026-05-13 "false closure" of Phase 9 (`make test-ui-roland` green, but PlayPage sticky chrome still occluded the drawer and parameter sliders were non-functional `role="img"` visualizations) would have been caught when the status column couldn't honestly read "Done" for PlayPage.

**Cost on smaller tasks:** Not applicable; the table is required only for UX/UI/redesign phases.

### 5.4 Pre-commit gate: visual regression across the route inventory

**What:** A `make check-redesign-routes` Make target plus `.githooks/pre-commit` hook that, on any commit touching `modules/*/src/**/*.css` or `modules/*/src/**/*.tsx`, replays the Playwright route inventory and fails if any captured screenshot's perceptual hash diverges from the baseline by more than a threshold *without* a corresponding `redesign-routes.yaml` entry being marked "in flight".

**Where:** `tools/check-redesign-routes.ts` + a Make target + a hook line in `.githooks/pre-commit`.

**How it would have changed the s550 redesign:** The 2026-05-19 18:54 *"the scroll bar on the items list is now default (white background, not overlaid). The three expandable sections on the connect page are unstyled"* regression — caught by the operator running the dev server because his hardware testing session needed it — would have been caught by the gate before commit. The 2026-05-19 21:37 *"Just revert the recent changes. You completely broke the UI."* full revert would not have happened.

**Cost on smaller tasks:** A full route replay is ~30s per commit. For doc-only or non-component commits the hook is a no-op (file-glob check). For component commits it's the only honest signal that the change is intentional across all routes.

**Honest caveat on this proposal:** the operator has already rejected a similar gate idea in spirit (May 20 journal: *"I want you to not make the stupid mistake in the first place. Gates are workarounds for not reading docs"*). I include it as a *catching* mechanism, not as a substitute for the discipline of widening. The DRY pre-commit gate (`check-css-duplication.ts`) was accepted because its target was code-shaped (rule-pair duplication), not behavior-shaped. A visual-regression gate is closer to the latter; the operator may reject it. The skill in 5.1 + the rule in 5.2 are higher-confidence interventions.

### 5.5 Sub-agent prompt update: orchestrator's prompt for visual-fix dispatches

**What:** Add a mandatory prelude to the `ui-engineer` and `frontend-design` sub-agent dispatch templates: *"Before proposing a fix, the dispatched sub-agent must report which other routes in the editor share the same primitive/class/pattern. If the answer is 'more than one,' the sub-agent's recommendation must cover all of them or explicitly justify why each excluded route is fine as-is. The orchestrator will reject a recommendation that fixes only the pointed-at instance."*

**Where:** `~/.claude/agents/ui-engineer.md` (or wherever the agent's system prompt lives), plus a checklist line in the orchestrator's delegation skill.

**How it would have changed the s550 redesign:** Most of the brute-force iterations went through the `/frontend-design:frontend-design` skill (33 invocations on the May 17 transcript alone). The skill returned beautiful, fixed-in-context single-component code each time. With this prelude it would have returned both code AND a "this should also apply to Routes X, Y" callout.

**Cost on smaller tasks:** Trivial — one extra paragraph in the agent prompt. Sub-agents that get a clearly-scoped single-component task (e.g., "build a brand-new SetItem") return "this is a new primitive; no existing routes to widen" in a single sentence.

### 5.6 Inventory artifact in the worktree: `.redesign-inventory/`

**What:** A worktree-local directory the agent writes to during inventory and reads from during fix-and-verify loops. Contains per-route screenshots, the divergence matrix, and a `progress.json` keyed by `surface → status`. Survives across sessions (committed only when phase closes; otherwise gitignored).

**Where:** `.redesign-inventory/` at the worktree root, gitignored except when the feature closes. The `redesign-scope` skill writes here; the orchestrator reads here before every dispatch.

**How it would have changed the s550 redesign:** Multi-machine work (orion-m4 ↔ orion-m1) was a constant friction (the CLAUDE.md notes "session context does NOT sync"). An on-disk inventory artifact bridges the gap: the May 19 session on a different machine still sees what the May 17 session enumerated.

**Cost on smaller tasks:** None — the artifact only exists when 5.1 fires.

## 6. Caveats and honest uncertainty

- **Some iteration was unavoidable.** The 2026-05-18 19:11 mockup-review exchange where the operator iterated on the Connect-page mockup itself (*"I like option A. A few comments: a) we need to make sure we don't hard-code the device name… b) Simplify 'ENGAGE CONNECTION' to 'CONNECT'… c) We should have collapsible affordances…"*) shows the design language was still being refined during the brute-force tail. An upfront inventory wouldn't have eliminated the mockup-iteration cycles — but it would have separated *design iteration* (legitimately serial) from *application iteration* (which is the part that should have been a single pass).
- **The operator's explicit mothballing decision on 2026-05-17 20:45 is load-bearing.** They explicitly rejected the structured Phase 9R remediation plan in favor of brute force. Any countermeasure I propose has to be acceptable inside a brute-force frame — operators choose brute force when structured plans collapse under their own paperwork. The `/redesign-scope` skill in 5.1 fits this constraint because it's a single 10-15 minute upfront cost with no ongoing process tax; the workplan-table requirement in 5.3 does NOT fit and may be rejected.
- **I cannot tell from the transcripts whether the agent ever asked itself "should I audit all routes here?" and decided against it, or whether the question never came up.** The agent's text output is sparse on meta-reasoning — most assistant-text turns are short fix-confirmation messages between tool calls. The lack of evidence cuts both ways; this report assumes the question never came up because that matches the operator's "you keep finding things one at a time" framing, but a more charitable read is that the agent considered widening and judged the brute-force frame to forbid it.
- **The 121-nav + 67-nav figures on May 17 / May 20 over-count the work**, because many are repeats of the same `?midi=simulated&scenario=tones-bank-0` URL during a long edit-verify loop on one page. The qualitative claim — every nav follows an operator turn, never precedes one as inventory — holds; the quantitative claim is "the agent never visited >2 distinct routes within any 10-minute window without an operator-triggered context switch in between."
- **The pre-commit gate proposal (5.4) is the weakest of the six.** Visual regression testing across 10+ route×scenario combos is flaky enough that a strict gate would generate false positives that erode trust faster than it catches real regressions. I'd land 5.1, 5.2, 5.3, 5.5, 5.6 first and consider 5.4 only after the upstream skills demonstrate value.

---

**Bottom line:** The agent treated the operator's brute-force opening as *"reactive single-fix loop"* when a defensible reading was *"brute-force inventory walk."* Both shapes fit the operator's words. The first costs five days; the second costs ninety minutes. The countermeasure that buys the most leverage is the `/redesign-scope` skill (5.1) plus the complaint-widening default in CLAUDE.md (5.2). Together they make the default response to *"this looks wrong"* into *"let me find every place it looks wrong"* rather than *"let me fix this one place."*
