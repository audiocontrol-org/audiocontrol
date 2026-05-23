# scope-discovery-protocol audit log

## AUDIT-20260522-01

Finding-ID: AUDIT-20260522-01
Status:     verified-2026-05-22
Severity:   high
Surface:    .githooks/pre-commit, .githooks/post-commit, .githooks/pre-push

The T7.5 `--no-verify` bypass detector is built on a false Git lifecycle assumption, so it does not actually detect bypassed commits. The design claims a missing post-commit sentinel proves `git commit --no-verify` was used, but Git still runs `post-commit` on `--no-verify` commits.

Evidence:
- [.githooks/post-commit](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/.githooks/post-commit:7) states that `git commit --no-verify` skips both `pre-commit` and `post-commit`.
- [.githooks/pre-push](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/.githooks/pre-push:2) treats a missing post-commit sentinel as evidence of `--no-verify`.
- Repro in a temporary repo with `pre-commit`, `commit-msg`, and `post-commit` hooks logged:

```text
normal:pre-commit
commit-msg
post-commit

noverify:post-commit
```

Expected vs actual:
- Expected: a `--no-verify` commit leaves no sentinel, so pre-push can warn on it.
- Actual: the `post-commit` hook still records the sentinel on `--no-verify`, so the pre-push warning has no signal to detect.

Fix guidance:
- Rework the detector around a hook that is actually skipped by `--no-verify`, or explicitly downgrade/remove the warning path rather than claiming it catches bypasses.

Resolution:
- Corrected mechanism (commit `bf599ad2`):
  - `.githooks/pre-commit` (skipped by `--no-verify`) writes a transient marker `.pre-commit-marker` as its last successful action.
  - `.githooks/post-commit` (runs on every commit, including `--no-verify`) reads HEAD's SHA, checks for the marker, writes the SHA-keyed sentinel IFF the marker exists, then deletes the marker.
  - `.githooks/pre-push` reads the sentinel and warns on any pushed SHA that is missing — unchanged signal shape; corrected source.
- Adversarial validator: `tools/scope-discovery/no-verify-detection.validate.ts` exercises three scenarios (normal-commit recorded, `--no-verify` commit NOT recorded, pre-push warns on bypassed SHA only) plus a gutted-detector self-check (gut the pre-commit marker write → "normal commit recorded" assertion MUST fail; proves the marker is load-bearing). Wired into `pnpm test:scope-discovery` (170 → 174 scenarios) and `make test-scope-discovery`.
- Empirical re-exercise (2026-05-22): all four scenarios pass against the corrected hooks in a throwaway `mktemp -d` git repo; `pnpm test:scope-discovery` reports 174/174.

## AUDIT-20260522-02

Finding-ID: AUDIT-20260522-02
Status:     verified-2026-05-22
Severity:   medium
Surface:    tools/scope-discovery/migrate-clone-ids.ts

The T7.1 clone-ID migrator can orphan an existing disposition when more than one shifted clone group shares the same bare file pair and `lines` count. The implementation stores only one `newGroups` entry per `shiftTolerantKey`, even though the surrounding comments describe a first-unmatched-wins policy across multiple candidates.

Evidence:
- [tools/scope-discovery/migrate-clone-ids.ts](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/tools/scope-discovery/migrate-clone-ids.ts:104) documents the collision case and says later old entries should surface as `unmapped`.
- The actual index at [migrate-clone-ids.ts](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/tools/scope-discovery/migrate-clone-ids.ts:215) is `Map<string, CloneGroup>`, so later `newGroups` with the same key overwrite earlier ones.
- The second-pass matcher at [migrate-clone-ids.ts](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/tools/scope-discovery/migrate-clone-ids.ts:236) can therefore only ever match one candidate for a colliding key.
- Repro with two old groups and two shifted new groups sharing the same `a.ts|b.ts#L10` key:

```json
{
  "idMap": [["old1", "new2"]],
  "unmapped": ["old2"],
  "newOnly": ["new1"]
}
```

Expected vs actual:
- Expected: either deterministic one-to-one matching across the candidate set, or an explicit collision failure that prevents silent disposition loss.
- Actual: one new entry is overwritten in the key map, one old entry becomes `unmapped`, and one new entry is treated as `newOnly`, which drops the old disposition unless the operator manually notices.

Fix guidance:
- Index `newByShift` as `Map<string, CloneGroup[]>` and resolve collisions explicitly, or fail the migration whenever a shift-tolerant key is non-unique.

