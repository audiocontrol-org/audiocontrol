/**
 * tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.validate.ts
 *
 * T7.5 polish — assert the PRD-themed pattern hunter's tokenizer strips
 * URL components (https?:// + bare hostnames like github.com) BEFORE
 * splitting on non-word, so URL fragments don't pollute the theme bag-
 * of-words. Without this gate, a PRD with N references to github.com
 * pages can promote "github" / "com" over actual domain terms.
 *
 * Single scenario plus a gutted-stub self-check (the harness has teeth
 * shape that the rest of the scope-discovery validators follow).
 *
 * Exit code:
 *   0   all assertions held
 *   1   one or more assertions failed (tokenizer regressed)
 *   2   harness infrastructure error
 */

import { tokenizePrd, type TermRank } from './prd-themed-pattern-hunter.js';
import { RELEVANCE_SCENARIOS } from './prd-themed-pattern-hunter.relevance-scenarios.js';
import { errorMessage } from '../util/typeguards.js';

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
 * Build a PRD-shaped text that contains:
 *   - a real domain theme repeated >= MIN_TERM_FREQ (3) times so it
 *     should survive the frequency filter and appear in the output;
 *   - several URL/host fragments that would, without stripping, also
 *     reach the MIN_TERM_FREQ threshold (`github`, `com`, `https`).
 * The assertion: only the domain theme appears in the tokenized
 * result; the URL/host fragments are absent.
 */
function buildFixturePrd(): string {
  const body = [
    '# Feature: polishtest',
    '',
    'The polishtest feature concerns polishtest tones and polishtest patches.',
    '',
    '## References',
    '',
    '- See https://github.com/example/repo/issues/1',
    '- See https://github.com/example/repo/issues/2',
    '- See https://github.com/example/repo/blob/main/README.md',
    '- And bare host: github.com/foo/bar',
    '- Another: example.org/qux',
    '',
    '## More polishtest context',
    '',
    'polishtest tooling supports polishtest tones in polishtest patches.',
  ].join('\n');
  return body;
}

function termsContain(ranked: ReadonlyArray<TermRank>, term: string): boolean {
  return ranked.some((r) => r.term === term);
}

function scenarioUrlComponentsStripped(): ScenarioResult {
  const name = 'prd-themed tokenizer strips URL / bare-host components';
  const ranked = tokenizePrd(buildFixturePrd());
  // The fixture's domain term "polishtest" occurs >= 3 times and must
  // be present.
  if (!termsContain(ranked, 'polishtest')) {
    return fail(
      name,
      `expected domain term "polishtest" in ranked output; got: ${ranked.map((r) => r.term).join(', ')}`,
    );
  }
  // The URL/host components must NOT appear — they would have if the
  // tokenizer naively split on `[^A-Za-z0-9-]+` without URL stripping.
  const forbidden = ['github', 'https', 'example', 'issues', 'blob'];
  const leaked = forbidden.filter((t) => termsContain(ranked, t));
  if (leaked.length > 0) {
    return fail(
      name,
      `URL/host components leaked into bag-of-words: ${leaked.join(', ')}; full bag: ${ranked.map((r) => r.term).join(', ')}`,
    );
  }
  return pass(name, `domain term present; URL components absent (bag: ${ranked.map((r) => r.term).join(', ')})`);
}

/**
 * Harness-teeth check: simulate a regressed tokenizer that does NOT
 * strip URLs by tokenizing the same fixture with the URL-stripping
 * regexes removed. The scenario assertion above should reject that
 * output — if the assertion accepts it, the harness has no teeth.
 *
 * This shape mirrors `clone-detector.validate.ts`'s gutted-stub
 * approach: simulate the failure mode and confirm the harness catches
 * it.
 */
function buildRegressedTokenization(text: string): ReadonlyArray<TermRank> {
  // Skip URL stripping. Otherwise identical config: stopword + len
  // floor + freq floor + sort + cap. We can't import the in-file
  // constants without exporting them; rebuild the minimum check
  // structure here (the assertion below only needs presence/absence,
  // not the full pipeline).
  const STOPWORDS_LIGHT = new Set([
    'and', 'the', 'see', 'with', 'context', 'feature', 'concerns',
    'tooling', 'supports', 'more', 'main', 'bare', 'host', 'another',
    'foo', 'bar', 'qux', 'repo',
  ]);
  const counts = new Map<string, number>();
  for (const rawTok of text.split(/[^A-Za-z0-9-]+/g)) {
    const tok = rawTok.toLowerCase();
    if (tok.length < 4) continue;
    if (STOPWORDS_LIGHT.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  const ranked: TermRank[] = [];
  for (const [term, freq] of counts) {
    if (freq < 3) continue;
    ranked.push({ term, freq });
  }
  return ranked;
}

function scenarioHarnessTeeth(): ScenarioResult {
  const name = 'gutted-stub self-check: regressed tokenizer leaks URL components';
  const regressed = buildRegressedTokenization(buildFixturePrd());
  // The regressed tokenizer should leak at least one URL-component term
  // (github appears 4 times in the fixture). If it doesn't, our fixture
  // is too weak.
  if (!termsContain(regressed, 'github')) {
    return fail(
      name,
      'regressed tokenizer did NOT leak github; fixture is too weak to prove the gate has teeth',
    );
  }
  // And the leak must be the same kind the production assertion above
  // would reject — re-running the production assertion on the regressed
  // bag would surface "leaked" terms. That's the teeth check.
  return pass(name, 'regressed tokenizer leaked "github"; production assertion would reject it');
}

async function main(): Promise<number> {
  const tokenizerScenarios = [scenarioUrlComponentsStripped, scenarioHarnessTeeth];
  const results: ScenarioResult[] = [];
  for (const scenario of tokenizerScenarios) {
    const r = scenario();
    results.push(r);
    const marker = r.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${marker}  ${r.name} — ${r.detail}\n`);
  }
  // AUDIT-20260524-11 — PRD-scope-based module relevance scenarios.
  // Each entry returns a {name, passed, detail} shape compatible with
  // ScenarioResult; sync results pass through await unchanged.
  for (const scenario of RELEVANCE_SCENARIOS) {
    const r = await scenario();
    results.push(r);
    const marker = r.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${marker}  ${r.name} — ${r.detail}\n`);
  }
  const failed = results.filter((r) => !r.passed);
  process.stdout.write(
    `\nSummary: ${results.length - failed.length}/${results.length} scenarios passed\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`harness infrastructure error: ${errorMessage(err)}`);
    process.exit(2);
  },
);
