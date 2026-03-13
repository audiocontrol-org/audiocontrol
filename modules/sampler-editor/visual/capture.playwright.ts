import { mkdir } from 'node:fs/promises';
import { test } from '@playwright/test';
import { captureEditorFixtureScreenshots } from '@audiocontrol/editor-core';
import { s330VisualFixture } from '../src/testing/visualFixtures';

const outputDir = process.env.VISUAL_OUTPUT_DIR ?? 'test-results/visual/current';
const pageId = process.env.VISUAL_PAGE_ID;

test('capture deterministic S-330 visual fixtures', async ({ page }) => {
  await mkdir(outputDir, { recursive: true });
  const fixture = pageId
    ? {
        ...s330VisualFixture,
        pages: s330VisualFixture.pages.filter((candidate) => candidate.id === pageId),
      }
    : s330VisualFixture;
  if (fixture.pages.length === 0) {
    throw new Error(`No S-330 fixture pages matched VISUAL_PAGE_ID=${pageId}`);
  }
  await captureEditorFixtureScreenshots(page, fixture, {
    outputDir,
    filePrefix: 'after',
    fullPage: true,
  });
});
