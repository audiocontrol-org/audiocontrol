/**
 * File System Access API global type declarations.
 *
 * These augment the global scope so that browser code using raw FSAA
 * handles compiles without errors. The declarations are intentionally
 * compatible with {@link StorageDirectoryHandle} et al. from
 * `./storage-handles.ts` — FSAA handles satisfy the abstract interfaces
 * via structural typing.
 *
 * Import this module (side-effect only) in any file that uses raw
 * FSAA globals like `FileSystemDirectoryHandle`.
 *
 * @packageDocumentation
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

declare global {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterable<FileSystemHandle>;
  }
}

export {};
