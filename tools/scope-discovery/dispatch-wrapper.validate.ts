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
 *   - A gutted-self-check stubs the wrap() function to always-accept and
 *     re-runs the rejection-asserting helper against it; the harness
 *     correctly reports the stub as broken. If the gut-check ever passes,
 *     the harness has no teeth and every other scenario proves nothing.
 *   - Per-scenario PASS/FAIL with one-line diagnostic.
 *   - Exit 0 = all pass; 1 = any assertion fail; 2 = infrastructure error.
 *
 * Run via:
 *   tsx tools/scope-discovery/dispatch-wrapper.validate.ts
 *   make check-dispatch-wrapper-validate
 */

import {
  DispatchRejected,
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
 * A gutted wrap() substitute: ignores the dispatched response entirely
 * and always returns a fixed ParsedDispatchReturn. Simulates the failure
 * mode where someone has commented out parseReturn/validateParsed and
 * the gate silently accepts every sub-agent dispatch.
 */
const guttedWrap: WrapFn = async () => ({
  searched: { pattern: 'gutted', count: 0 },
  included: [],
  excluded: [],
  rawText: '',
});

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
 * Run the gutted-wrap stub against EVERY rejection scenario and assert
 * that each one's assertion correctly FAILS (because the stub accepts
 * everything). If any rejection-scenario assertion *passes* against the
 * gutted stub, the harness has no teeth — guttedWrap returns a fixed
 * accepted ParsedDispatchReturn, so an honest assertScenario must
 * report "expected reject but wrapper accepted" for every rejection
 * scenario. A passing report against the stub means assertScenario is
 * permissive enough that real bugs would slip through too.
 */
async function scenarioGuttedLogicSelfCheck(): Promise<ScenarioResult> {
  const stubResults: ScenarioResult[] = [];
  for (const scenario of REJECTION_SCENARIOS) {
    stubResults.push(await assertScenario(scenario, guttedWrap));
  }
  const stubPasses = stubResults.filter((r) => r.passed);
  if (stubPasses.length > 0) {
    const names = stubPasses.map((r) => r.name).join('; ');
    return fail(
      'gutted-logic self-check',
      `assertion passed against gutted always-accept wrap() for: ${names} — harness has no teeth`,
    );
  }
  return pass(
    'gutted-logic self-check',
    `every rejection assertion (${REJECTION_SCENARIOS.length}) correctly failed against the always-accept stub`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const results: ScenarioResult[] = [];
  const allScenarios: ReadonlyArray<Scenario> = [
    ...ACCEPTANCE_SCENARIOS,
    ...REJECTION_SCENARIOS,
  ];
  for (const scenario of allScenarios) {
    const result = await assertScenario(scenario, wrap);
    results.push(result);
    const marker = result.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
  }
  const guttedResult = await scenarioGuttedLogicSelfCheck();
  results.push(guttedResult);
  const guttedMarker = guttedResult.passed ? 'PASS' : 'FAIL';
  process.stdout.write(
    `  ${guttedMarker}  ${guttedResult.name} — ${guttedResult.detail}\n`,
  );

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
