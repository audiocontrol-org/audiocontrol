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
import { OPFS_CORE_HELPERS } from './opfs-eval-helpers';

export function registerOPFSTests(config: LibraryTestConfig): void {
  test.describe(`${config.editorName} OPFS Operations`, () => {
    test.setTimeout(15_000);

    // Clean up OPFS before each test for isolation
    test.beforeEach(async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          await cleanupOPFS();
        })();
      `);
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
      expect(result.hasHandle).toBe(true);
    });

    test('can initialize library structure', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      // Use the editor-specific OPFS initializer
      await config.initializeOPFS(page);

      // Verify the common library root exists
      const libraryExists = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await directoryExists(['library']);
        })();
      `);
      expect(libraryExists).toBe(true);
    });

    test('can write and read files', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const testContent = 'Hello, OPFS! This is a test file.';
      const testPath = ['test-dir'];
      const testFileName = 'test-file.txt';

      const writeResult = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await writeFile(${JSON.stringify(testPath)}, ${JSON.stringify(testFileName)}, ${JSON.stringify(testContent)});
        })();
      `);

      expect(writeResult.success).toBe(true);

      const readResult = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await readFile(${JSON.stringify(testPath)}, ${JSON.stringify(testFileName)});
        })();
      `) as { success: boolean; content: string };

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

      const populateResult = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await populateFixtures(${JSON.stringify(fixtures)});
        })();
      `) as { success: boolean; created: Array<{ path: string[]; fileName: string }> };

      expect(populateResult.success).toBe(true);
      expect(populateResult.created).toHaveLength(3);

      for (const fixture of fixtures) {
        const readResult = await page.evaluate(`
          ${OPFS_CORE_HELPERS}
          (async () => {
            return await readFile(${JSON.stringify(fixture.path)}, ${JSON.stringify(fixture.fileName)});
          })();
        `) as { success: boolean; content: string };

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

      await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await populateFixtures(${JSON.stringify(fixtures)});
        })();
      `);

      const listResult = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await listDirectory(['test-dir']);
        })();
      `) as { success: boolean; entries: Array<{ name: string; kind: string }> };

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

      await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await populateFixtures(${JSON.stringify(fixtures)});
        })();
      `);

      const beforeCleanup = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await isOPFSEmpty();
        })();
      `);
      expect(beforeCleanup).toBe(false);

      const cleanupResult = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await cleanupOPFS();
        })();
      `);

      expect(cleanupResult.success).toBe(true);

      const afterCleanup = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await isOPFSEmpty();
        })();
      `);
      expect(afterCleanup).toBe(true);
    });

    test('cleanup is isolated between tests', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const isEmpty = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await isOPFSEmpty();
        })();
      `);
      expect(isEmpty).toBe(true);

      await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          await writeFile(['isolation-test'], 'marker.txt', 'This should be cleaned up');
        })();
      `);

      const afterWrite = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await isOPFSEmpty();
        })();
      `);
      expect(afterWrite).toBe(false);
    });

    test('isolation verification - OPFS should be empty from previous test cleanup', async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      const isEmpty = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await isOPFSEmpty();
        })();
      `);
      expect(isEmpty).toBe(true);

      const isolationDirExists = await page.evaluate(`
        ${OPFS_CORE_HELPERS}
        (async () => {
          return await directoryExists(['isolation-test']);
        })();
      `);
      expect(isolationDirExists).toBe(false);
    });
  });
}
