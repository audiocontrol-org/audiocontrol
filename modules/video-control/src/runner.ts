import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { generateCaptionsYaml, generateVoScript } from '@/captions.js';
import { burnCaptions, convertToGif, convertToMp4, getVideoDurationMs } from '@/ffmpeg.js';
import type { OutputTier, OverlayMode, ProgressCallback, ScenarioModule, ScenarioResult } from '@/types.js';

export interface RunScenarioOptions {
  /** URL to navigate to before running the scenario */
  url: string;
  /** Base output directory (defaults to dist/demos) */
  outputBase?: string;
  /** Viewport width (default 1280) */
  width?: number;
  /** Viewport height (default 720) */
  height?: number;
  /** Output tier override (defaults to scenario's own metadata.outputTier) */
  tier?: OutputTier;
  /** Caption overlay mode (defaults to 'none') */
  overlay?: OverlayMode;
  /** Progress callback invoked at each pipeline step transition */
  onProgress?: ProgressCallback;
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

  const { onProgress } = options;

  if (onProgress) onProgress('launching-browser');
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
  if (onProgress) onProgress('recording-scenario');
  await scenario.run(page);

  // Capture video reference before closing — Playwright requires this ordering
  const video = page.video();
  if (!video) {
    throw new Error(`No video recorded for scenario "${name}"`);
  }

  // Finalize the video: close page and context to flush the recording.
  if (onProgress) onProgress('finalizing-video');
  await page.close();
  await context.close();
  await browser.close();

  // Playwright writes the webm asynchronously. video.path() returns
  // the intended path, but the file may not exist yet. Poll until it does.
  const webmPath = await video.path();
  const { existsSync } = await import('node:fs');
  const maxWaitMs = 5000;
  const pollMs = 100;
  let waited = 0;
  while (!existsSync(webmPath) && waited < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    waited += pollMs;
  }
  if (!existsSync(webmPath)) {
    throw new Error(`Video file not found after ${maxWaitMs}ms: ${webmPath}`);
  }

  // Convert to MP4 and GIF
  const mp4Path = join(outputDir, 'video.mp4');
  const gifPath = join(outputDir, 'video.gif');

  if (onProgress) onProgress('converting-mp4');
  await convertToMp4(webmPath, mp4Path);
  if (onProgress) onProgress('converting-gif');
  await convertToGif(webmPath, gifPath);

  // Generate caption outputs if the scenario has captions and the tier calls for them
  const effectiveTier = options.tier ?? scenario.metadata.outputTier;
  const effectiveOverlay = options.overlay ?? 'none';
  let captionsYamlPath: string | undefined;
  let voScriptPath: string | undefined;
  let captionedMp4Path: string | undefined;

  if (
    scenario.captions &&
    scenario.captions.length > 0 &&
    (effectiveTier === 'captioned' || effectiveTier === 'scripted')
  ) {
    const videoDurationMs = await getVideoDurationMs(mp4Path);

    if (onProgress) onProgress('generating-captions');
    const yamlContent = generateCaptionsYaml(
      name,
      scenario.captions,
      videoDurationMs,
    );
    captionsYamlPath = join(outputDir, 'captions.yaml');
    await writeFile(captionsYamlPath, yamlContent, 'utf-8');

    if (effectiveTier === 'scripted') {
      if (onProgress) onProgress('generating-vo-script');
      const voContent = generateVoScript(
        name,
        scenario.captions,
        videoDurationMs,
      );
      voScriptPath = join(outputDir, 'vo-script.txt');
      await writeFile(voScriptPath, voContent, 'utf-8');
    }
  }

  // Burn captions into the video if overlay mode requests it
  if (
    scenario.captions &&
    scenario.captions.length > 0 &&
    (effectiveOverlay === 'burned' || effectiveOverlay === 'both')
  ) {
    captionedMp4Path = join(outputDir, 'video-captioned.mp4');
    if (onProgress) onProgress('burning-captions');
    await burnCaptions(mp4Path, captionedMp4Path, scenario.captions);
  }

  if (onProgress) onProgress('complete');

  return {
    scenarioName: name,
    outputDir,
    mp4Path,
    gifPath,
    captionedMp4Path,
    captionsYamlPath,
    voScriptPath,
    metadata: scenario.metadata,
  };
}
