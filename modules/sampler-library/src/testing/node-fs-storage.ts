/**
 * Node.js filesystem implementation of StorageDirectoryHandle.
 *
 * Wraps fs/promises to satisfy the same interface as browser FSAA handles,
 * enabling library operations (promoteToCommonArea, loadChoppedSample, etc.)
 * to run in Node tests against a real filesystem.
 */

import { mkdir, readdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type {
  StorageEntry,
  StorageFile,
  StorageWritable,
  StorageFileHandle,
  StorageDirectoryHandle,
} from '../storage-handles.js';

class NodeFile implements StorageFile {
  constructor(private path: string, private data: Buffer) {}

  get size(): number {
    return this.data.byteLength;
  }

  async text(): Promise<string> {
    return this.data.toString('utf-8');
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const copy = new Uint8Array(this.data.byteLength);
    copy.set(this.data);
    return copy.buffer;
  }

  stream(): ReadableStream<Uint8Array> {
    const data = this.data;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      },
    });
  }
}

class NodeWritable implements StorageWritable {
  private chunks: (string | ArrayBuffer)[] = [];

  constructor(private filePath: string) {}

  async write(data: string | ArrayBuffer): Promise<void> {
    this.chunks.push(data);
  }

  async close(): Promise<void> {
    for (const chunk of this.chunks) {
      if (typeof chunk === 'string') {
        await writeFile(this.filePath, chunk, 'utf-8');
      } else {
        await writeFile(this.filePath, Buffer.from(chunk));
      }
    }
  }
}

class NodeFileHandle implements StorageFileHandle {
  readonly name: string;
  private filePath: string;

  constructor(filePath: string, name: string) {
    this.filePath = filePath;
    this.name = name;
  }

  async getFile(): Promise<StorageFile> {
    const data = await readFile(this.filePath);
    return new NodeFile(this.filePath, data);
  }

  async createWritable(): Promise<StorageWritable> {
    return new NodeWritable(this.filePath);
  }
}

export class NodeDirectoryHandle implements StorageDirectoryHandle {
  readonly name: string;
  private dirPath: string;

  constructor(dirPath: string, name?: string) {
    this.dirPath = dirPath;
    this.name = name ?? dirPath.split('/').pop() ?? '';
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle> {
    const childPath = join(this.dirPath, name);
    if (options?.create) {
      await mkdir(childPath, { recursive: true });
    }
    // Verify it exists
    const s = await stat(childPath);
    if (!s.isDirectory()) {
      throw new Error(`Not a directory: ${childPath}`);
    }
    return new NodeDirectoryHandle(childPath, name);
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle> {
    const filePath = join(this.dirPath, name);
    if (options?.create) {
      // Ensure parent exists
      await mkdir(this.dirPath, { recursive: true });
      // Touch the file if it doesn't exist
      try {
        await stat(filePath);
      } catch {
        await writeFile(filePath, '');
      }
    }
    return new NodeFileHandle(filePath, name);
  }

  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const childPath = join(this.dirPath, name);
    await rm(childPath, { recursive: options?.recursive ?? false, force: true });
  }

  async *values(): AsyncIterable<StorageEntry> {
    const entries = await readdir(this.dirPath, { withFileTypes: true });
    for (const entry of entries) {
      yield {
        kind: entry.isDirectory() ? 'directory' : 'file',
        name: entry.name,
      };
    }
  }
}

/**
 * Create a StorageDirectoryHandle backed by a real filesystem directory.
 * The directory is created if it doesn't exist.
 */
export async function createNodeStorage(dirPath: string): Promise<StorageDirectoryHandle> {
  await mkdir(dirPath, { recursive: true });
  return new NodeDirectoryHandle(dirPath);
}
