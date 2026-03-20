/**
 * Backend-agnostic caching decorator for StorageDirectoryHandle.
 *
 * Wraps any {@link StorageDirectoryHandle} with read-through/write-through
 * caching. All operations through the wrapped handle tree benefit from
 * caching without changes to the underlying storage backend.
 *
 * Cache keys use normalized logical paths (lowercase, forward slashes,
 * no trailing slashes) so the cache works identically across backends.
 *
 * @example
 * ```typescript
 * const root = withCache(conn.getRoot());
 * // All operations through `root` are now cached
 * const samples = await root.getDirectoryHandle('samples');
 * // Second call returns cached handle, no network request
 * const samples2 = await root.getDirectoryHandle('samples');
 * ```
 *
 * @packageDocumentation
 */

import type {
  StorageDirectoryHandle,
  StorageFileHandle,
  StorageFile,
  StorageWritable,
  StorageEntry,
} from './storage-handles.js';

// =========================================================================
// Path normalization
// =========================================================================

/**
 * Normalize a path for use as a cache key.
 * - Lowercase
 * - Forward slashes only
 * - No trailing slash
 * - No leading slash
 */
function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .replace(/^\/+/, '');
}

/**
 * Join path segments into a normalized cache key.
 */
function joinPath(base: string, name: string): string {
  const normalizedBase = normalizePath(base);
  const normalizedName = normalizePath(name);
  if (!normalizedBase) return normalizedName;
  return `${normalizedBase}/${normalizedName}`;
}

// =========================================================================
// StorageCache — shared cache state
// =========================================================================

/**
 * Shared cache state for a handle tree.
 *
 * All handles created from a cached root share the same `StorageCache`
 * instance, ensuring cache coherence across the tree.
 */
export class StorageCache {
  /** Cached directory listings: path -> StorageEntry[] */
  readonly entries = new Map<string, StorageEntry[]>();

  /** Cached directory handles: path -> CachedStorageDirectoryHandle */
  readonly directories = new Map<string, CachedStorageDirectoryHandle>();

  /** Cached file handles: path -> CachedStorageFileHandle */
  readonly files = new Map<string, CachedStorageFileHandle>();

  /** Cached file contents: path -> StorageFile */
  readonly content = new Map<string, StorageFile>();

  /**
   * Invalidate a directory's cached entries and all children under that path.
   */
  invalidate(path: string): void {
    const normalizedPath = normalizePath(path);
    const prefix = normalizedPath ? `${normalizedPath}/` : '';

    // Remove this path and all children from all caches
    this.entries.delete(normalizedPath);
    this.directories.delete(normalizedPath);
    this.files.delete(normalizedPath);
    this.content.delete(normalizedPath);

    // Remove all children (paths starting with this path + /)
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
    for (const key of this.directories.keys()) {
      if (key.startsWith(prefix)) {
        this.directories.delete(key);
      }
    }
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
      }
    }
    for (const key of this.content.keys()) {
      if (key.startsWith(prefix)) {
        this.content.delete(key);
      }
    }
  }

  /**
   * Invalidate a single file's content cache.
   */
  invalidateFile(path: string): void {
    const normalizedPath = normalizePath(path);
    this.content.delete(normalizedPath);
    this.files.delete(normalizedPath);
  }

  /**
   * Clear all caches.
   */
  clear(): void {
    this.entries.clear();
    this.directories.clear();
    this.files.clear();
    this.content.clear();
  }
}

// =========================================================================
// CachedStorageDirectoryHandle
// =========================================================================

/**
 * Caching decorator for {@link StorageDirectoryHandle}.
 *
 * Implements the same interface as the inner handle but caches results
 * to avoid repeated network/filesystem calls on high-latency backends.
 */
export class CachedStorageDirectoryHandle implements StorageDirectoryHandle {
  readonly name: string;

  constructor(
    private readonly inner: StorageDirectoryHandle,
    private readonly cache: StorageCache,
    private readonly path: string,
  ) {
    this.name = inner.name;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle> {
    const childPath = joinPath(this.path, name);

    // Create mode always delegates to inner and invalidates cache
    if (options?.create) {
      const handle = await this.inner.getDirectoryHandle(name, options);
      this.cache.entries.delete(normalizePath(this.path));
      const cached = new CachedStorageDirectoryHandle(handle, this.cache, childPath);
      this.cache.directories.set(normalizePath(childPath), cached);
      return cached;
    }

    // Check cache first
    const normalizedChildPath = normalizePath(childPath);
    const cachedHandle = this.cache.directories.get(normalizedChildPath);
    if (cachedHandle) {
      return cachedHandle;
    }

    // Cache miss — fetch from inner
    const handle = await this.inner.getDirectoryHandle(name);
    const cached = new CachedStorageDirectoryHandle(handle, this.cache, childPath);
    this.cache.directories.set(normalizedChildPath, cached);
    return cached;
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle> {
    const childPath = joinPath(this.path, name);

    // Create mode always delegates to inner and invalidates cache
    if (options?.create) {
      const handle = await this.inner.getFileHandle(name, options);
      this.cache.entries.delete(normalizePath(this.path));
      const cached = new CachedStorageFileHandle(handle, this.cache, childPath, this.path);
      this.cache.files.set(normalizePath(childPath), cached);
      return cached;
    }

    // Check cache first
    const normalizedChildPath = normalizePath(childPath);
    const cachedHandle = this.cache.files.get(normalizedChildPath);
    if (cachedHandle) {
      return cachedHandle;
    }

    // Cache miss — fetch from inner
    const handle = await this.inner.getFileHandle(name);
    const cached = new CachedStorageFileHandle(handle, this.cache, childPath, this.path);
    this.cache.files.set(normalizedChildPath, cached);
    return cached;
  }

  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const childPath = joinPath(this.path, name);

    // Delegate to inner
    await this.inner.removeEntry(name, options);

    // Invalidate this directory's entries and all children of the removed entry
    this.cache.entries.delete(normalizePath(this.path));
    this.cache.invalidate(childPath);
  }

  async *values(): AsyncIterable<StorageEntry> {
    const normalizedPath = normalizePath(this.path);

    // Check cache first
    const cachedEntries = this.cache.entries.get(normalizedPath);
    if (cachedEntries) {
      for (const entry of cachedEntries) {
        yield entry;
      }
      return;
    }

    // Cache miss — fetch from inner and collect entries
    const entries: StorageEntry[] = [];
    for await (const entry of this.inner.values()) {
      entries.push(entry);
    }

    // Store in cache
    this.cache.entries.set(normalizedPath, entries);

    // Yield entries
    for (const entry of entries) {
      yield entry;
    }
  }
}

// =========================================================================
// CachedStorageFileHandle
// =========================================================================

/**
 * Caching decorator for {@link StorageFileHandle}.
 */
class CachedStorageFileHandle implements StorageFileHandle {
  readonly name: string;

