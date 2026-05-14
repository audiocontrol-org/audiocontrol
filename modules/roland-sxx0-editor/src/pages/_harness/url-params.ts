/**
 * Shared dispatch helpers for the `/_harness/*` routes.
 *
 * Both `AcEnvelopeTableHarness` and `AcRangeBarHarness` read the same two URL
 * parameters and dispatch into the same `BROKEN_PRIMITIVES` / `BROKEN_CONTEXTS`
 * registry. The duplication threshold (per the workflow-playbooks duplication
 * audit) is met the moment the second consumer arrives — that's now.
 *
 * The credibility check (Phase 9R-A.1, issue #392) runs each contract spec
 * against `?broken=<variant>` and `?context=<variant>`; an unknown key MUST
 * throw a descriptive error rather than silently falling back to the real
 * primitive (per CLAUDE.md "no fallbacks").
 *
 * See: docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §5
 */
import { type ComponentType, type ReactNode } from 'react';
import { BROKEN_CONTEXTS, type BrokenContextKey } from '@audiocontrol/editor-core';

/** Read a single URL search-param; returns `undefined` when missing or in SSR. */
export function getParam(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get(name);
  return value ?? undefined;
}

/**
 * Look up a value in a typed `Readonly<Record<K, V>>` by an untrusted string
 * key. Returns `undefined` when the key is not in the record's
 * statically-known union; consumers throw on undefined.
 *
 * The single `as Readonly<Record<string, V>>` cast below is the one
 * acceptable cast in this file: it widens the record's key from the literal
 * union to `string` so a runtime string lookup is well-typed without an
 * unsafe `as KeyT` on the way out. The cast preserves the value type
 * (`V | undefined`) faithfully — there is no information laundering.
 */
function lookup<K extends string, V>(
  record: Readonly<Record<K, V>>,
  key: string,
): V | undefined {
  return (record as Readonly<Record<string, V>>)[key];
}

/**
 * Resolve a broken-primitive variant by key, or return `undefined` when no
 * `?broken=` URL param is set. Throws with a descriptive Error listing the
 * known keys when the param is set but unknown — no silent fallback.
 *
 * The helper has one job: lookup-or-error. The caller picks the production
 * primitive when this returns `undefined` (so the "use real primitive when
 * unset" semantics live at the call site, not buried inside the helper).
 */
export function resolveBrokenPrimitive<P, KeyT extends string>(
  primitiveName: string,
  variants: Readonly<Record<KeyT, ComponentType<P>>>,
): ComponentType<P> | undefined {
  const key = getParam('broken');
  if (key === undefined) return undefined;
  const broken = lookup(variants, key);
  if (broken === undefined) {
    throw new Error(
      `Unknown ?broken variant for ${primitiveName}: '${key}'. ` +
        `Known: ${Object.keys(variants).join(', ')}`,
    );
  }
  return broken;
}

/**
 * Resolve a broken-context wrapper by key, or return `undefined` when no
 * `?context=` param is set. Throws on unknown key — no silent fallback.
 *
 * Returns `undefined` (not a passthrough wrapper) when no `?context=` is set.
 * The caller composes the wrapping itself, so a missing context means
 * literally no wrapper renders — there is no `<Fragment>` cost added.
 */
export function resolveContext(): ComponentType<{ children: ReactNode }> | undefined {
  const key = getParam('context');
  if (key === undefined) return undefined;
  const ctx = lookup(BROKEN_CONTEXTS, key);
  if (ctx === undefined) {
    throw new Error(
      `Unknown ?context variant: '${key}'. ` +
        `Known: ${Object.keys(BROKEN_CONTEXTS).join(', ')}`,
    );
  }
  return ctx;
}

// `BrokenContextKey` is re-exported here purely to keep call sites referencing
// a single import path for harness types alongside the dispatch helpers.
export type { BrokenContextKey };
