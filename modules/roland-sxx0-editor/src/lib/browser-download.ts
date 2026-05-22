/**
 * Trigger a file download in the browser by creating a transient
 * object URL anchor and clicking it.
 *
 * Extracted 2026-05-22 from `library-io.ts` (as `downloadFile`) +
 * `wave-export.ts` (as `downloadBlob`) per clones.yaml group
 * 5873e17e78bb. Both pre-extraction copies were byte-identical;
 * picked `downloadBlob` as the canonical name because it matches the
 * browser-side terminology (Blob URL, anchor download).
 *
 * The Blob URL is revoked immediately after the click — the browser
 * has already captured the bytes for the download by then, so revoke
 * is safe to fire synchronously.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
