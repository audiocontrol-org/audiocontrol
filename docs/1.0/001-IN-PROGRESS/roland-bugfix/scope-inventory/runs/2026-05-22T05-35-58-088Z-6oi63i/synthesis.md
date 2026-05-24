# Synthesis — roland-bugfix scope-inventory run 2026-05-22T05-35-58-088Z-6oi63i

## Run summary

- runId: `2026-05-22T05-35-58-088Z-6oi63i`
- startedAt: 2026-05-22T05:35:58.088Z → completedAt 2026-05-22T05:36:28.681Z (≈30s)
- featureSlug: `roland-bugfix`
- featureDir: `docs/1.0/001-IN-PROGRESS/roland-bugfix`
- Prior failed run preserved at `runs/2026-05-22T05-34-15-199Z-iwx5ns/` — `clone-detector-reader` exited 1 on the first invocation because `yaml` was uninstalled in this worktree; resolved via `pnpm install`. Per SKILL.md the failed run is retained as audit evidence rather than overwritten.

## Kind detection

Manifest `kind: hybrid` — the synthesizer combined inputs from all four agents (`ast-grep-matrix`, `clone-detector-reader`, `prd-themed-pattern-hunter`, `ui-route-enumerator`). The `ui-route-enumerator` populated `routes:` (7 entries); `ast-grep-matrix` + `clone-detector-reader` + `prd-themed-pattern-hunter` populated `modules:` (10 entries). Neither input dominated, so the synthesizer chose `hybrid` rather than `ui` or `code` alone. Dedup savings reported: 1901.

## Routes detected

7 routes (sorted):

- `/`
- `/_harness/envelope-table`
- `/_harness/range-bar`
- `/library`
- `/patches`
- `/play`
- `/tones`

The Roland editor's canonical routes (`/connect`, `/play`, `/patches`, `/tones`, `/library`) are mostly present but `/connect` is missing from this run — that's a notable strawman gap for the operator to confirm or correct. The two `_harness/` entries are the v3 control-primitive test harness pages (`AcEnvelopeTable` / `AcRangeBar` rendering surfaces) and are legitimate in-scope routes for any redesign work.

The strawman does NOT yet attach per-route device variants (`s330` / `s550`) — `devices: - none` placeholder appears on every route. That's expected for v1 (the skill explicitly defers Playwright-driven device-axis enumeration); operator will need to add the per-route `devices` matrix during curation.

## Modules detected

10 modules (all top-level src globs):

1. `modules/roland-sxx0-editor/src/**/*.{ts,tsx}` — primary surface
2. `modules/akai-s3k-editor/src/**/*.{ts,tsx}` — adjacent device editor
3. `modules/d110-editor/src/**/*.{ts,tsx}` — adjacent device editor
4. `modules/e2e-infra/src/**/*.{ts,tsx}` — test infra
5. `modules/editor-core/src/**/*.{ts,tsx}` — shared primitive surface
6. `modules/jv1080-editor/src/**/*.{ts,tsx}` — adjacent device editor
7. `modules/loop-editor/src/**/*.{ts,tsx}` — loop-editing surface
8. `modules/sample-chopper/src/**/*.{ts,tsx}` — sample-chopping surface
9. `modules/sampler-devices/src/**/*.{ts,tsx}` — device protocol layer
10. `modules/sampler-library/src/**/*.{ts,tsx}` — library data model

Each module carries a `patterns:` block with grep-style queries (e.g. `ac-class-consumer`, `any-annotation`) the synthesizer derived from PRD-themed pattern hunters. The patterns are sane defaults but very broad — operator curation should prune patterns per-module to whatever actually maps to roland-bugfix scope.

The 10-module list is a *workspace-shaped* enumeration: it includes every TS module that has discovery hits, not the modules genuinely in roland-bugfix scope. Per the PRD, in-scope modules are `roland-sxx0-editor`, `editor-core`, plus `sampler-devices` / `sampler-midi` / `e2e-infra` only if a real protocol/hardware repro surfaces. The strawman over-enumerates by a factor of ~2x — the curation pass should drop `akai-s3k-editor`, `d110-editor`, `jv1080-editor`, `loop-editor`, `sample-chopper`, and `sampler-library` unless the operator has reasons to keep them.

## Themes detected

10 themes (top of `discovery_themes:`):

1. `audiocontrol` (50 occurrences)
2. `roland` (50 occurrences)
3. `surface` (26 occurrences)
4. `modules` (6 occurrences)
5. `s550-support` (3 occurrences)
6. `audiocontrol-org` (1 occurrence)
7. `bugs` (1 occurrence)
8. `https` (1 occurrence)
9. `branch` (0 occurrences)
10. `disposition` (0 occurrences)

The top themes are reasonable for a Roland-editor feature; `s550-support` correctly surfaces the predecessor branch reference. The trailing zero-count themes (`branch`, `disposition`) are PRD-derived tokens with no corpus matches — they should be dropped during curation or kept as forward-looking markers (Phase 2's disposition work would push the `disposition` theme count above zero on the next inventory pass).

The `https` and `audiocontrol-org` themes are URL-fragment noise from the PRD's GitHub links; the operator may want to either filter URL tokens upstream in `prd-themed-pattern-hunter` or accept that they're harmless once curated out of the manifest.

## Reference docs

2 reference docs:

- `docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md` (role: prd) — feature PRD
- `docs/scope-discovery/LAYOUT.md` (role: other) — on-disk layout contract

The synthesizer's WARN line was *"PRD has no References/Appendix section; using PRD + LAYOUT.md defaults."* The roland-bugfix PRD has an "Appendix" section but no "References" subsection — the synthesizer's parser looks for the latter specifically. Reasonable to add a `## References` section to the PRD on the next iteration if we want device-notes / DESIGN-SYSTEM.md / explorations to surface in the manifest's reference_docs.

## Operator curation hints

1. **Drop the over-enumerated modules.** Of 10 modules listed, ~6 are out of roland-bugfix scope per the PRD (`akai-s3k-editor`, `d110-editor`, `jv1080-editor`, `loop-editor`, `sample-chopper`, `sampler-library`). Prune them before downstream phase work treats the manifest as binding — otherwise the disposition pass will widen far beyond what we've committed to.
2. **Add `/connect` to routes.** The Roland editor's connect page is genuinely in scope; the strawman missed it (likely because the route is registered in a slightly different file shape than the enumerator scans).
3. **Add the device-axis matrix.** Every route's `devices:` field is `- none`. Set per-route to `[s330, s550]` (or `[s330]` for `/_harness/*` which are device-agnostic).
4. **Curate themes.** Drop `https`, `audiocontrol-org`, `branch`, `disposition` (URL noise + zero-count futures). Keep the top six.
5. **Add a `## References` section to `prd.md`** before the next `/scope-inventory` invocation so the reference_docs list grows to include `DESIGN-SYSTEM.md`, the s550-support explorations, and SCSI-NOTES.md where relevant.
6. **Manifest is the strawman, not binding.** Phase 2 (clone disposition) does NOT need this manifest to be perfect — the clones.yaml baseline is the authoritative scope for the disposition work. The manifest is for downstream phase work that needs the curated route × module × theme matrix.
