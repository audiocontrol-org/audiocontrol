---
paths:
  - "modules/*/src/**/*.css"
  - "modules/*/src/**/*.tsx"
  - "modules/editor-core/src/design/**"
---

# CSS refactor protocol — screenshot first, one rule at a time

This rule exists because a sweeping cross-page CSS refactor on
`feature/s550-support` (2026-05-19) renamed shared chrome classes and
deleted per-page duplicates, with the "guarantee" that the test gates
passed. The visual result was broken — labels clipped, layouts collapsed —
and the operator had to take the screenshots that should have been the
first step. Reverted to HEAD; recorded here so it never happens again.

## When this rule fires

Any time an edit touches:

- A CSS file used by two or more pages (`modules/*/src/styles/*.css`,
  `modules/editor-core/src/design/*.css`, `modules/roland-sxx0-editor/src/styles/_shared.css`).
- A class name in JSX that's shared across two or more pages.
- A token or design variable consumed by cross-page primitives.

If the edit is wholly contained in a single page's component AND its
page-scoped class, this rule doesn't fire — proceed normally.

## The protocol

Before touching any line of CSS that meets the above:

1. **Start the dev server** (`pnpm dev` in the affected editor module
   or `make` from the root). Confirm it serves.

2. **Screenshot every affected page** via the Playwright MCP browser
   tools. The default surfaces for the Roland editor:
   - `/roland/s550/editor/connect` (Connect)
   - `/roland/s550/editor/play` (Play)
   - `/roland/s550/editor/patches` (Patches — with a patch selected)
   - `/roland/s550/editor/tones` (Tones — with a tone selected)
   - `/roland/s550/editor/library` (Library)

   Save baselines under `.tmp/baseline-<page>.png`. These are not
   tracked artifacts; they're scratch comparators for this single
   edit's verification loop.

3. **Make the smallest possible change.** One rule. One property. One
   class rename. Never a sweep. If the refactor "needs" to be sweeping,
   it's actually N small refactors and they each get their own loop.

4. **Re-screenshot every page** to `.tmp/after-<page>.png`. Diff
   pairwise against the baseline. Tools:
   - `compare` (ImageMagick) for a per-pixel mask
   - Read both PNGs back into Claude Code (multimodal) and visually
     compare side-by-side
   - `getBoundingClientRect()` probes on specific elements for
     pixel-precise position deltas

5. **If any pixel moved that wasn't supposed to: STOP.** Revert the
   change. Diagnose. Do not push forward and "fix the regression in
   the next commit" — the next commit cascades into the same trap.

6. **If everything matches**, commit that single change, then return
   to step 3 for the next rule.

## Tools that enforce this

The `make check-css-duplication` Make target + the pre-commit hook
in `.githooks/pre-commit` block NEW cross-page duplication at commit
time. Pre-existing pairs catalogued in
`tools/check-css-duplication.expected.txt` don't block — they're
backlog. As duplicates are unified through the protocol above, remove
their stems from the expected list in the same commit.

## What this rule explicitly forbids

- "Refactor first, screenshot at the end."
- Trusting test-gate green as proof of visual correctness. Tests
  verify behavior. Pixels verify pixels. They are different signals.
- Deleting a page-scoped CSS rule with the assumption that an
  identically-named shared rule will substitute. CSS specificity,
  cascade order, and DOM context all break that assumption. Verify
  computed styles per element after the swap, not just before.
- Sweeping JSX class renames via a shell script across many files
  in a single commit. Per-file is the unit, not per-script.

## Why this lives here

Memory-based discipline (`~/.claude/projects/.../memory/`) is keyed
to one user on one machine. It does not survive across worktrees,
clones, or dev environments. This file is tracked in git and loads
on every session in this repo regardless of operator or workspace.
The pre-commit hook is the enforcement layer; this rule is the
agent-readable description of why it exists and how to work
without tripping it.
