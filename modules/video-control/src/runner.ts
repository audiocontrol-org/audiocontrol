import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { generateCaptionsYaml, generateVoScript } from '@/captions.js';
import { burnCaptions, convertToGif, convertToMp4, getVideoDurationMs } from '@/ffmpeg.js';
import type { OutputTier, OverlayMode, ScenarioModule, ScenarioResult } from '@/types.js';

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

  // Capture video reference before closing — Playwright requires this ordering
  const video = page.video();
  if (!video) {
    throw new Error(`No video recorded for scenario "${name}"`);
  }

  // Close page and context to finalize the video file
  await page.close();
  await context.close();
  await browser.close();

  // Playwright saves video as .webm — path is available after close
  const webmPath = await video.path();

  // Convert to MP4 and GIF
  const mp4Path = join(outputDir, 'video.mp4');
  const gifPath = join(outputDir, 'video.gif');

  await convertToMp4(webmPath, mp4Path);
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

    const yamlContent = generateCaptionsYaml(
      name,
      scenario.captions,
      videoDurationMs,
    );
    captionsYamlPath = join(outputDir, 'captions.yaml');
    await writeFile(captionsYamlPath, yamlContent, 'utf-8');

    if (effectiveTier === 'scripted') {
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
    await burnCaptions(mp4Path, captionedMp4Path, scenario.captions);
  }

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