Resolution:
- Corrected mechanism (commit `7a0eeeee`):
  - The pure two-pass matching kernel was extracted from `tools/scope-discovery/migrate-clone-ids.ts` into a new sibling file `tools/scope-discovery/migrate-clone-ids.matcher.ts` so the host stays under the 300-500 line cap after the collision-resolution expansion.
  - `newByShift` is now `Map<string, CloneGroup[]>`: candidates accumulate rather than overwriting.
  - Each bucket is sorted by smallest member's `startLine` (then by the full sorted-members tuple) at index-build time; old entries pick candidates in that deterministic order and consume the chosen one, so subsequent colliding olds pick the next.
  - When two candidates compare equal under the tiebreaker (i.e., their `members[]` are IDENTICAL), `migrateGroups` throws a new `MigrationError` instead of silently picking; the message names both candidate ids and the shift-tolerant key.
- Adversarial validator: `tools/scope-discovery/clone-id-stability.collision-scenarios.ts` adds three scenarios (deterministic tiebreaker with 2 candidates, identical-discriminator fail-loud, N-candidate deterministic resolution with 5/5 entries). Wired into `tools/scope-discovery/clone-id-stability.validate.ts` and `pnpm test:scope-discovery` (174 → 177 scenarios).
- Live-tree verification (2026-05-22): `tsx tools/scope-discovery/migrate-clone-ids.ts --dry-run` against the current `docs/scope-discovery/clones.yaml` (post-T7.1 migration) reports `495 matched, 0 unmapped, 0 newOnly` under the corrected logic. No orphaned dispositions in the live data — the original T7.1 run happened against an all-pending baseline, so even if the buggy `Map<string, CloneGroup>` overwrote candidates internally, no operator-authored disposition existed to be silently dropped at that time.
- Empirical re-exercise (2026-05-22): all 12 scenarios in `clone-id-stability.validate.ts` pass against the corrected matcher; full `pnpm test:scope-discovery` reports 177/177.

## AUDIT-20260522-03

Finding-ID: AUDIT-20260522-03
Status:     verified-2026-05-22
Severity:   high
Surface:    .githooks/pre-commit, .githooks/post-commit, tools/scope-discovery/no-verify-detection.validate.ts

The replacement `--no-verify` detector still has a stale-marker hole. If a commit attempt runs `pre-commit`, writes `.pre-commit-marker`, and then aborts before `post-commit` runs, the marker is left behind. A later `git commit --no-verify` skips `pre-commit`, but `post-commit` still sees the stale marker and records the bypassed commit as if pre-commit had run.

Evidence:
- [.githooks/pre-commit](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/.githooks/pre-commit:73) writes `.pre-commit-marker` as the last successful action, but there is no cleanup path if a later hook aborts the commit.
- [.githooks/post-commit](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/.githooks/post-commit:45) treats marker presence as sufficient evidence that pre-commit ran for the current commit and only removes it after recording the SHA.
- The validator covers only the happy path, direct `--no-verify`, pre-push warning, and gutted-pre-commit self-check [tools/scope-discovery/no-verify-detection.validate.ts](/Users/orion/work/audiocontrol-work/audiocontrol-scope-discovery-protocol/tools/scope-discovery/no-verify-detection.validate.ts:163). It does not exercise “failed commit leaves stale marker, next `--no-verify` commit inherits it.”
- Repro in a throwaway repo:
  1. `pre-commit` writes the marker.
  2. `commit-msg` exits `1`, so the commit aborts and `post-commit` never consumes the marker.
  3. A later `git commit --no-verify` succeeds.
  4. The bypassed commit SHA is present in `.pre-commit-passed`.

Observed output:

```text
after-failed-commit marker=yes sentinel_exists=no
bypass_sha=752977666209ba27afeaa40a20889666f53f1d0a
sentinel_contains=yes
```

Expected vs actual:
- Expected: a `--no-verify` commit should never be recorded as pre-commit-verified, regardless of prior failed commit attempts.
- Actual: a stale marker from an aborted earlier commit causes the later bypassed commit to be falsely recorded, so pre-push will not warn.

Fix guidance:
- Bind the marker to the specific commit attempt rather than using an unscoped presence check, or add cleanup for abort paths before any later commit can reuse the marker.
- Extend `no-verify-detection.validate.ts` with an adversarial scenario covering “failed commit before post-commit, then `--no-verify`”.

