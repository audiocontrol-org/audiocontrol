---
name: scope-widen
description: "Run targeted discovery for a mid-implementation operator complaint. Identifies all sibling surfaces consuming the same primitive/pattern; produces a widening proposal in the dispatch-wrapper-grammar format."
user_invocable: true
---

# scope-widen

When an operator surfaces an inconsistency mid-feature (e.g., *"the Patches header is misaligned"* or *"the Tones chevron is too small"*), this skill runs targeted discovery focused on the specific complaint, identifies every sibling surface that consumes the same primitive/pattern, and produces a widening proposal in the structured grammar the dispatch wrapper validates.

The skill's output is the audit trail: the operator (and the dispatch wrapper, if applicable) can verify the audit happened by reading the `Searched: / Included: / Excluded:` block.

`/scope-widen` is the mid-implementation companion to `/scope-inventory` ([SKILL.md](../scope-inventory/SKILL.md)). Where `/scope-inventory` runs the full discovery-agent fleet upfront, `/scope-widen` runs a targeted grep-and-classify pass against the specific complaint — no manifest, no run directory, no journal entry. The output lives in chat for the operator's decision.

## When to use

- An operator complaint surfaces a cross-cutting class. E.g., *"the chevron is too small on the connect page"* (likely affects every collapse/expand chevron in the editor).
- A code review identifies a near-duplicate that should have been caught by the upfront `/scope-inventory` pass.
- During implementation, you realize a pattern you're applying might need to apply across more files than the workplan named.

If the operator wants to re-inventory the whole feature, use `/scope-inventory` instead.

## Argument

```
/scope-widen <complaint>
```

`<complaint>` is a free-text description of what the operator surfaced. The skill parses it heuristically to identify:

- The CSS class or selector if mentioned (`.ac-list-bank-chevron`).
- The component name if mentioned (`<DetailHead>`, `<Chevron>`).
- The page/route that surfaced the complaint (`patches`, `tones`, `connect`).
- The pattern shape (sizing, color, alignment, primitive choice, copy text).

If the complaint is too vague to extract a concrete grep target, **ask the operator to refine before running discovery.** Don't proceed with a vague search; vague searches return noise that pollutes the proposal.

## Procedure

### 1. Parse the complaint

Read the complaint text. Identify:

- A specific selector / class / component name to grep for.
- The page/route that surfaced the complaint.
- The class of inconsistency (sizing, color, alignment, primitive choice, copy text).

If you can't extract at least one concrete grep target, stop and ask the operator: *"Which specific element / class / component does the complaint refer to? I need a grep target like `.ac-list-bank-chevron` or `<DetailHead>` to enumerate siblings."* Don't proceed.

### 2. Run targeted greps

Use the project's `Bash` tool to invoke `grep -rn` (or `git grep`) for the identified target across `modules/*/src/`. Common shapes:

```bash
# CSS class consumers
grep -rn 'ac-list-bank-chevron' modules/*/src/

# Component usage
grep -rn '<DetailHead' modules/*/src/

# Combined CSS + TSX
grep -rEn '(ac-detail-head|className=.*detail-head)' modules/*/src/
```

The orchestrator (you, executing the skill) chooses the targets based on the complaint's content. Run multiple greps if the complaint covers multiple shapes (e.g., *"header misaligned"* might mean both `.ac-detail-head` class consumers AND `<DetailHead>` component usages).

Record the exact pattern string passed to grep — it becomes the `Searched:` line of the proposal.

### 3. Inspect each match

For each match, briefly read the surrounding code to confirm whether the match is a true sibling of the complained-about case. False positives:

- Tests / fixtures (already excluded by `.jscpd.json` for clone-detection, but grep finds them).
- Comments mentioning the class name.
- Different intentional usage (e.g., a chevron in a marketing page vs an in-app dropdown).

Classify each match as **Included** (true sibling, should be fixed with the in-flight change) or **Excluded** (intentionally different — and write a non-deferral reason for why).

### 4. Produce the widening proposal

Emit the proposal in the exact dispatch-wrapper grammar (from [`tools/scope-discovery/dispatch-grammar.ts`](../../../tools/scope-discovery/dispatch-grammar.ts)):

```
Searched: <pattern> — <N matches>
Included: <file:line>, <file:line>, ...
Excluded: <file:line> — <one-line reason that is not a deferral>
           [, <file:line> — <reason>, ...]
```

Format rules (mirrors what the wrapper validates):

- `Searched:` — the grep pattern + total match count.
- `Included:` — file:line pairs the proposed fix should cover. Single comma-separated block (may wrap across lines; the parser collects continuation lines until a blank line or a fresh top-level label).
- `Excluded:` — file:line pairs intentionally left out of the fix, each with a one-line reason that is NOT a deferral phrase.

If `Searched:` reports >1 match, the proposal must classify EVERY match — either into `Included:` or `Excluded:`. A multi-match search with only one inclusion and no exclusions is the "skipped-the-audit" pattern that the dispatch wrapper rejects (`dispatch-grammar.ts` §`validateParsed` Rule 1).

### 5. Forbidden deferral phrases in `Excluded:` reasons

