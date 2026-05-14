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
 * Resolve a broken-primitive variant by key, or return the production primitive
 * when no `?broken=` param is set. Throws with a descriptive Error listing the
 * known keys when the param is set but unknown — no silent fallback.
 *
 * The runtime `key in variants` narrowing proves `key` is a valid variant key,
 * but the TypeScript compiler narrows the value of `key` to `string` (not the
 * literal-union key type) inside the guarded branch. The single `as KeyT`
 * below is the documented runtime-checked cast described in the T4 task brief.
 */
export function resolveBrokenPrimitive<P, KeyT extends string>(
  paramName: string,
  variants: Readonly<Record<KeyT, ComponentType<P>>>,
  production: ComponentType<P>,
  primitiveLabel: string,
): ComponentType<P> {
  const key = getParam(paramName);
  if (key === undefined) return production;
  if (!(key in variants)) {
    throw new Error(
      `Unknown ?${paramName} variant for ${primitiveLabel}: '${key}'. ` +
        `Known: ${Object.keys(variants).join(', ')}`,
    );
  }
  // Runtime-checked: the `key in variants` guard above proves membership.
  return variants[key as KeyT];
}

/**
 * Resolve a broken-context wrapper by key, or return `undefined` when no
 * `?context=` param is set. Throws on unknown key — no silent fallback.
 */
export function resolveContext(): ComponentType<{ children: ReactNode }> | undefined {
  const key = getParam('context');
  if (key === undefined) return undefined;
  if (!(key in BROKEN_CONTEXTS)) {
    throw new Error(
      `Unknown ?context variant: '${key}'. ` +
        `Known: ${Object.keys(BROKEN_CONTEXTS).join(', ')}`,
    );
  }
  // Runtime-checked: the `key in BROKEN_CONTEXTS` guard above proves membership.
  return BROKEN_CONTEXTS[key as BrokenContextKey];
}
