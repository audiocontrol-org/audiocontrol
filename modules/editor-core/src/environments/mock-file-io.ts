/**
 * Mock FileIO implementation for testing.
 *
 * Follows the createMockMidiTransport pattern: returns { impl, controls }
 * where impl satisfies the interface and controls allow test assertions.
 */

import type {
  FileIO,
  FileHandle,
  DirectoryHandle,
  DirectoryEntry,
  FilePickerOptions,
} from './types';

export interface MockFileEntry {
  name: string;
  data: ArrayBuffer;
}

export interface MockDirectoryEntry {
  name: string;
  children: Array<MockFileEntry | MockDirectoryEntry>;
}

function isMockDir(entry: MockFileEntry | MockDirectoryEntry): entry is MockDirectoryEntry {
  return 'children' in entry;
}

export interface MockFileIOControls {
  /** Set the file that pickFile will return. Null simulates cancellation. */
  setPickedFile(entry: MockFileEntry | null): void;
  /** Set the directory that pickDirectory will return. Null simulates cancellation. */
  setPickedDirectory(entry: MockDirectoryEntry | null): void;
  /** Get all data written via writeFile, keyed by file name. */
  getWrittenFiles(): Map<string, ArrayBuffer>;
  /** Add a file to the virtual filesystem for readFile. */
  addFile(name: string, data: ArrayBuffer): void;
  /** Add a directory with children for listDirectory. */
  addDirectory(name: string, children: Array<MockFileEntry | MockDirectoryEntry>): void;
}

export function createMockFileIO(): { impl: FileIO; controls: MockFileIOControls } {
  let pickedFile: MockFileEntry | null = null;
  let pickedDirectory: MockDirectoryEntry | null = null;
  const files = new Map<string, ArrayBuffer>();
  const directories = new Map<string, Array<MockFileEntry | MockDirectoryEntry>>();
  const writtenFiles = new Map<string, ArrayBuffer>();

  const impl: FileIO = {
    async pickFile(_options?: FilePickerOptions): Promise<FileHandle | null> {
      if (!pickedFile) return null;
      return { name: pickedFile.name, kind: 'file' };
    },

    async pickDirectory(): Promise<DirectoryHandle | null> {
      if (!pickedDirectory) return null;
      return { name: pickedDirectory.name, kind: 'directory' };
    },

    async readFile(handle: FileHandle): Promise<ArrayBuffer> {
      const data = files.get(handle.name);
      if (!data) throw new Error(`File not found: ${handle.name}`);
      return data.slice(0);
    },

    async writeFile(handle: FileHandle, data: ArrayBuffer | Uint8Array): Promise<void> {
      const buffer = data instanceof ArrayBuffer
        ? data
        : new Uint8Array(data).buffer as ArrayBuffer;
      writtenFiles.set(handle.name, buffer);
    },

    async listDirectory(handle: DirectoryHandle): Promise<DirectoryEntry[]> {
      const children = directories.get(handle.name);
      if (!children) throw new Error(`Directory not found: ${handle.name}`);
      return children.map((child) => {
        if (isMockDir(child)) {
          return { name: child.name, kind: 'directory' as const, handle: { name: child.name, kind: 'directory' as const } };
        }
        return { name: child.name, kind: 'file' as const, handle: { name: child.name, kind: 'file' as const } };
      });
    },
  };

  const controls: MockFileIOControls = {
    setPickedFile(entry) {
      pickedFile = entry;
      if (entry) {
        files.set(entry.name, entry.data);
      }
    },
    setPickedDirectory(entry) {
      pickedDirectory = entry;
      if (entry) {
        directories.set(entry.name, entry.children);
      }
    },
    getWrittenFiles() {
      return new Map(writtenFiles);
    },
    addFile(name, data) {
      files.set(name, data);
    },
    addDirectory(name, children) {
      directories.set(name, children);
    },
  };

  return { impl, controls };
}
