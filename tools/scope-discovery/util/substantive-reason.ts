/**
 * tools/scope-discovery/util/substantive-reason.ts
 *
 * Shared "is this `reason:` string substantive enough to stand in for
 * a tracker artifact?" check (AUDIT-20260525-20). Lives in `util/` so
 * future registries that grow their own issue-less-deferral shapes
 * (anti-patterns `excludes_paths`, etc.) can share the same predicate
 * without duplicating the length + anti-gaming wordlist.
 *
 * Rule shape:
 *   - Trimmed-string length must be >= SUBSTANTIVE_REASON_MIN_CHARS
 *     (80, chosen so the author must encode (a) what the deferred
 *     work is, (b) why it's deferred, (c) what would unlock it — a
 *     single 60-80 char sentence cannot fit all three).
 *   - The trimmed-and-stripped-punctuation lowercase form must NOT
 *     equal any phrase in REASON_GAMING_PHRASES (the obvious "TODO"
 *     / "deferred" / "see issue" placeholders that defeat the
 *     tracking-discipline contract while satisfying a naive length
 *     check that ran on a multi-word placeholder).
 *
 * Why these defaults: the registry's purpose is to prevent the
 * `tracked_holdouts:` field from becoming a "fix-it-later" dumping
 * ground without operator-visible context. The substantive-reason
 * check enforces that an issue-less entry must carry enough inline
 * tracking content for an operator reading the registry to understand
 * (a) the migration target, (b) the blocker, (c) the unlock criteria
 * without consulting an external tracker artifact. A trivial "len > 0"
 * check would defeat the purpose; a regex-based prose-quality check
 * would over-fit. The 80-char + placeholder-wordlist split is the
 * smallest rule that catches both axes of the failure mode.
 */

/**
 * Minimum trimmed character count for a `reason:` to be accepted as
 * substantive inline tracking context when its sibling tracker field
 * (`issue:` etc.) is absent.
 */
export const SUBSTANTIVE_REASON_MIN_CHARS = 80;

/**
 * Lowercase placeholder / anti-gaming phrases. A `reason:` whose
 * trimmed-and-stripped-punctuation lowercase form equals one of these
 * is rejected as non-substantive even if its raw length would otherwise
 * pass the minimum-chars check. The check is intentionally narrow
 * (exact match against the stripped form, not substring) — the goal is
 * to catch the obvious "TODO" / "deferred" / "see issue" placeholders
 * without false-positiving on substantive prose that mentions one of
 * these words in passing (e.g., a real reason containing "deferred
 * until state-contract harmonization" is fine because the full reason
 * carries the context, not just the word).
 */
export const REASON_GAMING_PHRASES: readonly string[] = [
  'todo',
  'fixme',
  'tbd',
  'wip',
  'later',
  'deferred',
  'pending',
  'see issue',
  'see follow-up',
  'tracking pending',
  'tracked separately',
  'placeholder',
  'fix it later',
  'will fix',
  'follow up',
  'fix later',
];

/**
 * Returns null when `reason` passes the substantive-content check
 * (length + anti-gaming). Returns a descriptive error CLAUSE (suitable
 * for embedding in a larger error message naming the entry context)
 * when it does not. Callers should prepend their entry-context prefix
 * (`<namespace>: <ctx> ` etc.) to the returned clause before throwing.
 *
 * The check runs the placeholder/gaming-phrase test BEFORE the length
 * test so the more informative diagnostic surfaces for the common case
 * where a short reason is also a placeholder. (A reason like "deferred"
 * would fail both checks; the operator gets better guidance from "this
 * is a placeholder phrase, expand it" than from "8 chars too few".)
 */
export function checkSubstantiveReason(reason: string): string | null {
  const trimmed = reason.trim();
  const lower = trimmed.toLowerCase();
  const stripped = lower.replace(/[.,;:!?\s]+/g, ' ').trim();
  for (const phrase of REASON_GAMING_PHRASES) {
    if (stripped === phrase) {
      return (
        `\`reason\` is a placeholder phrase ("${phrase}") when \`issue\` is absent; ` +
        `expand the reason to encode what the deferred work is, why it's deferred, ` +
        `and what would unlock it`
      );
    }
  }
  if (trimmed.length < SUBSTANTIVE_REASON_MIN_CHARS) {
    return (
      `\`reason\` must be substantive (>= ${SUBSTANTIVE_REASON_MIN_CHARS} chars after trim) ` +
      `when \`issue\` is absent; got ${trimmed.length} chars`
    );
  }
  return null;
}