Resolution:
- Corrected mechanism (commit `29bdc9c2`): move the marker write from `.githooks/pre-commit` to `.githooks/commit-msg` as commit-msg's last successful action. Verified Git lifecycle facts: (a) commit-msg runs after pre-commit succeeds and immediately before the commit lands atomically — Git provides no abort window between commit-msg's success exit and post-commit's execution; (b) commit-msg is also skipped by `git commit --no-verify`, so the bypass case still produces no marker. Architectural property: the only way for the marker to exist when post-commit runs is for commit-msg to have completed, which means both pre-commit and commit-msg ran AND `--no-verify` was not used. There is no stale-marker hole because there is no abort window after the marker write.
- Adversarial validator: `tools/scope-discovery/no-verify-detection.validate.ts` adds a fifth scenario (`stale-marker-from-aborted-commit`) that wires a commit-msg stub which aborts before the marker write, asserts no marker survives on disk, then runs a `git commit --no-verify` and asserts the bypassed SHA does NOT appear in the sentinel. Confirmed teeth: under the prior AUDIT-01 architecture (pre-commit writes the marker) the scenario fails — stranded marker → bypass recorded → assertion trips. The existing four scenarios were refactored to use a new `FixtureOptions { preCommit, commitMsg }` shape; the gutted-detector self-check now guts commit-msg (the new marker source) rather than pre-commit. Suite: `pnpm test:scope-discovery` 177 → 178.
- Empirical re-exercise (2026-05-22): the auditor's repro (pre-commit OK → commit-msg aborts → marker absent → `git commit --no-verify` → bypass SHA NOT in sentinel) passes in a throwaway `mktemp -d` git repo. The happy path (normal commit recorded; pre-push warns on `--no-verify` SHA only) also passes. The fix commit `29bdc9c2` itself records correctly under the new mechanism — verified by grepping the sentinel for its SHA — which proves the new mechanism works on itself.

## AUDIT-20260522-04

Finding-ID: AUDIT-20260522-04
Status:     verified-2026-05-22
Severity:   medium
Surface:    tools/scope-discovery/check-anti-patterns.ts, tools/scope-discovery/anti-patterns-registry.ts, docs/scope-discovery/anti-patterns.yaml schema

The T6.1 anti-pattern registry has no path-exclude mechanism. For every primitive whose body IS the legacy shape it replaces (the common case — `useExportDialogLifecycle.ts`, `PageTitleRow.tsx`, `AcReloadIcon.tsx`, `BankHeader.tsx`, `SlotInfo.tsx`, `AcRadioTabs.tsx`, `DestinationEyebrow.tsx`, `LibraryDeviceMemoryPanel.tsx`, `LibraryPreviewPanelAdapter.tsx`, `browser-download.ts`), the scan flags the canonical file as a holdout against its own anti-pattern. The gate cannot be satisfied.

Evidence:
- Surfaced via dogfooding on `feature/roland-bugfix` Phase 4 backfilling 9 anti-pattern entries from Phase 2 extractions.
- Empirical repro: drafting `use-export-dialog-lifecycle-inline` (two-pattern fingerprint with `min_distance: 10`) and running `make check-anti-patterns` produces:
  ```
  modules/roland-sxx0-editor/src/hooks/useExportDialogLifecycle.ts:77: matches anti-pattern use-export-dialog-lifecycle-inline
    replacement: useExportDialogLifecycle from @/hooks/useExportDialogLifecycle
  anti-patterns: 1 finding(s) across 1347 files.
  make: *** [check-anti-patterns] Error 1
  ```
- `AntiPatternEntry` carries `id`, `addedIn`, `primitive`, `from`, `patterns`, `minDistance`, `message`. No `excludes_paths:` field, no `skip_canonical:` flag, no implicit "skip the file the primitive's `from:` path points at" semantic.
- Workaround attempts considered + rejected by the bugfix-branch operator: position-aware fingerprints (inverts the firing semantic), negative-lookbehind regex (fragile, brittle), drop the JSX/SVG primitives (most extracted primitives have this property).

Expected vs actual:
- Expected: the canonical file can be excluded from its own anti-pattern's scan via an explicit declaration.
- Actual: every anti-pattern derived from an extracted primitive whose body contains the legacy shape fires on the canonical file itself, blocking the gate.

Fix guidance:
- Add an optional `excludes_paths:` field to `AntiPatternEntry`. Semantics: filter out files whose path matches any listed glob or literal path before running the entry's patterns. Primary use case: the canonical primitive's own file. Secondary: test fixtures that intentionally carry the legacy shape as evidence.
- Path-exclude must be per-entry (not registry-wide) to handle the test-fixture case.
- Adversarial validator scenarios: (a) canonical file excluded + matches shape → no finding; (b) holdout file matching shape → finding still fires; (c) malformed exclude pattern → registry parse error.

