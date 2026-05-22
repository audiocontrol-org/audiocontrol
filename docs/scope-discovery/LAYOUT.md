# scope-discovery — On-Disk Layout Contract

This document defines where scope-discovery artifacts live in the repository and what each file/directory contains. It is the canonical reference consumed by:

- the `/scope-inventory` skill (Phase 3 T3.3) when writing discovery output
- the `/scope-widen` skill (Phase 3 T3.4) when appending widening-pass evidence
- the `make scope-inventory FEATURE=<slug>` Make target (T2.7) when validating + instructing
- the clone detector at `tools/scope-discovery/clone-detector.ts` (T2.2)
- the pre-commit hook (T2.3) when reading the dispositioned baseline

The PRD's Goal #5 (*"Inventory artifacts on disk — manifest canonical, discovery evidence retained and journaled"*) is the source-of-truth for the design decision; this file is its operational expansion. Nothing here is gitignored — every artifact is part of the planning record.

## Top-level layout

```
docs/
  scope-discovery/                                  # repo-level scope-discovery artifacts
    LAYOUT.md                                       # this file
    clones.yaml                                     # dispositioned clone-detector baseline
  <version>/                                        # e.g., 1.0
    <status>/                                       # 000-PENDING | 001-IN-PROGRESS | 002-BLOCKED | 003-COMPLETE
      <feature-slug>/                               # e.g., scope-discovery-protocol
        prd.md
        workplan.md
        README.md
        scope-manifest.yaml                         # per-feature manifest (T3.3 output)
        scope-inventory/                            # per-feature discovery evidence
          journal.md                                # append-only index of all runs
          runs/                                     # one subdir per /scope-inventory invocation
            <ISO-stamp>-<runId>/                    # e.g., 2026-05-22T14-03-12Z-a4f1
              meta.json                             # invocation metadata
              findings/                             # per-agent raw output (JSON)
                <agent-name>.json                   # e.g., ui-route-enumerator.json
              captures/                             # screenshots + DOM-token JSON
                <capture-id>.png                    # PNG-8 quantized where legibility permits
                <capture-id>.dom.json.gz            # DOM-token snapshots, gzipped at write
              synthesis.md                          # narrative produced by synthesis pass
```

## Repo-level files

### `docs/scope-discovery/clones.yaml`

Dispositioned baseline for the TS/TSX clone detector. Committed. Operator-authored disposition is part of the project's review record.

Shape (defined by `tools/scope-discovery/clones-yaml.ts`):

```yaml
generatedAt: "2026-05-21T18:42:00.000Z"
groups:
  - id: <stable-hash>
    members:
      - path: modules/foo/src/Bar.tsx
        startLine: 12
        endLine: 47
      - path: modules/baz/src/Qux.tsx
        startLine: 88
        endLine: 123
    tokens: 184
    lines: 36
    disposition: pending | refactor | keep-with-reason | ignore-with-justification
    reason: null | "<one-line justification (required for keep/ignore)>"
```

Disposition vocabulary:

- `pending` — un-reviewed. New clone groups land here. The Phase-4 drain is *"zero pending entries."*
- `refactor` — operator-approved cleanup target. A PR will merge that eliminates the clone; the detector will then DROP the group, and the next refresh will remove it from the baseline.
- `keep-with-reason` — clone is intentional; `reason` field MUST contain a one-line justification.
- `ignore-with-justification` — clone is a false positive (e.g., generated code, schema-driven duplication); `reason` field MUST contain a one-line justification.

The pre-commit hook (T2.3) reads this file. A commit that introduces a NEW group (id not present in the baseline) is rejected. Existing dispositioned groups pass the hook regardless of disposition value.

### `docs/scope-discovery/LAYOUT.md`

This file. The contract.

## Per-feature files

### `docs/<version>/<status>/<feature-slug>/scope-manifest.yaml`

Canonical per-feature manifest. Validated against `tools/scope-discovery/schema/scope-manifest.schema.json` (T2.1). Lifecycle: created by `/scope-inventory` as a strawman, curated by the operator, then referenced by all downstream phase work as the binding scope contract.

Lives alongside `prd.md` and `workplan.md` because the manifest IS the planning artifact — separating it would invite drift. Committed. Moves with the feature directory when status transitions (PENDING → IN-PROGRESS → COMPLETE).

### `docs/<version>/<status>/<feature-slug>/scope-inventory/`

Per-feature discovery evidence directory. Created on the first `/scope-inventory <slug>` invocation; persists across re-invocations.

#### `journal.md`

Append-only human-readable index of every `/scope-inventory` run against this feature. One entry per run, newest-first or newest-last (skill picks; consistent within a feature). Each entry records:

