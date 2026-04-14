import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { ScenarioModule, ScenarioResult } from '@/types.js';
import { convertToGif, convertToMp4 } from '@/ffmpeg.js';

export interface RunScenarioOptions {
  /** URL to navigate to before running the scenario */
  url: string;
  /** Base output directory (defaults to dist/demos) */
  outputBase?: string;
  /** Viewport width (default 1280) */
  width?: number;
  /** Viewport height (default 720) */
  height?: number;
}

export async function runScenario(
  scenario: ScenarioModule,
  options: RunScenarioOptions,
): Promise<ScenarioResult> {
  const { name } = scenario.metadata;
  const outputBase =
    options.outputBase ?? join(process.cwd(), 'dist', 'demos');
  const outputDir = join(outputBase, name);
  const width = options.width ?? 1280;
  const height = options.height ?? 720;

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: outputDir,
      size: { width, height },
    },
  });

  const page = await context.newPage();

  // tsx/esbuild injects __name() calls for keepNames. When Playwright
  // serializes functions for page.evaluate(), __name doesn't exist in
  // the browser context. Define it as a passthrough.
  await page.addInitScript('window.__name = function(fn) { return fn; };');

  await page.goto(options.url);
  await scenario.run(page);

  // Close page and context to finalize the video
  await page.close();
  await context.close();

  // Playwright saves video as .webm -- find it
  const video = page.video();
  if (!video) {
    throw new Error(`No video recorded for scenario "${name}"`);
  }
  const webmPath = await video.path();

  // Convert to MP4 and GIF
  const mp4Path = join(outputDir, 'video.mp4');
  const gifPath = join(outputDir, 'video.gif');

  await convertToMp4(webmPath, mp4Path);
  await convertToGif(webmPath, gifPath);

  await browser.close();

  return {
    scenarioName: name,
    outputDir,
    mp4Path,
    gifPath,
    metadata: scenario.metadata,
  };
}
