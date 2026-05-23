# Synthesis — roland-bugfix re-run with regime-holdout-detector (Phase 7)

## Run summary

- **Run ID:** `2026-05-23T04-29-58-677Z-ysxpw0`
- **Started:** 2026-05-23T04:29:58Z
- **Completed:** 2026-05-23T04:30:33Z
- **Elapsed:** ~35 seconds
- **Feature:** `roland-bugfix`
- **Feature dir:** `docs/1.0/001-IN-PROGRESS/roland-bugfix/`

First post-PR-#446 invocation: the fleet now runs 5 agents (the new `regime-holdout-detector` joined the 4 from the original run). This is the Phase 7 deliverable from the feature/roland-bugfix /dwe extension.

## Kind detection

`kind: hybrid` — synthesizer selected hybrid because all four substantive agents contributed:
- ui-route-enumerator: 7 routes
- ast-grep-matrix: 10 modules (cross-editor scope expanded by Phase 6's `slide-drawer-library-dialogs` cross-editor manifest entry)
- prd-themed-pattern-hunter: 10 themes
- clone-detector-reader: 468 clone groups (all dispositioned; 0 pending touching us)
- regime-holdout-detector: 1 finding (deprecation surface)

## Routes detected

7 total (sorted by path):

- `/`
- `/_harness/envelope-table`
- `/_harness/range-bar`
- `/library`
- `/patches`
- `/play`
- `/tones`

Matches the 5 canonical Roland routes + 2 test-harness routes. `/connect` is not enumerated (same gap as the prior strawman; curation should add it manually if it matters for downstream work — captured as an enumerator finding in tooling-feedback already).

## Modules detected

10 total (top 10 by hit count — all listed because the manifest's `modules:` cap is 10):

`roland-sxx0-editor, akai-s3k-editor, d110-editor, e2e-infra, editor-core, jv1080-editor, loop-editor, sample-chopper, sampler-devices, sampler-library`

The akai-s3k-editor + d110-editor + jv1080-editor + loop-editor + sample-chopper entries surfaced because the cross-editor SlideDrawer manifest entry (Phase 6) extended the ast-grep-matrix scope to other editor modules. Pre-Phase 6, the strawman listed only roland-scoped modules. Curation pass should keep this expansion — it's deliberate and load-bearing.

## Themes detected

10 total (top 10 by occurrence):

`roland (50); surface (22); 2026-05-22 (12); added (8); modules (8); validation (7); disposition (5); s550-support (3); branch (2); bugs (1)`

`2026-05-22` and `added` are date / verb tokens that bled in from the workplan's heavy disposition log. Operator may want to filter the PRD-themed hunter to skip ISO-date strings + common past-tense verbs.

## Regime holdouts (THE Phase 7 NEW SECTION)

**1 total finding** (per `regime_holdouts.meta`):

| Source | Count |
|---|---|
| anti_pattern | 0 |
| adopter_manifest | 0 |
| editor_symmetry | 0 |
| deprecation | 1 |

**Sample findings (deprecation bucket):**

- `modules/sampler-backup/src/lib/backup/path-conventions.ts` — imported by `modules/sampler-backup/src/cli/migrate.ts:20`. The file is `@deprecated`; the migrate-CLI consumer still references it. Replacement per the @deprecated note: "Import from `@audiocontrol/sampler-lib` instead."

**Per-bucket commentary:**

- `anti_patterns: 0` — registry is empty per Phase 4 outcome (T6.1 schema gap blocks backfill; drafts preserved at `scope-inventory/anti-patterns-drafts.yaml`).
- `adopter_manifests: 0` — Phase 5 populated 9 entries; all expected adopters are bound; 5 SlideDrawer tracked-holdouts (Import dialogs) are in `exceptions:` so they're silenced.
- `editor_symmetry: 0` — Phase 6 manifest extension added 9 akai library dialogs to the SlideDrawer adopter glob; they were listed as `CROSS-EDITOR HOLDOUT` exceptions so the symmetry checker doesn't flag them. Same root cause as the tracked-holdouts gap.
- `deprecation: 1` — the single sampler-backup finding is OUT OF SCOPE for feature/roland-bugfix. Belongs to a future sampler-backup migration. Documenting as out-of-scope curation rather than ignoring.

## Reference docs

8 detected:

- `docs/1.0/001-IN-PROGRESS/roland-bugfix/prd.md`
- `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md`
- `docs/scope-discovery/LAYOUT.md`
- `docs/scope-discovery/clones.yaml`
- `docs/analysis/s550-redesign-scope-discovery.md`
- `DESIGN-SYSTEM.md`
- `docs/1.0/003-COMPLETE/s550-support/explorations/`
- `AUDITOR-IMPLEMENTER-PROTOCOL.md`

(Note: some paths render with a leading `Users/orion/...` artifact in the raw manifest — `prd-themed-pattern-hunter` regex appears to capture an absolute-path prefix when the doc reference appears verbatim in a code-block. Cosmetic; not a synthesis defect.)

## Synthesizer notes

clean — no notes from this run.

## Operator curation hints

- **Regime holdouts: 1 deprecation finding is OUT OF SCOPE.** `path-conventions.ts` is in `modules/sampler-backup/` which the roland-bugfix PRD doesn't claim. Document as out-of-scope; recommend filing a sampler-backup-side follow-up if/when sampler-backup gets its own scope-discovery work.
- **All 9 adopter manifests are in compliance** post-Phase 5 (3 actual adopters + 5 tracked-holdouts via exceptions for SlideDrawer; the other 8 manifests have 0 holdouts).
- **Anti-pattern registry stays empty** until T6.1 gains path-exclude support (filed as #451). The 9 drafted entries at `scope-inventory/anti-patterns-drafts.yaml` are ready to copy in once #451 lands.
- **Cross-editor symmetry matrix** masks the 9 akai SlideDrawer holdouts because exceptions silence cells. Resolves automatically when #453 (tracked_holdouts schema) lands.
- **No new scope changes required** — the existing scope-manifest.yaml (curated 2026-05-22 in commit `dfb8baed`) remains binding. Phase 7's run validates that the regime-holdout-detector is correctly catching the cross-editor convention coverage the registry declares.

**Next operator action:** review the regime_holdouts section. The 1 deprecation finding is out of scope; the other three sources are correctly empty for the current registry state. Phase 7 closes when the journal entry lands.
