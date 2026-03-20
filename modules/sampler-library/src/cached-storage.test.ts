/**
 * Unit tests for the cached storage decorator.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withCache, StorageCache, CachedStorageDirectoryHandle } from './cached-storage.js';
import type {
  StorageDirectoryHandle,
  StorageFileHandle,
  StorageFile,
  StorageWritable,
  StorageEntry,
} from './storage-handles.js';

// =========================================================================
// Mock implementations
// =========================================================================

function createMockFile(content: string): StorageFile {
  return {
    text: vi.fn().mockResolvedValue(content),
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer),
  };
}

function createMockWritable(): StorageWritable & { writtenData: string | ArrayBuffer | null } {
  const writable = {
    writtenData: null as string | ArrayBuffer | null,
    write: vi.fn().mockImplementation(async (data: string | ArrayBuffer) => {
      writable.writtenData = data;
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return writable;
}

function createMockFileHandle(name: string, content: string): StorageFileHandle {
  const file = createMockFile(content);
  const writable = createMockWritable();
  return {
    name,
    getFile: vi.fn().mockResolvedValue(file),
    createWritable: vi.fn().mockResolvedValue(writable),
  };
}

function createMockDirectoryHandle(
  name: string,
  children: Map<string, StorageDirectoryHandle | StorageFileHandle> = new Map(),
  entries: StorageEntry[] = [],
): StorageDirectoryHandle {
  const handle: StorageDirectoryHandle = {
    name,
    getDirectoryHandle: vi.fn().mockImplementation(async (childName: string, options?: { create?: boolean }) => {
      const existing = children.get(childName);
      if (existing && 'getDirectoryHandle' in existing) {
        return existing;
      }
      if (options?.create) {
        const newDir = createMockDirectoryHandle(childName);
        children.set(childName, newDir);
        return newDir;
      }
      throw new DOMException(`Directory "${childName}" not found`, 'NotFoundError');
    }),
    getFileHandle: vi.fn().mockImplementation(async (childName: string, options?: { create?: boolean }) => {
      const existing = children.get(childName);
      if (existing && 'getFile' in existing) {
        return existing;
      }
      if (options?.create) {
        const newFile = createMockFileHandle(childName, '');
        children.set(childName, newFile);
        return newFile;
      }
      throw new DOMException(`File "${childName}" not found`, 'NotFoundError');
    }),
    removeEntry: vi.fn().mockResolvedValue(undefined),
    values: vi.fn().mockImplementation(async function* () {
      for (const entry of entries) {
        yield entry;
      }
    }),
  };
  return handle;
}

// =========================================================================
// Tests
// =========================================================================

describe('StorageCache', () => {
  let cache: StorageCache;

  beforeEach(() => {
    cache = new StorageCache();
  });

  it('should invalidate a directory and its children', () => {
    // Set up cache entries
    cache.entries.set('samples', [{ kind: 'file', name: 'test.wav' }]);
    cache.entries.set('samples/drums', [{ kind: 'file', name: 'kick.wav' }]);
    cache.entries.set('samples/drums/808', [{ kind: 'file', name: 'kick.wav' }]);
    cache.entries.set('other', [{ kind: 'file', name: 'other.wav' }]);

    // Invalidate samples directory
    cache.invalidate('samples');

    // samples and children should be gone
    expect(cache.entries.has('samples')).toBe(false);
    expect(cache.entries.has('samples/drums')).toBe(false);
    expect(cache.entries.has('samples/drums/808')).toBe(false);
    // other should remain
    expect(cache.entries.has('other')).toBe(true);
  });

  it('should handle case-insensitive path invalidation', () => {
    cache.entries.set('samples/drums', [{ kind: 'file', name: 'kick.wav' }]);

    cache.invalidate('SAMPLES');

    expect(cache.entries.has('samples/drums')).toBe(false);
  });

  it('should clear all caches', () => {
    cache.entries.set('a', []);
    cache.directories.set('b', {} as CachedStorageDirectoryHandle);
    cache.files.set('c', {} as StorageFileHandle as any);
    cache.content.set('d', {} as StorageFile);

    cache.clear();

    expect(cache.entries.size).toBe(0);
    expect(cache.directories.size).toBe(0);
    expect(cache.files.size).toBe(0);
    expect(cache.content.size).toBe(0);
  });
});

describe('withCache', () => {
  it('should return a handle with clearCache method', () => {
    const mock = createMockDirectoryHandle('root');
    const cached = withCache(mock);

    expect(cached.name).toBe('root');
    expect(typeof cached.clearCache).toBe('function');
    expect(typeof cached.getDirectoryHandle).toBe('function');
    expect(typeof cached.getFileHandle).toBe('function');
    expect(typeof cached.removeEntry).toBe('function');
    expect(typeof cached.values).toBe('function');
  });
});

describe('CachedStorageDirectoryHandle', () => {
  describe('getDirectoryHandle', () => {
    it('should cache directory handles on first access', async () => {
      const childDir = createMockDirectoryHandle('samples');
      const root = createMockDirectoryHandle('root', new Map([['samples', childDir]]));
      const cached = withCache(root);

      // First call
      const result1 = await cached.getDirectoryHandle('samples');
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(1);
      expect(result1.name).toBe('samples');

      // Second call should return cached
      const result2 = await cached.getDirectoryHandle('samples');
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(1); // Not called again
      expect(result2).toBe(result1); // Same instance
    });

    it('should bypass cache with create: true', async () => {
      const root = createMockDirectoryHandle('root');
      const cached = withCache(root);

      // Create a directory
      await cached.getDirectoryHandle('newdir', { create: true });
      expect(root.getDirectoryHandle).toHaveBeenCalledWith('newdir', { create: true });

      // Create again should call inner again
      await cached.getDirectoryHandle('newdir', { create: true });
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(2);
    });

    it('should handle case-insensitive cache keys', async () => {
      const childDir = createMockDirectoryHandle('Samples');
      const root = createMockDirectoryHandle('root', new Map([['Samples', childDir]]));
      const cached = withCache(root);

      // Access with different case
      await cached.getDirectoryHandle('Samples');
      await cached.getDirectoryHandle('samples');

      // Should only call inner once (normalized to lowercase)
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFileHandle', () => {
    it('should cache file handles on first access', async () => {
      const file = createMockFileHandle('test.txt', 'hello');
      const root = createMockDirectoryHandle('root', new Map([['test.txt', file]]));
      const cached = withCache(root);

      const result1 = await cached.getFileHandle('test.txt');
      expect(root.getFileHandle).toHaveBeenCalledTimes(1);

      const result2 = await cached.getFileHandle('test.txt');
      expect(root.getFileHandle).toHaveBeenCalledTimes(1); // Not called again
      expect(result2).toBe(result1);
    });

    it('should bypass cache with create: true', async () => {
      const root = createMockDirectoryHandle('root');
      const cached = withCache(root);

      await cached.getFileHandle('new.txt', { create: true });
      await cached.getFileHandle('new.txt', { create: true });

      expect(root.getFileHandle).toHaveBeenCalledTimes(2);
    });
  });

  describe('values', () => {
    it('should cache directory entries on first access', async () => {
      const entries: StorageEntry[] = [
        { kind: 'file', name: 'a.txt' },
        { kind: 'directory', name: 'subdir' },
      ];
      const root = createMockDirectoryHandle('root', new Map(), entries);
      const cached = withCache(root);

      // First iteration
      const result1: StorageEntry[] = [];
      for await (const entry of cached.values()) {
        result1.push(entry);
      }
      expect(root.values).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(entries);

      // Second iteration should use cache
      const result2: StorageEntry[] = [];
      for await (const entry of cached.values()) {
        result2.push(entry);
      }
      expect(root.values).toHaveBeenCalledTimes(1); // Not called again
      expect(result2).toEqual(entries);
    });
  });

  describe('removeEntry', () => {
    it('should invalidate caches after removal', async () => {
      const childDir = createMockDirectoryHandle('samples');
      const root = createMockDirectoryHandle(
        'root',
        new Map([['samples', childDir]]),
        [{ kind: 'directory', name: 'samples' }],
      );
      const cached = withCache(root);

      // Populate caches
      await cached.getDirectoryHandle('samples');
      const entries: StorageEntry[] = [];
      for await (const e of cached.values()) entries.push(e);

      // Remove entry
      await cached.removeEntry('samples');
      expect(root.removeEntry).toHaveBeenCalledWith('samples', undefined);

      // Directory handle should be re-fetched
      await cached.getDirectoryHandle('samples');
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(2);

      // Entries should be re-fetched
      for await (const _ of cached.values()) { /* drain */ }
      expect(root.values).toHaveBeenCalledTimes(2);
    });
  });

  describe('nested handles share cache', () => {
    it('should share cache across nested directory handles', async () => {
      const deepFile = createMockFileHandle('deep.txt', 'deep content');
      const level2 = createMockDirectoryHandle('level2', new Map([['deep.txt', deepFile]]));
      const level1 = createMockDirectoryHandle('level1', new Map([['level2', level2]]));
      const root = createMockDirectoryHandle('root', new Map([['level1', level1]]));
      const cached = withCache(root);

      // Navigate to nested file
      const l1 = await cached.getDirectoryHandle('level1');
      const l2 = await l1.getDirectoryHandle('level2');
      const file = await l2.getFileHandle('deep.txt');
      await file.getFile();

      // Navigate again — should all be cached
      const l1Again = await cached.getDirectoryHandle('level1');
      const l2Again = await l1Again.getDirectoryHandle('level2');
      const fileAgain = await l2Again.getFileHandle('deep.txt');
      await fileAgain.getFile();

      // Each inner method should only have been called once
      expect(root.getDirectoryHandle).toHaveBeenCalledTimes(1);
      expect(level1.getDirectoryHandle).toHaveBeenCalledTimes(1);
      expect(level2.getFileHandle).toHaveBeenCalledTimes(1);
      expect(deepFile.getFile).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CachedStorageFileHandle', () => {
  describe('getFile', () => {
    it('should cache file content', async () => {
      const innerFile = createMockFile('hello world');
      const fileHandle: StorageFileHandle = {
        name: 'test.txt',
        getFile: vi.fn().mockResolvedValue(innerFile),
        createWritable: vi.fn(),
      };
      const root = createMockDirectoryHandle('root', new Map([['test.txt', fileHandle]]));
      const cached = withCache(root);

      const handle = await cached.getFileHandle('test.txt');

      // First read
      const file1 = await handle.getFile();
      const text1 = await file1.text();
      expect(text1).toBe('hello world');
      expect(fileHandle.getFile).toHaveBeenCalledTimes(1);

      // Second read — should be cached
      const file2 = await handle.getFile();
      const text2 = await file2.text();
      expect(text2).toBe('hello world');
      expect(fileHandle.getFile).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('createWritable', () => {
    it('should invalidate caches on close', async () => {
      const innerWritable = createMockWritable();
      const innerFile = createMockFile('original');
      const fileHandle: StorageFileHandle = {
        name: 'test.txt',
        getFile: vi.fn().mockResolvedValue(innerFile),
        createWritable: vi.fn().mockResolvedValue(innerWritable),
      };
      const root = createMockDirectoryHandle(
        'root',
        new Map([['test.txt', fileHandle]]),
        [{ kind: 'file', name: 'test.txt' }],
      );
      const cached = withCache(root);

      // Populate caches
      const handle = await cached.getFileHandle('test.txt');
      await handle.getFile();
      for await (const _ of cached.values()) { /* drain */ }

      // Write to file
      const writable = await handle.createWritable();
      await writable.write('new content');
      await writable.close();

      // File content should be re-fetched
      await handle.getFile();
      expect(fileHandle.getFile).toHaveBeenCalledTimes(2);

      // Entries should be re-fetched
      for await (const _ of cached.values()) { /* drain */ }
      expect(root.values).toHaveBeenCalledTimes(2);
    });
  });
});

describe('clearCache', () => {
  it('should clear all caches and force re-fetch', async () => {
    const childDir = createMockDirectoryHandle('samples');
    const file = createMockFileHandle('test.txt', 'content');
    const children = new Map<string, StorageDirectoryHandle | StorageFileHandle>();
    children.set('samples', childDir);
    children.set('test.txt', file);
    const root = createMockDirectoryHandle(
      'root',
      children,
      [
        { kind: 'directory', name: 'samples' },
        { kind: 'file', name: 'test.txt' },
      ],
    );
    const cached = withCache(root);

    // Populate caches
    await cached.getDirectoryHandle('samples');
    const fh = await cached.getFileHandle('test.txt');
    await fh.getFile();
    for await (const _ of cached.values()) { /* drain */ }

    // Clear cache
    cached.clearCache();

    // All should be re-fetched
    await cached.getDirectoryHandle('samples');
    const fh2 = await cached.getFileHandle('test.txt');
    await fh2.getFile();
    for await (const _ of cached.values()) { /* drain */ }

    expect(root.getDirectoryHandle).toHaveBeenCalledTimes(2);
    expect(root.getFileHandle).toHaveBeenCalledTimes(2);
    expect(file.getFile).toHaveBeenCalledTimes(2);
    expect(root.values).toHaveBeenCalledTimes(2);
  });
});

describe('cache metrics', () => {
  it('should track hits and misses for all cache categories', async () => {
    const childDir = createMockDirectoryHandle('samples');
    const file = createMockFileHandle('test.txt', 'content');
    const children = new Map<string, StorageDirectoryHandle | StorageFileHandle>();
    children.set('samples', childDir);
    children.set('test.txt', file);
    const root = createMockDirectoryHandle(
      'root',
      children,
      [
        { kind: 'directory', name: 'samples' },
        { kind: 'file', name: 'test.txt' },
      ],
    );
    const cached = withCache(root);

    // Initial metrics should be zero
    let metrics = cached.getMetrics();
    expect(metrics.totalHits).toBe(0);
    expect(metrics.totalMisses).toBe(0);
    expect(metrics.hitRate).toBe(0);

    // First access — all misses
    await cached.getDirectoryHandle('samples');
    const fh = await cached.getFileHandle('test.txt');
    await fh.getFile();
    for await (const _ of cached.values()) { /* drain */ }

    metrics = cached.getMetrics();
    expect(metrics.directories.misses).toBe(1);
    expect(metrics.files.misses).toBe(1);
    expect(metrics.content.misses).toBe(1);
    expect(metrics.entries.misses).toBe(1);
    expect(metrics.totalMisses).toBe(4);
    expect(metrics.totalHits).toBe(0);

    // Second access — all hits
    await cached.getDirectoryHandle('samples');
    const fh2 = await cached.getFileHandle('test.txt');
    await fh2.getFile();
    for await (const _ of cached.values()) { /* drain */ }

    metrics = cached.getMetrics();
    expect(metrics.directories.hits).toBe(1);
    expect(metrics.files.hits).toBe(1);
    expect(metrics.content.hits).toBe(1);
    expect(metrics.entries.hits).toBe(1);
    expect(metrics.totalHits).toBe(4);
    expect(metrics.totalMisses).toBe(4);
    expect(metrics.hitRate).toBe(0.5); // 4 hits / 8 total
  });

  it('should track cache sizes', async () => {
    const childDir = createMockDirectoryHandle('samples');
    const file = createMockFileHandle('test.txt', 'content');
    const children = new Map<string, StorageDirectoryHandle | StorageFileHandle>();
    children.set('samples', childDir);
    children.set('test.txt', file);
    const root = createMockDirectoryHandle(
      'root',
      children,
      [{ kind: 'file', name: 'test.txt' }],
    );
    const cached = withCache(root);

    // Access items to populate cache
    await cached.getDirectoryHandle('samples');
    const fh = await cached.getFileHandle('test.txt');
    await fh.getFile();
    for await (const _ of cached.values()) { /* drain */ }

    const metrics = cached.getMetrics();
    expect(metrics.directories.size).toBe(1);
    expect(metrics.files.size).toBe(1);
    expect(metrics.content.size).toBe(1);
    expect(metrics.entries.size).toBe(1);
  });

  it('should track invalidations and clears', async () => {
    const childDir = createMockDirectoryHandle('samples');
    const root = createMockDirectoryHandle('root', new Map([['samples', childDir]]));
    const cached = withCache(root);

    // Populate cache
    await cached.getDirectoryHandle('samples');

    // Clear should increment clears counter
    cached.clearCache();
    let metrics = cached.getMetrics();
    expect(metrics.clears).toBe(1);

    // Populate again and remove entry
    await cached.getDirectoryHandle('samples');
    await cached.removeEntry('samples');

    metrics = cached.getMetrics();
    expect(metrics.invalidations).toBe(1);
  });

  it('should reset metrics', async () => {
    const childDir = createMockDirectoryHandle('samples');
    const root = createMockDirectoryHandle('root', new Map([['samples', childDir]]));
    const cached = withCache(root);

    // Generate some metrics
    await cached.getDirectoryHandle('samples');
    await cached.getDirectoryHandle('samples');
    cached.clearCache();

    let metrics = cached.getMetrics();
    expect(metrics.totalHits).toBeGreaterThan(0);
    expect(metrics.clears).toBe(1);

    // Reset
    cached.resetMetrics();

    metrics = cached.getMetrics();
    expect(metrics.totalHits).toBe(0);
    expect(metrics.totalMisses).toBe(0);
    expect(metrics.clears).toBe(0);
    expect(metrics.invalidations).toBe(0);
    // Sizes should still reflect actual cache contents
    expect(metrics.directories.size).toBe(0); // Cleared
  });
});
