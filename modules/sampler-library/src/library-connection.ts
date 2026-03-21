/**
 * Abstract interface for connecting to a library root directory.
 *
 * Implementations handle runtime-specific concerns (FSAA directory
 * picker in browsers, filesystem path in Node.js) while consumers
 * work only with {@link StorageDirectoryHandle}.
 *
 * @packageDocumentation
 */

import type { StorageDirectoryHandle } from './storage-handles.js';
import type { CacheMetrics } from './cached-storage.js';

/**
 * Connection to a library root directory.
 *
 * Call {@link connect} to open/pick the library root, then use
 * {@link getRoot} to obtain the handle for library operations.
 */
export interface LibraryConnection {
  /** Prompt the user to select or open the library directory. */
  connect(): Promise<boolean>;
  /** Whether a library root is currently available. */
  isConnected(): boolean;
  /** Return the library root handle. Throws if not connected. */
  getRoot(): StorageDirectoryHandle;
  /**
   * Clear any cached data, forcing subsequent operations to re-fetch
   * from the backing store. Optional — not all backends need caching.
   */
  clearCache?(): void;
  /**
   * Get current cache metrics. Optional — only available on cached backends.
   * Returns undefined if cache is not yet initialized.
   */
  getMetrics?(): CacheMetrics | undefined;
  /**
   * Reset cache metrics counters. Optional — only available on cached backends.
   */
  resetMetrics?(): void;
}