External tracking: ROLAND-BUGFIX-T6.1-EXCLUDE (filed on bugfix branch as consumer-side tracking; this audit-log entry is protocol-side).

Resolution:
- Corrected mechanism (commit `914710a2`): added optional `excludes_paths:` field to the anti-pattern registry schema. `AntiPatternEntry` gains `readonly excludesPaths: readonly ExcludePath[]` (compiled glob regexes via `util/glob.ts`); the parser accepts a list of non-empty strings (literal paths OR globs) and rejects malformed shapes with the standard prefixed parse error. The scanner now computes `relPath = toPosix(relative(process.cwd(), file))` per file and, for each registry entry, skips the file via `isPathExcluded(entry, relPath)` BEFORE running the entry's shape patterns. The exclusion is per-entry (other entries still scan the file normally), CWD-relative (matches how findings render in the report so an operator can copy a flagged path into `excludes_paths:` as-is), and empty-array-tolerant (missing field OR `[]` preserves prior behavior). YAML schema doc in `docs/scope-discovery/anti-patterns.yaml` updated with the new field. Glob compilation reuses the existing `globToRegex`; the brace-alternation limitation tracked under AUDIT-20260522-05 is not on the hot path for `excludes_paths` (the common case is a single literal path or a `**`-style glob without brace alternation).
- Adversarial validator: `tools/scope-discovery/anti-patterns.excludes-scenarios.ts` adds five scenarios — `excludes-paths-literal-skips-canonical-file` (with a paired control fixture that runs the same source tree without `excludes_paths` to prove the 2→1 finding delta is caused by the exclusion), `excludes-paths-glob-skips-tree` (`canonical/**/*.ts` excludes a nested subtree while `holdouts/c.ts` still surfaces), `excludes-paths-empty-array-behaves-as-absent`, `excludes-paths-malformed-element-rejected` (non-string element → exit 2 + descriptive parse error), and `excludes-paths-no-match-not-an-error` (glob matching zero files still passes; both files surface). Lives in a sibling module so `anti-patterns.validate.ts` stays under the 300-500 line cap. `util/run-scanner.ts` grew an optional `cwd` so the literal-path scenarios can run the scanner with CWD = the fixture root. Suite: `pnpm test:scope-discovery` 173 → 178 scenarios.
- Empirical re-exercise (2026-05-22): the auditor's synthetic repro (plant `lib/canonical.ts` + `lib/holdout.ts`, both carrying the legacy shape; run scanner with `excludes_paths: ['lib/canonical.ts']`; re-run without) executed against the corrected scanner reports exactly the expected behavior — Case A: exit 1, 1 finding (`lib/holdout.ts` only); Case B: exit 1, 2 findings (both files). Pre-commit hook recorded the fix commit `914710a2` in `.git/hooks-sentinels/.pre-commit-passed`; no hooks bypassed.

## AUDIT-20260522-05

Finding-ID: AUDIT-20260522-05
Status:     open
Severity:   medium
Surface:    tools/scope-discovery/util/glob.ts

The shared `globToRegex` compiler escapes `*` literally when it appears inside `{...}` alternation, instead of expanding it to `[^/]*` like top-level `*`. Result: globs of the form `lib/{Foo*Dialog,Bar*Dialog}.tsx` compile to a regex that matches zero files. Consumers using brace alternation with wildcards (adopter manifests, editor-symmetry matrix, deprecation scans) silently produce empty match sets.

Evidence:
- Surfaced via dogfooding on `feature/roland-bugfix` Phase 5 backfilling adopter manifests. First attempt used `'modules/roland-sxx0-editor/src/components/library/{Export*Dialog,Import*Dialog,BatchExportDrawer}.tsx'`. The schema validator rejected the exception entries as "inert" (glob matches zero files), making the registry unloadable.
- Reproducer:
  ```typescript
  import { globToRegex } from './tools/scope-discovery/util/glob.ts';
  const re = globToRegex('lib/{Foo*Dialog,Bar*Dialog}.tsx');
  console.log(re.source);
  // -> ^lib\/(?:Foo\*Dialog|Bar\*Dialog)\.tsx$
  // expected: ^lib\/(?:Foo[^/]*Dialog|Bar[^/]*Dialog)\.tsx$
  console.log(re.test('lib/FooLibraryDialog.tsx'));  // false (expected true)
  ```
- `globToRegex` is imported by `util/glob.ts` consumers across the scope-discovery surface: `adopter-manifests-registry.ts`, `editor-symmetry-matrix.ts`, `deprecation-scan.ts`, `editor-symmetry.scenarios.ts`. Any glob using brace+wildcard silently produces zero matches.

