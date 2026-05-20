/**
 * tools/generate-coverage-manifest/scan-specs.ts
 *
 * Walks the three tier directories under each declared module:
 *   test/wiring/          → Tier 1
 *   test/ui/contract/     → Tier 2
 *   test/ui/in-context/   → Tier 3
 *
 * For every `*.spec.ts` file found, extracts D-IDs from the test-title
 * string literals via regex. The convention (reform spec §3) is that each
 * test title starts with `D-<AREA>-<NN>:` and a single title may cite
 * multiple D-IDs separated by ` / `:
 *
 *     test('D-TONE-TVF-02 / D-TONE-TVF-03: cutoff + resonance respond …')
 *
 * We deliberately use a static regex against the file text (no TypeScript
 * AST) because every test in this codebase declares its title as a literal
 * string and the additional infrastructure of `ts-morph` or `typescript`
 * is not worth the dependency surface for one pattern. Templated/computed
 * titles would not be useful for D-ID coverage anyway — the regex would
 * see the unsubstituted source.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { DiscoveredSpec, DiscoveredTest, Tier } from './types.js';

/** Modules whose tier directories contribute to the manifest. */
export const MODULE_DIRS: ReadonlyArray<string> = [
  'modules/roland-sxx0-editor',
  'modules/akai-s3k-editor',
];

interface TierDir {
  readonly relPath: string;
  readonly tier: Tier;
}

const TIER_DIRS: ReadonlyArray<TierDir> = [
  { relPath: 'test/wiring', tier: 1 },
  { relPath: 'test/ui/contract', tier: 2 },
  { relPath: 'test/ui/in-context', tier: 3 },
];

// Match `D-<AREA>(-<SUB>)*-<NN>` where:
//   - <AREA> is uppercase letters (e.g. PATCH, TONE, CONN).
//   - There can be 0+ additional uppercase-letter segments (e.g. TONE-TVF,
//     PATCH-LIST, TONE-WAVE).
//   - The trailing -<NN> is one or more digits.
//
// Examples that match: D-PATCH-01, D-TONE-ENV-02, D-TONE-WAVE-11,
// D-PATCH-LIST-08. Examples that do NOT match: D-tone-01 (lowercase),
// D-1 (no area).
const D_ID_RE = /\bD(?:-[A-Z]+)+-\d+\b/g;

// Match a Playwright test() / test.skip() / test.only() call's first
// string-literal argument. We deliberately accept both single and double
// quotes; backticks are out of scope (templated names are pointless for
// D-ID extraction — the source `${var}` would land in the manifest).
const TEST_TITLE_RE = /\btest(?:\.(?:skip|only|fixme))?\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

function listSpecFiles(dir: string): ReadonlyArray<string> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSpecFiles(full));
      continue;
    }
    if (!entry.endsWith('.spec.ts')) continue;
    // Skip helper modules per the convention used by check-credibility:
    // filenames beginning with `_` are shared imports, not specs.
    if (entry.startsWith('_')) continue;
    out.push(full);
  }
  return out;
}

function extractDIds(text: string): ReadonlyArray<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  D_ID_RE.lastIndex = 0;
  while ((m = D_ID_RE.exec(text)) !== null) {
    out.add(m[0]);
  }
  return Array.from(out);
}

function extractTests(source: string): ReadonlyArray<DiscoveredTest> {
  const tests: DiscoveredTest[] = [];
  let m: RegExpExecArray | null;
  TEST_TITLE_RE.lastIndex = 0;
  while ((m = TEST_TITLE_RE.exec(source)) !== null) {
    const title = m[2];
    if (title === undefined) continue;
    // Unescape the captured contents minimally — `\'` / `\"` / `\\` are the
    // only escapes a test title is likely to use. We do NOT try to evaluate
    // arbitrary JS string-escape sequences; D-ID extraction tolerates the
    // raw form.
    const unescaped = title.replace(/\\(['"\\])/g, '$1');
    tests.push({ title: unescaped, dIds: extractDIds(unescaped) });
  }
  return tests;
}

export interface ScanResult {
  readonly specs: ReadonlyArray<DiscoveredSpec>;
}

export function scanSpecs(repoRoot: string): ScanResult {
  const specs: DiscoveredSpec[] = [];
  for (const moduleRel of MODULE_DIRS) {
    const moduleAbs = join(repoRoot, moduleRel);
    for (const td of TIER_DIRS) {
      const tierAbs = join(moduleAbs, td.relPath);
      for (const specAbs of listSpecFiles(tierAbs)) {
        const source = readFileSync(specAbs, 'utf8');
        const tests = extractTests(source);
        specs.push({
          absPath: specAbs,
          relPath: relative(repoRoot, specAbs),
          moduleRel,
          tier: td.tier,
          tests,
        });
      }
    }
  }
  return { specs };
}
