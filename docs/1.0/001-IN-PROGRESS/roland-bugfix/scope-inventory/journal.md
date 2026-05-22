# Scope Inventory Journal — roland-bugfix

## 2026-05-22T05-34-15-199Z-iwx5ns

- **Operator:** oletizi
- **Kind:** (synthesis not run — failed pre-synthesis)
- **Counts:** n/a
- **Manifest:** n/a (synthesis not run)
- **Evidence:** [`runs/2026-05-22T05-34-15-199Z-iwx5ns/`](runs/2026-05-22T05-34-15-199Z-iwx5ns/)

Failed run, preserved per SKILL.md error-handling. The `clone-detector-reader` agent exited 1 with `ERR_MODULE_NOT_FOUND: yaml` because the freshly-merged PR #441 added the `yaml` package to `package.json` but `pnpm install` had not been run in this worktree since the merge. Resolved by running `pnpm install` (added `yaml@2.8.3`, `ajv@8.20.0`, `ajv-formats@3.0.1`) and re-invoking. The run dir survives as audit evidence; downstream consumers must read `meta.json` and skip — the `findings/clone-detector-reader.json` file is zero bytes and the partial outputs from the surviving three agents are not synthesized. This is a real tooling-feedback finding: `make scope-inventory` does not run `pnpm install` first, so a fresh checkout that includes a deps-only change in main will fail without telling the operator to run `pnpm install`. See `tooling-feedback.md` for the recommendation.

## 2026-05-22T05-35-58-088Z-6oi63i

- **Operator:** oletizi
- **Kind:** hybrid (from manifest)
- **Counts:** 7 routes / 10 modules / 10 themes
- **Manifest:** [`../scope-manifest.yaml`](../scope-manifest.yaml)
- **Evidence:** [`runs/2026-05-22T05-35-58-088Z-6oi63i/`](runs/2026-05-22T05-35-58-088Z-6oi63i/)

Successful run after the pnpm install resolved the missing-dep failure. Strawman manifest written; kind=hybrid because the synthesizer drew from all four agents (UI + AST + clone + PRD-themed). Routes capture six of the seven canonical Roland surfaces — `/connect` is missing and should be added during curation. Modules over-enumerate (10 listed, ~6 out of scope per the PRD); curation should prune to `roland-sxx0-editor` + `editor-core` plus the conditional `sampler-devices` / `sampler-midi` / `e2e-infra` per the PRD's Scope section. Themes include URL-noise tokens (`https`, `audiocontrol-org`) and zero-count futures (`branch`, `disposition`) that should be filtered. The strawman is informational for Phase 2 — the binding scope artifact for the clone-disposition pass is `docs/scope-discovery/clones.yaml`, not this manifest. Operator review of the manifest is the next step.

## 2026-05-22 curation pass (AUDIT-20260521-05 remediation)

Curation applied to `scope-manifest.yaml` per the synthesis.md hints + the AUDIT-05 finding. Five mutations:

1. `generated_by: strawman` → `generated_by: curated`.
2. Modules pruned 10 → 4: kept `roland-sxx0-editor`, `editor-core`, `sampler-devices`, `e2e-infra` (the four in-scope per PRD); dropped `akai-s3k-editor`, `d110-editor`, `jv1080-editor`, `loop-editor`, `sample-chopper`, `sampler-library`.
3. `/connect` route added (was missing from the strawman's enumerator output).
4. Device matrix set on the five canonical Roland routes: `devices: [s330, s550]` on `/connect`, `/play`, `/patches`, `/tones`, `/library`. The `/_harness/*` test-surface routes and the bare `/` redirect kept `devices: [none]`.
5. Noise themes dropped: `https`, `audiocontrol-org`, `branch`, `disposition`. Top 6 themes retained.

PRD also gained a `## References` section listing the documents downstream phase work should treat as authoritative (the synthesizer warned at run time that this section was missing; warning lived in stderr only — captured as a `tooling-feedback.md` finding).

Manifest validates against `tools/scope-discovery/schema/scope-manifest.schema.json` post-curation. Curation was applied via `.tmp/curate-manifest.ts` (scratch script, not committed). No re-run of `/scope-inventory` triggered — per LAYOUT.md the canonical manifest is overwritten by re-runs, so curation lives in git history rather than in a new run directory.

## 2026-05-22 Phase 2 closure: strawman survival report

Post-walk report after the Phase 2 clone-disposition closure took `pending touching us` from 172 → 0. Recording how the curated strawman held up against the actual work.

**Strawman survival:** all 5 in-scope curated modules (`roland-sxx0-editor`, `editor-core`, `sampler-devices`, `e2e-infra`) saw refactor or disposition work this session. None were redundant; none turned out to be missing. The pruning from 10 → 4 modules in the curation pass was exactly correct — the dropped editor modules (akai, d110, jv1080, loop-editor, etc.) stayed out of scope and the surviving four were each touched by at least one walk.

**Route survival:** all 5 canonical Roland routes (`/connect`, `/play`, `/patches`, `/tones`, `/library`) saw protecting-test additions or refactor walks. The `/_harness/*` routes were exercised indirectly through wiring suites that route through them. The `/connect` route addition during curation (which the strawman missed) was load-bearing — `D-LIB-23` and `D-LIB-37` cite `/connect`-style URL flow when asserting cross-device chrome.

**Themes survival:** 4 of the 6 retained themes (`bug`, `clone`, `refactor`, `roland`) drove repeated decisions during the walk; the other 2 (`drawer`, `library`) showed up indirectly through the dialog-family decisions. No retained theme turned out to be off-base.

**Did NOT need to re-run `/scope-inventory`.** Curation was binding; the workplan + clones.yaml + disposition log handled the per-walk state. Re-running would have produced a fresh strawman that needed re-curation — no incremental value once the curated manifest is in place. The LAYOUT.md design (re-runs overwrite the canonical manifest by design; the operator branches/tags before re-running to preserve curation) is the right shape.

**What the curated manifest didn't capture, that the walk relied on:** the regime-holdout dimension. The manifest declares which modules/routes/themes are in scope, but says nothing about which primitives are canonical or which call sites should adopt them. The Phase 2 walk re-derived that mapping ad hoc (Export dialogs canonical → Import are holdouts; akai's `$INFRA_DIR/scripts/watchdog.ts` canonical → roland's local copy is the holdout; etc.). The proposal in `tooling-feedback.md` § "Regime holdouts" recommends a `regime_holdouts:` section be added to the synthesized manifest so this dimension stops being implicit. Filing here so the next inventory run + the protocol's own next iteration both see the gap.
