---
title: Testing and capability-inventory reform
status: draft
date: 2026-05-14
related-issues:
  - https://github.com/audiocontrol-org/audiocontrol/issues/423
  - https://github.com/audiocontrol-org/audiocontrol/issues/424
deskwork:
  id: afbe2d03-af5f-4d1b-99f1-af087537afe4
---

# Testing and capability-inventory reform

## Problem

The Phase 9 closure of 2026-05-12 marked 175 UI tests green while the editor's value sliders were non-functional on real hardware. Root cause: every "UI" capability spec drives writes by programmatically filling the underlying `<input type="number">` (`.fill(...)` / `evaluate(() => input.value = X)`). Those specs verify the device-write seam works **when forced** — they never exercise the operator-facing pointer or keyboard interaction. The bar could be `role="img"`, the bar could have `pointer-events: none`, the bar could disappear entirely; the specs passed regardless. Phase 9 Task 6's "screenshot verification" captured paint, not interaction.

Two further document-level problems compounded:

1. The capability inventory (`ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`) hand-couples capability rows to specific test references. Rows go stale; tests get renamed; the `Test` column drifts and is impossible to audit without running every test.
2. The inventory describes affordances using implementation language (`Cutoff — slider`, `Loop Mode — select`). When the implementation primitive changes — `ParameterSlider` → `AcSlider` → some future primitive — the inventory rows have to be hand-edited or they lie about the editor's shape.

The capability inventory was explicitly designed to be a description of intent. The current document mixes intent with implementation and conflates "a test exists" with "the capability is confidently covered."

## Goals

1. **The capability inventory describes what the operator can do, never how the UI shapes it.** Refactoring a primitive should not require an inventory edit.
2. **Coverage status in the inventory is machine-generated, not hand-curated.** The `Test` column is replaced by a `Coverage` column whose values are computed from the actual test artifacts on disk.
3. **A UI test that passes is credible — not just present.** Every UI test demonstrates it can fail under at least one known regression shape, via a runtime mechanism that does not modify production source code.
4. **The future state "hundreds of green tests that don't test what users care about" is mechanically prevented**, not prevented by review discipline.
5. **The inventory's Coverage column is enforceable.** A release cannot ship while any `implemented` capability is `none` (no real coverage).

## Non-goals

- This spec is not a comprehensive test-quality framework. It defends against the specific regression class that produced the Phase 9 incident: green tests against non-functional UI. It does not attempt to prevent every test-correctness failure mode.
- The reform is not a property-based testing framework. Specs continue to be example-based; credibility is established via known-broken comparison, not via property exploration.
- The reform does not promise that all known regressions are catchable in advance. The library of known-broken variants grows from real incidents; it is asymptotic, never complete.
- The reform does not replace the operator. The final gate on every capability remains human hardware sign-off.
- This spec does not specify the full migration of every existing test. The migration of the 175 wiring specs is one bounded task within the workplan, but extending Tier 2 / Tier 3 coverage to every `implemented` capability is the body of Phase 9R remediation and is scoped in the workplan, not here.

## Design

### 1 — Inventory reform: capability intent only

Every D-row's `Affordance` description is rewritten under three rules:

- **Lead with a verb.** "Edit X." "Read X." "Assign X to Y." "Trigger X." The verb captures operator intent.
- **Name the value, range, and units — never the widget.** "Edit TVF cutoff frequency (0–127)" instead of "Cutoff — slider". "Assign a tone to a wave bank (per-device bank set)" instead of "Wave Bank — select (A/B; A/B/C/D for S-550)".
- **Distinguish read from write.** A row whose verb is `Read` documents that the value is exposed; the operator cannot change it. A row whose verb is `Edit` or `Assign` documents that the operator drives the value.

The `Source of truth` column continues to point at the canonical data structure or client method — this is intent-aligned (the field exists; the data structure is part of the capability shape). The `Test` column is removed. Two new columns are added:

- `Sign-off` — **hand-edited by the operator.** Records the most recent operator sign-off for the capability against real hardware. Format: `none`, or `<YYYY-MM-DD> <signer> <sha>` (where `<sha>` is the production commit SHA that the operator was running when they verified). To revoke a sign-off, edit the cell to `revoked <YYYY-MM-DD> <signer>`. Historical sign-offs are recoverable via `git blame` on the inventory and via the manifest's iteration journal — the cell itself shows only the latest.
- `Coverage` — **machine-generated.** Reads test artifacts under `test/wiring/`, `test/ui/contract/`, `test/ui/in-context/` (Tiers 1–3) AND the `Sign-off` column (Tier 4) to compute one of `none` / `partial` / `confident`.

Keeping both columns in the inventory — rather than splitting operator-owned sign-off into a sidecar file — avoids the two-locations-for-one-fact pattern that creates documentation drift.

The `Origin` column (`native` / `client-derived` / `editor-derived`) is preserved unchanged.

### 2 — Tier directory structure

Tests live in tier-discriminated directories. The directory determines the tier; nothing else is required to declare it.

| Directory | Tier | What it proves |
|---|---|---|
| `modules/<editor>/test/wiring/` | 1 | The device-write seam fires with the right bytes when forced. May use `.fill()`, `value =`, `dispatchEvent`. Necessary for protocol correctness; **does not satisfy any UI capability gate**. |
| `modules/<editor>/test/ui/contract/` | 2 | The primitive works in isolation as a user-facing control. Real pointer events at real coordinates via `page.mouse.*`. Queries via accessibility role + name. Mounts the production primitive against a stub consumer with a window-exposed spy. |
| `modules/<editor>/test/ui/in-context/` | 3 | The primitive works on its real page with its real fixtures. Same four claims as Tier 2 but the rendered DOM is the production page, not a harness route. Catches layering bugs (occlusion, parent-grid collapse). |
| Inventory `Sign-off` column | 4 | A human exercised the capability against real hardware and recorded a dated sign-off keyed to the commit SHA — recorded inline on the capability's row, not in a sidecar file. |

The existing 175 capability specs migrate to `test/wiring/` as part of the reform's first task. They retain their D-ID test names; they are not deleted.

### 3 — Spec declaration of D-ID coverage

Every spec declares the D-ID(s) it covers in its test name, using the existing `D-<AREA>-<NN>:` prefix convention. One spec may cover multiple D-IDs; one D-ID may be covered by multiple specs. The manifest aggregates both directions.

```ts
test('D-TONE-ENV-02: pointer drag on segment-N Time bars changes value (segments 1..8)', ...);
test('D-TONE-TVF-02 / D-TONE-TVF-03: cutoff and resonance sliders respond to drag', ...);
```

### 4 — Validity Claim A: tests originate where the user originates

Tier 2 and Tier 3 specs must:

- Query affordances by **accessible role + name** (`getByRole('slider', { name: 'Cutoff' })`). CSS classes, `data-testid`, and React-component-name queries are forbidden in `test/ui/`.
- Drive events via the **browser's pointer engine** (`page.mouse.move/down/up` with coordinates from `boundingClientRect`). Synthetic `element.dispatchEvent` of `MouseEvent` / `PointerEvent` is forbidden.
- Assert on **user-observable outputs**: `aria-valuenow`, rendered readout text, bytes emitted to the simulated MIDI adapter, `elementsFromPoint` results. Internal React state, hook return values, private component methods are forbidden.

Enforcement: an ESLint custom rule (project-local plugin) flags violations and fails CI. The forbidden patterns are:

- `.fill(`, `.value =`, `dispatchEvent(`, `element.click()` (inside `test/ui/`; allowed in `test/wiring/`)
- `getByTestId(`, `[data-testid=`, `[data-test=`
- Imports from `src/internal/` or `src/private/`

### 5 — Validity Claim B: credibility via runtime swap

Each interactive primitive maintains a registry of **deliberately broken variants** committed as real components alongside the production primitive:

```
modules/editor-core/src/components/__broken__/
  AcRangeBar/
    role-img.tsx                 // role="img" paint, no interactive control
    no-pointer-events.tsx        // input present but pointer-events: none
    onchange-disconnected.tsx    // input present but onChange callback dropped
    disabled-permanently.tsx     // input present but disabled prop hard-coded true
  AcEnvelopeTable/
    cells-role-img.tsx
    onchange-disconnected.tsx
  contexts/
    sticky-overlay.tsx           // wraps children with a fixed-position overlay on top
    zero-width-grid.tsx          // wraps children in a grid whose column collapses to 0
    pointer-events-none-ancestor.tsx
```

