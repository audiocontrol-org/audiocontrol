/**
 * Shared OPFS spec factory for library e2e tests.
 *
 * Extracted from roland-sxx0-editor/e2e/library-opfs.spec.ts.
 * Each editor calls registerOPFSTests() with its own config to get
 * the full suite of OPFS operation tests.
 *
 * These tests navigate to config.baseUrl (not the library page) since
 * they only need OPFS access, not the library UI.
 */

import { test, expect } from '@playwright/test';
import type { LibraryTestConfig } from './library-test-config';

// Deviation: relative import because e2e-infra/specs/ is outside src/
import {
  opfsCleanup,
  opfsIsEmpty,
  opfsDirExists,
  opfsWriteFile,
  opfsReadFile,
  opfsListDir,
} from '../helpers/opfs-page-helpers';

export function registerOPFSTests(config: LibraryTestConfig): void {
  test.describe(`${config.editorName} OPFS Operations`, () => {
    test.setTimeout(15_000);

    // Clean up OPFS before each test for isolation
    test.beforeEach(async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });
      await opfsCleanup(page);
    });

    test('OPFS is available', async ({ page }) => {
      test.setTimeout(5000);

      await page.goto(config.baseUrl, { timeout: 5000 });

      const result = await page.evaluate(async () => {
        try {
          const handle = await navigator.storage.getDirectory();
          return {
            success: true,
            hasHandle: handle !== null && handle !== undefined,
            handleName: handle.name,
          };
        } catch (e) {
          return { success: false, error: String(e) };
        }
      });

      expect(result.success).toBe(true);
      if ('hasHandle' in result) {
        expect(result.hasHandle).toBe(true);
      }
    });

    test('can initialize library structure', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      // Use the editor-specific OPFS initializer
      await config.initializeOPFS(page);

      // Verify the common library root exists
      const libraryExists = await opfsDirExists(page, ['library']);
      expect(libraryExists).toBe(true);
    });

    test('can write and read files', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const testContent = 'Hello, OPFS! This is a test file.';
      const testPath = ['test-dir'];
      const testFileName = 'test-file.txt';

      await opfsWriteFile(page, testPath, testFileName, testContent);

      const readResult = await opfsReadFile(page, testPath, testFileName);
      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe(testContent);
    });

    test('can populate fixtures', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const fixtures = [
        {
          path: ['test-area', 'category-a'],
          fileName: 'item1.yaml',
          content: 'name: Test Item 1\nformat: item',
        },
        {
          path: ['test-area', 'category-a'],
          fileName: 'item2.yaml',
          content: 'name: Test Item 2\nformat: item',
        },
        {
          path: ['test-area', 'category-b', 'sub-group'],
          fileName: 'nested.yaml',
          content: 'name: Nested Item\nformat: item',
        },
      ];

      for (const fixture of fixtures) {
        await opfsWriteFile(
          page, fixture.path, fixture.fileName, fixture.content,
        );
      }

      for (const fixture of fixtures) {
        const readResult = await opfsReadFile(
          page, fixture.path, fixture.fileName,
        );
        expect(readResult.success).toBe(true);
        expect(readResult.content).toBe(fixture.content);
      }
    });

    test('can list directory contents', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const fixtures = [
        { path: ['test-dir'], fileName: 'file1.txt', content: 'content1' },
        { path: ['test-dir'], fileName: 'file2.txt', content: 'content2' },
        { path: ['test-dir', 'subdir'], fileName: 'nested.txt', content: 'nested' },
      ];

      for (const fixture of fixtures) {
        await opfsWriteFile(
          page, fixture.path, fixture.fileName, fixture.content,
        );
      }

      const listResult = await opfsListDir(page, ['test-dir']);

      expect(listResult.success).toBe(true);
      expect(listResult.entries).toHaveLength(3);

      const fileNames = listResult.entries.map(e => e.name).sort();
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.txt');
      expect(fileNames).toContain('subdir');

      const subdir = listResult.entries.find(e => e.name === 'subdir');
      expect(subdir?.kind).toBe('directory');

      const file1 = listResult.entries.find(e => e.name === 'file1.txt');
      expect(file1?.kind).toBe('file');
    });

    test('can cleanup OPFS', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const fixtures = [
        { path: ['area-a', 'items'], fileName: 'item1.yaml', content: 'test' },
        { path: ['area-b', 'items'], fileName: 'item2.yaml', content: 'test' },
        { path: ['deep', 'nested', 'path'], fileName: 'file.txt', content: 'test' },
      ];

      for (const fixture of fixtures) {
        await opfsWriteFile(
          page, fixture.path, fixture.fileName, fixture.content,
        );
      }

      const beforeCleanup = await opfsIsEmpty(page);
      expect(beforeCleanup).toBe(false);

      await opfsCleanup(page);

      const afterCleanup = await opfsIsEmpty(page);
      expect(afterCleanup).toBe(true);
    });

    test('cleanup is isolated between tests', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const isEmpty = await opfsIsEmpty(page);
      expect(isEmpty).toBe(true);

      await opfsWriteFile(
        page, ['isolation-test'], 'marker.txt', 'This should be cleaned up',
      );

      const afterWrite = await opfsIsEmpty(page);
      expect(afterWrite).toBe(false);
    });

    test('isolation verification - OPFS should be empty from previous test cleanup', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const isEmpty = await opfsIsEmpty(page);
      expect(isEmpty).toBe(true);

      const isolationDirExists = await opfsDirExists(page, ['isolation-test']);
      expect(isolationDirExists).toBe(false);
    });
  });
}
