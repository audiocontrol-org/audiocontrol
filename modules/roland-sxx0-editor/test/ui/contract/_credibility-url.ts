/**
 * Helper for Tier 2 contract specs (and Tier 3 in-context specs) to consume
 * the credibility-check env vars and append the matching `?broken=` /
 * `?context=` URL params to a harness route.
 *
 * The companion runner `tools/check-credibility.ts` (per
 * `docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`
 * §5) invokes the same spec multiple times — once unbroken, once per declared
 * broken variant — by exporting `AC_BROKEN_VARIANT` or `AC_BROKEN_CONTEXT`
 * before launching Playwright. The spec consults this helper to translate the
 * env-var state into URL params that the `/_harness/*` route dispatcher reads.
 *
 * When neither env var is set, the helper returns the base route unchanged so
 * the spec runs against the real production primitive in the real layout.
 *
 * The leading underscore in the filename keeps Playwright's `*.spec.ts`
 * test-matcher from picking this up as a spec — it's a helper, not a test.
 */
export function brokenHarnessUrl(baseRoute: string): string {
  const broken = process.env.AC_BROKEN_VARIANT;
  const context = process.env.AC_BROKEN_CONTEXT;
  const params = new URLSearchParams();
  if (broken !== undefined && broken !== '') {
    params.set('broken', broken);
  }
  if (context !== undefined && context !== '') {
    params.set('context', context);
  }
  const search = params.toString();
  return search === '' ? baseRoute : `${baseRoute}?${search}`;
}
