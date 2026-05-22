---
name: scope-inventory
description: "Run upfront discovery for a system-wide feature. Fans out discovery agents in parallel, synthesizes a strawman scope-manifest.yaml, writes the evidence trail to the feature docs directory."
user_invocable: true
---

# scope-inventory

Produce a strawman `scope-manifest.yaml` for a system-wide feature by running the multi-agent discovery fleet against the current audiocontrol repo state, write the per-run evidence trail to the feature's docs directory under `scope-inventory/runs/<ISO-stamp>-<runId>/`, append a journal entry, and present the manifest in chat for operator curation.

The skill is the operator-facing entry point that ties together the foundation built in Phase 2 (manifest schema, dispatch wrapper, clone detector) and the discovery code in Phase 3 (T3.1 agents, T3.2 synthesis). The on-disk layout is defined by [`docs/scope-discovery/LAYOUT.md`](../../../docs/scope-discovery/LAYOUT.md); this skill writes that layout.

## When to use

- After `/dw-lifecycle:define` + `/dw-lifecycle:setup` for a **system-wide feature** — UI redesign, architectural refactor, cross-cutting pattern enforcement, anything where the scope-discovery PRD's Goals apply (route × device × scenario decomposition is non-trivial).
- Re-run mid-feature when scope materially changes. New runs append to `runs/` rather than overwriting; the canonical manifest at `scope-manifest.yaml` is overwritten by design (operator git-tags or branches before re-running to preserve a prior curated state).

## Argument

```
/scope-inventory <feature-slug>
```

`<feature-slug>` is kebab-case. It must match the same regex the manifest schema enforces on `feature_slug`:

```
^[a-z0-9][a-z0-9-]*[a-z0-9]$
```

## Procedure

### 1. Validate the slug

Reject any slug that doesn't match the regex above. The error message names the regex literally and shows the offending input — synthesis would reject it later regardless; catching it here surfaces the error before doing work.

### 2. Locate the feature directory

Use the `make scope-inventory FEATURE=<slug>` target (T2.7). It calls `tools/scope-discovery/find-feature.ts`, which searches the four `<status>` subdirectories under `docs/<version>/` and prints either the resolved path or an actionable miss listing every searched path.

If the target exits non-zero, refuse with the target's error and direct the operator at `/dw-lifecycle:setup`. Do NOT fall back to a heuristic search.

Capture the resolved path as `FEATURE_DIR` for the rest of the procedure (e.g., `docs/1.0/001-IN-PROGRESS/<slug>/`).

### 3. Generate the run ID

The run stamp is `<ISO-8601-UTC-with-colons-replaced-by-dashes>-<6-char-runId>`, matching the LAYOUT.md naming convention. Generate both at invocation start so `meta.json.startedAt` and the directory name agree:

- ISO timestamp: `new Date().toISOString().replace(/[:.]/g, '-').replace(/-$/, '')` (e.g., `2026-05-22T14-03-12-000Z`).
- 6-char suffix: `Math.random().toString(36).slice(2, 8)` (or any equivalent collision-resistant short id).
- Final form: `<ISO-stamp>-<runId>`.

### 4. Create the run directory

```
mkdir -p <FEATURE_DIR>/scope-inventory/runs/<ISO-stamp>-<runId>/findings
mkdir -p <FEATURE_DIR>/scope-inventory/runs/<ISO-stamp>-<runId>/captures
```

The `captures/` directory is created empty by this skill; per LAYOUT.md, captures are populated by future Playwright-driven walks (out of scope for v1).

### 5. Fan out the discovery-agent fleet in parallel

Each agent reads `--feature <slug> --prd-path <FEATURE_DIR>/prd.md --repo-root .` and writes its findings JSON to stdout. Run all five concurrently and redirect stdout to the corresponding file under `findings/`:

