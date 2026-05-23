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
