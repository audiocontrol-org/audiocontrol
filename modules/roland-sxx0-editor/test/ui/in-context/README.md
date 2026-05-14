# Tier 3 — In-context page tests (roland-sxx0-editor)

## What this tier proves

The primitive works **on its real page with its real fixtures**. Same four
claims as Tier 2 (reform spec §4) — accessibility-role query, real pointer
events, user-observable outputs, credibility against declared broken
variants — but the rendered DOM is the production page, not a harness
route.

Tier 3 catches layering bugs that Tier 2 cannot see by construction:
occlusion by sticky overlays, parent-grid column collapse to zero width,
`pointer-events: none` ancestors, and other context-introduced regressions.

One spec per page: `patches`, `tones`, `play`, `library` (reform spec
"Migration" section).

## Patterns allowed

Identical to Tier 2:

- `page.getByRole(...)` accessibility-role queries
- `page.mouse.*` with coordinates from `boundingClientRect`
- Assertions on `aria-valuenow`, rendered readout text, simulated MIDI
  adapter bytes, `elementsFromPoint` results
- `.meta({ credibleAgainst: [...] })` declaration on each spec

Tier 3 additionally exercises the production page's data flow against the
existing simulated MIDI fixtures (reform spec "What does NOT change").

## Patterns forbidden

Same forbid-list as Tier 2 (enforced by the same ESLint rule):

- `.fill(` / `.value =` / `dispatchEvent(` / `element.click()`
- `getByTestId(` / `[data-testid=` / `[data-test=`
- Imports from `src/internal/` or `src/private/`

These shortcuts are allowed only in `test/wiring/`.

## Context-variant credibility

Tier 3 specs declare context-level broken variants (per reform spec §5)
under `__broken__/contexts/`:

```ts
test('D-TONE-ENV-02: segment Time bar reachable on TonesPage Amp tab', ...)
  .meta({ credibleAgainst: ['sticky-overlay', 'zero-width-grid'] });
```

Context variants wrap the harness rather than swap the primitive — they
prove the spec would fail if the production page introduced an occluding
overlay or collapsed the column the primitive lives in.

## Relationship to the coverage manifest

`tools/generate-coverage-manifest.ts` tags specs under this directory as
`tier: 3`. Per reform spec §6, `coverage: confident` requires Tier 2 +
Tier 3 + Tier 4 (operator sign-off in the inventory's `Sign-off` column).
A capability with only Tier 3 evidence is `partial`.

## See also

- Reform spec: `docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`
  (§2 tier table; §4 Validity Claim A; §5 Validity Claim B; §6 manifest;
  §7 operator sign-off)
- Workplan: `docs/1.0/001-IN-PROGRESS/s550-support/workplan.md` §9R-A
