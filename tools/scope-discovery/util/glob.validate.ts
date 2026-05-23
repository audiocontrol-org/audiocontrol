/**
 * tools/scope-discovery/util/glob.validate.ts
 *
 * Adversarial validator for `tools/scope-discovery/util/glob.ts`.
 * Closes AUDIT-20260522-05 — `globToRegex` used to literal-escape
 * wildcards (`*`, `**`, `?`) when they appeared inside `{a,b}`
 * alternation, so globs of the form
 *   `lib/{Foo*Dialog,Bar*Dialog}.tsx`
 * compiled to `^lib\/(?:Foo\*Dialog|Bar\*Dialog)\.tsx$` and matched
 * zero real files. Consumers (adopter manifests, editor-symmetry,
 * deprecation scans, T6.1 `excludes_paths`) silently produced empty
 * match sets whenever a brace alternation contained a wildcard.
 *
 * Each scenario invokes the production `globToRegex` (no stubs at the
 * primary path) and asserts on the compiled `RegExp`'s `source` AND
 * its `.test()` behaviour against both should-match and
 * should-NOT-match inputs. The harness then runs a
 * `guttedStubSelfCheck` against a stubbed compiler that always
 * literal-escapes alternatives (the pre-fix shape) and asserts that
 * the load-bearing scenario WOULD fail against it — proving the gate
 * actually exercises the alternation+wildcard pipeline.
 *
 * Run via:
 *   tsx tools/scope-discovery/util/glob.validate.ts
 *   make check-glob-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (compiler regressed)
 *   2   harness infrastructure error
 */

import { globToRegex } from './glob.js';
import { errorMessage } from './typeguards.js';

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

/**
 * GlobCompiler is the seam this harness exercises. Production runs use
 * the imported `globToRegex`; the gutted-self-check substitutes a stub
 * that always literal-escapes alternatives (the AUDIT-20260522-05
 * pre-fix shape) and asserts the load-bearing scenarios reject it.
 */
type GlobCompiler = (pattern: string) => RegExp;

interface PatternCase {
  readonly pattern: string;
  /** Substrings the compiled regex source must contain. */
  readonly sourceContains?: readonly string[];
  /** Substrings the compiled regex source must NOT contain. */
  readonly sourceMissing?: readonly string[];
  /** Inputs the regex must match. */
  readonly shouldMatch: readonly string[];
  /** Inputs the regex must NOT match. */
  readonly shouldNotMatch: readonly string[];
}

/**
 * Apply one PatternCase against `compile`. Returns null on success or
 * a short failure detail on first mismatch (source-shape or test() behaviour).
 */
function probeCase(compile: GlobCompiler, c: PatternCase): string | null {
  let re: RegExp;
  try {
    re = compile(c.pattern);
  } catch (err) {
    return `compile threw for "${c.pattern}": ${errorMessage(err)}`;
  }
  for (const needle of c.sourceContains ?? []) {
    if (!re.source.includes(needle)) {
      return `expected source of "${c.pattern}" to contain ${JSON.stringify(needle)}; got ${re.source}`;
    }
  }
  for (const needle of c.sourceMissing ?? []) {
    if (re.source.includes(needle)) {
      return `expected source of "${c.pattern}" to NOT contain ${JSON.stringify(needle)}; got ${re.source}`;
    }
  }
  for (const m of c.shouldMatch) {
    if (!re.test(m)) {
      return `"${c.pattern}" should match "${m}"; got false (source=${re.source})`;
    }
  }
  for (const n of c.shouldNotMatch) {
    if (re.test(n)) {
      return `"${c.pattern}" should NOT match "${n}"; got true (source=${re.source})`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/** Scenario 1: `*` inside an alternation expands to `[^/]*`. */
function scenarioWildcardInAlternationSingleStar(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: '{a*c,b*d}',
    sourceContains: ['[^/]*'],
    sourceMissing: ['\\*'],
    shouldMatch: ['axc', 'byd', 'aXYZc'],
    shouldNotMatch: ['a/c', 'aXc/extra'],
  });
  return detail === null
    ? pass(
        'wildcard-in-alternation-single-star',
        '{a*c,b*d} -> (?:a[^/]*c|b[^/]*d); matches axc/byd/aXYZc; rejects a/c',
      )
    : fail('wildcard-in-alternation-single-star', detail);
}

/** Scenario 2: `**` inside an alternation expands to a multi-segment skip. */
function scenarioWildcardInAlternationDoubleStar(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: '{a/**/b,c/**/d}',
    sourceContains: ['[^/]'],
    sourceMissing: ['\\*\\*'],
    shouldMatch: ['a/b', 'a/x/b', 'a/x/y/b', 'c/d', 'c/x/y/z/d'],
    shouldNotMatch: ['a/c', 'b/a', 'a/x/y/b/extra'],
  });
  return detail === null
    ? pass(
        'wildcard-in-alternation-double-star',
        '{a/**/b,c/**/d} matches a/b, a/x/b, a/x/y/b, c/d, c/x/y/z/d',
      )
    : fail('wildcard-in-alternation-double-star', detail);
}

