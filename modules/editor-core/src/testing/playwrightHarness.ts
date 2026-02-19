import {
  type VisualEditorFixture,
  type VisualViewport,
  DEFAULT_VISUAL_VIEWPORT,
} from './visualRegression';

export interface PlaywrightPageLike {
  setViewportSize: (size: { width: number; height: number }) => Promise<void> | void;
  goto: (url: string) => Promise<unknown>;
  waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<unknown>;
}

export interface CaptureFixtureOptions {
  outputDir: string;
  filePrefix?: string;
  fullPage?: boolean;
  viewport?: VisualViewport;
}

export async function captureEditorFixtureScreenshots(
  page: PlaywrightPageLike,
  fixture: VisualEditorFixture,
  options: CaptureFixtureOptions
): Promise<string[]> {
  const viewport = options.viewport ?? DEFAULT_VISUAL_VIEWPORT;
  const filePrefix = options.filePrefix ? `${options.filePrefix}-` : '';
  const fullPage = options.fullPage ?? true;
  const files: string[] = [];

  await page.setViewportSize(viewport);

  for (const pageFixture of fixture.pages) {
    await page.goto(pageFixture.path);
    await page.waitForSelector(pageFixture.readySelector, { timeout: 15_000 });
    if (pageFixture.waitMs && pageFixture.waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pageFixture.waitMs));
    }

    const file = `${options.outputDir}/${filePrefix}${fixture.editorId}-${pageFixture.id}.png`;
    await page.screenshot({ path: file, fullPage });
    files.push(file);
  }

  return files;
}