Broken variants are real React components. They share the production primitive's prop interface (TypeScript-checked). Layout-level brokenness lives under `__broken__/contexts/` and wraps the harness rather than swapping the primitive.

Each harness route reads `?broken=<variant>` (for primitive swaps) and `?context=<variant>` (for context wraps) URL params. When set, the harness consults the registry and mounts the broken variant instead of (or wrapping) the production primitive. Default — no params — mounts the real primitive in the real layout.

Each Tier 2 / Tier 3 spec declares the broken variants it must fail against:

```ts
test('D-TONE-ENV-02: ...', async ({ page }) => { ... })
  .meta({ credibleAgainst: ['cells-role-img', 'onchange-disconnected'] });
```

A spec is **credible** iff:

1. It passes against the unbroken harness (`?broken` absent).
2. For every variant in `credibleAgainst`: it fails against `?broken=<variant>`.

The `tools/check-credibility.ts` script runs the credibility pass on every spec and records results in the coverage manifest. A spec without a `credibleAgainst` list is rejected at PR review by the ESLint rule.

### 6 — Coverage manifest

`tools/generate-coverage-manifest.ts` aggregates the test state into `coverage-manifest.json` and renders `coverage-manifest.md`. The manifest is keyed by D-ID; each entry records:

```json
{
  "D-TONE-ENV-02": {
    "intent": "Edit per-segment rate of TVF envelope (8 segments, 0-127 each)",
    "sourceOfTruth": "modules/sampler-devices/.../tone.tvf.envelope.rates",
    "origin": "native",
    "status": "implemented",
    "specs": [
      {
        "path": "modules/roland-sxx0-editor/test/ui/contract/AcEnvelopeTable.contract.spec.ts",
        "testName": "D-TONE-ENV-02: pointer drag on segment Time bars changes value",
        "tier": 2,
        "passing": true,
        "credibleAgainst": ["cells-role-img", "onchange-disconnected"],
        "credibleVerified": true
      },
      {
        "path": "modules/roland-sxx0-editor/test/ui/in-context/tones.in-context.spec.ts",
        "testName": "D-TONE-ENV-02: segment Time bar reachable on TonesPage Amp tab",
        "tier": 3,
        "passing": true,
        "credibleAgainst": ["sticky-overlay", "zero-width-grid"],
        "credibleVerified": true
      }
    ],
    "operatorSignoff": {
      "raw": "2026-05-14 ol abc1234",
      "signedAt": "2026-05-14",
      "signedBy": "ol",
      "sha": "abc1234",
      "revoked": false
    },
    "tiersMet": [2, 3, 4],
    "coverage": "confident"
  }
}
```

The script:

1. Walks `test/wiring/`, `test/ui/contract/`, `test/ui/in-context/`.
2. Extracts D-IDs from each test's name via regex.
3. Tags each test by directory → tier.
4. Records pass/fail by running the suite.
5. Runs the credibility pass per spec.
6. Parses the `Sign-off` column in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md` per D-row to extract Tier 4 evidence (date, signer, SHA, revocation state).
7. Computes `coverage` per D-ID:
   - `confident` iff Tier 2 + Tier 3 specs exist AND both have `credibleVerified: true` AND the `Sign-off` cell parses to a non-revoked sign-off.
   - `partial` if some but not all of the above.
   - `none` if nothing or only Tier 1 evidence.
8. Writes back `coverage-manifest.{json,md}` and updates the `Coverage` column in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`. The `Sign-off` column is read-only to the generator and is never overwritten.

The inventory has two columns owned by different parties: `Sign-off` is operator-owned; `Coverage` is generator-owned. Any hand edit to `Coverage` is overwritten on the next manifest generation. The generator emits a warning if it sees a `Sign-off` cell whose format it cannot parse.

### 7 — Operator sign-off — inline column on the inventory

Sign-off lives on the capability's own row in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`. The `Sign-off` column is operator-owned and hand-edited. Format per cell:

| Cell value | Meaning |
|---|---|
| `none` | No sign-off recorded. Default for every row. |
| `2026-05-14 ol abc1234` | Most recent sign-off: date (ISO-8601 day), signer initials/handle, production commit SHA the operator was running when they verified. |
| `revoked 2026-05-14 ol` | Operator explicitly revoked any prior sign-off on this capability. Coverage drops to ≤ partial. |

Updating the cell to a fresh `<date> <signer> <sha>` triple replaces the previous sign-off — the cell shows the latest only. Historical sign-offs are recoverable via `git blame` on the inventory and via the manifest's append-only iteration journal (which records the inventory diff on each `pnpm run check-coverage` run).

Sign-off granularity is per D-row. If an aggregate row covers multiple physical instances (e.g. `D-TONE-ENV-02` covers 8 envelope segments), the operator's sign-off is asserting that all instances under that D-row work — the cell records one sign-off for the whole row.

Stale-on-source-change detection is **deferred** — the operator updates the cell to a revocation when capability behavior changes. Mechanical staleness was considered and removed from scope as overkill for the immediate reform.

**Why not a separate file?** The pre-edit version of this spec put sign-off in `OPERATOR-SIGNOFF.md` at the repo root. Operator feedback during spec review (2026-05-14) flagged that as two-locations-for-one-fact — exactly the drift shape that the inventory rewrite is meant to eliminate. The Sign-off column lives where the capability lives.

### 8 — Enforcement gate

`pnpm run check-coverage` runs the full pipeline:

1. ESLint (Claim A — origin discipline).
2. Spec test suite (all tiers).
3. Credibility pass (Claim B — broken-variant fail-then-pass).
4. Manifest regeneration.
5. Inventory column sync.
6. Exit non-zero if any `implemented` capability has `coverage: none`.

The gate runs locally via pre-commit hook (against changed specs) and in CI / pre-merge (full pipeline).

Release tags are blocked by the same gate.

## Migration

### What changes (capability inventory)

`ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`:

- Every `Affordance` description rewritten per the three rules in § 1.
- The `Test` column removed.
- A `Sign-off` column added (hand-edited by the operator; initial value `none` for every row).
- A `Coverage` column added (machine-generated; reads tests + `Sign-off`).

The companion document `ROLAND-S550-EDITOR-CAPABILITIES.md` (the parent capability list) is reviewed for the same implementation-language drift and rewritten where necessary.

### What changes (tests)

The 175 existing capability specs (`patch-writes.spec.ts`, `tone-writes.spec.ts`, `play-writes.spec.ts`, `display-gaps.spec.ts`, library / front-panel specs) move from `test/ui/capabilities/` to `test/wiring/`. Their D-ID test names are preserved. They become Tier 1 evidence — necessary for protocol correctness, not sufficient for capability closure.

New Tier 2 specs are written under `test/ui/contract/`, one per interactive primitive (`AcRangeBar`, `AcSlider`, `AcSelect`, `AcCheckbox`, `AcNumberInput`, `AcEnvelopeTable`, `AcEnvelopeGraph`, `AcEnvelopeMeta`, plus any future primitives). Each spec exercises its primitive against a harness route with a stubbed consumer and a window-exposed onChange spy.

New Tier 3 specs are written under `test/ui/in-context/`, one per page (`patches`, `tones`, `play`, `library`). Each spec mounts the real page with the appropriate fixture and re-verifies every interactive affordance on the page through `elementsFromPoint`-routed pointer events.

### What changes (new infrastructure)

- ESLint custom rule package `@audiocontrol/eslint-plugin-test-discipline` enforcing Claim A.
- `modules/editor-core/src/components/__broken__/` directory with the initial broken-variant registry.
- Harness route(s) reading `?broken` / `?context` URL params and dispatching to the registry.
- `tools/check-credibility.ts` running the credibility pass.
- `tools/generate-coverage-manifest.ts` aggregating and writing the manifest, including parsing the inventory's `Sign-off` column.
- `pnpm run check-coverage` orchestrator.
- `Makefile` target wiring.

### What does NOT change

