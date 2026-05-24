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
Status:     verified-2026-05-22
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

Resolution:
- Corrected mechanism (commit `2b3158e6`): `globToRegex` now routes every brace alternative back through the full compile pipeline. A new private `compileGlobBody(pattern)` exposes the unanchored compile pass (`expandBraces` + `compileSegmentwise`); the top-level `globToRegex` wraps it in `^…$`, and `compileSegment`'s alternation-token expander calls `compileGlobBody` on each alternative instead of `escapeRegex`. As a side-effect of the recursive entry point, `expandBraces` now tracks brace depth properly: `findMatchingBrace` pairs `{` / `}`, and `splitTopLevelCommas` only treats depth-0 commas as alternation separators. Nested braces (`{a,{b,c}}`) work as a free by-product — the outer pass lifts the whole inner group as part of one alternative; the recursive compile re-lifts the inner group on the next pass. Top-level `*` / `**` / `?` paths through `compileSegmentwise` are unchanged.
- Adversarial validator: `tools/scope-discovery/util/glob.validate.ts` exercises eight scenarios — `wildcard-in-alternation-single-star` (`{a*c,b*d}` → `[^/]*` expansion; no `\*`), `wildcard-in-alternation-double-star` (`{a/**/b,c/**/d}` matches `a/b`, `a/x/b`, `a/x/y/b`, `c/d`, `c/x/y/z/d`), `wildcard-in-alternation-question` (`{a?c,b?d}` matches single-char fillers, rejects multi-char and slash), `nested-braces` (`{a,{b,c}}` matches `a`/`b`/`c`), `literal-chars-in-braces` (`{a.b,c.d}` keeps `.` escaped), `top-level-wildcard-still-works` (`lib/*.ts` regression guard), `bugfix-repro` (the audit's verbatim `lib/{Foo*Dialog,Bar*Dialog}.tsx`), and `gutted-stub-self-check` (a literal-escaping compiler stub MUST fail the bugfix-repro assertion — confirmed teeth). Wired via `make check-glob-validate` and `pnpm test:scope-discovery` (178 → 186 scenarios).
- Empirical re-exercise (2026-05-22): the auditor's verbatim reproducer (`globToRegex('lib/{Foo*Dialog,Bar*Dialog}.tsx')`) now produces `^lib\/(?:Foo[^/]*Dialog|Bar[^/]*Dialog)\.tsx$` and `re.test('lib/FooLibraryDialog.tsx')` returns `true`. Side-effect check: `pnpm test:scope-discovery` reports 186/186 (no existing validator regressed); `tsx tools/scope-discovery/clone-detector.ts --quiet` reports `495 groups; 0 NEW; 0 DROPPED`; `pnpm exec tsc --noEmit` exits 0. Pre-commit hook recorded the fix commit `2b3158e6` in `.git/hooks-sentinels/.pre-commit-passed`; no hooks bypassed.

## AUDIT-20260522-06

Finding-ID: AUDIT-20260522-06
Status:     verified-2026-05-23
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

Resolution:
- Corrected mechanism (commit `caa132d9`): added optional `tracked_holdouts:` field to the adopter-manifest registry schema. `AdopterManifestEntry` gains `readonly trackedHoldouts: readonly TrackedHoldout[]`, where each `TrackedHoldout` carries non-empty `path` + `issue` (URL containing `://` OR a `#`-prefixed GitHub-style ref) + `reason`. The parser rejects entries missing any of the three fields, paths that don't match any `expected_adopters_glob` (same posture as the existing `exceptions` check), and any path listed in BOTH `exceptions:` and `tracked_holdouts:` (mutually-exclusive dispositions). The scanner (`check-adopters.ts`) now partitions expected files into three buckets BEFORE checking imports — exceptions, tracked-holdouts, regular candidates — so tracked-holdouts NEVER reach the `holdouts` array that drives the exit code. The report emits tracked-holdouts under a dedicated `tracked holdouts (gate-passing, pending follow-up):` section naming the path, issue URL, and first line of the reason; the JSON output exposes a parallel `tracked_holdouts: []` array per manifest entry. Exit code stays 0 when only tracked-holdouts remain. The T6.3 editor-symmetry matrix (`editor-symmetry-matrix.ts` + `editor-symmetry-report.ts`) gains a fourth bucket per cell and a new `tracked` `CellStatus` rendered as `⏳ A/E (T tracked)`; real holdouts dominate (`⚠`/`✗` cells take precedence over `⏳` when both exist), so the matrix still surfaces work-blocking gaps. The renderer's legend prose + `STATUS_GLYPH` map + `tallyStatuses` totals were extended in lockstep. DRY: the existing `adopter-manifests.scenarios.ts` fixture helpers were extracted into a new sibling `adopter-manifests.fixtures.ts` so both the original validator scenarios module and the new AUDIT-06 tracked-holdouts scenarios module reuse the mkdtemp/writeFile/runScanner boilerplate without copy-paste.
- Adversarial validator: `tools/scope-discovery/adopter-manifests.tracked-holdouts-scenarios.ts` adds five scenarios — `tracked-holdout-not-a-finding` (mixed real-holdout + tracked-holdout fixture; real holdout exits 1 but the tracked entry never appears under `no import matches`, only under the new section with its issue URL), `tracked-holdout-only-gate-passes` (only tracked-holdouts present → exit 0; summary line names the count), `tracked-holdout-missing-issue-rejected` (entry without `issue:` → exit 2 + descriptive parse error), `tracked-holdout-path-not-in-glob-rejected` (path outside any glob → exit 2 + descriptive parse error), `tracked-holdout-and-exception-conflict-rejected` (same path in both fields → exit 2 + "mutually exclusive" error). `tools/scope-discovery/editor-symmetry.tracked-holdouts-scenarios.ts` adds three scenarios — `tracked-holdouts-render-as-hourglass` (tracked-holdout-only cell renders `⏳ 0/1 (1 tracked)`; not `✓`; exit 0), `tracked-vs-real-holdouts-distinction` (real + tracked in same cell → `⚠`, not `⏳`; exit 1), `gutted-stub-tracked-holdouts` (a stub that emits all-`✓` matrix is rejected by the hourglass-assertion; confirms teeth). Both sibling modules wire into their respective validators alongside the existing `SCENARIOS` arrays. Suite: `pnpm test:scope-discovery` 191 → 199 (5 new adopter-manifests + 3 new editor-symmetry scenarios).
- Empirical re-exercise (2026-05-23): planted the audit's verbatim synthetic fixture — `alpha-editor/src/components/library/PromoteDialog.tsx` (importer of `@/components/SlideDrawer`) and 9 `beta-editor/src/components/library/Dialog{1..9}.tsx` files (all listed as `tracked_holdouts:` with a single shared issue URL). `tsx tools/scope-discovery/check-adopters.ts` against the fixture: exit 0, `expected adopters: 10`, `actual adopters: 1`, `holdouts: 0`, `tracked holdouts (gate-passing, pending follow-up): 9` listing each file with its issue URL. `tsx tools/scope-discovery/check-editor-symmetry.ts` against the same fixture: exit 0, matrix row `| slide-drawer-library-dialogs (\`@/components/SlideDrawer\`) | ✓ 1/1 | ⏳ 0/9 (9 tracked) |`, summary `1 ✓, 0 ⚠, 0 ✗, 1 ⏳, 0 —`. Side-effect checks: `pnpm exec tsc --noEmit` exits 0; `tsx tools/scope-discovery/clone-detector.ts --quiet` reports `495 groups; 0 NEW; 0 DROPPED`; `pnpm test:scope-discovery` reports 199/199. Pre-commit hook recorded the fix commit `caa132d9` in `.git/hooks-sentinels/.pre-commit-passed`; no hooks bypassed.
- Also closes the matrix-masking finding (#4 in the roland-bugfix branch's tooling-feedback document): the prior masking shape required listing real-but-deferred holdouts as `exceptions:`, which silently subtracted them from the matrix's expected count and rendered cells as falsely-`✓`. Under the new schema those entries belong in `tracked_holdouts:` instead — the matrix renders them as `⏳ A/E (T tracked)` with the deferred count visible, so a reader scanning for asymmetries sees the deferral immediately. The matrix-masking failure mode is structurally impossible under the new schema because the `tracked` cell state derives directly from the `trackedHoldouts:` bucket, not from a silent `expected − exceptions` subtraction.

## AUDIT-20260523-07

Finding-ID: AUDIT-20260523-07
Status:     informational
Severity:   informational
Surface:    tools/scope-discovery/*.validate.ts, tools/scope-discovery/*.scenarios.ts, tools/scope-discovery/*.fixtures.ts

The scope-discovery tooling now relies heavily on paired adversarial validators to keep semantics honest. That is the correct architectural direction for this feature, but it creates a maintenance risk: a future edit can change registry semantics, report shape, or gate meaning while leaving the existing validators green if the new behavior is adjacent to, rather than directly covered by, the current scenario set.

Evidence:
- Recent fixes in this feature have repeatedly required extending validators to cover newly discovered failure modes rather than changing only production code: `AUDIT-20260522-03` (`no-verify` stale-marker path), `AUDIT-20260522-05` (brace alternation with wildcards in `globToRegex`), and `AUDIT-20260522-06` (`tracked_holdouts` versus `exceptions` semantics).
- The implementation surface now includes dedicated validator modules for most critical paths (`dispatch-wrapper.validate.ts`, `clone-id-stability.validate.ts`, `no-verify-detection.validate.ts`, `adopter-manifests.validate.ts`, `editor-symmetry.validate.ts`, `glob.validate.ts`, etc.), which means behavior is only as well-guarded as the scenario coverage stays current.

Expected vs actual:
- Expected: whenever a scope-discovery semantic changes, the corresponding validator and adversarial scenario set change in the same commit, so the test suite continues to represent the actual contract.
- Actual: this is currently true in the reviewed fixes, but it remains a process discipline risk rather than something mechanically enforced across the whole tooling surface.

Guidance:
- Treat validator updates as part of the contract change, not as optional follow-up.
- When adding a new semantic branch, add at least one adversarial scenario that would have failed under the pre-change behavior.

Resolution:
- Guidance encoded as a new rule in `.claude/rules/agent-discipline.md` §"Validator-paired changes — every gate-semantic change ships with a scenario that would have failed against the prior behavior" (companion to the existing "When CI is absent, the controller is the gate" rule). Both rules now apply to every scope-discovery change.
- The new rule names the "hard test" the auditor's guidance implies: *"if I revert ONLY my production-code change, leaving my scenario changes in place, do my new scenarios FAIL?"* — if no, the scenarios are coverage padding.
- Status stays `informational` per protocol: the auditor explicitly noted "this is currently true in the reviewed fixes" — no production code defect to verify. The rule's purpose is to keep that statement true across turnover.

## AUDIT-20260524-08

Finding-ID: AUDIT-20260524-08
Status:     verified-2026-05-24
Severity:   medium
Surface:    tools/scope-discovery/adopter-manifests-registry.ts, tools/scope-discovery/check-adopters.ts, tools/scope-discovery/anti-patterns-registry.ts, tools/scope-discovery/check-anti-patterns.ts, docs/scope-discovery/{adopter-manifests,anti-patterns}.yaml schemas

The adopter-manifest `from:` field and the anti-pattern `excludes_paths:` field both assume the canonical primitive's location is stable. When a primitive is promoted across modules (the protocol's intended workflow — e.g., `roland-sxx0-editor/src/components/common/PageTitleRow.tsx` → `editor-core/src/components/PageTitleRow.tsx`), both fields silently invalidate:

- Adopter-manifest `from:` becomes a literal string that doesn't match consumers' new import paths. `make check-adopters` reports holdouts that aren't holdouts.
- Anti-pattern `excludes_paths:` stays pinned at the old canonical location. `make check-anti-patterns` flags the NEW canonical file as a holdout because its body IS the legacy shape.

Both findings surface together in the akai-harmonization feature's Phase 2 (PageTitleRow + AcReloadIcon promotion to editor-core). Bundled as one audit-log entry because they share root cause + share fix shape.

Evidence (from akai-harmonization tooling-feedback.md TF-001 + TF-002):

- TF-001 repro: Phase 2 task 2.2 promoted `PageTitleRow`. Consumers' imports changed from `@/components/common/PageTitleRow` to `@audiocontrol/editor-core`. `make check-adopters` then reported 3 holdouts ("0 file(s) import @/components/common/PageTitleRow") — accurate per the literal `from:` string, but misleading: the consumers DO import the same component via a different path.
- TF-002 repro: same promotion. `anti-patterns.yaml` had `page-title-row-inline` + `ac-reload-icon-inline` entries with `excludes_paths:` pinned at the old roland paths. After `git mv`, the canonical components (now in editor-core) matched the anti-pattern shape and `make check-anti-patterns` flagged the new canonical location.
- Workaround used by akai-harmonization operator (manual): update each entry's `from:` to `@audiocontrol/editor-core` + `excludes_paths:` to the new editor-core paths + expand `expected_adopters_glob` to include both editors' pages.

Expected vs actual:
- Expected: when a primitive moves modules, the registry tracks the new canonical without operator intervention OR fails the build with a specific actionable error naming the rename pair.
- Actual: the operator must manually update both registries; mistakes silently produce wrong holdout reports OR false flag the new canonical.

Fix guidance:
- **Adopter-manifest fix:** allow `from:` to be a list of import paths (alias-aware) so a primitive in transit is recognized by either path. The import-detection regex iterates the list and reports adoption if any path matches.
- **Anti-pattern fix:** add an optional `canonical_implementation_file:` field that names the canonical file's CURRENT path. The matcher auto-excludes that file (no need to repeat the path in `excludes_paths:`). When the file disappears (git rename detected via `git rev-parse HEAD:<path>` returning empty), fail the build with `primitive file <X> no longer exists; update canonical_implementation_file: in <entry-id>`.
- **Both fixes:** add adversarial scenarios covering the relocation case (synthetic fixture: primitive at path A, then renamed to path B; assert manifest with both A and B in `from:` reports correct adoption; assert anti-pattern with `canonical_implementation_file: B` doesn't flag B but does flag a planted holdout).

External tracking: TF-001 + TF-002 (filed on feature/akai-harmonization branch as consumer-side tracking).

Resolution:
- Corrected mechanism: bundled fix across both registries since both findings share root cause (primitive-relocation awareness) and share fix shape (registry schemas track the new canonical without operator intervention OR fail loud).
  - **Part A — adopter-manifest `from:` is now `string | string[]`.** `AdopterManifestEntry.from` is `readonly string[]` (always normalized to non-empty array). The parser accepts a single non-empty string (back-compat with pre-AUDIT-08 entries) OR a non-empty list of non-empty strings; both forms reject empty arrays, empty string elements, and non-string elements with descriptive parse errors. `buildImportRegex` was extended to accept `readonly string[]` and OR-combines every listed path inside a single `(?:p1|p2|...)` alternation in the quoted-import position — a consumer importing the primitive via ANY listed path counts as an adopter. Display sites (`adopter-manifests-report.ts`, `editor-symmetry-report.ts`, `discovery-agents/regime-holdout-detector.ts`) use `from[0]` as the "primary" canonical path; the report's `renderFromList` helper renders multi-element arrays as `<primary> (alias: <a1>, <a2>, …)` so the operator sees the transitional aliases inline. JSON output keeps `from` as a string array — downstream consumers parse the primary as `from[0]` and see transitional aliases at subsequent indices.
  - **Part B — anti-pattern entries gain optional `canonical_implementation_file:`.** `AntiPatternEntry.canonicalImplementationFile` is `string | null` (null when the field is absent → preserves pre-AUDIT-08 behavior; non-null is the CWD-relative POSIX path to the primitive's source-of-truth file). The parser accepts a non-empty string OR absent field; existence is NOT validated at parse time so a multi-step refactor may legitimately update the registry before moving the file. The scanner's `assertCanonicalImplementationFilesExist` runs once at scan start, `fs.existsSync`-checks every set canonical against `resolve(process.cwd(), canonical)`, and throws `anti-pattern <id>: canonical_implementation_file '<X>' does not exist; the primitive may have been renamed. Update canonical_implementation_file: in <id> or remove the field.` on the first miss (caught by the CLI wrapper → exit 2). `isPathExcluded` was extended to compare `relPath === entry.canonicalImplementationFile` (POSIX-normalized) BEFORE iterating `excludesPaths`, so the canonical auto-excludes from its own shape match. `excludes_paths:` from AUDIT-04 is independent and still applies for non-canonical exclusions; when both are set, both apply.
- Both schema changes are backward-compatible: existing single-string `from:` parses as a one-element array; absent `canonical_implementation_file:` field preserves existing behavior end-to-end. YAML schema docs in `docs/scope-discovery/{adopter-manifests,anti-patterns}.yaml` updated with the new fields, the relocation semantic, and the multi-step refactor caveat.
- Adversarial validator extended with 11 new scenarios (6 for Part A in `adopter-manifests.from-list-scenarios.ts`; 5 for Part B in `anti-patterns.canonical-file-scenarios.ts`):
  - Part A scenarios: `from-as-list-detects-either-path` (both consumers via different paths → 0 holdouts), `from-as-string-backward-compat` (single-string `from:` preserved end-to-end), `from-empty-array-rejected`, `from-list-with-empty-string-rejected`, `from-list-with-non-string-rejected`, `from-relocation-scenario` (3-editor synthetic relocation: new-path adopter + legacy-alias adopter + true holdout → only holdout surfaces).
  - Part B scenarios: `canonical-file-auto-excluded` (1 finding from holdout only; canonical auto-excluded), `canonical-file-missing-fails-loud` (exit 2; stderr names entry id + missing path + `does not exist` + the field name), `canonical-file-plus-excludes-paths-combine` (canonical auto-excluded AND excludes_paths target excluded; third holdout still surfaces), `canonical-file-absent-field-no-regression` (pre-AUDIT-08 entry shape preserved), `canonical-file-empty-string-rejected` (parse error). Both sibling modules wire into their respective validators alongside the existing scenario arrays. Suite: `pnpm test:scope-discovery` 194 → 205 scenarios.
- **AUDIT-07 hard test outcome (validator-paired changes):** stashed every production-code file in this commit (`adopter-manifests-registry.ts`, `check-adopters.ts`, `anti-patterns-registry.ts`, `check-anti-patterns.ts`, `adopter-manifests-report.ts`, `editor-symmetry-report.ts`, `discovery-agents/regime-holdout-detector.ts`, both YAML schema docs), kept ONLY the new scenario files + their validator wiring, and re-ran `make check-adopters-validate` + `make check-anti-patterns-validate`. Result: 2 of 6 Part A scenarios FAIL (the load-bearing `from-as-list-detects-either-path` + `from-relocation-scenario` — the parse layer rejected the list-form `from:` as "must be non-empty string", producing exit 2 instead of 0/1); 4 of 5 Part B scenarios FAIL (`canonical-file-auto-excluded`, `canonical-file-missing-fails-loud`, `canonical-file-plus-excludes-paths-combine`, `canonical-file-empty-string-rejected` — the scanner had no canonical-file awareness, so the canonical was flagged as a holdout against its own anti-pattern + the unrecognized field was silently accepted). The Part A scenarios that PASSED without production changes are the parse-error scenarios (`from-empty-array-rejected`, `from-list-with-empty-string-rejected`, `from-list-with-non-string-rejected`) — pre-AUDIT-08 the parser rejected list-form `from:` outright as "must be string", so those exit-2 assertions matched coincidentally; and the `from-as-string-backward-compat` scenario (back-compat assertion — must pass against BOTH pre- and post-change code by design). The Part B `canonical-file-absent-field-no-regression` scenario is also a regression-guard — passing against pristine production code is the correct behavior. After restoring all production code, all 36 scenarios (20 adopter + 16 anti-pattern) pass.
- Empirical re-exercise (2026-05-24): the auditor's verbatim synthetic relocation (manifest with `from: ['@new-package/RelocatedPrimitive', '@/local/RelocatedPrimitive']` + 3 editors in different states) reports exit 1 with 1 holdout naming only `editor-c/src/Page.tsx`; the canonical-file synthetic (`canonical_implementation_file: 'lib/canonical.ts'` + `lib/canonical.ts` and `lib/holdout.ts` both carrying the legacy shape) reports exit 1 with 1 finding naming only `lib/holdout.ts`; the missing-canonical synthetic (`canonical_implementation_file: 'lib/moved-away.ts'` with no such file planted) reports exit 2 with stderr naming `relocated-primitive-stale-registry`, `lib/moved-away.ts`, `does not exist`, and `canonical_implementation_file:`. Side-effect checks: `pnpm test:scope-discovery` reports 205/205; `tsx tools/scope-discovery/clone-detector.ts --quiet` reports `495 groups; 0 NEW; 0 DROPPED`; `pnpm exec tsc --noEmit` exits 0. Pre-commit hook recorded the fix commit in `.git/hooks-sentinels/.pre-commit-passed`; no hooks bypassed.

## AUDIT-20260524-09

Finding-ID: AUDIT-20260524-09
Status:     verified-2026-05-24
Severity:   low
Surface:    tools/scope-discovery/clone-detector.ts, .githooks/pre-commit

When the pre-commit clone-detector reports a NEW group, the operator must (a) find the right insertion point in `docs/scope-discovery/clones.yaml` (3000+ lines), (b) hand-write a YAML entry, (c) re-run the gate. The `tools/scope-discovery/batch-dispose.ts` script already automates this, but the pre-commit hook's error output doesn't mention it — operators reinvent the manual workflow each time.

Evidence (from akai-harmonization tooling-feedback.md TF-003):
- Pre-commit clone-detector reported `NEW    a50e0d779738 (21 lines)` for two akai pages newly invoking the canonical `<PageTitleRow>` with same wiring.
- Operator hand-appended the entry; would have preferred a pasteable batch-dispose command.

Expected vs actual:
- Expected: the pre-commit hook's error output cites the existing `batch-dispose.ts` command with the NEW id pre-filled + a placeholder disposition + reason, so the operator can paste-and-edit.
- Actual: operator finds the file, finds the insertion point, hand-writes the entry, re-runs the gate.

Fix guidance:
- Extend the clone-detector's NEW-group error output to include a `tsx tools/scope-discovery/batch-dispose.ts --ids <id> --disposition <pick> --reason "<one-line>"` line per NEW group.
- Example output:
  ```
  NEW    a50e0d779738 (21 lines)
    Run:  tsx tools/scope-discovery/batch-dispose.ts \
            --ids a50e0d779738 \
            --disposition <refactor|keep-with-reason|ignore-with-justification> \
            --reason "<one-line rationale>"
  ```
- Adversarial scenario: clone-detector's NEW-group error output (captured via subprocess) contains the literal string `batch-dispose.ts --ids <id>` for each NEW group.

External tracking: TF-003.

Resolution:
- Corrected mechanism: extended `tools/scope-discovery/clone-detector.ts` with a single `batchDisposeHintLines(id, indent)` helper (DRY — one function consumed by both output modes) and a `writeBatchDisposeHint` wrapper that emits the four-line hint per NEW group. Both `reportDiff` (--diff mode) and `reportHuman` (default-mode, non-quiet) iterate NEW groups identically to before; the hint is appended ADDITIVELY after each NEW group's existing member listing — every prior `NEW    <id>` and member-path line is preserved so any downstream consumer grepping the stdout sees only added lines, never replacement. DROPPED groups intentionally do NOT carry a citation (DROPPED entries are removed via `make refresh-clones-baseline`, not via batch-dispose; citing batch-dispose for a DROPPED would mislead the operator). The hint indentation matches each caller's existing convention: --diff mode uses no leading indent for the `Run:` prefix; default-mode wraps the hint in 2-space indent to mirror the surrounding `  NEW    ...` lines. Empirical post-change shape verified end-to-end against a synthetic fixture: --diff mode emits
  ```
  NEW    95407554c33e (7 lines)
           ../a/c.ts:1:7
           ../a/d.ts:1:7
    Run:  tsx tools/scope-discovery/batch-dispose.ts \
            --ids 95407554c33e \
            --disposition <refactor|keep-with-reason|ignore-with-justification> \
            --reason "<one-line rationale>"
  summary: 0 dropped, 1 new (net +1)
  ```
  and default-mode emits the same hint nested under the indented `  NEW    ...` block. Programmatic-consumer audit: `grep -rn clone-detector tools/` confirms the only stdout consumer is `tools/scope-discovery/discovery-agents/clone-detector-reader.ts`, which reads the committed YAML baseline directly (not the detector's stdout) — no breakage risk.
- Adversarial validator: `tools/scope-discovery/clone-detector.batch-dispose-hint-scenarios.ts` adds four scenarios — `scenarioNewGroupCitesBatchDispose` (synthetic NEW group via --diff; asserts stdout contains `tsx tools/scope-discovery/batch-dispose.ts \\`, `--ids <actual-id>` for each parsed NEW id, the `--disposition <refactor|keep-with-reason|ignore-with-justification>` placeholder, and the `--reason "<one-line rationale>"` placeholder), `scenarioNewGroupCitesBatchDisposeDefaultMode` (same fixture in default non-quiet mode; asserts the citation lands in the indented per-group output the pre-commit hook surfaces), `scenarioDroppedGroupNoCitation` (capture baseline → remove one member → assert exit 0 with `DROPPED` reported AND stdout free of `batch-dispose.ts` in BOTH default and --diff modes), `scenarioNoChangesNoCitation` (clone-free fixture; asserts no `batch-dispose.ts` mention in BOTH modes). Lives in a sibling module (the parent validator was 475 lines; the new module is 280 lines) so the 300-500 line cap holds across both files. Wired into `clone-detector.validate.ts` (imports + scenario array + cleanup hook). Suite: `pnpm test:scope-discovery` 210 → 214 scenarios.
- **AUDIT-07 hard test outcome (validator-paired changes):** stashed ONLY `tools/scope-discovery/clone-detector.ts` (the production-code change), kept the new scenarios module + validator wiring, re-ran the harness. Result: 2 of 4 scenarios FAIL (`scenarioNewGroupCitesBatchDispose` — diff stdout was `NEW    f6a131dcf46d (7 lines)` + member lines + `summary:` line with NO `tsx tools/scope-discovery/batch-dispose.ts \\`; `scenarioNewGroupCitesBatchDisposeDefaultMode` — default-mode stdout was `Detected 2 clone group(s)...` + `Baseline diff: 1 NEW, 0 DROPPED.` + indented NEW group with NO `--ids <id>` line). The 2 PASSING scenarios (`scenarioDroppedGroupNoCitation`, `scenarioNoChangesNoCitation`) are regression-guards by design — they assert ABSENCE of the citation in non-NEW paths, so they must pass against pristine production code as well. Confirms the two NEW-citation scenarios have teeth and the two no-citation scenarios are correct regression-guards. After restoring the production code (`git stash pop`), all 17 scenarios in `clone-detector.validate.ts` pass.
- Empirical re-exercise (2026-05-24): synthetic post-change repro — capture baseline with 2 clone members → add 2 new clone members → re-run in `--diff` mode reports `NEW    <id> (7 lines)` + 2 member-path lines + a 4-line `tsx tools/scope-discovery/batch-dispose.ts ... --ids <id> ... --disposition <refactor|keep-with-reason|ignore-with-justification> --reason "<one-line rationale>"` block + `summary: 0 dropped, 1 new (net +1)`; default-mode repro emits the same hint nested under the `  NEW    ...` indentation. Side-effect checks: `pnpm test:scope-discovery` reports 214/214; `tsx tools/scope-discovery/clone-detector.ts --quiet` reports `495 groups; 0 NEW; 0 DROPPED`; `pnpm exec tsc --noEmit` exits 0. Pre-commit hook will record the fix commit in `.git/hooks-sentinels/.pre-commit-passed`; no hooks bypassed.

## AUDIT-20260524-10

Finding-ID: AUDIT-20260524-10
Status:     open
Severity:   medium
Surface:    .githooks/pre-commit

The pre-commit hook chain short-circuits on the first failing gate. For substantial commits (primitive promotion, multi-module refactor) where multiple gates may fail independently, the operator pays the round-trip cost N times for what could be a single consolidated report.

Evidence (from akai-harmonization tooling-feedback.md TF-004):
- A PageTitleRow promotion commit hit three sequential failures: `check-clone-duplication` (new group), then `check-anti-patterns` (stale findings on moved canonical), then `check-adopters` (old `from:` path). 3 commit attempts for 1 commit.
- The failures were independent (different gates, different findings) but landed serially because the hook short-circuits.

Expected vs actual:
- Expected: pre-commit collects every gate's findings + presents a single consolidated report. Operator fixes everything in one pass.
- Actual: hook fails on the first red gate; operator never sees the other failures until the first is resolved.

Fix guidance:
- Restructure `.githooks/pre-commit` to collect every gate's exit code + stderr in an array, then report all failures at the end. If any gate failed, exit non-zero.
- Add a `PRE_COMMIT_SHORT_CIRCUIT=1` env var for backward-compat (developers who prefer fast-fail for tight iteration loops can opt back in).
- Adversarial scenario: synthetic state where 2+ gates would fail; assert pre-commit reports ALL failures + returns non-zero (default behavior); assert `PRE_COMMIT_SHORT_CIRCUIT=1` returns after the first failure (opt-in behavior).

External tracking: TF-004.

## AUDIT-20260524-11

Finding-ID: AUDIT-20260524-11
Status:     open
Severity:   medium
Surface:    tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.ts, tools/scope-discovery/synthesis-derive.ts

`/scope-inventory` produces strawman manifests that over-enumerate modules — including every workspace module that matched any pattern, regardless of PRD relevance. The akai-harmonization run listed 12 of 12 workspace modules including out-of-scope `d110-editor`, `jv1080-editor`, `sampler-devices`, `sampler-library`, `synth-core`, `e2e-infra`. Operator must manually prune.

Evidence (from akai-harmonization tooling-feedback.md TF-005):
- `/scope-inventory akai-harmonization` listed 12 modules; operator dropped 6 as out-of-scope.
- The PRD explicitly named In Scope / Out of Scope; the synthesizer didn't consult this.

Expected vs actual:
- Expected: the synthesizer parses the PRD's "In Scope" / "Out of Scope" sections and either (a) excludes out-of-scope modules with `excluded_by: prd-out-of-scope` OR (b) emits a relevance score so the operator reviews the agent's pruning judgment rather than authoring the prune list from scratch.
- Actual: every matched module lands in the strawman; operator does the curation work manually.

Fix guidance:
- Extend `prd-themed-pattern-hunter` to parse the PRD's `## In Scope` / `## Out of Scope` (or equivalent) sections. Emit a `module_relevance_score: high|medium|low|excluded` per module.
- The synthesizer's `deriveModules` consumes the score: `excluded` modules don't appear; `low` modules appear with a `relevance: low` annotation; operator decides whether to keep.
- Adversarial scenarios: synthetic PRD with explicit In/Out sections + synthetic module hits; assert excluded modules don't appear in synthesized manifest; assert low-relevance modules carry the annotation.

External tracking: TF-005.

## AUDIT-20260524-12

Finding-ID: AUDIT-20260524-12
Status:     open
Severity:   low
Surface:    tools/scope-discovery/synthesis.ts (warning text)

The synthesizer's "PRD has no References/Appendix section" warning is mild and easy to ignore. The result: synthesizer falls back to a minimal `reference_docs[]` (just PRD + LAYOUT.md). Operators who would have added richer references if prompted don't see actionable guidance.

Evidence (from akai-harmonization tooling-feedback.md TF-006):
- akai-harmonization synthesizer wrote `reference_docs[]` with just PRD + LAYOUT.md and surfaced a note in `synthesis-notes.md`: "PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md."
- Operator accepted the default; noted the Phase 2 re-run after appending an Appendix would produce richer references — but the prompt to do so was easy to miss.

Expected vs actual:
- Expected: when the warning fires, the synthesizer's note includes a specific suggested PRD addition (a fence with `## References` + `## Related issues` + `## Related ADRs` subheadings) so the operator can paste the skeleton into the PRD.
- Actual: warning is one line; operator has to infer what to add.

Fix guidance:
- Extend the synthesizer's warning to include the PRD-augmentation skeleton inline. Example:
  ```
  WARNING: PRD has no References/Appendix section; reference_docs[] defaulted to PRD + LAYOUT.md.
  Add this section to <prd-path> to produce a richer manifest on re-run:

    ## References

    - **Related issues:** [#NNN](url), [#MMM](url)
    - **Related ADRs:** [docs/adr/NNN.md](path)
    - **External docs:** [Title](url)
  ```
- Adversarial scenario: synthesize a manifest from a PRD without References; assert warning output contains the literal skeleton.

External tracking: TF-006.

## AUDIT-20260524-13

Finding-ID: AUDIT-20260524-13
Status:     open
Severity:   low
Surface:    tools/scope-discovery/check-adopters.ts (output ordering)

`make check-adopters` prints the summary line in the MIDDLE of its output, followed by several KB of per-manifest details (including all tracked holdouts). During pre-commit verification the operator must scroll past unrelated output to find the actual finding count.

Evidence (from akai-harmonization tooling-feedback.md TF-010):
- `make check-adopters` output: `adopter-manifests: 0 holdouts across 9 manifest(s); 9 tracked holdout(s) reported separately.` appears early; the per-manifest tracked-holdouts listing follows; no closing summary.
- Operator piped through `tail -5` to find summary; not stable across output-shape changes.

Expected vs actual:
- Expected: summary line is the LAST line of output OR a `--quiet` flag prints summary only unless non-tracked findings exist.
- Actual: summary is mid-output; operator hunts for it.

Fix guidance:
- Move the summary line to the END of the output (after per-manifest details). The first line stays for operators who scan top-down; the last line ALSO has the summary so `tail -1` works.
- Optional `--quiet` flag prints only the summary unless real holdouts exist (in which case full output prints).
- Adversarial scenarios: assert summary is on the LAST output line; assert `--quiet` mode prints only the summary when 0 real holdouts; assert `--quiet` mode prints full output when real holdouts exist.

External tracking: TF-010.
