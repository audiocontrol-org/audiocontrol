/**
 * tools/scope-discovery/dispatch-wrapper.validate.ts
 *
 * Adversarial validator harness for `tools/scope-discovery/dispatch-wrapper.ts`
 * (workplan T2.6). Proves the wrapper actually rejects sub-agent returns
 * that violate the PRD Resolved Question 5 grammar + agent-discipline.md
 * forbidden-deferral rules, and accepts well-formed returns — including
 * the edge cases the T2.4 fix-pass had to address (multi-line Included,
 * prelude-quoted grammar, narrowed "later"/"until" regexes).
 *
 * Scenario fixtures live in `dispatch-wrapper.fixtures.ts` so this
 * harness file stays under the 300-500 line cap mandated by
 * `~/work/CLAUDE.md`.
 *
 * Pattern mirrors `clone-detector.validate.ts` (T2.5):
 *   - Each scenario is a small async function returning a ScenarioResult.
 *   - A two-level gutted-self-check stubs the wrap() function and
 *     re-runs the rejection-asserting helper against it. Level 1
 *     stubs both parser and validator (fully-gutted); Level 2 keeps
 *     the parser and gutts only the validator (parser-only). The
 *     dynamic partition proves BOTH layers are load-bearing — if
 *     either passes against a rejection scenario, the harness has
 *     no teeth and the scenario proves nothing.
 *   - Per-scenario PASS goes to stdout, FAIL goes to stderr (CI
 *     consumers grep stderr for FAIL).
 *   - Exit 0 = all pass; 1 = any assertion fail; 2 = infrastructure error.
 *
 * Run via:
 *   tsx tools/scope-discovery/dispatch-wrapper.validate.ts
 *   make check-dispatch-wrapper-validate
 */

import {
  DispatchRejected,
  parseReturn,
  type DispatchFn,
  type ParsedDispatchReturn,
  type WrapOptions,
  wrap,
} from './dispatch-wrapper.js';
import {
  ACCEPTANCE_SCENARIOS,
  REJECTION_SCENARIOS,
  type Scenario,
} from './dispatch-wrapper.fixtures.js';
import { errorMessage } from './util/typeguards.js';

// ---------------------------------------------------------------------------
// Wrap function indirection — lets the gutted self-check substitute a
// stubbed wrap() into the rejection-asserting helper. Matches the
// RunDetectorFn pattern in clone-detector.validate.ts.
// ---------------------------------------------------------------------------

type WrapFn = (
  agentType: string,
  taskPrompt: string,
  options: WrapOptions,
) => Promise<ParsedDispatchReturn>;

/** Build a DispatchFn that always returns `text`, ignoring the prompt. */
function cannedDispatch(text: string): DispatchFn {
  return async () => text;
}

/**
 * A fully-gutted wrap() substitute: ignores the dispatched response
 * entirely and always returns a fixed ParsedDispatchReturn. Simulates
 * the failure mode where someone has commented out BOTH parseReturn and
 * validateParsed and the gate silently accepts every sub-agent dispatch.
 */
const guttedWrap: WrapFn = async () => ({
  searched: { pattern: 'gutted', count: 0 },
  included: [],
  excluded: [],
  rawText: '',
});

/**
 * A partially-gutted wrap() substitute: runs parseReturn (so malformed
 * grammar still throws) but skips validateParsed. Simulates the failure
 * mode where the parser is intact but the semantic validator (skipped-
 * audit + forbidden-phrase rules) has been commented out — a regression
 * class the fully-gutted stub misses, because every rejection scenario
 * would still appear caught (by the parser) and the test would silently
 * pass against a half-broken gate.
 */
const parserOnlyWrap: WrapFn = async (_agentType, _taskPrompt, options) => {
  const responseText = await options.dispatchFn({
    agentType: 'test-agent',
    prompt: 'test prompt',
  });
  return parseReturn(responseText);
};

// ---------------------------------------------------------------------------
// Scenario result + helpers
// ---------------------------------------------------------------------------

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
 * Run a wrap()-shaped function against a canned response and return the
 * outcome as a discriminated union. Centralises the try/catch shape that
 * every scenario would otherwise duplicate.
 */
type RunOutcome =
  | { readonly kind: 'accepted'; readonly parsed: ParsedDispatchReturn }
  | { readonly kind: 'rejected'; readonly error: DispatchRejected }
  | { readonly kind: 'crashed'; readonly error: unknown };

