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
// Cache Metrics
// =========================================================================

/**
 * Metrics for a single cache category.
 */
export interface CacheCategoryMetrics {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Current number of cached entries */
  size: number;
  /** Total time spent on cache hits (milliseconds) */
  hitTimeMs: number;
  /** Total time spent on cache misses (milliseconds) */
  missTimeMs: number;
}

/**
 * Aggregated cache metrics across all categories.
 */
export interface CacheMetrics {
  /** Directory entries cache (values() results) */
  entries: CacheCategoryMetrics;
  /** Directory handle cache */
  directories: CacheCategoryMetrics;
  /** File handle cache */
  files: CacheCategoryMetrics;
  /** File content cache */
  content: CacheCategoryMetrics;
  /** Total hits across all categories */
  totalHits: number;
  /** Total misses across all categories */
  totalMisses: number;
  /** Overall hit rate (0-1) */
  hitRate: number;
  /** Total time spent on cache hits (milliseconds) */
  totalHitTimeMs: number;
  /** Total time spent on cache misses (milliseconds) */
  totalMissTimeMs: number;
  /** Average time per cache hit (milliseconds) */
  avgHitTimeMs: number;
  /** Average time per cache miss (milliseconds) */
  avgMissTimeMs: number;
  /** Number of cache invalidations */
  invalidations: number;
  /** Number of full cache clears */
  clears: number;
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

  // Metrics tracking
  private _entriesHits = 0;
  private _entriesMisses = 0;
  private _entriesHitTimeMs = 0;
  private _entriesMissTimeMs = 0;
  private _directoriesHits = 0;
  private _directoriesMisses = 0;
  private _directoriesHitTimeMs = 0;
  private _directoriesMissTimeMs = 0;
  private _filesHits = 0;
  private _filesMisses = 0;
  private _filesHitTimeMs = 0;
  private _filesMissTimeMs = 0;
  private _contentHits = 0;
  private _contentMisses = 0;
  private _contentHitTimeMs = 0;
  private _contentMissTimeMs = 0;
  private _invalidations = 0;
  private _clears = 0;

  /** Record a cache hit for the entries cache */
  recordEntriesHit(durationMs: number): void {
    this._entriesHits++;
    this._entriesHitTimeMs += durationMs;
  }

  /** Record a cache miss for the entries cache */
  recordEntriesMiss(durationMs: number): void {
    this._entriesMisses++;
    this._entriesMissTimeMs += durationMs;
  }

  /** Record a cache hit for the directories cache */
  recordDirectoriesHit(durationMs: number): void {
    this._directoriesHits++;
    this._directoriesHitTimeMs += durationMs;
  }

  /** Record a cache miss for the directories cache */
  recordDirectoriesMiss(durationMs: number): void {
    this._directoriesMisses++;
    this._directoriesMissTimeMs += durationMs;
  }

  /** Record a cache hit for the files cache */
  recordFilesHit(durationMs: number): void {
    this._filesHits++;
    this._filesHitTimeMs += durationMs;
  }

  /** Record a cache miss for the files cache */
  recordFilesMiss(durationMs: number): void {
    this._filesMisses++;
    this._filesMissTimeMs += durationMs;
  }

  /** Record a cache hit for the content cache */
  recordContentHit(durationMs: number): void {
    this._contentHits++;
    this._contentHitTimeMs += durationMs;
  }

  /** Record a cache miss for the content cache */
  recordContentMiss(durationMs: number): void {
    this._contentMisses++;
    this._contentMissTimeMs += durationMs;
  }

  /**
   * Get current cache metrics.
   */
  getMetrics(): CacheMetrics {
    const totalHits = this._entriesHits + this._directoriesHits + this._filesHits + this._contentHits;
    const totalMisses = this._entriesMisses + this._directoriesMisses + this._filesMisses + this._contentMisses;
    const total = totalHits + totalMisses;
    const totalHitTimeMs = this._entriesHitTimeMs + this._directoriesHitTimeMs + this._filesHitTimeMs + this._contentHitTimeMs;
    const totalMissTimeMs = this._entriesMissTimeMs + this._directoriesMissTimeMs + this._filesMissTimeMs + this._contentMissTimeMs;

    return {
      entries: {
        hits: this._entriesHits,
        misses: this._entriesMisses,
        size: this.entries.size,
        hitTimeMs: this._entriesHitTimeMs,
        missTimeMs: this._entriesMissTimeMs,
      },
      directories: {
        hits: this._directoriesHits,
        misses: this._directoriesMisses,
        size: this.directories.size,
        hitTimeMs: this._directoriesHitTimeMs,
        missTimeMs: this._directoriesMissTimeMs,
      },
      files: {
        hits: this._filesHits,
        misses: this._filesMisses,
        size: this.files.size,
        hitTimeMs: this._filesHitTimeMs,
        missTimeMs: this._filesMissTimeMs,
      },
      content: {
        hits: this._contentHits,
        misses: this._contentMisses,
        size: this.content.size,
        hitTimeMs: this._contentHitTimeMs,
        missTimeMs: this._contentMissTimeMs,
      },
      totalHits,
      totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
      totalHitTimeMs,
      totalMissTimeMs,
      avgHitTimeMs: totalHits > 0 ? totalHitTimeMs / totalHits : 0,
      avgMissTimeMs: totalMisses > 0 ? totalMissTimeMs / totalMisses : 0,
      invalidations: this._invalidations,
      clears: this._clears,
    };
  }

