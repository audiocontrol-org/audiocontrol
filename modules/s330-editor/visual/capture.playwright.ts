import { mkdir } from 'node:fs/promises';
import { test } from '@playwright/test';
import { captureEditorFixtureScreenshots } from '@audiocontrol/editor-core';
import { s330VisualFixture } from '../src/testing/visualFixtures';

const outputDir = process.env.VISUAL_OUTPUT_DIR ?? 'artifacts/visual/current';

test('capture deterministic S-330 visual fixtures', async ({ page }) => {
  await mkdir(outputDir, { recursive: true });
  await captureEditorFixtureScreenshots(page, s330VisualFixture, {
    outputDir,
    filePrefix: 'after',
    fullPage: true,
  });
});
