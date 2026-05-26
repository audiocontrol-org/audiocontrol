# Visual Verification Protocol

## Purpose

How UI work gets verified, ratified, and closed in this repo. Optimized for the case where structural tests verify DOM shape but not appearance, and where the operator's eye is the only check on rendered pixels.

Earlier versions of "done" relied on green test gates + sub-agent DONE reports as proof of correctness. That model produced shipped regressions that the operator caught at review — invented box chrome on plain-text spans, collapsed grids, missing pill toggles, slider rows with overlapping labels and readouts. The pattern: a sub-agent reasons "X probably needs Y styling" and adds Y; tests assert X exists, which it does, so tests pass; the rendered chrome ships broken because nobody looked at it. This document codifies the discipline that stops that loop.

## The empirical failure this protocol prevents

The `akai-harmonization` Phase 4 visual-fidelity review (2026-05-25, commits `885b2d61` → `7d141ea3`) ran the failure end-to-end and then ran the fix end-to-end. The instructive parts:

- **Failure run.** Controller dispatched 4 sub-agents to close 4 audit findings (collapsed slider grids, missing AcRadioTabs, missing detail-pane chrome, broken mockup capture infrastructure). Each sub-agent reported DONE. All controller-side test gates re-ran green: 43 UI tests, 33 editor-core UI tests, 4 roland UI tests, 242 akai unit tests. Controller delivered a post-fix screenshot to the operator. The operator rejected it verbatim: *"no — there's still a lot of broken stuff … haphazard vertical alignment … many drop-down controls that still need to be converted to toggles … you have a lot more work to do."*

- **Diagnosis.** Investigation found `.ac-compact-field--readout > .ac-field-readout` had been given `padding + border + background + border-radius` chrome that the mockup HTML didn't ask for. A prior sub-agent had reasoned "readouts probably need chrome" and added it. Tests asserted the `<span class="ac-field-readout">` element existed, which it did, so tests passed. The mockup HTML uses `<span class="ac-field-readout">A03</span>` — plain text, no chrome. The rendered live page wrapped values in fake input boxes. Test suite verified structure; only the operator's eye caught the chrome.

- **Operator's named diagnosis.** *"the columnar alignment isn't a problem. the elements in a row don't line up. I suspect you aren't using a sane layout strategy and are instead hard coding values that should be maintained by the layout manager. Why is the implementation so broken when the mockup isn't? Are you making shit up and offroading?"* The answer was yes — the implementation had drifted from the literal mockup contract because nobody read the rendered output before claiming done.

- **Successful fix run.** Direct hand-edit (no sub-agent layer), build, capture via `tools/visual-fidelity/capture.mjs`, `Read` the captured PNG, observe the broken render of an invented `.ac-app-shell--single` CSS modifier that doesn't exist, fix to use plain `.ac-detail-scroll`, capture again, observe clean output, deliver to operator. Operator confirmed "much better."

- **Operator's named lesson.** *"five concrete things changed: (1) direct work over delegation for small/focused changes; (2) visual capture as part of the 'done' gate, not the post-mortem; (3) read actual code instead of speculating; (4) mockup HTML treated as literal contract; (5) tight see-edit-see iteration on small units."*

This document operationalises those five lessons.

## Scope — when this protocol fires

**Required** for any change that touches:

- `modules/*/src/**/*.{tsx,jsx}` — React components and pages
- `modules/*/src/**/*.{css,scss}` — design system, primitive styles, page-scoped styles
- `modules/editor-core/src/design/*` — design tokens, primitive CSS, anything cross-consumer
- Any file that promotes a primitive from per-editor to shared (`editor-core`)
- Any file that changes a CSS class name used in JSX

**Not required** for changes that touch only:

- Backend / device-protocol code (`modules/sampler-*`, `modules/scsi-midi-bridge`)
- Pure tooling (`tools/**`, `scripts/**`)
- Pure documentation (`*.md`, JSDoc comments)
- Test code that doesn't change UI source
- Configuration that doesn't affect rendering (`package.json`, `tsconfig.json`, etc.)

Commits that legitimately skip the protocol declare it in their commit message via `Visual-verify: skipped-<substantive-reason>` (see Mechanical Enforcement below).

