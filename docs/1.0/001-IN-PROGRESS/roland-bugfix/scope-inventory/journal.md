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
