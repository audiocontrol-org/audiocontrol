/**
 * Unit tests for `downloadBlob` — the 9-line browser util that lives in
 * editor-core (promoted from roland-sxx0-editor 2026-05-23 per
 * ROLAND-BUGFIX-RGM-001 sub-task 4 #455).
 *
 * Pins the four observable side effects (createObjectURL, anchor
 * mount + click, DOM cleanup, revokeObjectURL) that any "botched"
 * rewrite could silently break.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from './browser-download';

const STUB_URL = 'blob:http://localhost/abcdef-1234-5678';

// jsdom doesn't provide URL.createObjectURL / revokeObjectURL by
// default. Define no-op stubs so vi.spyOn has something to wrap.
beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: (_blob: Blob) => '',
    });
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: (_url: string) => undefined,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadBlob', () => {
  it('mounts an anchor with the createObjectURL href + the filename, clicks it, then revokes the URL and removes the anchor', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(STUB_URL);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const blob = new Blob(['some bytes'], { type: 'application/octet-stream' });
    const filename = 'tone_T11.wav';

    downloadBlob(blob, filename);

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(blob);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchorAtClick = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchorAtClick.href).toBe(STUB_URL);
    expect(anchorAtClick.download).toBe(filename);

    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(STUB_URL);

    expect(document.querySelectorAll('a').length).toBe(0);
  });
});
