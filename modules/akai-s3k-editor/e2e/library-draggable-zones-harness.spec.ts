/**
 * Browser-only feature harness tests for draggable zone editing surfaces.
 *
 * These tests hit a dedicated harness route that seeds realistic Akai
 * keygroup state locally, without hardware, HTTP MIDI, or OPFS setup.
 *
 * Run via:
 * modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library 'ARGS=--grep "Draggable Zones Harness"'
 */

import { test, expect } from '@playwright/test';

const port = process.env.E2E_PORT;

if (!port) {
  throw new Error('E2E_PORT must be set. Run via: make test-e2e-s3k-library');
}

function harnessUrl(fixture = 'stacked-layers'): string {
  return `https://localhost:${port}/akai/s3000xl/editor/harness/draggable-zones?midi=mock&fixture=${fixture}`;
}

test.describe('Draggable Zones Harness', () => {
  test('loads the harness route without hardware dependencies', async ({ page }) => {
    await page.goto(harnessUrl());
    await expect(page.getByTestId('draggable-zones-harness')).toBeVisible();
    await expect(page.getByText('Draggable Zones Harness')).toBeVisible();
    await expect(page.getByText(/Browser-only feature harness for the Akai keygroup zone surfaces/i)).toContainText(
      'Browser-only feature harness',
    );
  });

  test('switches fixtures and re-seeds the UI state', async ({ page }) => {
    await page.goto(harnessUrl('stacked-layers'));

    await expect(page.getByTestId('harness-keygroup-0')).toContainText('KG 1');
    await expect(page.getByTestId('draggable-zones-fixture-select')).toHaveValue(
      'stacked-layers',
    );

    await page.getByTestId('draggable-zones-fixture-select').selectOption('dense-splits');

    await expect(page.getByTestId('draggable-zones-fixture-select')).toHaveValue(
      'dense-splits',
    );
    await expect(page.getByTestId('draggable-zones-fixture-description')).toContainText(
      'Three tightly packed keygroups',
    );
    await expect(page.getByTestId('harness-keygroup-2')).toBeVisible();
  });

  test('supports local editing without device loaders', async ({ page }) => {
    await page.goto(harnessUrl());

    const lowInput = page.getByRole('spinbutton', { name: /low/i });
    await expect(lowInput).toHaveValue('36');
    await lowInput.fill('40');
    await expect(lowInput).toHaveValue('40');

    const zoneOverview = page.getByTestId('zone-overview-zone-0-1');
    await expect(zoneOverview).toBeVisible();
  });
});
