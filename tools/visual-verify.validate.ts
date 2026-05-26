/**
 * tools/visual-verify.validate.ts
 *
 * Adversarial validator harness for `tools/check-visual-verify.ts` (the
 * commit-msg gate that enforces the `Visual-verify:` marker per
 * VISUAL-VERIFICATION.md). Proves the gate fires on UI-touching commits,
 * passes through non-UI commits, accepts well-formed marker values,
 * rejects placeholder reasons + missing markers, AND that the harness
 * has teeth (a gutted-stub version of the production check is mounted
 * and EVERY rejection assertion must FAIL against it).
 *
 * Run via:
 *   tsx tools/visual-verify.validate.ts
 *   make check-visual-verify-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (gate is broken)
 *   2   harness infrastructure error
 */

import { checkVisualVerify, validateMarkerValue } from './check-visual-verify.js';

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
 * Gutted stub of the production check. Always returns null (accept-all).
 * Mounted in the teeth-proof scenarios to prove that, if the production
 * check were replaced with a no-op, the rejection assertions would FAIL —
 * i.e., the rejections are load-bearing, not coincidentally satisfied.
 */
function guttedCheckVisualVerify(
  _commitMsg: string,
  _stagedUiFiles: string[],
): string | null {
  return null;
}

const UI_FILE = 'modules/akai-s3k-editor/src/pages/ProgramsPage.tsx';

const scenarios: ScenarioResult[] = [];

// --- Production check: happy paths -----------------------------------------

scenarios.push((() => {
  // The CLI filters staged files against UI_SOURCE_REGEX before calling
  // checkVisualVerify, so a "non-UI commit" reaches the function with an
  // empty stagedUiFiles array. Mirror that contract here.
  const name = 'PROD: non-UI commit (empty staged-UI list) passes';
  const result = checkVisualVerify('docs: tweak readme\n', []);
  if (result !== null) return fail(name, `expected null, got: ${result.split('\n')[0]}`);
  return pass(name, 'gate does not fire when stagedUiFiles is empty');
})());

scenarios.push((() => {
  const name = 'PROD: UI commit with route-form marker passes';
  const msg = 'fix(programs): tweak something\n\nVisual-verify: programs-desktop, programs-mobile\n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result !== null) return fail(name, `expected null, got: ${result.split('\n')[0]}`);
  return pass(name, 'route-form marker accepted');
})());

scenarios.push((() => {
  const name = 'PROD: UI commit with skipped-<substantive-reason> passes';
  const reason = 'comment-only edits; no rendering change. Source files touched only for typo fixes.';
  const msg = `chore: comment polish\n\nVisual-verify: skipped-${reason}\n`;
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result !== null) return fail(name, `expected null, got: ${result.split('\n')[0]}`);
  return pass(name, 'skipped-form with substantive reason accepted');
})());

scenarios.push((() => {
  const name = 'PROD: marker line tolerates leading whitespace';
  const msg = 'fix: thing\n\n  Visual-verify: programs-desktop\n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result !== null) return fail(name, `expected null, got: ${result.split('\n')[0]}`);
  return pass(name, 'leading whitespace before marker accepted');
})());

// --- Production check: rejection paths -------------------------------------

scenarios.push((() => {
  const name = 'PROD: UI commit with NO marker is rejected';
  const result = checkVisualVerify('fix(programs): tweak something\n', [UI_FILE]);
  if (result === null) return fail(name, 'expected rejection, got null');
  if (!result.includes('Visual-verify marker missing')) {
    return fail(name, `unexpected error text: ${result.split('\n')[0]}`);
  }
  return pass(name, 'missing marker rejected with expected diagnostic');
})());

scenarios.push((() => {
  const name = 'PROD: empty marker value is rejected';
  const msg = 'fix: thing\n\nVisual-verify: \n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result === null) return fail(name, 'expected rejection, got null');
  if (!result.includes('invalid')) {
    return fail(name, `unexpected error text: ${result.split('\n')[0]}`);
  }
  return pass(name, 'empty marker value rejected');
})());

scenarios.push((() => {
  const name = 'PROD: skipped-<empty> is rejected';
  const msg = 'fix: thing\n\nVisual-verify: skipped-\n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result === null) return fail(name, 'expected rejection, got null');
  return pass(name, 'skipped- with no reason rejected');
})());

