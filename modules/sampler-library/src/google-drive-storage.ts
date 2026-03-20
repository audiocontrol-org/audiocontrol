/**
 * Google Drive storage adapter for the library.
 *
 * Implements {@link StorageDirectoryHandle} over Google Drive API v3
 * using OAuth 2.0 with PKCE for authentication. No server component
 * needed — the browser handles the full OAuth flow.
 *
 * Google Drive's folder/file model maps to StorageDirectoryHandle:
 * - Folders → directories (identified by mimeType)
 * - Files → files (read via `alt=media`, write via multipart upload)
 * - Parent references simulate hierarchical paths
 *
 * Uses the `drive.file` scope so the app can only access files it
 * created — not the user's entire Drive.
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
import type { LibraryConnection } from './library-connection.js';

// =========================================================================
// Configuration
// =========================================================================

export interface GoogleDriveConfig {
  /** OAuth 2.0 client ID from Google Cloud Console. */
  clientId: string;
  /**
   * OAuth 2.0 client secret. Required by Google for "Web application"
   * client types, even for SPAs. Not truly secret in client-side code —
   * security relies on redirect URI validation, not the secret.
   */
  clientSecret: string;
  /**
   * OAuth redirect URI. Must match one registered in the client config.
   * Defaults to `window.location.origin + window.location.pathname`.
   */
  redirectUri?: string;
  /**
   * Name of the root folder in the user's Drive.
   * Created on first connect if it doesn't exist.
   * Default: "AudioControl Library"
   */
  rootFolderName?: string;
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// =========================================================================
// OAuth 2.0 with PKCE
// =========================================================================

function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

interface TokenData {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  /** Timestamp (ms) when this token was obtained. */
  obtained_at: number;
}

const TOKEN_STORAGE_KEY = 'audiocontrol:google-drive:token';
const VERIFIER_STORAGE_KEY = 'audiocontrol:google-drive:verifier';

function storeToken(token: TokenData): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
}