Expected vs actual:
- Expected: `{a*c,b*d}` expands to `(?:a[^/]*c|b[^/]*d)` — each alternative re-compiled through the same wildcard logic.
- Actual: `{a*c,b*d}` compiles to `(?:a\*c|b\*d)` — alternation body is literal-escaped.

Fix guidance:
- `globToRegex`'s alternation handler should recursively re-compile each alternative through the same `*` / `**` / `?` expansion logic, then join with `|`.
- Adversarial validator scenarios: (a) `{a*c,b*d}` matches `axc` and `byd`; (b) `{a/**/b,c/**/d}` matches `a/x/y/b` and `c/x/y/d`; (c) nested brace `{a,{b,c}}` works correctly; (d) literal-escape preserved for non-wildcard chars (`{a.b,c.d}` → `(?:a\.b|c\.d)`).

External tracking: ROLAND-BUGFIX-T6.2-GLOB (filed on bugfix branch as consumer-side tracking).

## AUDIT-20260522-06

Finding-ID: AUDIT-20260522-06
Status:     open
Severity:   medium
Surface:    docs/scope-discovery/adopter-manifests.yaml schema, tools/scope-discovery/adopter-manifests-registry.ts, tools/scope-discovery/adopter-manifests-report.ts, tools/scope-discovery/editor-symmetry-matrix.ts

The T6.2 adopter-manifest schema's `exceptions:` field collapses two semantically distinct cases: (a) permanent opt-outs (the file legitimately shouldn't adopt) and (b) deferred-but-known holdouts (the file IS a holdout, with an open follow-up to fix it). The only way to keep the gate green when a known migration is pending is to list the file as a permanent exception — which hides the work-to-do count and makes the T6.3 cross-editor symmetry matrix render `✓` for editors with unsilenced-but-acknowledged holdouts.

Evidence:
- Surfaced via dogfooding on `feature/roland-bugfix` Phase 5 (adopter manifests, 5 Import-dialog SlideDrawer holdouts pending ROLAND-BUGFIX-V3-IMPORT) and Phase 6 (cross-editor matrix masking akai's 9 library-dialog holdouts).
- The 5 Import-dialog deferrals were tracked via `reason: TRACKED HOLDOUT — pending ROLAND-BUGFIX-V3-IMPORT (issue #450)` in the `exceptions:` field. Visible to manifest readers; invisible to any tool deriving counts or holdout-burndown metrics.
- The T6.3 matrix's `slide-drawer-library-dialogs × akai-s3k-editor` cell renders `✓ 9/9` because exceptions are silently subtracted from the holdout count before the matrix renders. A reader scanning the matrix for asymmetries sees `✓` everywhere and concludes "no asymmetries" — the opposite of the truth (9 of 9 akai library dialogs are on legacy chrome).
- Finding #4 in the bugfix-branch tooling-feedback.md (matrix masking) rolls up into this finding — same root cause.

Expected vs actual:
- Expected: `tracked_holdouts:` is a distinct field from `exceptions:`. Tracked holdouts are not findings (gate passes) but are reported under their own section. Each tracked-holdout entry requires an `issue:` URL to prevent the field from becoming a "I'll fix it later" deferral dumping ground. The matrix renders tracked-holdout cells in a third state (e.g., `⏳ A/E (H tracked)`).
- Actual: `exceptions:` collapses both semantics. Burndown counts are wrong. Matrix asymmetries are masked.

Fix guidance:
- Add `tracked_holdouts:` field to `AdopterManifestEntry`. Required sub-fields per entry: `path` (string), `issue` (URL string), `reason` (multi-line string). Validator rejects entries missing `issue:`.
- `make check-adopters` exit code stays 0 when tracked-holdouts are listed (gate passes) but the report emits them under a separate `tracked_holdouts:` section.
- `make check-editor-symmetry` matrix renders tracked-holdout cells with a distinct glyph (proposed: `⏳ A/E (H tracked)`).
- Adversarial validator scenarios for adopter-manifests: (a) tracked-holdout file is NOT a finding; (b) tracked-holdout report section names the file + issue URL; (c) entry without `issue:` → parse error; (d) tracked-holdout path that doesn't match any glob → parse error.
- Adversarial validator scenarios for editor-symmetry: tracked-holdouts render with the new glyph; existing `✓ N/N` / `⚠ A/E (H)` / `✗` / `—` cells unaffected.

External tracking: ROLAND-BUGFIX-T6.2-TRACKED-HOLDOUTS (#453 — filed on bugfix branch as consumer-side tracking).