```bash
RUN_DIR=<FEATURE_DIR>/scope-inventory/runs/<ISO-stamp>-<runId>
PRD=<FEATURE_DIR>/prd.md

tsx tools/scope-discovery/discovery-agents/ui-route-enumerator.ts \
  --feature <slug> --prd-path "$PRD" --repo-root . \
  > "$RUN_DIR/findings/ui-route-enumerator.json" &
PID_UI=$!

tsx tools/scope-discovery/discovery-agents/ast-grep-matrix.ts \
  --feature <slug> --prd-path "$PRD" --repo-root . \
  > "$RUN_DIR/findings/ast-grep-matrix.json" &
PID_AST=$!

tsx tools/scope-discovery/discovery-agents/clone-detector-reader.ts \
  --feature <slug> --prd-path "$PRD" --repo-root . \
  > "$RUN_DIR/findings/clone-detector-reader.json" &
PID_CLONE=$!

tsx tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.ts \
  --feature <slug> --prd-path "$PRD" --repo-root . \
  > "$RUN_DIR/findings/prd-themed-pattern-hunter.json" &
PID_PRD=$!

tsx tools/scope-discovery/discovery-agents/regime-holdout-detector.ts \
  --feature <slug> --prd-path "$PRD" --repo-root . \
  > "$RUN_DIR/findings/regime-holdout-detector.json" &
PID_REGIME=$!

wait $PID_UI $PID_AST $PID_CLONE $PID_PRD $PID_REGIME
```

The fifth agent — `regime-holdout-detector` (T6.5) — fuses the four Phase 6 gates (anti-patterns, adopter-manifests, editor-symmetry, deprecation-queue) into a single `RegimeHoldoutFindings` payload that the synthesis pass emits as the manifest's top-level `regime_holdouts:` section. It is in-process (consumes the four scanners directly), so its findings reflect the same on-disk state the operator-driven `make check-anti-patterns` / `make check-adopters` / `make check-editor-symmetry` / `make check-deprecations` targets would.

Record each agent's exit code (`$?` after each `wait <pid>`, or by waiting on each pid individually) for `meta.json`. **If any agent exits non-zero, refuse to continue** — surface the agent name, exit code, and the agent's stderr. Do NOT synthesize from partial findings; partial inputs would produce a partial manifest that the operator could mistake for complete.

### 6. Run the synthesis pass

```bash
tsx tools/scope-discovery/synthesis.ts \
  --feature <slug> \
  --prd-path "$PRD" \
  --repo-root . \
  --findings "$RUN_DIR/findings/ui-route-enumerator.json" \
             "$RUN_DIR/findings/ast-grep-matrix.json" \
             "$RUN_DIR/findings/clone-detector-reader.json" \
             "$RUN_DIR/findings/prd-themed-pattern-hunter.json" \
             "$RUN_DIR/findings/regime-holdout-detector.json" \
  --out "<FEATURE_DIR>/scope-manifest.yaml"
```

The synthesizer validates the produced manifest against `tools/scope-discovery/schema/scope-manifest.schema.json` before writing. If validation fails, the synthesizer exits non-zero with the ajv error; surface that error and refuse. Do not edit the manifest by hand to make validation pass — fix the upstream cause (agent output shape, theme bag, etc.).

Record the synthesis exit code for `meta.json`.

### 7. Write `meta.json`

After synthesis succeeds, write the run metadata. Use the Write tool, not `echo`, and write valid JSON (no trailing commas):

```json
{
  "runId": "<ISO-stamp>-<runId>",
  "skill": "scope-inventory",
  "skillVersion": "0.1.0",
  "featureSlug": "<slug>",
  "featureDir": "<FEATURE_DIR>",
  "featureStatus": "<status-dir-name>",
  "operator": "<git config user.name>",
  "startedAt": "<ISO-8601 captured at step 3>",
  "completedAt": "<ISO-8601 captured after step 6>",
  "inputs": {
    "prdPath": "<FEATURE_DIR>/prd.md"
  },
  "agentsRun": [
    "ui-route-enumerator",
    "ast-grep-matrix",
    "clone-detector-reader",
    "prd-themed-pattern-hunter",
    "regime-holdout-detector"
  ],
  "agentExitCodes": {
    "ui-route-enumerator": 0,
    "ast-grep-matrix": 0,
    "clone-detector-reader": 0,
    "prd-themed-pattern-hunter": 0,
    "regime-holdout-detector": 0
  },
  "synthesisExitCode": 0,
  "manifestPath": "<FEATURE_DIR>/scope-manifest.yaml",
  "captureCount": 0
}
```