/** Scenario 3: `?` inside an alternation matches exactly one non-slash char. */
function scenarioWildcardInAlternationQuestion(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: '{a?c,b?d}',
    sourceContains: ['[^/]'],
    sourceMissing: ['\\?'],
    shouldMatch: ['axc', 'bzd'],
    shouldNotMatch: ['aXYc', 'abcc', 'a/c'],
  });
  return detail === null
    ? pass(
        'wildcard-in-alternation-question',
        '{a?c,b?d} matches single-char fillers; rejects multi-char and slash',
      )
    : fail('wildcard-in-alternation-question', detail);
}

/** Scenario 4: nested braces resolve recursively. `{a,{b,c}}` matches a,b,c. */
function scenarioNestedBraces(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: '{a,{b,c}}',
    shouldMatch: ['a', 'b', 'c'],
    shouldNotMatch: ['d', 'ab', 'bc', ''],
  });
  return detail === null
    ? pass('nested-braces', '{a,{b,c}} matches a/b/c; rejects ab/bc/d/empty')
    : fail('nested-braces', detail);
}

/** Scenario 5: non-wildcard regex metacharacters inside braces are still escaped. */
function scenarioLiteralCharsInBraces(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: '{a.b,c.d}',
    sourceContains: ['\\.'],
    shouldMatch: ['a.b', 'c.d'],
    shouldNotMatch: ['aXb', 'aab', 'a.X', 'c-d'],
  });
  return detail === null
    ? pass('literal-chars-in-braces', '{a.b,c.d} escapes `.` literally; rejects fuzzed inputs')
    : fail('literal-chars-in-braces', detail);
}

/**
 * Scenario 6: regression guard — top-level wildcards still produce the
 * established expansion. Lets us catch a refactor that accidentally
 * routes everything through the (newly-recursive) alternation path.
 */
function scenarioTopLevelWildcardStillWorks(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: 'lib/*.ts',
    sourceContains: ['[^/]*'],
    shouldMatch: ['lib/foo.ts', 'lib/bar.ts'],
    shouldNotMatch: ['lib/sub/foo.ts', 'foo.ts', 'lib/foo.tsx'],
  });
  return detail === null
    ? pass('top-level-wildcard-still-works', 'lib/*.ts compiles to [^/]*; rejects nested')
    : fail('top-level-wildcard-still-works', detail);
}

/**
 * Scenario 7: the audit's verbatim repro from
 * AUDIT-20260522-05. Locks the exact failure shape so a future
 * refactor that reintroduces literal-escaping of alternation wildcards
 * regresses here first.
 */
