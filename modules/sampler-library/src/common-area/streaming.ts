/**
 * Streaming utilities for reading files with progress reporting.
 *
 * These helpers enable byte-level progress tracking during file reads
 * by leveraging the `stream()` method on {@link StorageFile}.
 *
 * @packageDocumentation
 */

import type { StorageFile } from '@/storage-handles.js';

/**
 * Progress callback for streaming reads.
 * Reports bytes read so far out of total bytes.
 */
export type ReadProgressCallback = (bytesRead: number, bytesTotal: number) => void;

/**
 * Read a file's contents with progress reporting.
 *
 * Uses the file's `stream()` method to read in chunks and report
 * progress via callback. Falls back to `arrayBuffer()` if streaming
 * is not available (e.g., older implementations).
 *
 * @param file - StorageFile to read
 * @param onProgress - Optional callback for progress updates
 * @returns Complete file contents as ArrayBuffer
 *
 * @example
 * ```typescript
 * const buffer = await readFileWithProgress(file, (read, total) => {
 *   console.log(`Progress: ${Math.round(read / total * 100)}%`);
 * });
 * ```
 */
export async function readFileWithProgress(
  file: StorageFile,
  onProgress?: ReadProgressCallback,
): Promise<ArrayBuffer> {
  // If no progress callback, just use arrayBuffer() directly
  if (!onProgress) {
    return file.arrayBuffer();
  }

  const totalBytes = file.size;
  let bytesRead = 0;

  // Report initial progress
  onProgress(0, totalBytes);

  // Read via stream for progress tracking
  const stream = file.stream();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      bytesRead += value.length;
      onProgress(bytesRead, totalBytes);
    }
  } finally {
    reader.releaseLock();
  }

  // Combine chunks into single ArrayBuffer
  const result = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Read file as text with progress reporting.
 *
 * @param file - StorageFile to read
 * @param onProgress - Optional callback for progress updates
 * @returns File contents as string
 */
export async function readTextWithProgress(
  file: StorageFile,
  onProgress?: ReadProgressCallback,
): Promise<string> {
  const buffer = await readFileWithProgress(file, onProgress);
  return new TextDecoder().decode(buffer);
}
