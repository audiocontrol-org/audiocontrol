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
 * env-var state into URL params that the `/_harness/*` route dispatcher
 * (Tier 2) and the App-level `BrokenContextWrapper` (Tier 3 production
 * routes) read. Both tiers consume the identical translation, so this
 * helper is shared rather than duplicated under `test/ui/in-context/`.
 *
 * When neither env var is set, the helper returns the base route unchanged so
 * the spec runs against the real production primitive in the real layout.
 *
 * Handles two route shapes:
 *   - bare path: `/roland/s330/editor/_harness/envelope-table`
 *   - path with existing query string: `/roland/s330/editor/library?midi=simulated&scenario=load-everything`
 * For the latter, the credibility params are appended with `&` so the URL
 * stays well-formed. The Tier 3 LibraryPage spec exercises the
 * existing-query path because the simulated-MIDI scenario is part of the
 * route, not removable without losing the device-side load fixture.
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
  if (search === '') return baseRoute;
  if (baseRoute.includes('#')) {
    throw new Error(
      `brokenHarnessUrl: baseRoute must not contain '#' (fragments unsupported — appending query params after a fragment breaks routing). Got: ${baseRoute}`,
    );
  }
  const joiner = baseRoute.includes('?') ? '&' : '?';
  return `${baseRoute}${joiner}${search}`;
}
