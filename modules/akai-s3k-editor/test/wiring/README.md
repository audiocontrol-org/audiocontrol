# Tier 1 — Wiring tests (akai-s3k-editor)

## What this tier proves

The device-write seam fires with the right bytes when forced. These tests
verify protocol correctness: given a programmatic value change on an editor
control, the expected SysEx / parameter-write traffic reaches the simulated
MIDI adapter.

Tier 1 is **necessary for protocol correctness** and **does not satisfy any
UI capability gate**. A capability covered only by Tier 1 evidence remains
`coverage: none` in the manifest (see reform spec §6).

The akai-s3k-editor is not in the active Phase 9 scope but consumes the
same `editor-core` primitives as `roland-sxx0-editor`. The testing
discipline applies here as a side effect (reform spec §"Open questions and
accepted trade-offs", "Two editors").

## Patterns allowed

- `locator.fill(...)` to set `<input>` values directly
- `await page.evaluate(() => { input.value = X; input.dispatchEvent(...) })`
- `dispatchEvent(new Event('change'))` / synthetic `MouseEvent` / `PointerEvent`
- `element.click()` without coordinate computation
- `getByTestId(...)` / `[data-testid=...]` selectors
- Direct assertions on bytes emitted to the simulated MIDI adapter

These shortcuts are appropriate here because Tier 1 isolates the write
path — not the user-facing interaction model.

## Spec-name convention

Tier 1 specs declare their D-ID(s) in the test name using the existing
`D-<AREA>-<NN>:` prefix (reform spec §3):

```ts
test('D-PROG-FLT-02: program filter cutoff write emits Akai SysEx with expected bytes', ...);
```

## Relationship to the coverage manifest

`tools/generate-coverage-manifest.ts` walks this directory and tags every
spec it finds as Tier 1. Tier 1 evidence appears under each D-ID's `specs`
array with `tier: 1`. Per reform spec §6, the manifest computes
`coverage: confident` only when **Tier 2 + Tier 3 + Tier 4 (operator
sign-off)** are present. Tier 1 alone yields `coverage: none`.

## See also

- Reform spec: `docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`
  (§2 tier table; §6 manifest semantics)
- Workplan: `docs/1.0/001-IN-PROGRESS/s550-support/workplan.md` §9R-A
