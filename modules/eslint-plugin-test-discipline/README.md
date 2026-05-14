# @audiocontrol/eslint-plugin-test-discipline

ESLint rules enforcing **Validity Claim A** from
[`docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`](../../docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md)
§4: tests under `test/ui/` must originate user input from accessible
role+name queries and real pointer/keyboard events, not synthetic
shortcuts.

## Rules

### `no-forbidden-ui-patterns`

Flags inside Tier 2/3 UI specs:

| Pattern | Why it's forbidden |
|---|---|
| `.fill(...)` | Bypasses the pointer + keyboard engines. Use `page.keyboard.type()` after focusing via an accessible query, or `page.mouse.*` for sliders. |
| `.value = ...` | Direct DOM-value assignment bypasses the user's input path. |
| `dispatchEvent(...)` | Synthesizes events the browser never fires. Use `page.mouse.*` / `page.keyboard.*` so the real engines run. |
| `element.click()` (zero-arg) | Programmatic click that bypasses pointer hit-testing. Use `page.mouse.*` for explicit coordinates, or `locator.click({ position: ... })`. |
| `getByTestId(...)` | Couples the test to layout encoding. Locate by accessible role + name. |
| `[data-testid=...]` | Attribute-selector form of the same. |
| `[data-test=...]` | Alternate attribute name. |

### `no-internal-imports`

Flags imports from `**/src/internal/**` or `**/src/private/**` inside
Tier 2/3 UI specs. Reaching past a module's public surface bypasses the
user-facing contract the spec is supposed to verify.

## Scoping

Configured via the root `.eslintrc.cjs` `overrides` block, scoped to
the canonical Tier 2/3 directories:

```
modules/*/test/ui/contract/**
modules/*/test/ui/in-context/**
```

**Not linted:**

- `test/wiring/**` — Tier 1. Wiring-test shortcuts (`.fill()`,
  `value =`, `dispatchEvent`) are part of Tier 1's contract; the rule
  spec explicitly permits them there.
- `test/ui/capabilities/**` — legacy capability specs that migrate to
  `test/wiring/` in 9R-A.2. Linting them now would block CI on specs
  whose home directory will change.

## Development

```
pnpm test       # run the rule tests
pnpm build      # compile to dist/
pnpm typecheck  # type-check without emit
```
