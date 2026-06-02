/**
 * Device-free promo screenshot capture (editor-ux-refinement Phase 2, P2.3).
 *
 * Runs against a dev server already started by `run_with_dev_server` (which
 * exports E2E_PORT). Renders each PROMO_SCENES entry for the editor named in
 * PROMO_EDITOR and writes a full-page PNG to `out/promo/<id>.png`.
 *
 * Reuses the simulated-MIDI device-free path (scene routes carry
 * `?midi=simulated&scenario=`), so no hardware is needed. This is a
 * visual-capture tool, NOT an E2E correctness test.
 *
 * Determinism: pinned per-scene viewport + deviceScaleFactor, `networkidle`
 * settle, and `document.fonts.ready` (so captures don't flash unstyled
 * text). No arbitrary sleeps.
 */

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { PROMO_SCENES, type Scene } from '#promo/scenes.js';
import { validateSceneManifest } from '#promo/validate-scenes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// modules/e2e-infra/src/promo -> repo root -> out/promo
const OUT_DIR = resolve(HERE, '../../../../out/promo');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required (set by run_with_dev_server / make promo-shots)`);
  }
  return value;
}

async function main(): Promise<void> {
  // Fail fast if any fixture-backed scene points at an absent capture.
  validateSceneManifest(PROMO_SCENES);

  const editor = requireEnv('PROMO_EDITOR');
  const port = requireEnv('E2E_PORT');
  const baseURL = `https://localhost:${port}`;

  const scenes: Scene[] = PROMO_SCENES.filter((scene) => scene.editor === editor);
  if (scenes.length === 0) {
    console.log(`[promo] no scenes for editor '${editor}'`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const scene of scenes) {
      const context = await browser.newContext({
        viewport: { width: scene.viewport.width, height: scene.viewport.height },
        deviceScaleFactor: scene.viewport.deviceScaleFactor,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();
      const url = `${baseURL}${scene.route}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const outPath = resolve(OUT_DIR, `${scene.id}.png`);
      // `animations: 'disabled'` freezes CSS animations/transitions/Web
      // Animations to a stable end state for the shot, so live chrome
      // (rec-LED glow, VFD pulse, in-flight transitions) captures
      // deterministically instead of mid-frame.
      await page.screenshot({ path: outPath, fullPage: true, animations: 'disabled' });
      console.log(`[promo] ${scene.id} -> ${outPath}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`[promo] captured ${scenes.length} scene(s) for '${editor}'`);
}

main().catch((err) => {
  console.error(`[promo] capture failed: ${(err as Error).message}`);
  process.exit(1);
});
