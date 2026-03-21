/**
 * Playwright E2E tests for the loop editor with synth-core integration.
 *
 * Uses the test fixture page at /test/loop-editor which renders
 * LoopEditorDialog with a generated sine wave and keyboard note input.
 *
 * Tests verify:
 * - Dialog renders with correct sample info
 * - Keyboard input triggers MIDI voice indicator
 * - Voice indicator disappears on key release
 * - Multiple simultaneous keys show correct voice count
 * - Save button captures loop points
 * - Dialog closes and can be reopened
 */

import { test, expect } from '@playwright/test';

test.describe('Loop Editor — synth-core integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roland/s330/editor/test/loop-editor');
    // Wait for keyboard input to initialize
    await expect(page.getByTestId('keyboard-input-status')).toContainText('active');
    // Wait for dialog to be visible
    await expect(page.getByRole('heading', { name: 'Loop Editor' })).toBeVisible();
  });

  test('displays sample name and rate in dialog header', async ({ page }) => {
    await expect(page.getByText('E2E Test Sine (C4) — 44100 Hz')).toBeVisible();
  });

  test('shows loop editor content', async ({ page }) => {
    // The LoopEditor component should be rendered inside the dialog
    // It contains canvas elements for waveform display
    const dialogContent = page.locator('[role="dialog"]');
    await expect(dialogContent).toBeVisible();
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
    // Press C, E, G for a major chord
    await page.keyboard.down('z'); // C
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();

    await page.keyboard.down('c'); // E
    await expect(page.getByText('MIDI: 2 voices')).toBeVisible();

    await page.keyboard.down('v'); // F (next key in mapping)
    await expect(page.getByText('MIDI: 3 voices')).toBeVisible();

    // Release all
    await page.keyboard.up('z');
    await page.keyboard.up('c');
    await page.keyboard.up('v');

    await expect(page.getByText(/MIDI:/)).not.toBeVisible();
  });

  test('save button captures loop points', async ({ page }) => {
    await page.getByText('Save Loop Points').click();

    // Dialog should close
    await expect(page.getByRole('heading', { name: 'Loop Editor' })).not.toBeVisible();

    // Save result should be captured
    const result = await page.getByTestId('save-result').textContent();
    const parsed = JSON.parse(result!);
    expect(parsed.loopStart).toBe(4410);
    expect(parsed.loopEnd).toBe(88200);
  });

  test('dialog can be reopened after closing', async ({ page }) => {
    // Close dialog via save
    await page.getByText('Save Loop Points').click();
    await expect(page.getByRole('heading', { name: 'Loop Editor' })).not.toBeVisible();

    // Reopen
    await page.getByTestId('reopen-dialog').click();
    await expect(page.getByRole('heading', { name: 'Loop Editor' })).toBeVisible();
  });

  test('keyboard playback works after dialog reopen', async ({ page }) => {
    // Close and reopen
    await page.getByText('Save Loop Points').click();
    await page.getByTestId('reopen-dialog').click();
    await expect(page.getByRole('heading', { name: 'Loop Editor' })).toBeVisible();

    // Keyboard should still trigger voices
    await page.keyboard.down('z');
    await expect(page.getByText('MIDI: 1 voice')).toBeVisible();
    await page.keyboard.up('z');
  });
});