The `captureCount` is 0 in v1 (no Playwright walk yet); the field is reserved by LAYOUT.md and recorded for forward compatibility.

### 8. Write `synthesis.md`

Write a short narrative summary of the run to `$RUN_DIR/synthesis.md`. Use the Write tool. Sections, in order:

- **Run summary** — runId, startedAt → completedAt elapsed, feature slug, feature dir.
- **Kind detection** — which agent outputs led the synthesizer to choose `ui` / `code` / `hybrid`. (Read the kind from the produced manifest; cite the agent counts.)
- **Routes detected** — count + the first ten paths (or all if fewer). For non-UI kinds, write *"n/a — kind=code; no routes in manifest"*.
- **Modules detected** — count + the top ten by hit count. For non-code kinds, write *"n/a — kind=ui; no modules in manifest"*.
- **Themes detected** — count + the top ten themes by occurrence.
- **Regime holdouts** — read the manifest's `regime_holdouts.meta` section. Report `total` plus the four `by_source` counts (`anti_pattern`, `adopter_manifest`, `editor_symmetry`, `deprecation`). For non-zero buckets, list up to five sample finding ids with their `file` field. For an all-zero result, write *"clean — no regime holdouts in the current source tree"*. This section IS the burndown summary the operator drives Phase 6 work from; do not abbreviate.
- **Reference docs** — count + list (PRD path always included; agent-derived doc references appended).
- **Operator curation hints** — concrete pointers (e.g., *"26 modules listed across `modules/*`; prune to those genuinely in scope before downstream phase work treats the manifest as binding"*). At minimum mention manifest size, any obvious noise (modules touched by clone-detector-reader but not name-checked by the PRD-themed hunter, etc.), and the next operator action.

Keep it under 100 lines; this file is a reading-surface, not a dump.

### 9. Append the journal entry

Append to `<FEATURE_DIR>/scope-inventory/journal.md`. If the file does not exist, create it with the top-level heading first:

```markdown
# Scope Inventory Journal — <feature-slug>
```

Then append the entry (newest-last, per LAYOUT.md operator-choice convention; this skill writes newest-last so the file reads forward in time):

```markdown
## <ISO-stamp>-<runId>

- **Operator:** <git user.name>
- **Kind:** ui|code|hybrid (from manifest)
- **Counts:** N routes / M modules / K themes
- **Manifest:** [`../scope-manifest.yaml`](../scope-manifest.yaml)
- **Evidence:** [`runs/<ISO-stamp>-<runId>/`](runs/<ISO-stamp>-<runId>/)

<One short paragraph (3–6 sentences) describing what the run found and what the operator should focus on. Mirror the highlights of synthesis.md §"Operator curation hints" — do not paste it verbatim; the journal is the human reading-surface and the synthesis.md is the machine-readable narrative.>
```

Use the Edit tool (with `replace_all: false`) to append, or Write to the path if the file is new. Do NOT use shell redirection (`>>`) — heredoc-with-`#` characters trips the permission gate, and Write avoids that entirely.

### 10. Present the manifest summary in chat

After all artifacts land, print a summary block. The format below is the canonical reporting shape — keep it terse and link-heavy so the operator can navigate to the evidence trail without re-asking:

```
Scope inventory complete for <slug>.

Kind:        <kind>
Routes:      N (sorted by path)
Modules:     M (sorted by hit count desc)
Themes:      K (top 10 by occurrence)
Regime:      H total (anti-pat=A / adopter=B / symmetry=C / deprecation=D)
Ref docs:    R

Manifest:    <FEATURE_DIR>/scope-manifest.yaml
Journal:     <FEATURE_DIR>/scope-inventory/journal.md  (run <ISO-stamp>-<runId>)
Evidence:    <FEATURE_DIR>/scope-inventory/runs/<ISO-stamp>-<runId>/

Next step: review the manifest. Prune false positives, add scenarios per
route, and confirm with the operator before downstream phase work treats
it as binding.
```