- The capability inventory's structure: D-ID convention, areas, parent capability linkage, `Status` semantics (`implemented` / `partial` / `missing` / `removed`), `Origin` (`native` / `client-derived` / `editor-derived`), `Source of truth` column.
- Production code outside the broken-variant registry. The reform is a testing-discipline reform; it does not modify primitives or pages.
- The simulated MIDI adapter infrastructure. Tier 2 specs use stub consumers (no MIDI); Tier 3 specs use the existing simulated MIDI fixtures.
- The Playwright test runner. Both `wiring` and `ui` tiers run on the existing test-harness Playwright config; only the directory roots differ.

## Acceptance criteria

The reform is complete when:

- [ ] Every `Affordance` cell in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md` and `ROLAND-S550-EDITOR-CAPABILITIES.md` is verb-led and free of widget names. Grep audit: zero hits for `slider`, `select`, `checkbox`, `radio`, `dropdown`, `button` as affordance-describing nouns (allowed in the `Source of truth` column when referencing code identifiers).
- [ ] The `Test` column is removed from the detailed inventory; a `Sign-off` column (operator-edited) and a `Coverage` column (machine-generated) exist on every row.
- [ ] All existing capability specs are moved to `test/wiring/`. Grep audit: zero specs under `test/ui/capabilities/`.
- [ ] At least one Tier 2 spec exists per interactive primitive (`AcRangeBar`, `AcSlider`, `AcSelect`, `AcCheckbox`, `AcNumberInput`, `AcEnvelopeTable`, `AcEnvelopeGraph`, `AcEnvelopeMeta`).
- [ ] Every Tier 2 / Tier 3 spec carries a `credibleAgainst` declaration and is marked `credibleVerified: true` by `tools/check-credibility.ts`.
- [ ] The inventory's `Sign-off` column carries a non-`none`, non-revoked value for every `implemented` capability before the gate is enabled in CI.
- [ ] `pnpm run check-coverage` passes and the inventory's `Coverage` column shows `confident` for every `implemented` row.
- [ ] The ESLint custom rule is installed and rejects `.fill()` / `data-testid` / `dispatchEvent` patterns in `test/ui/`.
- [ ] CI / pre-merge runs `pnpm run check-coverage` and rejects PRs that regress any capability from `confident` to a lower tier.

## Open questions and accepted trade-offs

- **Mutation registry maintenance.** Broken variants must be kept in sync with the production primitive's prop interface. TypeScript compilation is the primary defense — if a real primitive's API changes, broken variants fail to compile and force update. Accepted cost.
- **Credibility is asymptotic.** A novel regression with no matching broken variant slips through. Accepted; the library grows from incidents.
- **Sign-off staleness is manual.** A production refactor under a previously-signed-off capability does not automatically revoke the sign-off. Operator must remember to revoke when capability behavior changes. Accepted as part of "credible, not perfect."
- **Sign-off granularity.** Whether a single sign-off covers a whole D-row (the 8-segment envelope as one capability) or each instance separately is decided per capability when the inventory is rewritten. Default: per D-row.
- **Test count.** The reform implies authoring approximately one Tier 2 spec per primitive (8–12 specs) and one Tier 3 spec per page (5–6 specs). The Tier 1 migration is purely directory motion (175 specs). The volume of work is bounded.
- **Two editors.** `roland-sxx0-editor` and `akai-s3k-editor` both consume `editor-core` primitives. Broken-variant infrastructure lives in `editor-core`; harness routes are added in each consumer. Akai is not in the active Phase 9 scope but inherits the discipline as a side effect.

## Sequence

The reform's implementation order is captured in the workplan's Phase 9R-A section. Briefly:

1. Infrastructure: tier directory structure, ESLint rule, broken-variant registry skeleton, harness URL-param dispatch, credibility runner, manifest generator.
2. Migration: move existing capability specs to `test/wiring/`.
3. Inventory rewrite: `Affordance` column edits + `Test` → `Coverage` column swap.
4. Tier 2 specs per interactive primitive (parallelizable).
5. Tier 3 specs per page (parallelizable, dependent on Tier 2 primitives being credible).
6. First operator sign-off pass for `implemented` rows.
7. Enable the CI gate.

Phase 9R-B (primitive remediation) and Phase 9R-C (page rebuild) consume this infrastructure; they cannot proceed without it.
