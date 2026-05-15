## Rendering smokes (roland-sxx0-editor)

## What this directory proves

Specs under `test/rendering/` capture **visual paint state** for design
review. They mount each editor page through the simulated MIDI harness,
let the page settle, and write PNGs to disk under
`docs/.../phase-N-task-M-screenshots/`.

A green rendering run only proves the page **paints**. It does NOT
prove any affordance works. Sliders that are read-only `role="img"`
SVGs will still produce a passing screenshot.

## This is NOT a closure gate

Rendering smokes contribute **zero coverage credit** toward the
four-tier discipline introduced in workplan sub-task 9R-A. Specifically:

- The coverage manifest (`tools/generate-coverage-manifest.ts`) does
  NOT scan this directory.
- A capability that is "verified" only by a screenshot in this
  directory remains `coverage: none` in the manifest.
- `make check-coverage-roland`'s gate ignores this directory entirely.

The tier table in the reform spec (`testing-and-inventory-reform-spec.md` §2)
recognizes only Tier 1 (`test/wiring/`), Tier 2 (`test/ui/contract/`),
Tier 3 (`test/ui/in-context/`), and Tier 4 (operator sign-off in the
inventory). Rendering smokes sit outside that hierarchy by design --
they are evidence for human reviewers, not the gate.

## Why a separate directory

Previously these specs lived next to the Tier 2/3 UI specs in
`test/ui/`. That co-location confused the closure story: a passing
`make test-ui-roland` run included screenshot captures whose green
status said nothing about interaction correctness. Moving them out
makes the tier separation visible at the directory level and lets
`make test-ui-roland` mean "the UI behavior gates pass" without
qualification.

## How to run

```bash
make test-rendering-roland
```

Or, with extra Playwright args:

```bash
make test-rendering-roland ARGS="--grep 'tones page'"
```

Output overwrites the PNGs under their target directories in place
(deterministic: same fixture → same screenshots, modulo browser font
rendering which is locked by the pinned Playwright Chromium).

## See also

- Reform spec: `docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`
  (§2 tier table; §6 manifest semantics)
- Workplan: `docs/1.0/001-IN-PROGRESS/s550-support/workplan.md` §9R-A.2
- Screenshot README: `docs/1.0/001-IN-PROGRESS/s550-support/phase-9-task-6-screenshots/README.md`