Do not editorialize beyond the curation hint; the operator drives from here.

## Re-invocations

Each invocation creates a NEW run directory (different stamp + runId). Prior runs are never overwritten — they are the audit trail.

The canonical `scope-manifest.yaml` IS overwritten on each successful run, by design: the latest synthesized strawman is what the operator curates against. To preserve a prior curated manifest, the operator git-tags or branches before re-running. The journal's per-entry manifest link always resolves to the current canonical manifest; the per-run `meta.json.manifestPath` field records which manifest the run produced (always the canonical path; the history is in git, not in `runs/`).

If the operator wants to compare a strawman against a prior curated version, they run `git diff <tag>:<FEATURE_DIR>/scope-manifest.yaml <FEATURE_DIR>/scope-manifest.yaml` after the new run lands.

## Error handling

| Failure | Skill response |
|---|---|
| Slug fails the regex | Refuse. Print the regex + the offending input. Do not create any directories. |
| `make scope-inventory FEATURE=<slug>` exits non-zero | Refuse. Print the target's stderr and direct the operator at `/dw-lifecycle:setup <slug>`. Do not create any directories. |
| Any discovery agent exits non-zero | Refuse. Print the agent name, exit code, and the contents of its stderr. Do NOT proceed to synthesis. The partial findings under `$RUN_DIR/findings/` are left in place for debugging; the run directory is NOT deleted so a follow-up can inspect what the surviving agents produced. |
| Synthesis exits non-zero (schema validation failure or upstream shape mismatch) | Refuse. Print the synthesizer's stderr. The run directory is left in place; do NOT touch `scope-manifest.yaml` (so the prior curated state survives a failed re-run). |
| `journal.md` write fails | Refuse. Print the filesystem error. The manifest and run directory are already on disk; a follow-up invocation will create a new run, which is the correct disposition (manifests reflect the latest synthesis; journals are append-only). |

## What this skill does NOT do

- **Drive Playwright for visual captures.** v1 enumerates the route MAP; per-route screenshots + DOM-token snapshots are a separate manual step (or a future agent enhancement). The `captures/` directory is created empty for forward compatibility with LAYOUT.md.
- **Refactor or fix anything.** Output is an inventory and a strawman manifest. The operator curates the strawman; downstream phase work treats the curated manifest as binding scope.
- **Modify the PRD or workplan.** Discovery is purely additive — it reads `prd.md` and writes `scope-manifest.yaml` + the evidence trail. The PRD is the input.
- **Run the validator suites.** `pnpm test:scope-discovery` is operator/controller-invoked per `.claude/rules/agent-discipline.md` §"When CI is absent, the controller is the gate". The skill assumes the foundation is healthy; if validators are red, the operator runs them separately and fixes before invoking `/scope-inventory`.

## Cross-references

- Layout contract — [`docs/scope-discovery/LAYOUT.md`](../../../docs/scope-discovery/LAYOUT.md)
- Manifest schema — [`tools/scope-discovery/schema/scope-manifest.schema.json`](../../../tools/scope-discovery/schema/scope-manifest.schema.json)
- Discovery agents — [`tools/scope-discovery/discovery-agents/`](../../../tools/scope-discovery/discovery-agents/)
- Synthesis pass — [`tools/scope-discovery/synthesis.ts`](../../../tools/scope-discovery/synthesis.ts)
- `make scope-inventory` target — [`tools/scope-discovery/find-feature.ts`](../../../tools/scope-discovery/find-feature.ts)
- Workplan T3.3 — [`docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md`](../../../docs/1.0/001-IN-PROGRESS/scope-discovery-protocol/workplan.md)
- Regime-holdout detector (T6.5) — [`tools/scope-discovery/discovery-agents/regime-holdout-detector.ts`](../../../tools/scope-discovery/discovery-agents/regime-holdout-detector.ts)
