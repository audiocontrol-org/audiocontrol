/**
 * Adversarial self-check for the promo scene-manifest validator
 * (validator-paired per .claude/rules/agent-discipline.md). Run via tsx;
 * exits non-zero on the first failed assertion.
 *
 * Teeth: assertion 2 fails if the validator is gutted to a no-op — it
 * proves the fixture-existence rule actually rejects a missing-fixture
 * manifest, not just that the happy path passes.
 */

import { PROMO_SCENES, type Scene } from '#promo/scenes.js';
import { validateSceneManifest } from '#promo/validate-scenes.js';

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// 1) The real manifest must validate clean — every fixture exists on disk.
try {
  validateSceneManifest(PROMO_SCENES);
  console.log(`OK: PROMO_SCENES validates clean (${PROMO_SCENES.length} scenes)`);
} catch (err) {
  fail(`real PROMO_SCENES manifest should validate but threw: ${(err as Error).message}`);
}

// 2) A manifest pointing at a non-existent fixture must be REJECTED.
const missingFixtureManifest: readonly Scene[] = [
  {
    id: 'adversarial-missing-fixture',
    editor: 'roland',
    source: 'fixture',
    device: 's330',
    scenario: 'this-scenario-does-not-exist-xyz',
    route: '/roland/s330/editor/tones?midi=simulated&scenario=this-scenario-does-not-exist-xyz',
    viewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  },
];
let rejected = false;
try {
  validateSceneManifest(missingFixtureManifest);
} catch {
  rejected = true;
}
if (!rejected) {
  fail('validator must REJECT a manifest pointing at a non-existent fixture (the load-bearing rule)');
}
console.log('OK: missing-fixture manifest rejected');

// 3) A duplicate scene id must be REJECTED.
const dupeManifest: readonly Scene[] = [PROMO_SCENES[0], PROMO_SCENES[0]];
let dupeRejected = false;
try {
  validateSceneManifest(dupeManifest);
} catch {
  dupeRejected = true;
}
if (!dupeRejected) {
  fail('validator must REJECT a manifest with a duplicate scene id');
}
console.log('OK: duplicate-id manifest rejected');

console.log('promo manifest self-check passed');
