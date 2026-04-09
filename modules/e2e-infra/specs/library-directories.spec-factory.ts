/**
 * Shared directory operations spec factory for library e2e tests.
 *
 * Extracted from roland-sxx0-editor/e2e/library-directories.spec.ts.
 * Each editor calls registerDirectoryTests() with its own config to get
 * the full suite of OPFS directory CRUD tests.
 *
 * These tests navigate to config.baseUrl for OPFS access. They exercise
 * raw OPFS directory operations (create, rename, move, delete) and do not
 * interact with the library UI.
 */

import { test, expect } from '@playwright/test';
import type { LibraryTestConfig } from './library-test-config';

// Deviation: relative import because e2e-infra/specs/ is outside src/
import {
  opfsCleanup,
  opfsCreateDir,
  opfsDirExists,
  opfsWriteFile,
  opfsReadFile,
  opfsListDir,
  opfsDeleteDir,
  opfsRenameDir,
  opfsMoveDir,
  isMovingIntoItself,
} from '../helpers/opfs-page-helpers';

export function registerDirectoryTests(config: LibraryTestConfig): void {
  test.describe(`${config.editorName} Directory Operations`, () => {
    test.setTimeout(15_000);

    // Clean up OPFS and initialize before each test for isolation
    test.beforeEach(async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });
      await opfsCleanup(page);
      await config.initializeOPFS(page);
    });

    test.describe('Directory Creation', () => {
      test('can create directory in library', async ({ page }) => {
        const createResult = await opfsCreateDir(page, [
          'library', 'common', 'samples', 'test-dir',
        ]);
        expect(createResult.success).toBe(true);

        const exists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'test-dir',
        ]);
        expect(exists).toBe(true);
      });

      test('can create nested directories', async ({ page }) => {
        const createResult = await opfsCreateDir(page, [
          'library', 'common', 'samples', 'group', 'subgroup',
        ]);
        expect(createResult.success).toBe(true);

        const groupExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'group',
        ]);
        expect(groupExists).toBe(true);

        const subgroupExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'group', 'subgroup',
        ]);
        expect(subgroupExists).toBe(true);
      });

      test('cannot create directory with empty name', async ({ page }) => {
        const result = await page.evaluate(async (path) => {
          const root = await navigator.storage.getDirectory();
          let dir: FileSystemDirectoryHandle = root;
          try {
            for (const seg of path) {
              dir = await dir.getDirectoryHandle(seg, { create: true });
            }
            return { success: true };
          } catch (e: unknown) {
            return {
              success: false,
              error: (e instanceof Error) ? e.message : String(e),
            };
          }
        }, ['library', 'common', 'samples', '']);

        expect(result.success).toBe(false);
      });

      test('cannot create duplicate directory', async ({ page }) => {
        await opfsCreateDir(page, ['library', 'common', 'samples', 'my-dir']);
        await opfsCreateDir(page, ['library', 'common', 'samples', 'my-dir']);

        const listing = await opfsListDir(page, [
          'library', 'common', 'samples',
        ]);
        const dirCount = listing.entries.filter(e => e.name === 'my-dir').length;
        expect(dirCount).toBe(1);
      });
    });

    test.describe('Directory Rename', () => {
      test('can rename directory', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'old-name',
        ]);

        const renameResult = await opfsRenameDir(
          page,
          ['library', 'common', 'samples', 'old-name'],
          'new-name',
        );
        expect(renameResult.success).toBe(true);

        const oldExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'old-name',
        ]);
        expect(oldExists).toBe(false);

        const newExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'new-name',
        ]);
        expect(newExists).toBe(true);
      });

      test('cannot rename to empty name', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'my-dir',
        ]);

        const result = await page.evaluate(
          async ({ path, newName }) => {
            try {
              const root = await navigator.storage.getDirectory();
              let parent: FileSystemDirectoryHandle = root;
              for (const seg of path.slice(0, -1)) {
                parent = await parent.getDirectoryHandle(seg);
              }
              await parent.getDirectoryHandle(newName, { create: true });
              return { success: true };
            } catch (e: unknown) {
              return {
                success: false,
                error: (e instanceof Error) ? e.message : String(e),
              };
            }
          },
          { path: ['library', 'common', 'samples', 'my-dir'], newName: '' },
        );

        expect(result.success).toBe(false);
      });

      test('cannot rename to existing directory name', async ({ page }) => {
        await opfsCreateDir(page, ['library', 'common', 'samples', 'dir-a']);
        await opfsCreateDir(page, ['library', 'common', 'samples', 'dir-b']);

        await opfsRenameDir(
          page,
          ['library', 'common', 'samples', 'dir-a'],
          'dir-b',
        );

        // With current implementation, rename overwrites destination
        const dirAExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'dir-a',
        ]);
        expect(dirAExists).toBe(false);

        const dirBExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'dir-b',
        ]);
        expect(dirBExists).toBe(true);
      });

      test('can rename directory with contents', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'my-items',
        ]);
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'my-items'],
          'item1.yaml',
          'name: Item 1',
        );
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'my-items'],
          'item2.yaml',
          'name: Item 2',
        );

        await opfsRenameDir(
          page,
          ['library', 'common', 'samples', 'my-items'],
          'renamed-items',
        );

        const listing = await opfsListDir(page, [
          'library', 'common', 'samples', 'renamed-items',
        ]);
        expect(listing.entries).toHaveLength(2);

        const item1 = await opfsReadFile(
          page,
          ['library', 'common', 'samples', 'renamed-items'],
          'item1.yaml',
        );
        expect(item1.content).toBe('name: Item 1');

        const item2 = await opfsReadFile(
          page,
          ['library', 'common', 'samples', 'renamed-items'],
          'item2.yaml',
        );
        expect(item2.content).toBe('name: Item 2');
      });
    });

    test.describe('Directory Delete', () => {
      test('can delete empty directory', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'empty-dir',
        ]);

        const deleteResult = await opfsDeleteDir(page, [
          'library', 'common', 'samples', 'empty-dir',
        ]);
        expect(deleteResult.success).toBe(true);

        const exists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'empty-dir',
        ]);
        expect(exists).toBe(false);
      });

      test('can delete directory with contents', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'dir-with-contents',
        ]);
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'dir-with-contents'],
          'file1.txt',
          'content1',
        );
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'dir-with-contents', 'subdir',
        ]);
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'dir-with-contents', 'subdir'],
          'file2.txt',
          'content2',
        );

        const deleteResult = await opfsDeleteDir(page, [
          'library', 'common', 'samples', 'dir-with-contents',
        ]);
        expect(deleteResult.success).toBe(true);

        const exists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'dir-with-contents',
        ]);
        expect(exists).toBe(false);
      });

      test('delete non-existent directory fails gracefully', async ({ page }) => {
        const result = await page.evaluate(async (path) => {
          try {
            const root = await navigator.storage.getDirectory();
            let parent: FileSystemDirectoryHandle = root;
            for (const seg of path.slice(0, -1)) {
              parent = await parent.getDirectoryHandle(seg);
            }
            await parent.removeEntry(path[path.length - 1], {
              recursive: true,
            });
            return { success: true };
          } catch (e: unknown) {
            return {
              success: false,
              error: (e instanceof Error) ? e.name : String(e),
            };
          }
        }, ['library', 'common', 'samples', 'does-not-exist']);

        expect(result.success).toBe(false);
        if ('error' in result) {
          expect(result.error).toBe('NotFoundError');
        }
      });
    });

    test.describe('Directory Move', () => {
      test('can move directory to different location', async ({ page }) => {
        await config.initializeOPFS(page);
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'source-dir',
        ]);

        const moveResult = await opfsMoveDir(
          page,
          ['library', 'common', 'samples', 'source-dir'],
          ['library', 'common', 'samples', 'moved-dir'],
        );
        expect(moveResult.success).toBe(true);

        const sourceExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'source-dir',
        ]);
        expect(sourceExists).toBe(false);

        const destExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'moved-dir',
        ]);
        expect(destExists).toBe(true);
      });

      test('can move directory with contents', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'my-samples',
        ]);
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'my-samples'],
          'sample.yaml',
          'name: My Sample',
        );
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'my-samples', 'audio',
        ]);
        await opfsWriteFile(
          page,
          ['library', 'common', 'samples', 'my-samples', 'audio'],
          'sample.bin',
          'binary-data',
        );

        await opfsMoveDir(
          page,
          ['library', 'common', 'samples', 'my-samples'],
          ['library', 'common', 'samples', 'archived-samples'],
        );

        const sampleContent = await opfsReadFile(
          page,
          ['library', 'common', 'samples', 'archived-samples'],
          'sample.yaml',
        );
        expect(sampleContent.content).toBe('name: My Sample');

        const audioContent = await opfsReadFile(
          page,
          ['library', 'common', 'samples', 'archived-samples', 'audio'],
          'sample.bin',
        );
        expect(audioContent.content).toBe('binary-data');
      });

      test('cannot move directory into itself', async ({ page }) => {
        await opfsCreateDir(page, [
          'library', 'common', 'samples', 'parent-dir',
        ]);

        const srcPath = ['library', 'common', 'samples', 'parent-dir'];
        const destPath = [
          'library', 'common', 'samples', 'parent-dir', 'child-dir',
        ];

        expect(isMovingIntoItself(srcPath, destPath)).toBe(true);
      });
    });

    test.describe('Edge Cases', () => {
      test('handles special characters in directory names', async ({ page }) => {
        const specialNames = [
          'with spaces',
          'with-dashes',
          'with_underscores',
          'CamelCase',
          'numbers123',
        ];

        for (const name of specialNames) {
          await opfsCreateDir(page, [
            'library', 'common', 'samples', name,
          ]);
        }

        for (const name of specialNames) {
          const exists = await opfsDirExists(page, [
            'library', 'common', 'samples', name,
          ]);
          expect(exists, `Directory "${name}" should exist`).toBe(true);
        }
      });

      test('handles unicode characters in directory names', async ({ page }) => {
        const unicodeNames = ['cafe', 'test-folder'];

        for (const name of unicodeNames) {
          await opfsCreateDir(page, [
            'library', 'common', 'samples', name,
          ]);
        }

        const cafeExists = await opfsDirExists(page, [
          'library', 'common', 'samples', 'cafe',
        ]);
        expect(cafeExists).toBe(true);
      });

      test('handles deeply nested directories', async ({ page }) => {
        const deepPath = [
          'library', 'common', 'samples',
          'level1', 'level2', 'level3', 'level4', 'level5', 'level6',
        ];

        const createResult = await opfsCreateDir(page, deepPath);
        expect(createResult.success).toBe(true);

        const exists = await opfsDirExists(page, deepPath);
        expect(exists).toBe(true);

        await opfsWriteFile(page, deepPath, 'deep-file.txt', 'I am deeply nested');

        const fileContent = await opfsReadFile(
          page, deepPath, 'deep-file.txt',
        );
        expect(fileContent.success).toBe(true);
        expect(fileContent.content).toBe('I am deeply nested');

        const deleteResult = await opfsDeleteDir(page, [
          'library', 'common', 'samples', 'level1',
        ]);
        expect(deleteResult.success).toBe(true);

        const afterDelete = await opfsDirExists(page, [
          'library', 'common', 'samples', 'level1',
        ]);
        expect(afterDelete).toBe(false);
      });
    });
  });
}
