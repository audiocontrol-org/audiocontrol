# Tier 2 — Primitive contract tests (akai-s3k-editor)

## What this tier proves

The interactive primitive (e.g. `AcRangeBar`, `AcSlider`, `AcSelect`,
`AcCheckbox`, `AcNumberInput`, `AcEnvelopeTable`, `AcEnvelopeGraph`,
`AcEnvelopeMeta`) works **in isolation** as a user-facing control.

Each spec mounts the production primitive against a harness route with a
stubbed consumer and a window-exposed `onChange` spy. The four claims
(reform spec §4):

1. The affordance is reachable by accessibility role + name.
2. Real pointer events at real coordinates drive value changes.
3. User-observable outputs (`aria-valuenow`, rendered readout text, spy
   invocations) reflect the change.
4. The spec is **credible** — it fails against at least one declared
   `__broken__` variant of the primitive and passes against the real one.

The akai-s3k-editor shares `editor-core` primitives with `roland-sxx0-editor`,
so the broken-variant registry is the same registry (one location of
truth — reform spec §"What changes (new infrastructure)").

## Patterns allowed

- `page.getByRole('slider', { name: 'Cutoff' })` and other role-name queries
- `page.mouse.move(x, y)` / `page.mouse.down()` / `page.mouse.up()` using
  coordinates derived from `boundingClientRect`
- Assertions on `aria-valuenow`, `aria-valuetext`, rendered text content
- Assertions on a window-exposed `onChange` spy invocation count and args
- `.meta({ credibleAgainst: ['<variant>', ...] })` declaration on each spec

## Patterns forbidden

The ESLint rule `@audiocontrol/eslint-plugin-test-discipline` rejects:

- `.fill(` — bypasses the pointer engine
- `.value =` (any assignment to `.value` in `page.evaluate`) — bypasses the
  pointer engine
- `dispatchEvent(` — synthetic events bypass the browser's input pipeline
- `element.click()` — use `page.mouse.click(x, y)` against a coordinate
- `getByTestId(` / `[data-testid=` / `[data-test=` — queries must originate
  from accessibility surface, not implementation hooks
- Imports from `src/internal/` or `src/private/` — primitives are tested
  through their public surface only

These shortcuts are allowed in `test/wiring/` and forbidden here.

## Spec-name convention

Each spec declares the D-ID(s) it covers via the `D-<AREA>-<NN>:` prefix
(reform spec §3). One spec may cover multiple D-IDs:

```ts
test('D-PROG-FLT-02 / D-PROG-FLT-03: cutoff and resonance sliders respond to drag', ...);
```

## Relationship to the coverage manifest

`tools/generate-coverage-manifest.ts` tags specs under this directory as
`tier: 2`. The credibility runner records `credibleVerified: true` only when
the spec passes against the unbroken harness AND fails against every
variant in its `credibleAgainst` list (reform spec §5). Per §6,
`coverage: confident` requires Tier 2 + Tier 3 + Tier 4 — Tier 2 alone is
`partial`.

## See also

- Reform spec: `docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`
  (§2 tier table; §4 Validity Claim A; §5 Validity Claim B; §6 manifest)
- Broken-variant registry: `modules/editor-core/src/components/__broken__/`
  (shared with roland-sxx0-editor)
