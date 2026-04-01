import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const SAMPLES_NAV_HREF = 'samples';
const UI_TIMEOUT_MS = 5_000;
const SAMPLE_NAMES_TIMEOUT_MS = 15_000;

/**
 * Generate a valid 16-bit mono PCM WAV file as a Buffer.
 * Uses a deterministic triangle wave pattern.
 */
export function generateTestWavBuffer(numSamples: number, sampleRate: number): Buffer {
  const headerSize = 44;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(headerSize + dataSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Triangle wave samples
  for (let i = 0; i < numSamples; i++) {
    const phase = (i % 256) / 256;
    const value =
      phase < 0.5
        ? Math.round(-32768 + phase * 2 * 65535)
        : Math.round(32767 - (phase - 0.5) * 2 * 65535);
    buffer.writeInt16LE(value, headerSize + i * 2);
  }

  return buffer;
}

/** Navigate to the Samples page. */
export async function navigateToSamples(page: Page): Promise<void> {
  const link = page.locator(`a[href*="${SAMPLES_NAV_HREF}"]`);
  await link.click();
  await page.waitForURL(`**/${SAMPLES_NAV_HREF}**`);
}

/** Wait for the sample dropdown to have more than just the placeholder option. */
export async function waitForSampleNamesLoaded(page: Page): Promise<void> {
  const select = page.locator('[data-testid="sds-sample-select"]');
  await expect(select).toBeVisible({ timeout: UI_TIMEOUT_MS });

  await expect(async () => {
    const count = await select.locator('option').count();
    expect(count).toBeGreaterThan(1);
  }).toPass({ timeout: SAMPLE_NAMES_TIMEOUT_MS });
}

/** Select a sample by its index in the dropdown. */
export async function selectSample(page: Page, index: number): Promise<void> {
  const select = page.locator('[data-testid="sds-sample-select"]');
  await select.selectOption(String(index));
}

/**
 * Attach console listener that forwards S3000XL/SDS messages to stdout.
 * This keeps the watchdog heartbeat alive during long MIDI transfers.
 */
export function attachSdsConsoleListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S3000XL') ||
      text.includes('SDS') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log('BROWSER:', text);
    }
  });
}