- the run's `<ISO-stamp>-<runId>` (matches the subdirectory under `runs/`)
- the operator who invoked it (from `git config user.name` at invocation time)
- the inputs the skill consumed (PRD path, feature stub state, any `--focus` flag from `/scope-widen`)
- a one-paragraph narrative of what the run discovered and what changed in the manifest as a result
- pruning notes when an operator prunes prior runs (see PRD Risks; pruning is operator-initiated, never automatic, and the prune action is logged here)

The journal is the human reading-surface; the per-run directories are the machine-reading surface.

#### `runs/<ISO-stamp>-<runId>/`

One subdirectory per skill invocation. Never overwritten; re-invocations create new subdirectories. The `<ISO-stamp>` is the run's start time in UTC with `:` replaced by `-` for filesystem safety (e.g., `2026-05-22T14-03-12Z`); `<runId>` is a short collision-resistant suffix (e.g., 4-char hex of a content hash) to disambiguate same-second invocations.

Contents:

##### `meta.json`

Invocation metadata. Plaintext JSON, committed.

```json
{
  "runId": "2026-05-22T14-03-12Z-a4f1",
  "startedAt": "2026-05-22T14:03:12.000Z",
  "completedAt": "2026-05-22T14:14:48.000Z",
  "skill": "scope-inventory",
  "skillVersion": "0.1.0",
  "operator": "<git user.name>",
  "featureSlug": "<slug>",
  "featureStatus": "001-IN-PROGRESS",
  "inputs": {
    "prdPath": "docs/1.0/001-IN-PROGRESS/<slug>/prd.md",
    "workplanPath": "docs/1.0/001-IN-PROGRESS/<slug>/workplan.md"
  },
  "agentsRun": [
    "ui-route-enumerator",
    "ast-grep-matrix-builder",
    "clone-detector-reader",
    "pattern-hunter"
  ],
  "captureCount": 23
}
```

For `/scope-widen` runs, `meta.json` additionally records the complaint payload, the targeted-discovery agents run, and any `--focus` selectors the operator supplied.

##### `findings/<agent-name>.json`

One JSON file per discovery agent that participated in the run. Raw structured findings; consumed by the synthesis pass (T3.2) to produce `synthesis.md` and the strawman `scope-manifest.yaml`. Plaintext JSON, committed. Schema is per-agent (e.g., the UI-route enumerator emits `{ route, kind, components: [...], capturePaths: [...] }`; the AST/grep matrix builder emits its grep-matrix shape). Each agent's contract is documented in its source file under `tools/scope-discovery/discovery-agents/` (Phase 3 T3.1).

##### `captures/`

Discovery captures. Two kinds:

- `<capture-id>.png` — screenshots produced by Playwright-driven route walks. PNG-8 with quantization where legibility permits, to keep repo size in check (see PRD Risks).
- `<capture-id>.dom.json.gz` — DOM-token snapshots produced alongside each screenshot, gzip-compressed at write time. Used by the AST/grep matrix builder + by pattern hunters to correlate visible elements with their backing components.

Capture IDs are stable per-run identifiers (e.g., `roland-patches-page-default-state`); the per-agent JSON files in `findings/` reference these IDs.

##### `synthesis.md`

Narrative output of the synthesis pass (T3.2). Combines per-agent findings into a single human-readable account of what the run discovered, what the strawman manifest covers, what was excluded and why, and what's left for operator curation. Markdown, committed.

## What is NOT under `docs/`

- `tools/scope-discovery/` — the TypeScript implementation (detector, dispatch wrapper, validators, discovery agents). Lives under `tools/` because it's code, not planning artifacts.
- `.claude/skills/scope-inventory/` and `.claude/skills/scope-widen/` — the skill definitions (SKILL.md). Lives under `.claude/skills/` per Claude Code's plugin convention.
- `.githooks/pre-commit` — wires the clone detector into the commit gate. Lives under `.githooks/` per the project's existing hook convention.
- `.jscpd.json` — jscpd configuration (scope, thresholds, ignores). Lives at the repo root per jscpd's convention.

## Pre-commit gate vs. validator suite

The scope-discovery tooling has two distinct verification surfaces and the boundary between them is load-bearing:

- **Pre-commit hook** (`.githooks/pre-commit`) runs ONLY the clone detector (`make check-clone-duplication`) on commits that touch TS/TSX. It's the fast, deterministic gate that blocks NEW clone groups at commit time. The dispatch wrapper is NOT invoked here — the wrapper fires at sub-agent dispatch time inside an orchestrator session, not at commit time, so a commit-time wrapper check would have nothing to validate.
- **Validator suite** (`pnpm test:scope-discovery` or `make test-scope-discovery`) runs BOTH adversarial validator harnesses in sequence: `check-clone-duplication-validate` (proves the clone detector has teeth — gutted-logic self-check plants adversarial fixtures and asserts the detector catches them) followed by `check-dispatch-wrapper-validate` (proves the wrapper rejects malformed sub-agent returns — synthetic dispatchFn responses + gutted-wrapper self-check). Combined runtime is under 30s.