## The loop

For every UI-touching change, the operator and every agent dispatched to do the work must follow this loop:

```
1. Edit         → Make the smallest scoped change that addresses the task.
2. Build        → `make` (or per-module `pnpm build`). Must succeed.
3. Capture      → Run the visual-capture script for affected routes.
                  `node tools/visual-fidelity/capture.mjs`
                  Output lands in `.tmp/visual-fidelity/<route>-<viewport>.png`.
4. Read         → Use the `Read` tool on each captured PNG. Look at the
                  rendered chrome with your own eyes (multimodal Read works
                  for sub-agents too). Compare against the canonical mockup
                  PNG (`mockup-<page>-<viewport>.png`) side-by-side.
5. Decide       → Does the live render match the mockup modulo data?
                  - If YES: proceed to step 6.
                  - If NO: return to step 1. Do not claim done. Do not commit
                    until the chrome matches.
6. Deliver      → `SendUserFile` the post-fix PNG to the operator with a
                  short caption naming what changed and what to look at.
7. Test         → Re-run the structural test gates. They MUST stay green.
                  This is the SECOND signal; the visual capture is the FIRST.
8. Commit       → Single commit. Message MUST carry `Visual-verify: <routes>`
                  enumerating the routes captured. Cite the audit finding
                  if any (`Closes AUDIT-YYYYMMDD-NN`).
9. Push         → Standard branch push. Operator can review the delivered
                  screenshot independently of code review.
```

Steps 3-6 are non-negotiable. The capture-and-Read step is what makes "done" honest.

## Roles

| Role | Responsibility |
|---|---|
| Operator | Authors the mockup HTML+CSS that constitutes the literal visual spec. Reviews delivered screenshots. Rejects or accepts. Catches what the test suite + capture loop missed. |
| Controller (main agent) | Drives implementation. For small/focused changes, does the work directly per the loop above. For large refactors, dispatches sub-agents with briefs that REQUIRE the sub-agent to capture+Read before reporting DONE. Re-captures independently after every sub-agent dispatch (controller IS the gate). Delivers screenshots to operator at every page-touching task boundary. |
| Sub-agent | Executes a focused brief. MUST capture rendered output and Read PNG before reporting DONE. MUST quote the captured PNG path(s) in the DONE report. May NOT defer visual verification to "the controller will check" — that's a violation of the dispatch contract. |

## The mockup-as-contract rule

The mockup HTML and CSS in `docs/<version>/<feature>/mockups/` are the **literal visual spec**, not "inspiration." Implementation CSS for any class `.ac-foo` shared with the mockup must render the same chrome.

Practical implication: if the mockup uses `<span class="ac-field-readout">A03</span>` with no border, no padding, no background, then the implementation's CSS for `.ac-field-readout` MAY NOT declare those properties. "It would look more readout-y with chrome" is not a justification. The mockup is the spec.

Cross-checks:

- Before adding any CSS property to a shared class, grep the mockup CSS + HTML for that class. If the mockup doesn't use the property, the implementation can't add it without operator approval recorded in the task's audit-log entry.
- When promoting a primitive (e.g., `.tones__param-rows` → `.ac-param-rows`), re-screenshot every consumer page, not just the page that drove the promotion. Cross-consumer drift is the most common breakage shape.

## Anti-patterns

Each of these has shipped at least once. Recognize them in your own work and stop.

