import { describe, expect, it, vi } from 'vitest';
import { captureEditorFixtureScreenshots } from './playwrightHarness';
import type { VisualEditorFixture } from './visualRegression';

describe('playwrightHarness', () => {
  it('captures each fixture page in order', async () => {
    const page = {
      setViewportSize: vi.fn(),
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      screenshot: vi.fn(),
    };

    const fixture: VisualEditorFixture = {
      editorId: 's330',
      pages: [
        { id: 'connect', path: '/roland/s330/editor/?midi=mock', readySelector: 'h2' },
        { id: 'play', path: '/roland/s330/editor/play?midi=mock', readySelector: 'h2' },
      ],
    };

    const files = await captureEditorFixtureScreenshots(page, fixture, {
      outputDir: 'screenshots',
      filePrefix: 'after',
    });

    expect(page.setViewportSize).toHaveBeenCalledWith({ width: 1366, height: 768 });
    expect(page.goto).toHaveBeenNthCalledWith(1, '/roland/s330/editor/?midi=mock');
    expect(page.goto).toHaveBeenNthCalledWith(2, '/roland/s330/editor/play?midi=mock');
    expect(page.waitForSelector).toHaveBeenCalledTimes(2);
    expect(page.screenshot).toHaveBeenNthCalledWith(1, {
      path: 'screenshots/after-s330-connect.png',
      fullPage: true,
    });
    expect(files).toEqual([
      'screenshots/after-s330-connect.png',
      'screenshots/after-s330-play.png',
    ]);
  });
});
