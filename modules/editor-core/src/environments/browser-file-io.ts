/**
 * Browser FileIO implementation using the File System Access API.
 *
 * Browser globals (showOpenFilePicker, showDirectoryPicker) are ONLY
 * referenced in this file. All other code uses the FileIO interface.
 */

import type {
  FileIO,
  FileHandle,
  DirectoryHandle,
  DirectoryEntry,
  FilePickerOptions,
} from './types';

// ---------------------------------------------------------------------------
// File System Access API type declarations (not yet in all TS libs)
// ---------------------------------------------------------------------------

interface FSAAPickerTypeDescriptor {
  description?: string;
  accept: Record<string, string[]>;
}

interface FSAAOpenFilePickerOptions {
  types?: FSAAPickerTypeDescriptor[];
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
}

declare global {
  interface Window {
    showOpenFilePicker(options?: FSAAOpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

/**
 * Internal handle wrapping a native FileSystemFileHandle.
 */
interface BrowserFileHandle extends FileHandle {
  readonly _native: FileSystemFileHandle;
}

/**
 * Internal handle wrapping a native FileSystemDirectoryHandle.
 */
interface BrowserDirectoryHandle extends DirectoryHandle {
  readonly _native: FileSystemDirectoryHandle;
}

function isBrowserFileHandle(handle: FileHandle): handle is BrowserFileHandle {
  return '_native' in handle;
}

function isBrowserDirectoryHandle(handle: DirectoryHandle): handle is BrowserDirectoryHandle {
  return '_native' in handle;
}

export function createBrowserFileIO(): FileIO {
  return {
    async pickFile(options?: FilePickerOptions): Promise<FileHandle | null> {
      try {
        const pickerOptions: FSAAOpenFilePickerOptions = {};
        if (options?.accept) {
          pickerOptions.types = Object.entries(options.accept).map(([description, extensions]) => ({
            description,
            accept: { [description]: extensions },
          }));
        }
        pickerOptions.multiple = options?.multiple ?? false;

        const [handle] = await window.showOpenFilePicker(pickerOptions);
        return { name: handle.name, kind: 'file', _native: handle } as BrowserFileHandle;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        throw err;
      }
    },

    async pickDirectory(): Promise<DirectoryHandle | null> {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        return { name: handle.name, kind: 'directory', _native: handle } as BrowserDirectoryHandle;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return null;
        throw err;
      }
    },

    async readFile(handle: FileHandle): Promise<ArrayBuffer> {
      if (!isBrowserFileHandle(handle)) {
        throw new Error('Expected a browser file handle');
      }
      const file = await handle._native.getFile();
      return file.arrayBuffer();
    },

    async writeFile(handle: FileHandle, data: ArrayBuffer | Uint8Array): Promise<void> {
      if (!isBrowserFileHandle(handle)) {
        throw new Error('Expected a browser file handle');
      }
      const writable = await (handle._native as unknown as { createWritable(): Promise<WritableStream & { write(d: ArrayBuffer | Uint8Array): Promise<void>; close(): Promise<void> }> }).createWritable();
      await writable.write(data);
      await writable.close();
    },

    async listDirectory(handle: DirectoryHandle): Promise<DirectoryEntry[]> {
      if (!isBrowserDirectoryHandle(handle)) {
        throw new Error('Expected a browser directory handle');
      }
      const entries: DirectoryEntry[] = [];
      for await (const [name, childHandle] of (handle._native as unknown as AsyncIterable<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>)) {
        if (childHandle.kind === 'file') {
          entries.push({
            name,
            kind: 'file',
            handle: { name, kind: 'file', _native: childHandle } as BrowserFileHandle,
          });
        } else {
          entries.push({
            name,
            kind: 'directory',
            handle: { name, kind: 'directory', _native: childHandle } as BrowserDirectoryHandle,
          });
        }
      }
      return entries;
    },
  };
}