| Anti-pattern | Why it ships broken UI |
|---|---|
| "Tests pass → done" | Tests assert DOM shape. They have zero opinion on whether rendered pixels match the mockup. Green tests + broken chrome is the most common shipped-regression pattern. |
| "Sub-agent reported DONE → done" | Sub-agent reports describe intent. Without capture+Read evidence quoted in the report, intent and reality are different signals. |
| "Looks roughly right in the screenshot → done" | "Roughly right" is the next-review's bug report. Match the mockup, or document the drift in the audit log with operator acceptance. |
| Inventing CSS to match a "vibe" | The mockup is the contract. If the mockup uses plain text, the implementation uses plain text. Box chrome / inset shadow / gradient backgrounds that the mockup doesn't show are inventions. |
| Inventing CSS class modifiers | `.ac-app-shell--single` doesn't exist; using it shipped a 260px-wide collapsed editor. If you can't find the class in the canonical CSS, it doesn't exist. Use the documented primitives. |
| Batching screenshots across many pages | The bug surfaces at page N+1; by then you've made follow-on changes that compound on the broken N. Screenshot AT each page-touching task boundary, not at the end of the phase. |
| Trusting structural test coverage as a proxy for visual coverage | They're orthogonal contracts. Structural tests are necessary; they're not sufficient. |
| "I'll add a chrome fix in a follow-up commit" | The follow-up doesn't happen. The "for now" CSS ships as the new default. See `.claude/rules/agent-discipline.md` §"Just for now is bullshit." |
| Speculating about layout root causes without grep | Before claiming "this is broken because of subgrid / display-flex / specificity," grep for the actual CSS rule, read it, quote the file:line. Speculation drifts; reading doesn't. |

## Mechanical enforcement

The pre-commit gate enforces visual verification at the commit boundary.

**Rule:** any commit touching `modules/*/src/**/*.{tsx,jsx,css,scss}` must carry one of these markers in its commit message:

```
Visual-verify: programs-desktop, programs-mobile
Visual-verify: keygroup-editor-desktop
Visual-verify: skipped-test-fixture-only-no-rendering-effect
```

The marker format:

- `Visual-verify: <comma-separated-routes>` — names the routes actually captured. The captured PNGs must exist at `.tmp/visual-fidelity/<route>-<viewport>.png` with mtime newer than the staged source files.
- `Visual-verify: skipped-<substantive-reason>` — for commits whose UI-source touch genuinely doesn't change rendering (test-only edits, comment-only edits, dead-code removal). The reason must be ≥ 40 characters AND must not contain gaming phrases (`TBD`, `next commit`, `for now`, `will add later`, etc.). Validator mirrors the AUDIT-20 `substantive_reason` pattern at `tools/scope-discovery/util/substantive-reason.ts`.

The pre-commit hook fails the commit if:

- A staged file matches the UI-touching glob AND no `Visual-verify:` marker is present.
- The marker is `Visual-verify: <routes>` but no matching `.tmp/visual-fidelity/<route>-<viewport>.png` exists, OR its mtime is older than the staged source files.
- The marker is `Visual-verify: skipped-<reason>` but the reason fails the substantive-reason validator.

A gutted-stub self-check (per `.claude/rules/agent-discipline.md` §"Validator-paired changes") proves the gate's rejection has teeth. The hook lives alongside the existing pre-commit gates (clone-detection, anti-pattern, adopter-manifest, chevron-sizing).

## Sub-agent dispatch contract

Every sub-agent dispatch brief that touches UI source MUST contain these sections, verbatim:

1. **The routes the sub-agent will capture** — explicit list (e.g., `/akai/s3000xl/editor/test/keygroup-editor`).
2. **The canonical mockup the live render must match** — explicit path (e.g., `docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/keygroups.html`).
3. **The capture command** — explicit invocation (e.g., `node tools/visual-fidelity/capture.mjs`).
4. **The contract** — sub-agent's DONE report MUST quote the captured PNG path(s). Sub-agent MUST iterate (capture → Read → fix) before reporting DONE. Sub-agent MAY NOT defer visual verification to "the controller will check."
5. **The commit-message contract** — the sub-agent's commit message MUST carry `Visual-verify: <routes>` enumerating the routes captured.

The controller, after receiving a sub-agent's DONE report, MUST:

- Re-capture independently using the same script.
- Read the resulting PNG.
- Compare against the mockup.
- If the live render diverges from the mockup, REJECT the sub-agent's DONE and re-dispatch with the specific delta named in the brief.
- Only after the controller's independent capture+Read matches the mockup may the controller forward the result to the operator.

This is the visual analog of the existing rule `.claude/rules/agent-discipline.md` §"When CI is absent, the controller is the gate." That rule covers structural tests; this protocol extends it to visual fidelity.

## Concrete examples from this session

### What went wrong: invented box chrome on plain readouts

