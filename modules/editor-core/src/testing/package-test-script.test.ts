/**
 * package-test-script.test.ts — self-asserting invariant that the
 * editor-core `test` script wires in BOTH the unit-test config and
 * the UI-harness config, so the keyboard-navigation harness is
 * load-bearing on every default test run (root `pnpm -r test` /
 * `pnpm --filter @audiocontrol/editor-core test`).
 *
 * AUDIT-20260525-22 lesson: the editor-core UI keyboard-navigation
 * harness (`test/ui/keyboard-navigation.spec.tsx`) was originally
 * runnable only via `pnpm test:ui` or `make test-ui-editor-core` —
 * opt-in entry-points the operator had to remember. The fix wired
 * the UI config into the default `test` script
 * (`vitest run && vitest run --config vitest.ui.config.ts`). This
 * test asserts the wiring stays in place: a future revert that
 * drops the UI invocation from the default script would fail this
 * test, which itself runs on the default script — so the next
 * `pnpm test` would surface the regression instead of silently
 * dropping the harness from routine gates.
 *
 * Validator-paired-changes pattern: paired with the package.json
 * `test` script change. The assertion's teeth come from reading
 * the same package.json the test runner used to find this file —
 * a revert that removes the UI invocation would FAIL this test
 * because it would run via the (reverted) `test: "vitest run"`
 * script and discover its own absence from the script's command
 * list.
 *
 * Why a unit test, not a UI-harness self-assertion: the UI
 * harness can't catch a regression that removes itself from the
 * routine path — if a future commit drops the UI invocation from
 * the `test` script, the harness wouldn't run on `pnpm test` and
 * its self-assertion would be silently skipped. A unit test runs
 * on the (always-invoked) unit config, so it gets to assert the
 * UI config is wired alongside it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE_JSON_PATH = join(__dirname, '..', '..', 'package.json');

interface PackageJsonShape {
  readonly scripts?: Record<string, string | undefined>;
}

describe('editor-core package.json test script (AUDIT-20260525-22)', () => {
  it('default `test` script invokes BOTH the unit config and the UI harness config', () => {
    const raw = readFileSync(PACKAGE_JSON_PATH, 'utf8');
    const pkg = JSON.parse(raw) as PackageJsonShape;
    const testScript = pkg.scripts?.['test'];
    expect(
      testScript,
      'editor-core package.json is missing a `scripts.test` entry',
    ).toBeTruthy();
    const script = testScript!;

    // The unit config is the default `vitest run` invocation
    // (vitest.config.ts in the cwd is picked up implicitly).
    expect(
      script.includes('vitest run'),
      `editor-core test script must invoke \`vitest run\` (got: ${script})`,
    ).toBe(true);

    // The UI harness config is the explicit
    // `--config vitest.ui.config.ts` flag. A revert that drops this
    // would fail this assertion on the very next `pnpm test`.
    expect(
      script.includes('--config vitest.ui.config.ts'),
      `editor-core test script must invoke the UI harness via ` +
        `\`vitest run --config vitest.ui.config.ts\` so the keyboard-` +
        `navigation harness runs on every default test run ` +
        `(AUDIT-20260525-22). Current script: ${script}`,
    ).toBe(true);
  });

  it('preserves `test:unit` + `test:ui` granular entry-points for targeted runs', () => {
    // The aggregate `test` script picks up both suites, but the
    // granular entry-points let an operator run one suite in
    // isolation (e.g., `pnpm test:ui` to iterate on a UI harness
    // without re-running 391 unit tests).
    const raw = readFileSync(PACKAGE_JSON_PATH, 'utf8');
    const pkg = JSON.parse(raw) as PackageJsonShape;
    const scripts = pkg.scripts ?? {};
    expect(scripts['test:unit']).toBe('vitest run');
    expect(scripts['test:ui']).toBe(
      'vitest run --config vitest.ui.config.ts',
    );
  });
});