async function runWrap(wrapFn: WrapFn, response: string): Promise<RunOutcome> {
  try {
    const parsed = await wrapFn('test-agent', 'test prompt', {
      dispatchFn: cannedDispatch(response),
    });
    return { kind: 'accepted', parsed };
  } catch (err) {
    if (err instanceof DispatchRejected) {
      return { kind: 'rejected', error: err };
    }
    return { kind: 'crashed', error: err };
  }
}

/**
 * Core assertion: run `wrapFn` against `scenario.response` and check the
 * outcome matches `scenario.expect`. Returns a ScenarioResult. The same
 * function is used by the real-wrapper scenarios and by the gutted
 * self-check — so when the gut substitutes guttedWrap, the assertion
 * fails for any scenario whose expect kind is 'reject'.
 */
async function assertScenario(
  scenario: Scenario,
  wrapFn: WrapFn,
): Promise<ScenarioResult> {
  const outcome = await runWrap(wrapFn, scenario.response);
  if (outcome.kind === 'crashed') {
    return fail(
      scenario.name,
      `wrapper crashed with non-DispatchRejected error: ${errorMessage(outcome.error)}`,
    );
  }
  if (scenario.expect.kind === 'accept') {
    if (outcome.kind !== 'accepted') {
      return fail(
        scenario.name,
        `expected accept but rejected: ${outcome.error.message}`,
      );
    }
    const checkErr = scenario.expect.check?.(outcome.parsed) ?? null;
    if (checkErr !== null) {
      return fail(scenario.name, `accepted but post-check failed: ${checkErr}`);
    }
    return pass(scenario.name, 'accepted as expected');
  }
  if (outcome.kind !== 'rejected') {
    return fail(
      scenario.name,
      'expected reject but wrapper accepted the return',
    );
  }
  const sub = scenario.expect.messageSubstring;
  if (sub !== undefined && !outcome.error.message.includes(sub)) {
    return fail(
      scenario.name,
      `rejected but message lacks "${sub}". Got: ${outcome.error.message}`,
    );
  }
  const expectedBlocks = scenario.expect.missingBlocks;
  if (expectedBlocks !== undefined) {
    const got = [...outcome.error.missingBlocks].sort().join(',');
    const want = [...expectedBlocks].sort().join(',');
    if (got !== want) {
      return fail(
        scenario.name,
        `missingBlocks mismatch — want [${want}], got [${got}]`,
      );
    }
  }
  return pass(
    scenario.name,
    `rejected as expected (${outcome.error.message.slice(0, 80)}...)`,
  );
}

// ---------------------------------------------------------------------------
// Gutted-logic self-check
// ---------------------------------------------------------------------------

/**
 * Two-level gutted-logic self-check. Exercises both gutting modes and
 * proves the rejection rules depend on BOTH the parser AND the
 * validator — a single-level always-accept check would miss the
 * partial-gut regression where parseReturn runs but validateParsed
 * is silently bypassed.
 *
 *   Level 1 — fully-gutted wrap (guttedWrap): every rejection scenario
 *     MUST fail its assertion. If any passes, the harness has no teeth.
 *
 *   Level 2 — parser-only wrap (parserOnlyWrap): the partition is
 *     dynamic — scenarios whose response trips parseReturn are still
 *     rejected (parser-caught); the rest pass through (validator-
 *     caught). The assertions must:
 *       (a) PASS against parser-caught scenarios (the parser is doing
 *           its job), AND
 *       (b) FAIL against validator-caught scenarios (because the
 *           always-accept-validator stub lets them through, but the
 *           rejection-asserting fixture expects a throw).
 *     If (b) is empty — i.e. every rejection scenario is parser-caught
 *     — then the suite doesn't exercise the validator at all, which
 *     itself is a regression.
 */
