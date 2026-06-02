/**
 * Validator for the promo scene manifest.
 *
 * The load-bearing rule is fixture existence: a fixture-backed scene whose
 * captured NDJSON is absent throws, so a fabricated fixture reference can
 * never be committed silently. Paired with validate-scenes.selfcheck.ts
 * (an adversarial scenario that proves the rejection has teeth).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { FixtureScene, Scene } from '#promo/scenes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// modules/e2e-infra/src/promo -> modules/sampler-devices/test/fixtures
const FIXTURES_ROOT = resolve(HERE, '../../../sampler-devices/test/fixtures');

/** Absolute path to the captured NDJSON a fixture scene replays. */
export function fixturePathForScene(scene: FixtureScene): string {
  return resolve(FIXTURES_ROOT, scene.device, `${scene.scenario}.ndjson`);
}

/**
 * Validate a promo scene manifest. Throws (never returns a soft result) on:
 * - duplicate scene ids
 * - a route that is not an absolute path
 * - non-positive viewport dimensions or scale
 * - a fixture-backed scene whose captured NDJSON is absent on disk
 */
export function validateSceneManifest(scenes: readonly Scene[]): void {
  const seen = new Set<string>();
  for (const scene of scenes) {
    if (seen.has(scene.id)) {
      throw new Error(`promo scene manifest: duplicate scene id '${scene.id}'`);
    }
    seen.add(scene.id);

    if (!scene.route.startsWith('/')) {
      throw new Error(
        `promo scene '${scene.id}': route must be an absolute path, got '${scene.route}'`,
      );
    }

    const { width, height, deviceScaleFactor } = scene.viewport;
    if (width <= 0 || height <= 0 || deviceScaleFactor <= 0) {
      throw new Error(
        `promo scene '${scene.id}': viewport width/height/deviceScaleFactor must all be positive`,
      );
    }

    if (scene.source === 'fixture') {
      const fixturePath = fixturePathForScene(scene);
      if (!existsSync(fixturePath)) {
        throw new Error(
          `promo scene '${scene.id}': captured fixture not found at ${fixturePath}. ` +
            `Capture it from real hardware — do not fabricate a fixture.`,
        );
      }
    }
  }
}