The validator suite is **controller-invokable and operator-invokable**, not pre-commit-invoked. The project removed external CI gates 2026-05-11; the controller (orchestrator session) is now the gate per `.claude/rules/agent-discipline.md` §"When CI is absent, the controller is the gate". The orchestrator runs `pnpm test:scope-discovery` after every Phase 2 task dispatch to independently verify the gates still have teeth; operators run it ad-hoc when they change detector/wrapper logic or want to confirm a touched validator scenario.

## Git-ignore policy

**Nothing under `docs/` is gitignored.** This is a load-bearing invariant — the entire point of treating discovery evidence as planning artifacts is that it travels with the feature in git, is review-visible, and is reconstructible by any future session reading the repo.

To verify the invariant against the live repo:

```bash
git check-ignore -v docs/scope-discovery/clones.yaml         # exits non-zero (not ignored)
git check-ignore -v docs/1.0/001-IN-PROGRESS/<slug>/scope-inventory/  # exits non-zero (not ignored)
git check-ignore -v docs/1.0/001-IN-PROGRESS/<slug>/scope-inventory/runs/<stamp>/captures/foo.png  # exits non-zero
```

Any positive match (exit 0 from `git check-ignore`) is a regression to be fixed by editing `.gitignore`. Adding `docs/**/*.png`, `docs/**/captures/`, or any similar exclusion would silently discard the audit trail; do not do this. PNG size pressure is addressed by quantization at write time, not by exclusion (see PRD Risks → *"Discovery-evidence repo size growth"*).

## Naming conventions

- **Feature slug:** kebab-case, matches the directory name under `<status>/` and the branch name (`feature/<slug>`). Operators pick the slug at `/dw-lifecycle:define` time.
- **Run stamp:** `<ISO-8601-UTC-with-colons-replaced-by-dashes>-<4-char-hex-runId>`. Example: `2026-05-22T14-03-12Z-a4f1`. Sortable lexicographically.
- **Agent name in `findings/<agent>.json`:** kebab-case, matches the agent's source filename in `tools/scope-discovery/discovery-agents/` (e.g., `ui-route-enumerator.ts` → `ui-route-enumerator.json`).
- **Capture ID:** kebab-case, descriptive (e.g., `roland-patches-page-default-state`, `s3k-library-keygroup-zone-collapsed`). Stable within a run; not required to be stable across runs.

## Lifecycle

1. **Feature setup.** `/dw-lifecycle:setup <slug>` creates `docs/<version>/<status>/<slug>/` with `prd.md`, `workplan.md`, `README.md`. No `scope-inventory/` directory yet.
2. **First inventory pass.** Operator types `/scope-inventory <slug>` in a Claude Code session. The skill creates `scope-inventory/journal.md` (empty index) + `scope-inventory/runs/<stamp>/` + writes findings, captures, synthesis. Appends a journal entry. Writes the strawman `scope-manifest.yaml` next to `prd.md`.
3. **Operator curation.** Operator reviews `scope-manifest.yaml`, prunes/edits the strawman. The curated manifest is committed.
4. **Mid-implementation widening (optional).** When a complaint surfaces, operator types `/scope-widen <slug> "<complaint>"`. Skill creates a new run dir under `runs/` (tagged in `meta.json` with `skill: "scope-widen"` + the complaint payload), appends a journal entry, and proposes manifest updates.
5. **Status transition.** When the feature moves PENDING → IN-PROGRESS → COMPLETE, the whole `docs/<version>/<status>/<slug>/` directory moves with it. The `scope-inventory/` evidence travels along.
6. **At feature close.** Operator may prune old runs to a representative subset (see PRD Risks). Prune actions are logged in `journal.md`. Never automatic.

## Cross-references

- PRD Goal #5 — [`../1.0/001-IN-PROGRESS/scope-discovery-protocol/prd.md`](../1.0/001-IN-PROGRESS/scope-discovery-protocol/prd.md)
- Workplan Modules Affected — [`../1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md`](../1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md)
- Manifest schema — [`../../tools/scope-discovery/schema/scope-manifest.schema.json`](../../tools/scope-discovery/schema/scope-manifest.schema.json)
- Clones YAML serializer — [`../../tools/scope-discovery/clones-yaml.ts`](../../tools/scope-discovery/clones-yaml.ts)
- `find-feature.ts` (backs `make scope-inventory`) — [`../../tools/scope-discovery/find-feature.ts`](../../tools/scope-discovery/find-feature.ts)