  constructor(
    private readonly inner: StorageFileHandle,
    private readonly cache: StorageCache,
    private readonly path: string,
    private readonly parentPath: string,
  ) {
    this.name = inner.name;
  }

  async getFile(): Promise<StorageFile> {
    const normalizedPath = normalizePath(this.path);

    // Check cache first
    const cachedContent = this.cache.content.get(normalizedPath);
    if (cachedContent) {
      return cachedContent;
    }

    // Cache miss — fetch from inner
    const file = await this.inner.getFile();

    // Wrap the file to cache its content reads
    const cachedFile = new CachedStorageFile(file);
    this.cache.content.set(normalizedPath, cachedFile);
    return cachedFile;
  }

  async createWritable(): Promise<StorageWritable> {
    const writable = await this.inner.createWritable();
    return new CachedStorageWritable(writable, this.cache, this.path, this.parentPath);
  }
}

// =========================================================================
// CachedStorageFile
// =========================================================================

/**
 * Wrapper for StorageFile that caches the content after first read.
 */
class CachedStorageFile implements StorageFile {
  private cachedText: string | null = null;
  private cachedArrayBuffer: ArrayBuffer | null = null;

  constructor(private readonly inner: StorageFile) {}

  async text(): Promise<string> {
    if (this.cachedText !== null) {
      return this.cachedText;
    }

    // If we have the array buffer, derive text from it
    if (this.cachedArrayBuffer !== null) {
      this.cachedText = new TextDecoder().decode(this.cachedArrayBuffer);
      return this.cachedText;
    }

    // Fetch from inner
    this.cachedText = await this.inner.text();
    return this.cachedText;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.cachedArrayBuffer !== null) {
      return this.cachedArrayBuffer;
    }

    // If we have the text, derive array buffer from it
    if (this.cachedText !== null) {
      this.cachedArrayBuffer = new TextEncoder().encode(this.cachedText).buffer;
      return this.cachedArrayBuffer;
    }

    // Fetch from inner
    this.cachedArrayBuffer = await this.inner.arrayBuffer();
    return this.cachedArrayBuffer;
  }
}

// =========================================================================
// CachedStorageWritable
// =========================================================================

/**
 * Writable that invalidates caches on close.
 */
class CachedStorageWritable implements StorageWritable {
  constructor(
    private readonly inner: StorageWritable,
    private readonly cache: StorageCache,
    private readonly filePath: string,
    private readonly parentPath: string,
  ) {}

  async write(data: string | ArrayBuffer): Promise<void> {
    return this.inner.write(data);
  }

  async close(): Promise<void> {
    await this.inner.close();

    // Invalidate file content cache
    this.cache.invalidateFile(this.filePath);

    // Invalidate parent directory's entries cache (file list may have changed)
    this.cache.entries.delete(normalizePath(this.parentPath));
  }
}

// =========================================================================
// Factory function
// =========================================================================

/**
 * Extended handle type that includes cache clearing capability.
 */
export interface CachedStorageRoot extends StorageDirectoryHandle {
  /** Clear all cached data, forcing subsequent operations to re-fetch. */
  clearCache(): void;
}

/**
 * Wrap a storage handle with read-through/write-through caching.
 *
 * All handles created from the returned root share the same cache,
 * ensuring cache coherence across the tree.
 *
 * @param root - The root directory handle to wrap
 * @returns A cached handle with `clearCache()` method
 *
 * @example
 * ```typescript
 * const cachedRoot = withCache(conn.getRoot());
 *
 * // Operations are cached
 * const dir = await cachedRoot.getDirectoryHandle('samples');
 * const dir2 = await cachedRoot.getDirectoryHandle('samples'); // cached
 *
 * // Force refresh
 * cachedRoot.clearCache();
 * const dir3 = await cachedRoot.getDirectoryHandle('samples'); // re-fetched
 * ```
 */
export function withCache(root: StorageDirectoryHandle): CachedStorageRoot {
  const cache = new StorageCache();
  const cached = new CachedStorageDirectoryHandle(root, cache, '');

  return {
    get name() {
      return cached.name;
    },
    getDirectoryHandle: cached.getDirectoryHandle.bind(cached),
    getFileHandle: cached.getFileHandle.bind(cached),
    removeEntry: cached.removeEntry.bind(cached),
    values: cached.values.bind(cached),
    clearCache: () => cache.clear(),
  };
}
