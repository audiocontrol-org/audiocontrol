/**
 * Trigger a file download in the browser by creating a transient
 * object URL anchor and clicking it.
 *
 * Promoted to editor-core 2026-05-23 from
 * `modules/roland-sxx0-editor/src/lib/browser-download.ts` per
 * ROLAND-BUGFIX-RGM-001 sub-task 4 (#455). The roland-side wrapper
 * (`roland-sxx0-editor/src/lib/browser-download.ts`) re-exports this
 * symbol for back-compat with existing call sites in
 * `wave-export.ts` + `library-tones.ts`. Cross-editor consumers (e.g.
 * `akai-s3k-editor/src/components/samples/SampleTransferPanel.tsx`)
 * import directly from `@audiocontrol/editor-core`.
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