Excluded reasons must explain WHY the match is intentionally different (different primitive, intentionally narrower viewport, etc.), not WHEN it'll be fixed.

The canonical forbidden-phrase list lives in [`tools/scope-discovery/dispatch-grammar.ts`](../../../tools/scope-discovery/dispatch-grammar.ts) (`FORBIDDEN_DEFERRAL_PHRASES` + `FORBIDDEN_DEFERRAL_REGEXES`). At time of writing it includes substrings *"for now"*, *"just for now"*, *"we'll fix"*, *"we'll get"*, *"we'll come back"*, *"will fix"*, *"will address"*, *"address in"*, *"eventually"*, *"todo"*, *"fixme"*, *"hack"*, *"xxx"*, *"temporary"*, *"stub"*, *"placeholder"*, *"pending"*, *"defer"*, *"deferred"*, *"next pass"*, *"next time"*, plus regex collocations like *"until F<digit>"*, *"until v<digit>"*, *"until phase <digit>"*, *"fix it later"*, *"as a follow-up"*, *"follow-up issue"*.

Check the source file for the authoritative list before emitting the proposal — the wrapper enforces case-insensitive substring match against every Excluded reason. The rationale lives in [`.claude/rules/agent-discipline.md`](../../../.claude/rules/agent-discipline.md) §*"Just for now is bullshit"*.

### 6. Present in chat

Format the proposal as a code block + a one-paragraph explanation of what the proposal covers and what the operator should confirm:

````markdown
## Widening proposal — <complaint summary>

```
Searched: <pattern> — N matches
Included: <file:line>, ...
Excluded: <file:line> — <reason>, ...
```

This proposal covers <N> sibling surfaces. The Included matches share <attribute>; the Excluded matches are intentionally different (<reasons>). To apply: confirm the proposal, then I'll widen the in-flight fix to cover the Included set.
````

If the proposal is large (>10 file:line pairs), suggest the operator paginate the review:

> The Included set has <N> entries — review in batches. If any line classifies wrong, point at it and I'll re-grep + re-classify.

### 7. Handle a "no widening needed" outcome

If the grep returns exactly one match, the original fix already covers the scope. Report:

```
## Widening proposal — <complaint summary>

Searched: <pattern> — 1 match
Included: <file:line>

Single match. No widening needed — the in-flight fix already covers the scope.
```

If the grep returns zero matches, the complaint may target dead code or an off-by-one description. Surface that finding instead of proceeding:

```
## Widening proposal — <complaint summary>

Searched: <pattern> — 0 matches

Zero matches. The complaint may target a different selector, a component name spelled differently, or code that no longer exists. Refine the complaint and re-invoke.
```

## What this skill does NOT do

- **Modify code or apply the fix.** Output is a proposal; the operator confirms before any edit. The widening itself happens through the normal implementation loop (`/dw-lifecycle:implement` or a direct edit).
- **Validate the proposal via the dispatch wrapper.** The wrapper validates returns from `Agent()` dispatches; `/scope-widen` produces grammar-shaped output for the operator's audit, not for programmatic validation. If the operator wants to round-trip the proposal through the wrapper, that's a separate workflow.
- **Run the full discovery-agent fleet.** `/scope-widen` is targeted — only the patterns the complaint surfaces. Use `/scope-inventory` for a fleet sweep.
- **Re-run upfront discovery or touch the `scope-manifest.yaml`.** This skill is purely about audit-and-propose for a single in-flight complaint; it has no on-disk artifacts.
- **Write a journal entry.** The chat output IS the audit trail. Anything that should persist beyond the session lives in the operator's commit message or the workplan, not in a `/scope-widen`-managed file.

## Error handling

| Failure | Skill response |
|---|---|
| Complaint too vague to extract a grep target | Refuse to proceed. Ask the operator for a concrete selector / class / component name. Provide examples. |
| Grep returns 0 matches | Surface the zero-match finding (see §7). Ask whether the complaint targets a different pattern. Do NOT emit an empty proposal. |
| Grep returns >1 match and a match's classification is ambiguous | Present the ambiguous candidates and ask the operator to disambiguate before finalizing the proposal. Do NOT guess. |
| Operator's complaint names a pattern that already has a curated `scope-manifest.yaml` entry | Surface the existing entry and ask whether the complaint is widening the entry or naming a new one. The manifest is binding; widening it without acknowledgement bypasses the curation step. |

## Cross-references

- Sibling skill — [`.claude/skills/scope-inventory/SKILL.md`](../scope-inventory/SKILL.md)
- Dispatch grammar (forbidden-phrase list + parser) — [`tools/scope-discovery/dispatch-grammar.ts`](../../../tools/scope-discovery/dispatch-grammar.ts)
- Dispatch wrapper — [`tools/scope-discovery/dispatch-wrapper.ts`](../../../tools/scope-discovery/dispatch-wrapper.ts)
- Agent-discipline rule that drives the forbidden-phrase list — [`.claude/rules/agent-discipline.md`](../../../.claude/rules/agent-discipline.md) §*"Just for now is bullshit"*
- Workplan T3.4 — [`docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md`](../../../docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md)