A prior sub-agent added to `modules/editor-core/src/design/compact-grid-primitives.css`:

```css
.ac-compact-field--readout > .ac-field-readout {
  padding: var(--ac-space-1) var(--ac-space-3);
  border: var(--ac-rule-hairline) solid var(--ac-color-border-subtle);
  border-radius: var(--ac-radius-sm);
  background: color-mix(in srgb, var(--ac-color-surface-canvas) 70%, transparent);
  font-size: var(--ac-text-base);
}
```

Mockup HTML for the same class:

```html
<span class="ac-field-readout">A03</span>
```

The mockup uses plain text. The implementation rendered fake input boxes around 2-character values, with the vertical baseline drifting because the boxed values sat at a different y-coordinate than the plain-text labels next to them. The operator's "haphazard vertical alignment" complaint traced directly to this rule.

Fix landed at commit `2d38407b` — delete the box-chrome declarations, override `.ac-compact-field--readout` to `flex-direction: row` so the layout manager places label and value on one baseline.

### What went wrong: invented CSS class modifier

The first version of `TestKeygroupEditorPage.tsx` used:

```tsx
<div className="ac-app-shell ac-app-shell--single">
```

`.ac-app-shell--single` doesn't exist in the design system. `.ac-app-shell` is a 2-col grid that collapses without a list child. The captured screenshot showed the editor crushed into a ~260px column with all labels stacked vertically. The bug was caught at step 4 (Read the PNG) BEFORE step 6 (deliver to operator).

Fix landed before delivery — replaced with plain `<div className="ac-detail-scroll">`. The operator never saw the broken render.

### What went right: see-edit-see loop

For the readout-chrome fix:

1. Read `compact-grid-primitives.css` — found the offending rule at line 76-82.
2. Edited the rule (4-line deletion + flex-direction override).
3. Rebuilt editor-core.
4. Ran `node tools/visual-fidelity/capture.mjs`.
5. Read `live-programs-desktop.png` — saw `PROGRAM # 01    KEYGROUPS 1` rendered horizontal as plain text. Matched the mockup.
6. Delivered the screenshot to the operator.
7. Tests re-ran green (242 passed).
8. Committed with `Closes AUDIT-…` and `Visual-verify: programs-desktop, programs-mobile`.
9. Pushed.

Total time: ~15 minutes. Compared to the prior dispatch loop (sub-agent → tests → false-DONE → operator catches → revert and restart), the see-edit-see loop was faster AND produced clean output the first time it claimed done.

## What success looks like

- The operator receives a fresh screenshot at every page-touching task boundary, without asking.
- The screenshot matches the canonical mockup modulo data, OR the audit log entry documents the operator-accepted drift.
- Sub-agent DONE reports quote the captured PNG path(s). Sub-agent dispatches whose reports lack capture evidence are rejected and re-dispatched.
- The pre-commit gate's `Visual-verify` marker requirement catches commits that touch UI source without an accompanying capture; reviewers don't have to manually check.
- The operator's "next-review" surprise — finding broken chrome hours after the agent claimed done — drops to zero.

## Cross-references

- Companion rule: `.claude/rules/agent-discipline.md` §"When CI is absent, the controller is the gate" (structural-test re-run discipline; this protocol extends it to visual fidelity).
- Companion rule: `.claude/rules/css-refactor.md` (screenshot-first, one-rule-at-a-time discipline; this protocol generalises beyond CSS-only refactors).
- Companion rule: `.claude/rules/agent-discipline.md` §"Validator-paired changes" (the gutted-stub teeth-proof pattern this protocol's pre-commit gate adopts).
- Mockup home: `docs/<version>/<feature>/mockups/` per feature.
- Capture tooling: `tools/visual-fidelity/capture.mjs`.
- Substantive-reason validator: `tools/scope-discovery/util/substantive-reason.ts`.
- Upstream proposal (in flight): `audiocontrol-org/deskwork` feature request — canonicalize this protocol in the `dw-lifecycle` plugin so it applies to every adopting project, not just this repo.
- Incident commits (for forensic reference): `885b2d61` → `7d141ea3` on `feature/akai-harmonization` (2026-05-25 evening through 2026-05-26 morning).