  /**
   * Reset all metrics counters to zero.
   */
  resetMetrics(): void {
    this._entriesHits = 0;
    this._entriesMisses = 0;
    this._entriesHitTimeMs = 0;
    this._entriesMissTimeMs = 0;
    this._directoriesHits = 0;
    this._directoriesMisses = 0;
    this._directoriesHitTimeMs = 0;
    this._directoriesMissTimeMs = 0;
    this._filesHits = 0;
    this._filesMisses = 0;
    this._filesHitTimeMs = 0;
    this._filesMissTimeMs = 0;
    this._contentHits = 0;
    this._contentMisses = 0;
    this._contentHitTimeMs = 0;
    this._contentMissTimeMs = 0;
    this._invalidations = 0;
    this._clears = 0;
  }

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

    this._invalidations++;
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
    this._clears++;
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
    const startTime = performance.now();
    const normalizedChildPath = normalizePath(childPath);
    const cachedHandle = this.cache.directories.get(normalizedChildPath);
    if (cachedHandle) {
      this.cache.recordDirectoriesHit(performance.now() - startTime);
      return cachedHandle;
    }

    // Cache miss — fetch from inner
    const handle = await this.inner.getDirectoryHandle(name);
    this.cache.recordDirectoriesMiss(performance.now() - startTime);
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
    const startTime = performance.now();
    const normalizedChildPath = normalizePath(childPath);
    const cachedHandle = this.cache.files.get(normalizedChildPath);
    if (cachedHandle) {
      this.cache.recordFilesHit(performance.now() - startTime);
      return cachedHandle;
    }

    // Cache miss — fetch from inner
    const handle = await this.inner.getFileHandle(name);
    this.cache.recordFilesMiss(performance.now() - startTime);
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
    const startTime = performance.now();

    // Check cache first
    const cachedEntries = this.cache.entries.get(normalizedPath);
    if (cachedEntries) {
      this.cache.recordEntriesHit(performance.now() - startTime);
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
    this.cache.recordEntriesMiss(performance.now() - startTime);

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
    const startTime = performance.now();

    // Check cache first
    const cachedContent = this.cache.content.get(normalizedPath);
    if (cachedContent) {
      this.cache.recordContentHit(performance.now() - startTime);
      return cachedContent;
    }

    // Cache miss — fetch from inner
    const file = await this.inner.getFile();
    this.cache.recordContentMiss(performance.now() - startTime);

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
 * Extended handle type that includes cache management and metrics.
 */
export interface CachedStorageRoot extends StorageDirectoryHandle {
  /** Clear all cached data, forcing subsequent operations to re-fetch. */
  clearCache(): void;
  /** Get current cache metrics (hits, misses, sizes). */
  getMetrics(): CacheMetrics;
  /** Reset all metrics counters to zero. */
  resetMetrics(): void;
}

/**
 * Wrap a storage handle with read-through/write-through caching.
 *
 * All handles created from the returned root share the same cache,
 * ensuring cache coherence across the tree.
 *
 * @param root - The root directory handle to wrap
 * @returns A cached handle with cache management and metrics
 *
 * @example
 * ```typescript
 * const cachedRoot = withCache(conn.getRoot());
 *
 * // Operations are cached
 * const dir = await cachedRoot.getDirectoryHandle('samples');
 * const dir2 = await cachedRoot.getDirectoryHandle('samples'); // cached
 *
 * // Check cache effectiveness
 * const metrics = cachedRoot.getMetrics();
 * console.log(`Hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`);
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
    getMetrics: () => cache.getMetrics(),
    resetMetrics: () => cache.resetMetrics(),
  };
}
