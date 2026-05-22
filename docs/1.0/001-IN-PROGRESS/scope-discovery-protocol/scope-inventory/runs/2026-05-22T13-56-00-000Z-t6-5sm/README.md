# T6.5 smoke-test — regime-holdout-detector against the current source tree

Captured 2026-05-22 against `feature/scope-discovery-protocol` (this branch).

The original workplan named `feature/roland-bugfix` as the smoke-test target with a placeholder estimate of `5+5+1+6+3 = 20` findings. That estimate was a forward projection from before the four Phase 6 gates (T6.1–T6.4) actually shipped. The smoke-test target adjustment for this commit: run the detector against the source tree the gates are actually wired against (this branch), and report the real counts.

## Real-tree counts

| Source            | Findings |
|-------------------|----------|
| anti-pattern      | 0        |
| adopter-manifest  | 0        |
| editor-symmetry   | 0        |
| deprecation       | 3        |
| **total**         | **3**    |

## Why each bucket reads the way it does

- **anti-pattern = 0** — `docs/scope-discovery/anti-patterns.yaml` is the empty initial registry (committed as a header-only file in `0183811b`); future refactor commits append entries, future commits matching those entries flip this bucket.
- **adopter-manifest = 0** — `docs/scope-discovery/adopter-manifests.yaml` is the empty initial registry (committed in `09f8c8af`); future primitive-promotion refactors will populate it.
- **editor-symmetry = 0** — the matrix walks the same empty adopter-manifest registry, so it has no rows to surface partial/missing cells against.
- **deprecation = 3** — T6.4's deprecation queue currently surfaces three `@deprecated` files with one importer each. The agent emits one finding per importer (semantic chosen: "an importer is what's blocking the file's deletion"), so the count matches.

The three deprecation findings:
- `modules/roland-sxx0-editor/src/components/ui/EnvelopeDisplay.tsx` ← `modules/roland-sxx0-editor/src/components/ui/index.ts:7`
- `modules/roland-sxx0-editor/src/components/ui/EnvelopeEditor.tsx` ← `modules/roland-sxx0-editor/src/components/ui/index.ts:8`
- `modules/sampler-backup/src/lib/backup/path-conventions.ts` ← `modules/sampler-backup/src/cli/migrate.ts:20`

The captured JSON in `findings/regime-holdout-detector.json` is the verbatim agent output. Re-running against this branch should produce the same finding set (the markers are committed to disk and the registries are stable).

## How to reproduce

```bash
tsx tools/scope-discovery/discovery-agents/regime-holdout-detector.ts \
  --feature scope-discovery-protocol \
  --prd-path docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/prd.md \
  --repo-root .
```
