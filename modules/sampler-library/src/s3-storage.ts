/**
 * S3-compatible storage adapter for the library.
 *
 * Implements {@link StorageDirectoryHandle} over any S3-compatible API
 * (AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.) using `aws4fetch`
 * for request signing. Works in browsers and Node.js.
 *
 * S3 is flat key-value storage — directories are simulated via "/" delimiters
 * and `ListObjectsV2` CommonPrefixes. Empty "directory marker" objects are
 * never created; directories exist implicitly when they contain objects.
 *
 * @packageDocumentation
 */

import { AwsClient } from 'aws4fetch';

import type {
  StorageDirectoryHandle,
  StorageFileHandle,
  StorageFile,
  StorageWritable,
  StorageEntry,
} from './storage-handles.js';
import type { LibraryConnection } from './library-connection.js';

// =========================================================================
// Configuration
// =========================================================================

export interface S3StorageConfig {
  /** S3-compatible endpoint URL (e.g., "https://s3.us-east-1.amazonaws.com") */
  endpoint: string;
  /** Bucket name */
  bucket: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /** AWS region (default: "auto" for R2/MinIO) */
  region?: string;
}

// =========================================================================
// S3 client wrapper
// =========================================================================

class S3Client {
  private readonly aws: AwsClient;
  private readonly endpoint: string;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.aws = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region ?? 'auto',
      service: 's3',
    });
    this.endpoint = config.endpoint.replace(/\/$/, '');
    this.bucket = config.bucket;
  }

  private url(key: string, query?: Record<string, string>): string {
    const params = query ? '?' + new URLSearchParams(query).toString() : '';
    return `${this.endpoint}/${this.bucket}/${key}${params}`;
  }

  async getObject(key: string): Promise<Response> {
    const resp = await this.aws.fetch(this.url(key));
    if (!resp.ok) {
      throw new Error(`S3 GetObject failed for "${key}": ${resp.status} ${resp.statusText}`);
    }
    return resp;
  }

  async putObject(key: string, body: string | ArrayBuffer): Promise<void> {
    const resp = await this.aws.fetch(this.url(key), {
      method: 'PUT',
      body,
    });
    if (!resp.ok) {
      throw new Error(`S3 PutObject failed for "${key}": ${resp.status} ${resp.statusText}`);
    }
  }

  async headObject(key: string): Promise<boolean> {
    const resp = await this.aws.fetch(this.url(key), { method: 'HEAD' });
    return resp.ok;
  }

  /**
   * Get object metadata including size.
   */
  async getObjectMetadata(key: string): Promise<{ size: number }> {
    const resp = await this.aws.fetch(this.url(key), { method: 'HEAD' });
    if (!resp.ok) {
      throw new Error(`S3 HeadObject failed for "${key}": ${resp.status} ${resp.statusText}`);
    }
    const contentLength = resp.headers.get('Content-Length');
    return { size: contentLength ? parseInt(contentLength, 10) : 0 };
  }

  async deleteObject(key: string): Promise<void> {
    const resp = await this.aws.fetch(this.url(key), { method: 'DELETE' });
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`S3 DeleteObject failed for "${key}": ${resp.status} ${resp.statusText}`);
    }
  }

  async listObjects(prefix: string): Promise<{ files: string[]; directories: string[] }> {
    const query: Record<string, string> = {
      'list-type': '2',
      prefix,
      delimiter: '/',
    };

    const files: string[] = [];
    const directories: string[] = [];
    let continuationToken: string | undefined;

    do {
      if (continuationToken) {
        query['continuation-token'] = continuationToken;
      }

      const resp = await this.aws.fetch(this.url('', query));
      if (!resp.ok) {
        throw new Error(`S3 ListObjectsV2 failed: ${resp.status} ${resp.statusText}`);
      }

      const xml = await resp.text();

      // Parse file keys from <Contents><Key>...</Key></Contents>
      const contentMatches = xml.matchAll(/<Contents>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<\/Contents>/g);
      for (const match of contentMatches) {
        const key = match[1];
        if (key !== prefix) {
          files.push(key);
        }
      }

      // Parse directory prefixes from <CommonPrefixes><Prefix>...</Prefix></CommonPrefixes>
      const prefixMatches = xml.matchAll(/<CommonPrefixes>\s*<Prefix>(.*?)<\/Prefix>\s*<\/CommonPrefixes>/g);
      for (const match of prefixMatches) {
        directories.push(match[1]);
      }

      // Check for truncation
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      if (truncated) {
        const tokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
        continuationToken = tokenMatch?.[1];
      } else {
        continuationToken = undefined;
      }
    } while (continuationToken);

    return { files, directories };
  }

  /**
   * List ALL objects under a prefix (no delimiter, recursive).
   * Used for recursive delete.
   */
  async listAllObjects(prefix: string): Promise<string[]> {
    const query: Record<string, string> = {
      'list-type': '2',
      prefix,
    };

    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      if (continuationToken) {
        query['continuation-token'] = continuationToken;
      }

      const resp = await this.aws.fetch(this.url('', query));
      if (!resp.ok) {
        throw new Error(`S3 ListObjectsV2 failed: ${resp.status} ${resp.statusText}`);
      }

      const xml = await resp.text();
      const matches = xml.matchAll(/<Contents>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<\/Contents>/g);
      for (const match of matches) {
        keys.push(match[1]);
      }

      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
      if (truncated) {
        const tokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
        continuationToken = tokenMatch?.[1];
      } else {
        continuationToken = undefined;
      }
    } while (continuationToken);

    return keys;
  }
}

