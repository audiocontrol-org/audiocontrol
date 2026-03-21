/**
 * Abstract filesystem handle interfaces for library storage.
 *
 * These interfaces mirror the shape of the browser File System Access API
 * (FSAA) so that FSAA handles satisfy them via TypeScript structural typing
 * — no adapter needed in the browser. A Node.js adapter wrapping `fs/promises`
 * can implement the same interfaces for CLI and test use.
 *
 * All library scanners and CRUD operations accept these types instead of
 * raw FSAA globals, making the library layer portable across runtimes.
 *
 * @packageDocumentation
 */

/**
 * Minimal entry metadata returned when iterating a directory.
 */
export interface StorageEntry {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

/**
 * Abstract readable file content.
 * In browsers this is satisfied by the native `File` object.
 */
export interface StorageFile {
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  /**
   * Return a readable stream of the file content.
   * Enables progress tracking during reads on high-latency backends.
   */
  stream(): ReadableStream<Uint8Array>;
  /** File size in bytes. */
  readonly size: number;
}

/**
 * Optional metadata for cache validation on high-latency backends.
 *
 * Backends may provide this information to enable smarter cache invalidation
 * (e.g., skip re-fetch if mtime matches). Not all backends support
 * this — local FSAA does, Google Drive can derive it from API responses,
 * NFS/SMB varies by implementation.
 *
 * Note: `size` is now part of the base `StorageFile` interface.
 */
export interface StorageFileMetadata {
  /** Last modification time (ms since epoch). */
  readonly lastModified?: number;
}

/**
 * Extended file content with optional metadata.
 * Backends that support metadata should return this from `getFile()`.
 */
export interface StorageFileWithMetadata extends StorageFile, StorageFileMetadata {}

/**
 * Writable stream for creating or overwriting a file.
 * In browsers this is satisfied by `FileSystemWritableFileStream`.
 */
export interface StorageWritable {
  write(data: string | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

/**
 * Abstract handle to a file in the storage tree.
 * In browsers this is satisfied by `FileSystemFileHandle`.
 */
export interface StorageFileHandle {
  readonly name: string;
  getFile(): Promise<StorageFile>;
  createWritable(): Promise<StorageWritable>;
}

/**
 * Abstract handle to a directory in the storage tree.
 * In browsers this is satisfied by `FileSystemDirectoryHandle`.
 */
export interface StorageDirectoryHandle {
  readonly name: string;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle>;
  removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void>;
  values(): AsyncIterable<StorageEntry>;
}
