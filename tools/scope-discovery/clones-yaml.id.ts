/**
 * tools/scope-discovery/clones-yaml.id.ts
 *
 * Content-hashed clone-group ID derivation (T7.1). Extracted from
 * clones-yaml.ts so the host file stays under the 300-500 line cap
 * after T7.1's expanded docstrings + helpers; also makes the migration
 * script and the stability validator import just the ID surface without
 * pulling in the YAML ser/deser layer.
 *
 * SSOT for "what makes a clone-group's id stable":
 *   id = sha1(
 *     sortedBarePaths.join('\n')
 *     + 0x20
 *     + tokenFingerprint
 *   ).slice(0, 12)
 *
 * where:
 *   - sortedBarePaths   = each member's `<path>` portion (`:start:end`
 *                         stripped) sorted lexicographically
 *   - tokenFingerprint  = jscpd's per-pair fragment fingerprint
 *                         (sha1-hex of `duplicates[].fragment`) — the
 *                         duplicated source text, normalised by jscpd
 *
 * Why this shape: the previous id derivation hashed the full member
 * strings including the `:start:end` line ranges, so any unrelated line
 * shift adjacent to a clone group rewrote the group's id and orphaned
 * any operator-authored disposition. The new shape follows the *content*
 * (file paths + duplicated text) and is invariant under unrelated line
 * shifts. Renames or membership changes legitimately change the id; the
 * diff is operator-visible.
 */

import { createHash } from 'node:crypto';

/**
 * Strip the `:startLine:endLine` suffix from a member string, leaving
 * only the bare file path. Members are stored as `<path>:<start>:<end>`
 * so the operator can navigate to the exact range; ID derivation uses
 * only the bare path so unrelated line shifts don't churn the id.
 *
 * The two trailing `:N:M` segments are removed via lastIndexOf chaining.
 * Strings without the expected suffix shape throw rather than silently
 * returning a value indistinguishable from the bare-path case (the
 * caller depends on these two cases being distinct for ID stability).
 */
export function extractBarePath(member: string): string {
  const lastColon = member.lastIndexOf(':');
  if (lastColon <= 0) {
    throw new Error(`extractBarePath: member "${member}" missing :endLine suffix`);
  }
  const head = member.slice(0, lastColon);
  const secondLastColon = head.lastIndexOf(':');
  if (secondLastColon <= 0) {
    throw new Error(`extractBarePath: member "${member}" missing :startLine:endLine suffix`);
  }
  return head.slice(0, secondLastColon);
}

/**
 * Derive sortedBarePaths from a (possibly unsorted) members[] array.
 * Single helper so makeCloneGroup, makeRefactorCloneGroup, the migration
 * script, and the stability validator all compute the same projection.
 */
export function sortedBarePathsFromMembers(
  members: readonly string[],
): readonly string[] {
  return members.map(extractBarePath).sort();
}

/**
 * Content-hashed clone-group ID (T7.1). The 12-char truncation yields a
 * collision probability of ~1e-11 across ~500 groups — small enough that
 * any collision is investigated as a bug, not tolerated.
 *
 * The separator between the path block and the token fingerprint is a
 * single ASCII space (0x20). A space cannot appear inside the sha1-hex
 * fingerprint and cannot appear inside a sortedBarePath line (newlines
 * separate path entries; a path with an embedded space would land in
 * one path entry, which is the desired behavior). This keeps the
 * canonical hash input unambiguous.
 */
export function deriveContentHashedId(args: {
  readonly sortedBarePaths: readonly string[];
  readonly tokenFingerprint: string;
}): string {
  if (args.sortedBarePaths.length < 2) {
    throw new Error(
      `deriveContentHashedId: a clone group must have at least 2 bare paths ` +
        `(got ${args.sortedBarePaths.length})`,
    );
  }
  if (args.tokenFingerprint.length === 0) {
    throw new Error('deriveContentHashedId: tokenFingerprint must be non-empty');
  }
  const hash = createHash('sha1');
  hash.update(args.sortedBarePaths.join('\n'));
  hash.update(' ');
  hash.update(args.tokenFingerprint);
  return hash.digest('hex').slice(0, 12);
}

/** sha1 hex of a UTF-8 string. Shared by jscpd-runner and the migration. */
export function sha1HexOfText(text: string): string {
  const hash = createHash('sha1');
  hash.update(text);
  return hash.digest('hex');
}
