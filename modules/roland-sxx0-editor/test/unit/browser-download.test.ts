/**
 * Unit tests for `downloadBlob` — the 9-line browser util promoted to
 * `src/lib/browser-download.ts` in commit `ae0b5192` per clones.yaml
 * 5873e17e78bb refactor.
 *
 * Closes AUDIT-20260522-12: the original `5873e17e78bb` refactor row
 * recorded "No protecting test added" with the argument that the
 * function is too trivial to need one. Per the workplan refactor
 * protocol, "if you have to argue for it, write the new test instead"
 * — so this file is that test. It pins the four observable side
 * effects (createObjectURL, anchor mount + click, DOM cleanup,
 * revokeObjectURL) that any "botched" rewrite could silently break.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob } from '@/lib/browser-download';

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

    // createObjectURL fires exactly once with the blob.
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(blob);

    // The anchor click fires exactly once. The anchor element at click
    // time carried href === STUB_URL and download === filename.
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchorAtClick = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchorAtClick.href).toBe(STUB_URL);
    expect(anchorAtClick.download).toBe(filename);

    // revokeObjectURL fires exactly once with the same URL.
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(STUB_URL);

    // DOM cleanup — no orphan <a> left behind on the document.
    expect(document.querySelectorAll('a').length).toBe(0);
  });
});
