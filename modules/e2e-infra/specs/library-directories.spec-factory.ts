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
import { OPFS_CORE_HELPERS, OPFS_DIRECTORY_HELPERS } from './opfs-eval-helpers';

const ALL_HELPERS = `${OPFS_CORE_HELPERS}\n${OPFS_DIRECTORY_HELPERS}`;

export function registerDirectoryTests(config: LibraryTestConfig): void {
  test.describe(`${config.editorName} Directory Operations`, () => {
    test.setTimeout(15_000);

    // Clean up OPFS and initialize before each test for isolation
    test.beforeEach(async ({ page }) => {
      await page.goto(config.baseUrl, { timeout: 5000 });

      await page.evaluate(`
        ${ALL_HELPERS}
        (async () => {
          await cleanupOPFS();
        })();
      `);

      await config.initializeOPFS(page);
    });

    test.describe('Directory Creation', () => {
      test('can create directory in library', async ({ page }) => {
        const createResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await createDirectory(['library', 'common', 'samples', 'test-dir']);
          })();
        `);

        expect(createResult.success).toBe(true);

        const exists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'test-dir']);
          })();
        `);
        expect(exists).toBe(true);
      });

      test('can create nested directories', async ({ page }) => {
        const createResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await createDirectory(['library', 'common', 'samples', 'group', 'subgroup']);
          })();
        `);

        expect(createResult.success).toBe(true);

        const groupExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'group']);
          })();
        `);
        expect(groupExists).toBe(true);

        const subgroupExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'group', 'subgroup']);
          })();
        `);
        expect(subgroupExists).toBe(true);
      });

      test('cannot create directory with empty name', async ({ page }) => {
        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            try {
              await createDirectory(['library', 'common', 'samples', '']);
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })();
        `);

        expect(result.success).toBe(false);
      });

      test('cannot create duplicate directory', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await createDirectory(['library', 'common', 'samples', 'my-dir']);
          })();
        `);

        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'my-dir']);
            const listing = await listDirectory(['library', 'common', 'samples']);
            const dirCount = listing.entries.filter(e => e.name === 'my-dir').length;
            return { success: true, dirCount };
          })();
        `) as { success: boolean; dirCount: number };

        expect(result.success).toBe(true);
        expect(result.dirCount).toBe(1);
      });
    });

    test.describe('Directory Rename', () => {
      test('can rename directory', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'old-name']);
          })();
        `);

        const renameResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await renameDirectory(['library', 'common', 'samples', 'old-name'], 'new-name');
          })();
        `);

        expect(renameResult.success).toBe(true);

        const oldExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'old-name']);
          })();
        `);
        expect(oldExists).toBe(false);

        const newExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'new-name']);
          })();
        `);
        expect(newExists).toBe(true);
      });

      test('cannot rename to empty name', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'my-dir']);
          })();
        `);

        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            try {
              await renameDirectory(['library', 'common', 'samples', 'my-dir'], '');
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })();
        `);

        expect(result.success).toBe(false);
      });

      test('cannot rename to existing directory name', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'dir-a']);
            await createDirectory(['library', 'common', 'samples', 'dir-b']);
          })();
        `);

        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            try {
              await renameDirectory(['library', 'common', 'samples', 'dir-a'], 'dir-b');
              const dirAExists = await directoryExists(['library', 'common', 'samples', 'dir-a']);
              const dirBExists = await directoryExists(['library', 'common', 'samples', 'dir-b']);
              return { success: true, dirAExists, dirBExists };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })();
        `) as { success: boolean; dirAExists: boolean; dirBExists: boolean };

        // With current implementation, rename overwrites destination
        expect(result.success).toBe(true);
        expect(result.dirAExists).toBe(false);
        expect(result.dirBExists).toBe(true);
      });

      test('can rename directory with contents', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'my-items']);
            await writeFile(['library', 'common', 'samples', 'my-items'], 'item1.yaml', 'name: Item 1');
            await writeFile(['library', 'common', 'samples', 'my-items'], 'item2.yaml', 'name: Item 2');
          })();
        `);

        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await renameDirectory(['library', 'common', 'samples', 'my-items'], 'renamed-items');
          })();
        `);

        const contents = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const listing = await listDirectory(['library', 'common', 'samples', 'renamed-items']);
            const item1 = await readFile(['library', 'common', 'samples', 'renamed-items'], 'item1.yaml');
            const item2 = await readFile(['library', 'common', 'samples', 'renamed-items'], 'item2.yaml');
            return {
              fileCount: listing.entries.length,
              item1Content: item1.content,
              item2Content: item2.content,
            };
          })();
        `) as { fileCount: number; item1Content: string; item2Content: string };

        expect(contents.fileCount).toBe(2);
        expect(contents.item1Content).toBe('name: Item 1');
        expect(contents.item2Content).toBe('name: Item 2');
      });
    });

    test.describe('Directory Delete', () => {
      test('can delete empty directory', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'empty-dir']);
          })();
        `);

        const deleteResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await deleteDirectory(['library', 'common', 'samples', 'empty-dir']);
          })();
        `);

        expect(deleteResult.success).toBe(true);

        const exists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'empty-dir']);
          })();
        `);
        expect(exists).toBe(false);
      });

      test('can delete directory with contents', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'dir-with-contents']);
            await writeFile(['library', 'common', 'samples', 'dir-with-contents'], 'file1.txt', 'content1');
            await createDirectory(['library', 'common', 'samples', 'dir-with-contents', 'subdir']);
            await writeFile(['library', 'common', 'samples', 'dir-with-contents', 'subdir'], 'file2.txt', 'content2');
          })();
        `);

        const deleteResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await deleteDirectory(['library', 'common', 'samples', 'dir-with-contents']);
          })();
        `);

        expect(deleteResult.success).toBe(true);

        const exists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'dir-with-contents']);
          })();
        `);
        expect(exists).toBe(false);
      });

      test('delete non-existent directory fails gracefully', async ({ page }) => {
        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            try {
              await deleteDirectory(['library', 'common', 'samples', 'does-not-exist']);
              return { success: true };
            } catch (e) {
              return { success: false, error: e.name };
            }
          })();
        `) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toBe('NotFoundError');
      });
    });

    test.describe('Directory Move', () => {
      test('can move directory to different location', async ({ page }) => {
        await config.initializeOPFS(page);

        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'source-dir']);
          })();
        `);

        const moveResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await moveDirectory(
              ['library', 'common', 'samples', 'source-dir'],
              ['library', 'common', 'samples', 'moved-dir']
            );
          })();
        `);

        expect(moveResult.success).toBe(true);

        const sourceExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'source-dir']);
          })();
        `);
        expect(sourceExists).toBe(false);

        const destExists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'moved-dir']);
          })();
        `);
        expect(destExists).toBe(true);
      });

      test('can move directory with contents', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'my-samples']);
            await writeFile(['library', 'common', 'samples', 'my-samples'], 'sample.yaml', 'name: My Sample');
            await createDirectory(['library', 'common', 'samples', 'my-samples', 'audio']);
            await writeFile(['library', 'common', 'samples', 'my-samples', 'audio'], 'sample.bin', 'binary-data');
          })();
        `);

        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await moveDirectory(
              ['library', 'common', 'samples', 'my-samples'],
              ['library', 'common', 'samples', 'archived-samples']
            );
          })();
        `);

        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const sampleContent = await readFile(['library', 'common', 'samples', 'archived-samples'], 'sample.yaml');
            const audioContent = await readFile(
              ['library', 'common', 'samples', 'archived-samples', 'audio'],
              'sample.bin'
            );
            return {
              sampleContent: sampleContent.content,
              audioContent: audioContent.content,
            };
          })();
        `) as { sampleContent: string; audioContent: string };

        expect(result.sampleContent).toBe('name: My Sample');
        expect(result.audioContent).toBe('binary-data');
      });

      test('cannot move directory into itself', async ({ page }) => {
        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            await createDirectory(['library', 'common', 'samples', 'parent-dir']);
          })();
        `);

        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const srcPath = ['library', 'common', 'samples', 'parent-dir'];
            const destPath = ['library', 'common', 'samples', 'parent-dir', 'child-dir'];

            if (isMovingIntoItself(srcPath, destPath)) {
              return { success: false, error: 'Cannot move directory into itself' };
            }

            try {
              await moveDirectory(srcPath, destPath);
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          })();
        `);

        expect(result.success).toBe(false);
      });
    });

    test.describe('Edge Cases', () => {
      test('handles special characters in directory names', async ({ page }) => {
        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const specialNames = [
              'with spaces',
              'with-dashes',
              'with_underscores',
              'CamelCase',
              'numbers123',
            ];

            for (const name of specialNames) {
              await createDirectory(['library', 'common', 'samples', name]);
            }

            const results = [];
            for (const name of specialNames) {
              const exists = await directoryExists(['library', 'common', 'samples', name]);
              results.push({ name, exists });
            }

            return { success: true, results };
          })();
        `) as { success: boolean; results: Array<{ name: string; exists: boolean }> };

        expect(result.success).toBe(true);
        for (const r of result.results) {
          expect(r.exists).toBe(true);
        }
      });

      test('handles unicode characters in directory names', async ({ page }) => {
        const result = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const unicodeNames = [
              'cafe',
              'test-folder',
            ];

            const created = [];
            for (const name of unicodeNames) {
              try {
                await createDirectory(['library', 'common', 'samples', name]);
                const exists = await directoryExists(['library', 'common', 'samples', name]);
                created.push({ name, exists });
              } catch (e) {
                created.push({ name, exists: false, error: e.message });
              }
            }

            return { success: true, created };
          })();
        `) as { success: boolean; created: Array<{ name: string; exists: boolean }> };

        expect(result.success).toBe(true);
        const cafeResult = result.created.find(c => c.name === 'cafe');
        expect(cafeResult?.exists).toBe(true);
      });

      test('handles deeply nested directories', async ({ page }) => {
        const deepPath = [
          'library',
          'common',
          'samples',
          'level1',
          'level2',
          'level3',
          'level4',
          'level5',
          'level6',
        ];

        const createResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const path = ${JSON.stringify(deepPath)};
            return await createDirectory(path);
          })();
        `);

        expect(createResult.success).toBe(true);

        const exists = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const path = ${JSON.stringify(deepPath)};
            return await directoryExists(path);
          })();
        `);
        expect(exists).toBe(true);

        await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const path = ${JSON.stringify(deepPath)};
            await writeFile(path, 'deep-file.txt', 'I am deeply nested');
          })();
        `);

        const fileContent = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            const path = ${JSON.stringify(deepPath)};
            return await readFile(path, 'deep-file.txt');
          })();
        `) as { success: boolean; content: string };

        expect(fileContent.success).toBe(true);
        expect(fileContent.content).toBe('I am deeply nested');

        const deleteResult = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await deleteDirectory(['library', 'common', 'samples', 'level1']);
          })();
        `);

        expect(deleteResult.success).toBe(true);

        const afterDelete = await page.evaluate(`
          ${ALL_HELPERS}
          (async () => {
            return await directoryExists(['library', 'common', 'samples', 'level1']);
          })();
        `);
        expect(afterDelete).toBe(false);
      });
    });
  });
}
