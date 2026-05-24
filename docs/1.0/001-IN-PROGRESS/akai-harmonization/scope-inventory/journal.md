# Scope Inventory Journal — akai-harmonization

## 2026-05-24T08-10-55-119Z-epa17r

- **Operator:** oletizi
- **Kind:** hybrid (16 routes + 12 modules)
- **Counts:** 16 routes / 12 modules / 10 themes / 1 regime holdout (unrelated — sampler-backup deprecation)
- **Manifest:** [`../scope-manifest.yaml`](../scope-manifest.yaml)
- **Evidence:** [`runs/2026-05-24T08-10-55-119Z-epa17r/`](runs/2026-05-24T08-10-55-119Z-epa17r/)

First scope-inventory run for the feature; produced a strawman covering every workspace module + every UI route + every theme the discovery agents surfaced. The akai surface (5 routes under `/akai/s3000xl/editor/`) and the roland reference surface (5 routes under `/editor` / `/library` / etc.) both appear cleanly. Module list is over-broad — includes `d110-editor` / `jv1080-editor` / `sampler-devices` / `sampler-library` / `synth-core` / `e2e-infra` which are all out of scope per PRD; operator should prune to the 3 core modules (`akai-s3k-editor` / `roland-sxx0-editor` / `editor-core`) plus the 3 sample-editor links (`loop-editor` / `sample-editor` / `sample-chopper`) before Phase 2 dispatches treat the manifest as binding. Regime-holdout scanner returned clean for the akai surface — the 1 deprecation hit is in `sampler-backup` and unrelated to this feature.