// =========================================================================
// StorageDirectoryHandle implementation
// =========================================================================

/**
 * S3-backed directory handle. A "directory" is an S3 key prefix ending in "/".
 */
export class S3DirectoryHandle implements StorageDirectoryHandle {
  readonly name: string;

  constructor(
    private readonly client: S3Client,
    private readonly prefix: string,
  ) {
    // Extract name from prefix: "a/b/c/" → "c", "" → ""
    const trimmed = prefix.replace(/\/$/, '');
    const lastSlash = trimmed.lastIndexOf('/');
    this.name = lastSlash >= 0 ? trimmed.slice(lastSlash + 1) : trimmed;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle> {
    const childPrefix = this.prefix + name + '/';

    if (!options?.create) {
      // Verify the "directory" exists (has at least one object under it)
      const { files, directories } = await this.client.listObjects(childPrefix);
      if (files.length === 0 && directories.length === 0) {
        throw new DOMException(
          `Directory "${name}" not found under "${this.prefix}"`,
          'NotFoundError',
        );
      }
    }
    // For create: true, S3 directories are implicit — just return the handle.
    // Objects written under this prefix will create the "directory".

    return new S3DirectoryHandle(this.client, childPrefix);
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle> {
    const key = this.prefix + name;

    if (!options?.create) {
      const exists = await this.client.headObject(key);
      if (!exists) {
        throw new DOMException(
          `File "${name}" not found under "${this.prefix}"`,
          'NotFoundError',
        );
      }
    }

    return new S3FileHandle(this.client, key, name);
  }

  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    if (options?.recursive) {
      // Delete all objects under the prefix
      const allKeys = await this.client.listAllObjects(this.prefix + name + '/');
      // Also try deleting the exact key (file, not directory)
      allKeys.push(this.prefix + name);
      await Promise.all(allKeys.map((key) => this.client.deleteObject(key)));
    } else {
      await this.client.deleteObject(this.prefix + name);
    }
  }

  async *values(): AsyncIterable<StorageEntry> {
    const { files, directories } = await this.client.listObjects(this.prefix);

    for (const dirPrefix of directories) {
      const dirName = dirPrefix.slice(this.prefix.length).replace(/\/$/, '');
      yield { kind: 'directory' as const, name: dirName };
    }

    for (const fileKey of files) {
      const fileName = fileKey.slice(this.prefix.length);
      // Skip files with "/" in the remaining name (shouldn't happen with delimiter)
      if (!fileName.includes('/')) {
        yield { kind: 'file' as const, name: fileName };
      }
    }
  }
}

// =========================================================================
// StorageFile implementation for S3
// =========================================================================

/**
 * StorageFile implementation that fetches content from S3.
 * Supports streaming reads for progress tracking.
 */
class S3File implements StorageFile {
  readonly size: number;
  private cachedBuffer: ArrayBuffer | null = null;

  constructor(
    private readonly client: S3Client,
    private readonly key: string,
    size: number,
  ) {
    this.size = size;
  }

  async text(): Promise<string> {
    const buffer = await this.arrayBuffer();
    return new TextDecoder().decode(buffer);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    if (this.cachedBuffer !== null) {
      return this.cachedBuffer;
    }
    const resp = await this.client.getObject(this.key);
    this.cachedBuffer = await resp.arrayBuffer();
    return this.cachedBuffer;
  }

  stream(): ReadableStream<Uint8Array> {
    const client = this.client;
    const key = this.key;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const resp = await client.getObject(key);
          const reader = resp.body?.getReader();
          if (!reader) {
            throw new Error('No response body available');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }
}

// =========================================================================
// StorageFileHandle implementation
// =========================================================================

class S3FileHandle implements StorageFileHandle {
  readonly name: string;

  constructor(
    private readonly client: S3Client,
    private readonly key: string,
    name: string,
  ) {
    this.name = name;
  }

  async getFile(): Promise<StorageFile> {
    const metadata = await this.client.getObjectMetadata(this.key);
    return new S3File(this.client, this.key, metadata.size);
  }

  async createWritable(): Promise<StorageWritable> {
    return new S3Writable(this.client, this.key);
  }
}

// =========================================================================
// StorageWritable implementation
// =========================================================================

class S3Writable implements StorageWritable {
  private data: string | ArrayBuffer | null = null;

  constructor(
    private readonly client: S3Client,
    private readonly key: string,
  ) {}

  async write(data: string | ArrayBuffer): Promise<void> {
    this.data = data;
  }

  async close(): Promise<void> {
    if (this.data === null) return;
    await this.client.putObject(this.key, this.data);
    this.data = null;
  }
}

// =========================================================================
// LibraryConnection implementation
// =========================================================================

/**
 * S3-backed library connection.
 *
 * Unlike the FSAA browser connection, this does not prompt the user
 * for a directory — it connects to a pre-configured S3 bucket.
 */
export class S3LibraryConnection implements LibraryConnection {
  private root: S3DirectoryHandle | null = null;
  private readonly config: S3StorageConfig;

  constructor(config: S3StorageConfig) {
    this.config = config;
  }

  async connect(): Promise<boolean> {
    try {
      const client = new S3Client(this.config);
      this.root = new S3DirectoryHandle(client, '');
      // Verify connectivity by listing the root
      await client.listObjects('');
      return true;
    } catch {
      this.root = null;
      return false;
    }
  }

  isConnected(): boolean {
    return this.root !== null;
  }

  getRoot(): StorageDirectoryHandle {
    if (!this.root) {
      throw new Error('S3 library not connected — call connect() first');
    }
    return this.root;
  }
}
