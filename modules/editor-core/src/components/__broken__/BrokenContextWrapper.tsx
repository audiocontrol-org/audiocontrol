/**
 * BrokenContextWrapper
 *
 * Dev-only React wrapper that lets the Tier 3 in-context credibility check
 * inject one of the registered broken context variants around a production
 * page. Reads `?context=<variant>` from the URL via `react-router-dom`'s
 * `useSearchParams` and looks the variant up in the `BROKEN_CONTEXTS`
 * registry from `./registry`.
 *
 *   - If no `?context=` is present, `children` are rendered unchanged
 *     (the production code path).
 *   - If `?context=<known-variant>` is present, `children` are wrapped in
 *     the matching broken context (e.g. `sticky-overlay`).
 *   - If `?context=<unknown-key>` is present, an Error is thrown listing
 *     the known keys — no silent fallback (per repo rule "loud failure
 *     over silent no-ops"; see `.claude/rules/agent-discipline.md`).
 *
 * The production routes mount this wrapper ONLY in dev mode (gated on
 * `import.meta.env.DEV` at the call site in
 * `modules/roland-sxx0-editor/src/App.tsx`); production builds bypass
 * the wrapper entirely.
 *
 * Pairs with the existing harness-route dispatcher at
 * `modules/roland-sxx0-editor/src/pages/_harness/url-params.ts`. That
 * dispatcher serves the Tier 2 `/_harness/*` routes; this wrapper serves
 * the Tier 3 production routes. Both consume the same registry, both
 * read the same `?context=<v>` URL param shape, so a credibility-runner
 * env-var setting (`AC_BROKEN_CONTEXT=sticky-overlay`) flows through the
 * shared `_credibility-url.ts` translator and lands in the same DOM-side
 * effect at both tiers.
 *
 * See: docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §5
 */
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BROKEN_CONTEXTS,
  type BrokenContextKey,
} from './registry';

/**
 * Type guard narrowing an untrusted string to the `BrokenContextKey`
 * union. Used to validate the URL param value against the registry's
 * statically-known key set without resorting to `as BrokenContextKey`.
 */
function isBrokenContextKey(value: string): value is BrokenContextKey {
  return Object.prototype.hasOwnProperty.call(BROKEN_CONTEXTS, value);
}

export interface BrokenContextWrapperProps {
  children: ReactNode;
}

/**
 * Wrap `children` in a broken context variant when the URL carries
 * `?context=<variant>`. When the URL lacks the param, render `children`
 * unchanged. Throws on unknown variant keys.
 */
export function BrokenContextWrapper({
  children,
}: BrokenContextWrapperProps): JSX.Element {
  const [searchParams] = useSearchParams();
  const raw = searchParams.get('context');

  if (raw === null) {
    // No broken-context override requested — production code path.
    // An empty-string param (`?context=`) falls through to the
    // unknown-key throw below: that's the loud-failure path the
    // contract-enforcement rule prescribes, and it mirrors how
    // `_credibility-url.ts` treats `AC_BROKEN_CONTEXT=''` as
    // un-set on the env-var side (the un-set env var never
    // produces `?context=` in the URL).
    return <>{children}</>;
  }

  if (!isBrokenContextKey(raw)) {
    throw new Error(
      `BrokenContextWrapper: unknown ?context variant '${raw}'. ` +
        `Known: ${Object.keys(BROKEN_CONTEXTS).join(', ')}`,
    );
  }

  const ContextComponent = BROKEN_CONTEXTS[raw];
  return <ContextComponent>{children}</ContextComponent>;
}