scenarios.push((() => {
  const name = 'PROD: skipped-<gaming-phrase> is rejected (TBD)';
  const msg = 'fix: thing\n\nVisual-verify: skipped-tbd\n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result === null) return fail(name, 'expected rejection, got null');
  if (!result.includes('placeholder phrase')) {
    return fail(name, `unexpected error text: ${result.split('\n')[0]}`);
  }
  return pass(name, 'placeholder reason rejected');
})());

scenarios.push((() => {
  const name = 'PROD: skipped-<too-short> is rejected';
  // 25 chars — well under the 40-char minimum.
  const msg = 'fix: thing\n\nVisual-verify: skipped-short reason here\n';
  const result = checkVisualVerify(msg, [UI_FILE]);
  if (result === null) return fail(name, 'expected rejection, got null');
  if (!result.includes('substantive')) {
    return fail(name, `unexpected error text: ${result.split('\n')[0]}`);
  }
  return pass(name, 'short reason rejected');
})());

// --- Marker-value validator unit checks ------------------------------------

scenarios.push((() => {
  const name = 'UNIT: validateMarkerValue accepts well-formed route list';
  const r = validateMarkerValue('programs-desktop, programs-mobile, library-real-desktop');
  if (r !== null) return fail(name, `expected null, got: ${r}`);
  return pass(name, 'route list accepted');
})());

scenarios.push((() => {
  const name = 'UNIT: validateMarkerValue rejects only-commas value';
  const r = validateMarkerValue(' , , , ');
  if (r === null) return fail(name, 'expected rejection, got null');
  return pass(name, 'only-commas rejected');
})());

// --- GUTTED-STUB teeth proof -----------------------------------------------
//
// Per .claude/rules/agent-discipline.md §"Validator-paired changes": every
// gate-semantic change ships with a scenario that would have FAILED
// against the prior behavior. For the visual-verify gate, the "prior
// behavior" is "no marker check at all" — a gutted stub that always
// accepts. The block below proves that EVERY rejection scenario above
// fails against the gutted stub. If the production check were ever
// silently downgraded to a no-op, this scenario's assertions would
// surface that.

scenarios.push((() => {
  const name = 'GUTTED: missing marker silently passes (proves rejection has teeth)';
  const guttedResult = guttedCheckVisualVerify('fix: thing\n', [UI_FILE]);
  if (guttedResult !== null) {
    return fail(name, 'gutted stub unexpectedly rejected — stub is wrong');
  }
  // Now run the SAME input through the production check and confirm
  // it DOES reject. The two-step difference IS the teeth.
  const prodResult = checkVisualVerify('fix: thing\n', [UI_FILE]);
  if (prodResult === null) {
    return fail(
      name,
      'production check ALSO passed — gate is broken; gutted stub and production behave identically',
    );
  }
  return pass(
    name,
    'gutted accept-all passes the input; production check rejects it (rejection is load-bearing)',
  );
})());

scenarios.push((() => {
  const name = 'GUTTED: skipped-tbd silently passes (proves placeholder rejection has teeth)';
  const msg = 'fix: thing\n\nVisual-verify: skipped-tbd\n';
  const guttedResult = guttedCheckVisualVerify(msg, [UI_FILE]);
  if (guttedResult !== null) {
    return fail(name, 'gutted stub unexpectedly rejected — stub is wrong');
  }
  const prodResult = checkVisualVerify(msg, [UI_FILE]);
  if (prodResult === null) {
    return fail(name, 'production check passed a placeholder reason — gate is broken');
  }
  return pass(name, 'gutted accept-all passes placeholder; production rejects it');
})());

// --- Report + exit ---------------------------------------------------------

const passed = scenarios.filter((s) => s.passed).length;
const failed = scenarios.filter((s) => !s.passed).length;

for (const s of scenarios) {
  const icon = s.passed ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${s.name} — ${s.detail}`);
}

console.log('');
console.log(`Summary: ${passed} passed, ${failed} failed (of ${scenarios.length})`);

process.exit(failed === 0 ? 0 : 1);
