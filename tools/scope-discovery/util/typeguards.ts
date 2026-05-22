/**
 * tools/scope-discovery/util/typeguards.ts
 *
 * Tiny shared type-guard helpers used across the scope-discovery
 * tooling. Extracted from tools/scope-discovery/schema/validate.ts
 * (T2.1) when T2.2 needed the same shapes; the goal is to keep these
 * narrowing primitives in one place so future scope-discovery scripts
 * don't reinvent them or, worse, reach for `as Type` / `any`.
 *
 * The project rule is "never bypass typing" — see CLAUDE.md. These
 * helpers exist so that `unknown` values from JSON.parse / yaml.parse /
 * subprocess output / FS reads can be narrowed without an `as` cast.
 */

/** Type-guard: narrows `unknown` to `Record<string, unknown>` without an `as Type` cast. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Extract a string message from an `unknown` thrown value without an `as Error` cast. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Detect Node's ENOENT error code; `'code' in err` is a real TS narrowing operator. */
export function isEnoent(err: unknown): boolean {
  if (!(err instanceof Error) || !('code' in err)) {
    return false;
  }
  return err.code === 'ENOENT';
}
