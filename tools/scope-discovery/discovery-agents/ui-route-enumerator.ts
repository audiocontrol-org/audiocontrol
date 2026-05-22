/**
 * tools/scope-discovery/discovery-agents/ui-route-enumerator.ts
 *
 * Discovery Agent 1 — UI route enumerator (T3.1).
 *
 * What it does:
 *   1. Identify which editor modules are in scope for the feature
 *      (PRD-mention → those modules; no mention → all editors).
 *   2. For each in-scope module, parse `src/App.tsx` to enumerate the
 *      React-Router `<Route path="..." element={<XPage />} />` entries.
 *   3. Resolve each route's element back to a page file under
 *      `src/pages/` when locatable.
 *   4. Emit structured UiRouteFindings JSON.
 *
 * Honest scope: this agent enumerates the route MAP — it does NOT
 * drive Playwright. Capture-via-Playwright is the `/scope-inventory`
 * skill's job at invocation time. The agent's output is the
 * deterministic seed the skill uses to plan its walks.
 *
 * Engine choice: line-grep over the App.tsx contents instead of a TS
 * AST. The Roland + Akai + D110 + JV1080 App.tsx files all follow the
 * same `<Route path="..." element={<XPage />} />` shape; a regex over
 * the lines produces a usable signal at near-zero cost. AST parsing is
 * a v2 enhancement if/when route declarations stop being uniform.
 *
 * CLI:
 *   tsx tools/scope-discovery/discovery-agents/ui-route-enumerator.ts \
 *     --feature <slug> --prd-path <path> [--repo-root <path>]
 */

import { join } from 'node:path';
import type {
  DiscoveryAgentInput,
  UiRoute,
  UiRouteFindings,
} from './types.js';
import {
  isDirectory,
  modulesInScopeForFeature,
  readUtf8,
  repoAbs,
  runIfMain,
} from './shared.js';
import { errorMessage } from '../util/typeguards.js';

const APP_TSX = 'src/App.tsx';
const PAGES_DIR = 'src/pages';

/**
 * Match a JSX `<Route path="..." element={<XPage />} />` declaration.
 * The path may be a string literal (single or double-quoted) or a JSX
 * `path="/akai/s3000xl/editor/programs"`. We capture both the path
 * literal and the element identifier so we can resolve the page file.
 *
 * We intentionally tolerate cross-line declarations by reading the
 * whole file as one string and using the `s` flag — Route tags are
 * sometimes split across lines for readability.
 */
const ROUTE_RE =
  /<Route\b[^>]*?\bpath\s*=\s*["']([^"']+)["'][^>]*?\belement\s*=\s*\{\s*<([A-Z][A-Za-z0-9_]*)\b/gs;

/**
 * Match an `index` route: `<Route index element={<HomePage />} />`.
 * Index routes have no path attribute; we model them as path = "" so
 * the synthesis layer can render them as "the default route".
 */
const INDEX_ROUTE_RE =
  /<Route\b[^>]*?\bindex\b[^>]*?\belement\s*=\s*\{\s*<([A-Z][A-Za-z0-9_]*)\b/gs;

interface RawRoute {
  readonly path: string;
  readonly element: string;
}

function extractRoutesFromAppTsx(text: string): ReadonlyArray<RawRoute> {
  const out: RawRoute[] = [];
  // Reset lastIndex by constructing fresh regexes per call (top-level
  // RE objects with /g flag preserve lastIndex across runs which would
  // produce wrong results on the second invocation).
  const routeRe = new RegExp(ROUTE_RE.source, ROUTE_RE.flags);
  const indexRe = new RegExp(INDEX_ROUTE_RE.source, INDEX_ROUTE_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = routeRe.exec(text)) !== null) {
    const path = m[1];
    const element = m[2];
    if (path === undefined || element === undefined) continue;
    // Skip the catch-all `<Route path="*" ... Navigate />` — it's not a
    // real surface, just a redirect.
    if (path === '*') continue;
    out.push({ path, element });
  }
  while ((m = indexRe.exec(text)) !== null) {
    const element = m[1];
    if (element === undefined) continue;
    out.push({ path: '', element });
  }
  return out;
}

/**
 * Best-effort resolution of an element identifier (e.g., "PatchesPage")
 * to its page file under `modules/<module>/src/pages/<PageName>.tsx`.
 * Returns null if the file doesn't exist — the route is still reported
 * but downstream consumers know the page file wasn't auto-located.
 */
async function resolvePageFile(args: {
  readonly repoRoot: string;
  readonly module: string;
  readonly elementName: string;
}): Promise<string | null> {
  const candidate = join('modules', args.module, PAGES_DIR, `${args.elementName}.tsx`);
  const abs = repoAbs(args.repoRoot, candidate);
  try {
    await readUtf8(abs);
    return candidate;
  } catch {
    return null;
  }
}

async function enumerateModuleRoutes(args: {
  readonly repoRoot: string;
  readonly module: string;
}): Promise<ReadonlyArray<UiRoute>> {
  const appRel = join('modules', args.module, APP_TSX);
  const appAbs = repoAbs(args.repoRoot, appRel);
  let text: string;
  try {
    text = await readUtf8(appAbs);
  } catch {
    // Module has no App.tsx — it's not a routed editor (e.g., a pure
    // library module that happens to end in -editor). Return empty.
    return [];
  }
  const raw = extractRoutesFromAppTsx(text);
  const resolved: UiRoute[] = [];
  for (const r of raw) {
    const pageFile = await resolvePageFile({
      repoRoot: args.repoRoot,
      module: args.module,
      elementName: r.element,
    });
    resolved.push({
      module: args.module,
      path: r.path,
      file: appRel,
      pageFile,
    });
  }
  return resolved;
}

/**
 * Public agent entrypoint. Imported by the synthesis layer + `/scope-
 * inventory` skill; invoked via the CLI wrapper at the bottom of this
 * file for standalone smoke-testing.
 */
export async function enumerateUiRoutes(
  input: DiscoveryAgentInput,
): Promise<UiRouteFindings> {
  // modulesInScopeForFeature is the single source of truth for the
  // empty-vs-all heuristic — it returns the full editor list as its
  // fallback, so the result is never empty. No second "empty? then
  // all" branch is needed here.
  const modulesInScope = await modulesInScopeForFeature(input);
  const routes: UiRoute[] = [];
  for (const module of modulesInScope) {
    const modAbs = repoAbs(input.repoRoot, join('modules', module));
    if (!(await isDirectory(modAbs))) {
      throw new Error(
        `module directory missing: ${modAbs} ` +
          `(in-scope set was derived from PRD ${input.prdPath})`,
      );
    }
    const moduleRoutes = await enumerateModuleRoutes({
      repoRoot: input.repoRoot,
      module,
    });
    for (const r of moduleRoutes) routes.push(r);
  }
  return {
    agent: 'ui-route-enumerator',
    featureSlug: input.featureSlug,
    modulesInScope,
    routes,
  };
}

// CLI entrypoint — only fires when invoked directly via `tsx <file>`;
// inert when imported by the synthesis pass (T3.2) or the skill.
runIfMain({
  importMetaUrl: import.meta.url,
  agentName: 'ui-route-enumerator',
  run: async (input) => {
    try {
      return await enumerateUiRoutes(input);
    } catch (err) {
      throw new Error(`enumeration failed: ${errorMessage(err)}`);
    }
  },
});
