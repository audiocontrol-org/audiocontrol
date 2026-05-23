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
Status:     open
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
