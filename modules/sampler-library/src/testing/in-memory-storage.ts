/**
 * In-memory implementation of StorageDirectoryHandle and friends.
 *
 * Satisfies the same interface as the browser FSAA handles, enabling
 * library operations (loadSample, listCommonSamplesTree, etc.) to run
 * against generated data without filesystem access.
 *
 * Used by: mock library mode (?library=mock), unit tests.
 */

import type {
  StorageEntry,
  StorageFile,
  StorageWritable,
  StorageFileHandle,
  StorageDirectoryHandle,
} from '../storage-handles.js';

export class InMemoryFile implements StorageFile {
  constructor(private data: Uint8Array) {}

  get size(): number {
    return this.data.byteLength;
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this.data);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    // Copy to a fresh ArrayBuffer to avoid SharedArrayBuffer issues
    const copy = new Uint8Array(this.data.byteLength);
    copy.set(this.data);
    return copy.buffer as ArrayBuffer;
  }

  stream(): ReadableStream<Uint8Array> {
    const data = this.data;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  /** Replace the file content (used by InMemoryWritable). */
  _setData(data: Uint8Array): void {
    this.data = data;
  }
}

class InMemoryWritable implements StorageWritable {
  private chunks: Uint8Array[] = [];

  constructor(private file: InMemoryFile) {}

  async write(data: string | ArrayBuffer): Promise<void> {
    if (typeof data === 'string') {
      this.chunks.push(new TextEncoder().encode(data));
    } else {
      this.chunks.push(new Uint8Array(data));
    }
  }

  async close(): Promise<void> {
    const totalLength = this.chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    this.file._setData(merged);
  }
}

export class InMemoryFileHandle implements StorageFileHandle {
  private file: InMemoryFile;

  constructor(
    public readonly name: string,
    data: Uint8Array = new Uint8Array(0),
  ) {
    this.file = new InMemoryFile(data);
  }

  async getFile(): Promise<StorageFile> {
    return this.file;
  }

  async createWritable(): Promise<StorageWritable> {
    return new InMemoryWritable(this.file);
  }
}

type Entry = InMemoryDirectoryHandle | InMemoryFileHandle;

export class InMemoryDirectoryHandle implements StorageDirectoryHandle {
  private entries = new Map<string, Entry>();

  constructor(public readonly name: string) {}

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle> {
    const existing = this.entries.get(name);
    if (existing instanceof InMemoryDirectoryHandle) return existing;
    if (existing) throw new Error(`"${name}" is not a directory`);
    if (options?.create) {
      const dir = new InMemoryDirectoryHandle(name);
      this.entries.set(name, dir);
      return dir;
    }
    throw new DOMException(`Directory "${name}" not found`, 'NotFoundError');
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle> {
    const existing = this.entries.get(name);
    if (existing instanceof InMemoryFileHandle) return existing;
    if (existing) throw new Error(`"${name}" is not a file`);
    if (options?.create) {
      const fh = new InMemoryFileHandle(name);
      this.entries.set(name, fh);
      return fh;
    }
    throw new DOMException(`File "${name}" not found`, 'NotFoundError');
  }

  async removeEntry(
    _name: string,
    _options?: { recursive?: boolean },
  ): Promise<void> {
    if (!this.entries.has(_name)) {
      throw new DOMException(`"${_name}" not found`, 'NotFoundError');
    }
    this.entries.delete(_name);
  }

  async *values(): AsyncIterable<StorageEntry> {
    for (const [name, entry] of this.entries) {
      yield {
        kind: entry instanceof InMemoryDirectoryHandle ? 'directory' : 'file',
        name,
      };
    }
  }

  /** Add a pre-built subdirectory. */
  addDirectory(dir: InMemoryDirectoryHandle): void {
    this.entries.set(dir.name, dir);
  }

  /** Add a pre-built file. */
  addFile(fh: InMemoryFileHandle): void {
    this.entries.set(fh.name, fh);
  }
}
