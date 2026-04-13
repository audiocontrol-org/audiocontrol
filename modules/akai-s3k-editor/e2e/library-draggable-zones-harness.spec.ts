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

  test('supports draggable note-boundary editing in the isolated harness', async ({ page }) => {
    await page.goto(harnessUrl('stacked-layers'));

    const lowHandle = page.getByTestId('zone-handle-note-low-0');
    const surface = page.getByTestId('zone-overview-surface');
    await expect(lowHandle).toBeVisible();
    await expect(surface).toBeVisible();

    const handleBox = await lowHandle.boundingBox();
    const surfaceBox = await surface.boundingBox();
    if (!handleBox || !surfaceBox) {
      throw new Error('Expected note-low drag handle bounding box');
    }

    const targetNote = 40;
    const visibleRangeMin = 32;
    const visibleRangeMax = 100;
    const visibleSpan = visibleRangeMax - visibleRangeMin + 1;
    const targetX =
      surfaceBox.x + surfaceBox.width * ((targetNote - visibleRangeMin) / visibleSpan);
    const targetY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(handleBox.x + handleBox.width / 2, targetY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, {
      steps: 8,
    });
    await page.mouse.up();

    await expect(page.getByTestId('harness-keygroup-0')).toContainText('40 - 72');

    const harnessState = await page.evaluate(() => {
      const state = (
        window as unknown as {
          __draggableZonesHarness?: {
            keygroups: Array<{ LONOTE: number; HINOTE: number }>;
          };
        }
      ).__draggableZonesHarness;
      return state?.keygroups[0];
    });

    expect(harnessState).toMatchObject({ LONOTE: 40, HINOTE: 72 });
  });

  test('supports draggable velocity split editing in the isolated harness', async ({ page }) => {
    await page.goto(harnessUrl('stacked-layers'));

    const splitHandle = page.getByTestId('velocity-split-handle-0');
    const surface = page.getByTestId('velocity-range-bar-surface');
    await expect(splitHandle).toBeVisible();
    await expect(surface).toBeVisible();

    const handleBox = await splitHandle.boundingBox();
    const surfaceBox = await surface.boundingBox();
    if (!handleBox || !surfaceBox) {
      throw new Error('Expected velocity split drag handle bounding box');
    }

    const targetBoundary = 80;
    const targetX =
      surfaceBox.x + surfaceBox.width * ((targetBoundary + 1) / 128);
    const targetY = handleBox.y + handleBox.height / 2;

    await page.evaluate(
      ({ startX, targetX: nextX, targetY: nextY }) => {
        const handle = document.querySelector('[data-testid="velocity-split-handle-0"]');
        if (!(handle instanceof HTMLElement)) {
          throw new Error('Velocity split handle not found');
        }

        handle.dispatchEvent(
          new MouseEvent('mousedown', {
            bubbles: true,
            clientX: startX,
            clientY: nextY,
          }),
        );
        document.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            clientX: nextX,
            clientY: nextY,
          }),
        );
        document.dispatchEvent(
          new MouseEvent('mouseup', {
            bubbles: true,
            clientX: nextX,
            clientY: nextY,
          }),
        );
      },
      {
        startX: handleBox.x + handleBox.width / 2,
        targetX,
        targetY,
      },
    );

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = (
            window as unknown as {
              __draggableZonesHarness?: {
                keygroups: Array<{ HIVEL1: number; LOVEL2: number }>;
              };
            }
          ).__draggableZonesHarness;
          return state?.keygroups[0];
        }))
      .toMatchObject({ HIVEL1: 80, LOVEL2: 81 });
  });

  test('supports creating a new keygroup by dragging in empty overview space', async ({ page }) => {
    await page.goto(harnessUrl('stacked-layers'));

    const surface = page.getByTestId('zone-overview-surface');
    await expect(surface).toBeVisible();

    const box = await surface.boundingBox();
    if (!box) {
      throw new Error('Expected zone overview surface bounding box');
    }

    const startX = box.x + 4;
    const startY = box.y + box.height - 50;
    const endX = startX + 40;
    const endY = startY - 50;
    const visibleRangeMin = 32;
    const visibleRangeMax = 100;
    const visibleSpan = visibleRangeMax - visibleRangeMin + 1;
    const velocityFromY = (clientY: number) => {
      const fraction = Math.max(0, Math.min(1, (clientY - box.y) / box.height));
      return Math.max(0, Math.min(127, Math.round(127 - fraction * 128)));
    };
    const noteFromX = (clientX: number) => {
      const fraction = Math.max(0, Math.min(1, (clientX - box.x) / box.width));
      return Math.max(
        visibleRangeMin,
        Math.min(127, Math.round(visibleRangeMin + fraction * visibleSpan)),
      );
    };

    const expectedLowNote = Math.min(noteFromX(startX), noteFromX(endX));
    const expectedHighNote = Math.max(noteFromX(startX), noteFromX(endX));
    const expectedLowVelocity = Math.min(velocityFromY(startY), velocityFromY(endY));
    const expectedHighVelocity = Math.max(velocityFromY(startY), velocityFromY(endY));

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await expect(page.getByTestId('zone-overview-create-preview')).toBeVisible();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId('harness-keygroup-2')).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = (
            window as unknown as {
              __draggableZonesHarness?: {
                keygroups: Array<{ LONOTE: number; HINOTE: number; LOVEL1: number; HIVEL1: number }>;
                selectedKeygroupIndex: number;
              };
            }
          ).__draggableZonesHarness;
          return {
            selectedKeygroupIndex: state?.selectedKeygroupIndex,
            keygroup: state?.keygroups[2],
          };
        }))
      .toMatchObject({
        selectedKeygroupIndex: 2,
        keygroup: {
          LONOTE: expectedLowNote,
          HINOTE: expectedHighNote,
          LOVEL1: expectedLowVelocity,
          HIVEL1: expectedHighVelocity,
        },
      });
  });
});