function loadToken(): TokenData | null {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function isTokenExpired(token: TokenData): boolean {
  const elapsed = (Date.now() - token.obtained_at) / 1000;
  // Refresh 60 seconds before actual expiry
  return elapsed >= token.expires_in - 60;
}

// =========================================================================
// Google Drive API client
// =========================================================================

class DriveClient {
  private tokenData: TokenData;

  constructor(tokenData: TokenData) {
    this.tokenData = tokenData;
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.tokenData.access_token}` };
  }

  /**
   * List files/folders in a parent folder.
   */
  async listChildren(
    parentId: string,
  ): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const items: Array<{ id: string; name: string; mimeType: string }> = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: '1000',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const resp = await fetch(`${DRIVE_API}/files?${params}`, {
        headers: this.headers,
      });
      if (!resp.ok) {
        throw new Error(`Drive list failed: ${resp.status} ${resp.statusText}`);
      }

      const data = await resp.json();
      items.push(...(data.files ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return items;
  }

  /**
   * Find a child by name and optional mimeType in a parent folder.
   */
  async findChild(
    parentId: string,
    name: string,
    mimeType?: string,
  ): Promise<{ id: string; name: string; mimeType: string } | null> {
    let q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
    if (mimeType) q += ` and mimeType = '${mimeType}'`;

    const params = new URLSearchParams({
      q,
      fields: 'files(id, name, mimeType)',
      pageSize: '1',
    });

    const resp = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: this.headers,
    });
    if (!resp.ok) {
      throw new Error(`Drive find failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    return data.files?.[0] ?? null;
  }

  /**
   * Create a folder.
   */
  async createFolder(name: string, parentId: string): Promise<string> {
    const resp = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
      }),
    });
    if (!resp.ok) {
      throw new Error(`Drive createFolder failed: ${resp.status} ${resp.statusText}`);
    }
    const data = await resp.json();
    return data.id;
  }

  /**
   * Read file content.
   */
  async getFileContent(fileId: string): Promise<ArrayBuffer> {
    const resp = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: this.headers,
    });
    if (!resp.ok) {
      throw new Error(`Drive getFileContent failed: ${resp.status} ${resp.statusText}`);
    }
    return resp.arrayBuffer();
  }

  /**
   * Create or overwrite a file using multipart upload.
   */
  async uploadFile(
    name: string,
    parentId: string,
    content: string | ArrayBuffer,
    existingFileId?: string,
  ): Promise<string> {
    const contentType = typeof content === 'string'
      ? 'text/plain; charset=utf-8'
      : 'application/octet-stream';

    const metadata = existingFileId
      ? { name }
      : { name, parents: [parentId] };

    const boundary = '---audiocontrol-boundary-' + generateRandomString(16);

    const metadataStr = JSON.stringify(metadata);
    const contentBytes = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : new Uint8Array(content);

    // Build multipart body
    const parts = [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataStr,
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${contentType}\r\n\r\n`,
    ];

    const prefix = new TextEncoder().encode(parts.join(''));
    const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);

    const body = new Uint8Array(prefix.length + contentBytes.length + suffix.length);
    body.set(prefix, 0);
    body.set(contentBytes, prefix.length);
    body.set(suffix, prefix.length + contentBytes.length);

    const url = existingFileId
      ? `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart`
      : `${UPLOAD_API}/files?uploadType=multipart`;

    const method = existingFileId ? 'PATCH' : 'POST';

    const resp = await fetch(url, {
      method,
      headers: {
        ...this.headers,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!resp.ok) {
      throw new Error(`Drive upload failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    return data.id;
  }

  /**
   * Delete a file or folder (moves to trash).
   */
  async deleteFile(fileId: string): Promise<void> {
    const resp = await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Drive delete failed: ${resp.status} ${resp.statusText}`);
    }
  }
}

// =========================================================================
// StorageDirectoryHandle implementation
// =========================================================================

export class GoogleDriveDirectoryHandle implements StorageDirectoryHandle {
  readonly name: string;

  constructor(
    private readonly client: DriveClient,
    private readonly folderId: string,
    name: string,
  ) {
    this.name = name;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageDirectoryHandle> {
    const existing = await this.client.findChild(this.folderId, name, FOLDER_MIME);
    if (existing) {
      return new GoogleDriveDirectoryHandle(this.client, existing.id, existing.name);
    }

    if (options?.create) {
      const id = await this.client.createFolder(name, this.folderId);
      return new GoogleDriveDirectoryHandle(this.client, id, name);
    }

    throw new DOMException(`Directory "${name}" not found`, 'NotFoundError');
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<StorageFileHandle> {
    const existing = await this.client.findChild(this.folderId, name);
    if (existing && existing.mimeType !== FOLDER_MIME) {
      return new GoogleDriveFileHandle(this.client, existing.id, existing.name, this.folderId);
    }

    if (options?.create) {
      // Return a handle that will create the file on write
      return new GoogleDriveFileHandle(this.client, null, name, this.folderId);
    }

    throw new DOMException(`File "${name}" not found`, 'NotFoundError');
  }

  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    // Find the child (could be file or folder)
    const children = await this.client.listChildren(this.folderId);
    const child = children.find((c) => c.name === name);
    if (!child) {
      throw new DOMException(`Entry "${name}" not found`, 'NotFoundError');
    }

    if (child.mimeType === FOLDER_MIME && options?.recursive) {
      await this.deleteRecursive(child.id);
    } else {
      await this.client.deleteFile(child.id);
    }
  }

  private async deleteRecursive(folderId: string): Promise<void> {
    const children = await this.client.listChildren(folderId);
    await Promise.all(
      children.map((child) =>
        child.mimeType === FOLDER_MIME
          ? this.deleteRecursive(child.id)
          : this.client.deleteFile(child.id),
      ),
    );
    await this.client.deleteFile(folderId);
  }

  async *values(): AsyncIterable<StorageEntry> {
    const children = await this.client.listChildren(this.folderId);
    for (const child of children) {
      yield {
        kind: child.mimeType === FOLDER_MIME ? 'directory' : 'file',
        name: child.name,
      };
    }
  }
}

// =========================================================================
// StorageFileHandle implementation
// =========================================================================

class GoogleDriveFileHandle implements StorageFileHandle {
  readonly name: string;

  constructor(
    private readonly client: DriveClient,
    private fileId: string | null,
    name: string,
    private readonly parentId: string,
  ) {
    this.name = name;
  }

  async getFile(): Promise<StorageFile> {
    if (!this.fileId) {
      throw new DOMException(`File "${this.name}" does not exist yet`, 'NotFoundError');
    }

    const buffer = await this.client.getFileContent(this.fileId);
    return {
      text: async () => new TextDecoder().decode(buffer),
      arrayBuffer: async () => buffer,
    };
  }

  async createWritable(): Promise<StorageWritable> {
    return new GoogleDriveWritable(this.client, this.name, this.parentId, this.fileId, (id) => {
      this.fileId = id;
    });
  }
}

// =========================================================================
// StorageWritable implementation
// =========================================================================

class GoogleDriveWritable implements StorageWritable {
  private data: string | ArrayBuffer | null = null;

  constructor(
    private readonly client: DriveClient,
    private readonly name: string,
    private readonly parentId: string,
    private readonly existingFileId: string | null,
    private readonly onCreated: (id: string) => void,
  ) {}

  async write(data: string | ArrayBuffer): Promise<void> {
    this.data = data;
  }

  async close(): Promise<void> {
    if (this.data === null) return;
    const id = await this.client.uploadFile(
      this.name,
      this.parentId,
      this.data,
      this.existingFileId ?? undefined,
    );
    this.onCreated(id);
    this.data = null;
  }
}

// =========================================================================
// LibraryConnection implementation
// =========================================================================

/**
 * Google Drive-backed library connection using OAuth 2.0 with PKCE.
 *
 * On `connect()`, redirects the user to Google's consent screen.
 * After authorization, the browser is redirected back with an auth code
 * that is exchanged for an access token.
 *
 * Call {@link handleRedirect} on page load to complete the flow if
 * the URL contains an auth code.
 */
export class GoogleDriveLibraryConnection implements LibraryConnection {
  private root: GoogleDriveDirectoryHandle | null = null;
  private client: DriveClient | null = null;
  private readonly config: GoogleDriveConfig;
  private readonly rootFolderName: string;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
    this.rootFolderName = config.rootFolderName ?? 'AudioControl Library';
  }

  /**
   * Check if the current URL contains an OAuth callback and exchange
   * the code for a token. Call this on page load.
   *
   * Returns true if a token was obtained (the redirect was handled).
   */
  async handleRedirect(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return false;

    // Always clean the URL so stale codes don't persist across reloads
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    const verifier = localStorage.getItem(VERIFIER_STORAGE_KEY);
    if (!verifier) {
      throw new Error('OAuth PKCE verifier not found — was the auth flow started from this browser?');
    }

    localStorage.removeItem(VERIFIER_STORAGE_KEY);

    // Exchange code for token
    const redirectUri = this.config.redirectUri ?? (window.location.origin + window.location.pathname);
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Token exchange failed (${resp.status}): ${body}`);
    }

    const token: TokenData = {
      ...(await resp.json()),
      obtained_at: Date.now(),
    };

    storeToken(token);
    return true;
  }

  async connect(): Promise<boolean> {
    // Check for existing valid token
    const existing = loadToken();
    if (existing && !isTokenExpired(existing)) {
      return this.initClient(existing);
    }

    // Start OAuth flow with PKCE
    const verifier = generateRandomString(64);
    const challenge = base64UrlEncode(await sha256(verifier));
    localStorage.setItem(VERIFIER_STORAGE_KEY, verifier);

    const redirectUri = this.config.redirectUri ?? (window.location.origin + window.location.pathname);
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    // This won't resolve — the page navigates away.
    // connect() returns true after handleRedirect() is called on the return trip.
    return false;
  }

  isConnected(): boolean {
    return this.root !== null;
  }

  getRoot(): StorageDirectoryHandle {
    if (!this.root) {
      throw new Error('Google Drive library not connected — call connect() first');
    }
    return this.root;
  }

  /**
   * Try to restore a session from a stored token without user interaction.
   * Returns true if a valid session was restored.
   */
  async tryRestore(): Promise<boolean> {
    const token = loadToken();
    if (!token || isTokenExpired(token)) return false;
    return this.initClient(token);
  }

  private async initClient(token: TokenData): Promise<boolean> {
    try {
      this.client = new DriveClient(token);
      const rootId = await this.getOrCreateRootFolder();
      this.root = new GoogleDriveDirectoryHandle(this.client, rootId, this.rootFolderName);
      return true;
    } catch (err) {
      console.error('Failed to initialize Google Drive client:', err);
      clearToken();
      this.client = null;
      this.root = null;
      return false;
    }
  }

  private async getOrCreateRootFolder(): Promise<string> {
    if (!this.client) throw new Error('Client not initialized');

    // Search for existing root folder
    const params = new URLSearchParams({
      q: `name = '${this.rootFolderName}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
      fields: 'files(id)',
      pageSize: '1',
    });

    const resp = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${(this.client as any).tokenData.access_token}` },
    });

    if (!resp.ok) throw new Error(`Failed to search for root folder: ${resp.status}`);
    const data = await resp.json();

    if (data.files?.length > 0) {
      return data.files[0].id;
    }

    // Create it
    return this.client.createFolder(this.rootFolderName, 'root');
  }
}
