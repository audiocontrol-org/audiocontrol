/**
 * Playwright E2E tests for the loop editor with synth-core integration.
 *
 * This spec runs against TWO surfaces via Playwright projects:
 * - sampler-editor: /roland/s330/editor/test/loop-editor
 * - dev-harness: / (root)
 *
 * Both surfaces use the shared useLoopEditor hook with keyboard note input.
 * Tests verify they behave identically: waveform renders, keyboard triggers
 * MIDI voice indicator, voice count updates correctly.
 */

import { test, expect } from '@playwright/test';

// Resolve the correct URL based on which project is running
function getTestUrl(projectName: string | undefined): string {
  if (projectName === 'dev-harness') return '/';
  return '/roland/s330/editor/test/loop-editor';
}

test.describe('Loop Editor — synth-core integration', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const url = getTestUrl(testInfo.project.name);
    await page.goto(url);
    // Wait for keyboard input to initialize
    await expect(page.getByTestId('keyboard-input-status')).toContainText('active');
    // Wait for loop editor content to render
    await expect(page.getByTestId('loop-editor-test-page')).toBeVisible();
  });

  test('renders loop editor with waveform content', async ({ page }) => {
    // The LoopEditor component renders canvas elements for waveforms
    const canvases = page.locator('canvas');
    await expect(canvases.first()).toBeVisible();
  });

  test('keyboard note triggers MIDI voice indicator', async ({ page }) => {
    // No voices initially
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();

    // Press 'z' key — maps to C4 (note 60) in keyboard input
    await page.keyboard.down('z');

    // Voice indicator should appear
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();

    // Release key
    await page.keyboard.up('z');

    // Voice indicator should disappear
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });

  test('multiple keys show correct polyphonic voice count', async ({ page }) => {
    // Press C, E, F for a chord
    await page.keyboard.down('z'); // C
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();

    await page.keyboard.down('c'); // E
    await expect(page.getByText('MIDI: 2 voices')).toBeVisible();

    await page.keyboard.down('v'); // F
    await expect(page.getByText('MIDI: 3 voices')).toBeVisible();

    // Release all
    await page.keyboard.up('z');
    await page.keyboard.up('c');
    await page.keyboard.up('v');

    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });

  test('voice indicator appears and disappears for rapid note presses', async ({ page }) => {
    // Quick press and release
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();

    // Again with a different key
    await page.keyboard.down('x'); // D
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('x');
    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });
});
