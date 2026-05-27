#!/usr/bin/env node
// One-shot capture of the Akai keygroup-editor harness with the FILTER tab
// active, so the TVF envelope LCD treatment lands in the screenshot.
// Run with the akai dev server up on https://localhost:3300.

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(REPO_ROOT, '.tmp/visual-fidelity');
mkdirSync(OUT_DIR, { recursive: true });

const playwrightUrl = pathToFileURL(
  resolve(REPO_ROOT, 'node_modules/.pnpm/playwright-core@1.58.1/node_modules/playwright-core/index.mjs'),
).href;
const { chromium } = await import(playwrightUrl);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
await page.goto('https://localhost:3300/akai/s3000xl/editor/test/keygroup-editor', {
  waitUntil: 'networkidle',
});
await page.waitForSelector('.ac-radio-tabs', { timeout: 10_000 });
// AcRadioTabs hides the native radio; click the visible label instead.
await page.locator('label.ac-radio-tab', { hasText: /^Filter$/i }).first().click();
await page.waitForTimeout(600);
await page.screenshot({
  path: resolve(OUT_DIR, 'envelope-lcd-filter-tab.png'),
  fullPage: true,
});
await page.locator('label.ac-radio-tab', { hasText: /^Amp$/i }).first().click();
await page.waitForTimeout(600);
await page.screenshot({
  path: resolve(OUT_DIR, 'envelope-lcd-amp-tab.png'),
  fullPage: true,
});
await browser.close();
console.log('OK envelope-lcd-filter-tab');