function scenarioBugfixRepro(compile: GlobCompiler): ScenarioResult {
  const detail = probeCase(compile, {
    pattern: 'lib/{Foo*Dialog,Bar*Dialog}.tsx',
    sourceContains: ['[^/]*'],
    sourceMissing: ['\\*'],
    shouldMatch: [
      'lib/FooLibraryDialog.tsx',
      'lib/BarConfigDialog.tsx',
      'lib/FooDialog.tsx',
      'lib/BarDialog.tsx',
    ],
    shouldNotMatch: ['lib/BazDialog.tsx', 'lib/Foo.tsx', 'lib/sub/FooDialog.tsx'],
  });
  return detail === null
    ? pass(
        'bugfix-repro',
        'lib/{Foo*Dialog,Bar*Dialog}.tsx matches FooLibraryDialog.tsx + siblings',
      )
    : fail('bugfix-repro', detail);
}

const SCENARIOS: ReadonlyArray<(compile: GlobCompiler) => ScenarioResult> = [
  scenarioWildcardInAlternationSingleStar,
  scenarioWildcardInAlternationDoubleStar,
  scenarioWildcardInAlternationQuestion,
  scenarioNestedBraces,
  scenarioLiteralCharsInBraces,
  scenarioTopLevelWildcardStillWorks,
  scenarioBugfixRepro,
];

// ---------------------------------------------------------------------------
// Gutted-stub self-check — prove the harness has teeth
// ---------------------------------------------------------------------------

/**
 * Pre-fix compiler shape: wildcards inside `{…}` are literal-escaped,
 * so `{a*c,b*d}` produces `(?:a\*c|b\*d)` and the bugfix-repro
 * scenario MUST fail. Top-level wildcards still expand normally (the
 * regression we did not have pre-fix) so scenario 6 still passes —
 * the gutted shape only blunts the alternation+wildcard path.
 */
function guttedCompile(pattern: string): RegExp {
  // Replicate the pre-AUDIT-05 logic just well enough to fool the
  // top-level scenarios while breaking the alternation-with-wildcard
  // ones. We hand-build a regex by walking the pattern: top-level `*`
  // expands to `[^/]*`; everything inside `{…}` is literal-escaped.
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '{') {
      const close = pattern.indexOf('}', i + 1);
      if (close === -1) throw new Error(`gutted: unmatched '{' in "${pattern}"`);
      const inner = pattern.substring(i + 1, close);
      const alts = inner.split(',').map((s) => s.trim());
      // The bug: each alternative is escaped wholesale; `*` becomes `\*`.
      out += `(?:${alts.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
      i = close + 1;
      continue;
    }
    if (ch === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

/**
 * Run the alternation-sensitive scenarios against `guttedCompile` and
 * confirm that the bugfix-repro scenario REJECTS the stub. The other
 * scenarios are noise here — we only need one load-bearing assertion
 * to prove the gate has teeth. If `scenarioBugfixRepro` accidentally
 * PASSES against the gutted shape, the harness has no signal and we
 * surface that as the failure.
 */
function guttedStubSelfCheck(): ScenarioResult {
  const result = scenarioBugfixRepro(guttedCompile);
  if (!result.passed) {
    // Expected: the gutted stub literal-escapes `*`, so the assertion fails.
    return pass(
      'gutted-stub-self-check',
      `gutted compile fails the bugfix-repro assertion as expected: ${result.detail}`,
    );
  }
  return fail(
    'gutted-stub-self-check',
    'gutted compile somehow PASSED the bugfix-repro assertion — the gate has no teeth',
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function main(): number {
  const results: ScenarioResult[] = [];
  for (const sc of SCENARIOS) {
    try {
      results.push(sc(globToRegex));
    } catch (err) {
      results.push(fail(sc.name, `scenario threw: ${errorMessage(err)}`));
    }
  }
  try {
    results.push(guttedStubSelfCheck());
  } catch (err) {
    results.push(fail('gutted-stub-self-check', `harness threw: ${errorMessage(err)}`));
  }

  let passed = 0;
  for (const r of results) {
    if (r.passed) {
      console.log(`PASS ${r.name}: ${r.detail}`);
      passed += 1;
    } else {
      console.error(`FAIL ${r.name}: ${r.detail}`);
    }
  }
  console.log(`Summary: ${passed}/${results.length} scenarios passed`);
  return passed === results.length ? 0 : 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`glob.validate: harness error: ${errorMessage(err)}`);
  process.exit(2);
}
