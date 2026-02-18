import { mkdir } from 'node:fs/promises';
import { test } from '@playwright/test';
import { captureEditorFixtureScreenshots } from '@audiocontrol/editor-core';
import { jv1080VisualFixture } from '../src/testing/visualFixtures';

const outputDir = process.env.VISUAL_OUTPUT_DIR ?? 'test-results/visual/current';

test('capture deterministic JV-1080 visual fixtures', async ({ page }) => {
  await mkdir(outputDir, { recursive: true });
  await captureEditorFixtureScreenshots(page, jv1080VisualFixture, {
    outputDir,
    filePrefix: 'after',
    fullPage: true,
  });
});
