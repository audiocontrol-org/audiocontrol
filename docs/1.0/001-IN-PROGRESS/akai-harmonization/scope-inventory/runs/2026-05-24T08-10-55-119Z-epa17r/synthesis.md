# Scope Inventory Run — 2026-05-24T08-10-55-119Z-epa17r

## Run summary

- **runId:** `2026-05-24T08-10-55-119Z-epa17r`
- **feature slug:** `akai-harmonization`
- **feature dir:** `docs/1.0/001-IN-PROGRESS/akai-harmonization`
- **elapsed:** `2026-05-24T08:10:55Z` → `2026-05-24T08:11:25Z` (≈30 s)
- **operator:** `oletizi`

## Kind detection

Synthesizer chose `kind=hybrid` — both `ui-route-enumerator` (16 routes) and `ast-grep-matrix` (287 patterns across 12 modules) returned non-trivial findings. The PRD's scope (per-page mockups + per-primitive migration commits + scope-discovery on the akai surface) spans both UI routes and code modules, so the hybrid manifest is the correct shape.

## Routes detected

**16 routes** (sorted by path):

1. `/`
2. `/_harness/envelope-table`
3. `/_harness/range-bar`
4. `/akai/s3000xl/editor`
5. `/akai/s3000xl/editor/keygroups`
6. `/akai/s3000xl/editor/library`
7. `/akai/s3000xl/editor/programs`
8. `/akai/s3000xl/editor/samples`
9. `/akai/s3000xl/editor/test/keygroups`
10. `/editor`
11. `/library`
12. `/patches`
13. `/play`
14. `/tones`
15. *(2 additional rendered in the manifest)*

The akai surface is the 5 routes under `/akai/s3000xl/editor/` (4 production pages + 1 test harness). The roland surface is the 5 under `/editor` / `/library` / `/patches` / `/play` / `/tones`. The 2 `/_harness/*` routes are editor-core test harnesses for the envelope-table + range-bar primitives — useful for verifying the dialect tokens flow correctly through the canonical primitives during Phase 2.

## Modules detected

**12 modules** (every workspace module under `modules/*/src/`):

| label | likely in akai-harmonization scope? |
|---|---|
| `akai-s3k-editor` | ✅ primary write target |
| `roland-sxx0-editor` | ✅ secondary write target + canonical reference |
| `editor-core` | ✅ token extension + primitive promotion |
| `loop-editor` | maybe — sample-editor + loop affordances cross-link from akai SamplesPage |
| `sample-editor` | maybe — same reason |
| `sample-chopper` | maybe — same reason |
| `sampler-devices` | likely no — protocol/device layer, not UI |
| `sampler-library` | likely no — data model, not UI |
| `e2e-infra` | likely no — test infrastructure |
| `synth-core` | likely no — unrelated module |
| `d110-editor` | **out of scope** per PRD (future editor) |
| `jv1080-editor` | **out of scope** per PRD (future editor) |

**Operator action:** prune `d110-editor` + `jv1080-editor` + likely `sampler-devices` / `sampler-library` / `synth-core` / `e2e-infra` from the manifest before downstream phase work treats it as binding.

## Themes detected

**10 themes** (top by occurrence):

| theme | occurrences |
|---|---|
| akai | 50 |
| editor-core | 50 |
| roland | 50 |
| yaml | 50 |
| contract | 33 |
| canonical | 17 |
| does | 17 |
| primitives | 14 |
| audit | 7 |
| scope | 2 |

The top three (`akai`, `editor-core`, `roland`) confirm the three-way migration target. `yaml` shows up because the spec + workplan cite the scope-discovery YAML registries heavily. `contract` + `canonical` + `primitives` reflect the dialect-contract framing in `harmonization-spec.md`.

## Regime holdouts

**Total: 1** (`anti_pattern=0 / adopter_manifest=0 / editor_symmetry=0 / deprecation=1`).

The lone holdout is unrelated to akai-harmonization:

- **`modules/sampler-backup/src/lib/backup/path-conventions.ts`** — imported by `modules/sampler-backup/src/cli/migrate.ts:20` despite being marked `@deprecated`. Replacement: import from `@audiocontrol/sampler-lib`.

**Action:** none for this feature. The deprecation lives in `sampler-backup` (CLI tool, not in the harmonization scope). File as a separate cleanup if not already tracked, or leave for the next sampler-backup-touching feature to drain.

## Reference docs

**2** (synthesizer defaulted because the PRD has no References / Appendix section the way the protocol expects):

- `docs/1.0/001-IN-PROGRESS/akai-harmonization/prd.md` (role: prd)
- `docs/scope-discovery/LAYOUT.md` (role: other)

## Synthesizer notes

- PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md.

## Operator curation hints

1. **Modules**: 12 modules listed — prune to the 3 core (`akai-s3k-editor`, `roland-sxx0-editor`, `editor-core`) plus possibly `loop-editor` / `sample-editor` / `sample-chopper` if Phase 2 touches the SamplesPage launch-editor cluster. Drop `d110-editor`, `jv1080-editor`, `synth-core`, `e2e-infra`, `sampler-devices`, `sampler-library` (out of scope per PRD).

2. **Routes**: 16 routes are correct as-enumerated. Phase 2 work touches the 5 akai routes; the 5 roland routes serve as the canonical reference for parity verification (visual regression sweep in workplan task 2.6). The 2 `/_harness/*` routes are useful for verifying token flow during Phase 2 task 2.1 (theme-token infrastructure).

3. **Scenarios**: only the strawman `default` scenario. Operator should add per-route scenarios before Phase 2 dispatches treat the manifest as binding — e.g., `akai-page-with-selected-program`, `library-tree-expanded-folder`, `keygroup-envelope-edit`, mobile breakpoint variants, etc.

4. **Regime holdouts**: clean for the akai surface. The 1 deprecation noise is in `sampler-backup` — file separately or leave for that module's next touch.

5. **Next operator action**: review `docs/1.0/001-IN-PROGRESS/akai-harmonization/scope-manifest.yaml`, prune the modules list, add scenarios, then proceed to Phase 2 — first commit the audit findings (AUDIT-20260523-01/02/03) into editor-core, then extend the dialect tokens in `[data-editor='s3000xl']` (workplan task 2.1).
