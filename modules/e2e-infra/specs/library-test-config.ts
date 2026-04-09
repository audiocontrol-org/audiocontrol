/**
 * Configuration for shared library e2e test factories.
 *
 * Each editor provides this config to register the same set of
 * common-area tests against its own URL and OPFS structure.
 */

import type { Page } from '@playwright/test';

export interface LibraryTestConfig {
  /** Base URL for the editor's library page (e.g., https://localhost:5173/akai/s3000xl/editor/library) */
  libraryUrl: string;
  /** Any page URL that has OPFS access (for OPFS-only tests that don't need the library UI) */
  baseUrl: string;
  /** Initialize OPFS with the editor's directory structure */
  initializeOPFS: (page: Page) => Promise<void>;
  /** Editor name for test descriptions (e.g., "S3K", "Roland S-330") */
  editorName: string;
}