async function scenarioGuttedLogicSelfCheck(): Promise<ScenarioResult> {
  // Level 1 — fully-gutted wrap. Every rejection scenario must fail its
  // assertion (gutted accepts everything; the assertion expects reject).
  const fullyGuttedResults: ScenarioResult[] = [];
  for (const scenario of REJECTION_SCENARIOS) {
    fullyGuttedResults.push(await assertScenario(scenario, guttedWrap));
  }
  const fullyGuttedPasses = fullyGuttedResults.filter((r) => r.passed);
  if (fullyGuttedPasses.length > 0) {
    const names = fullyGuttedPasses.map((r) => r.name).join('; ');
    return fail(
      'gutted-logic self-check',
      `Level 1: assertion passed against fully-gutted wrap() for: ${names} — harness has no teeth`,
    );
  }

  // Level 2 — parser-only wrap. Classify scenarios dynamically by
  // running parseReturn against each response: scenarios that the
  // parser rejects are "parser-caught" and must still fail their
  // assertion correctly under parserOnlyWrap; scenarios the parser
  // accepts are "validator-caught" and must INCORRECTLY pass against
  // the stub (proving the validator is the load-bearing layer for
  // those rules).
  const parserCaught: string[] = [];
  const validatorCaught: string[] = [];
  for (const scenario of REJECTION_SCENARIOS) {
    try {
      parseReturn(scenario.response);
      validatorCaught.push(scenario.name);
    } catch (err) {
      if (err instanceof DispatchRejected) {
        parserCaught.push(scenario.name);
      } else {
        return fail(
          'gutted-logic self-check',
          `Level 2: parseReturn threw non-DispatchRejected error for "${scenario.name}": ${errorMessage(err)}`,
        );
      }
    }
  }
  if (validatorCaught.length === 0) {
    return fail(
      'gutted-logic self-check',
      'Level 2: REJECTION_SCENARIOS contains no validator-caught scenarios — the validator (skipped-audit + forbidden-phrase rules) is not exercised by the rejection fixtures',
    );
  }
  if (parserCaught.length === 0) {
    return fail(
      'gutted-logic self-check',
      'Level 2: REJECTION_SCENARIOS contains no parser-caught scenarios — the grammar parser is not exercised by the rejection fixtures',
    );
  }

  const parserOnlyResults: ScenarioResult[] = [];
  for (const scenario of REJECTION_SCENARIOS) {
    parserOnlyResults.push(await assertScenario(scenario, parserOnlyWrap));
  }

  // (a) Parser-caught scenarios MUST still pass against parserOnlyWrap.
  // If any fail, the parser regressed (or our classification is wrong).
  const parserCaughtFailures = parserOnlyResults.filter(
    (r) => !r.passed && parserCaught.includes(r.name),
  );
  if (parserCaughtFailures.length > 0) {
    const names = parserCaughtFailures.map((r) => r.name).join('; ');
    return fail(
      'gutted-logic self-check',
      `Level 2 (a): parser-caught scenarios failed against parserOnlyWrap (parser regression?): ${names}`,
    );
  }

  // (b) Validator-caught scenarios MUST fail against parserOnlyWrap
  // (the validator is gutted; the parser doesn't catch them; so the
  // wrapper accepts and the rejection-asserting fixture fails).
  const validatorCaughtPasses = parserOnlyResults.filter(
    (r) => r.passed && validatorCaught.includes(r.name),
  );
  if (validatorCaughtPasses.length > 0) {
    const names = validatorCaughtPasses.map((r) => r.name).join('; ');
    return fail(
      'gutted-logic self-check',
      `Level 2 (b): validator-caught scenarios passed against parserOnlyWrap — the parser is doing the validator's work (regression class): ${names}`,
    );
  }

  return pass(
    'gutted-logic self-check',
    `Level 1: ${REJECTION_SCENARIOS.length} assertions correctly failed against fully-gutted wrap; ` +
      `Level 2: ${parserCaught.length} parser-caught + ${validatorCaught.length} validator-caught scenarios — both layers proven load-bearing`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Per-scenario printer. PASS lines go to stdout; FAIL lines go to
 * stderr so CI consumers grepping stderr for FAIL see them. Matches
 * the dual-stream convention used by other validator harnesses.
 */
function emitScenarioLine(result: ScenarioResult): void {
  if (result.passed) {
    process.stdout.write(`  PASS  ${result.name} — ${result.detail}\n`);
  } else {
    process.stderr.write(`  FAIL  ${result.name} — ${result.detail}\n`);
  }
}

async function main(): Promise<number> {
  const results: ScenarioResult[] = [];
  const allScenarios: ReadonlyArray<Scenario> = [
    ...ACCEPTANCE_SCENARIOS,
    ...REJECTION_SCENARIOS,
  ];
  for (const scenario of allScenarios) {
    const result = await assertScenario(scenario, wrap);
    results.push(result);
    emitScenarioLine(result);
  }
  const guttedResult = await scenarioGuttedLogicSelfCheck();
  results.push(guttedResult);
  emitScenarioLine(guttedResult);

  const failed = results.filter((r) => !r.passed);
  process.stdout.write(
    `\nSummary: ${results.length - failed.length}/${results.length} scenarios passed\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`harness infrastructure error: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
