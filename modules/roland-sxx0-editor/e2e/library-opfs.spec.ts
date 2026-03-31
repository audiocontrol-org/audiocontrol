/**
 * E2E tests for OPFS (Origin Private File System) helpers.
 *
 * These tests verify that OPFS operations work correctly in browser context.
 * Tests run with short timeouts for fast failure detection.
 */

import { test, expect } from '@playwright/test';

// Short timeouts - fail fast
test.setTimeout(15_000);

/**
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 */
const OPFS_HELPERS = `
  /**
   * Get the OPFS root directory handle.
   */
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  /**
   * Initialize the library directory structure.
   * Creates: library/tones, library/patches, library/sets
   */
  async function initializeOPFS() {
    const root = await getOPFSRoot();
    const library = await root.getDirectoryHandle('library', { create: true });
    await library.getDirectoryHandle('tones', { create: true });
    await library.getDirectoryHandle('patches', { create: true });
    await library.getDirectoryHandle('sets', { create: true });
    return { success: true };
  }

  /**
   * Check if a directory exists at the given path.
   */
  async function directoryExists(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write a file to OPFS at the given path.
   */
  async function writeFile(pathSegments, fileName, content) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { success: true };
  }

  /**
   * Read a file from OPFS at the given path.
   */
  async function readFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { success: true, content };
  }

  /**
   * Populate fixtures - create test files in OPFS.
   */
  async function populateFixtures(fixtures) {
    const results = [];
    for (const fixture of fixtures) {
      await writeFile(fixture.path, fixture.fileName, fixture.content);
      results.push({ path: fixture.path, fileName: fixture.fileName });
    }
    return { success: true, created: results };
  }

  /**
   * List directory contents at the given path.
   */
  async function listDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const entries = [];
    for await (const entry of current.values()) {
      entries.push({ name: entry.name, kind: entry.kind });
    }
    return { success: true, entries };
  }

  /**
   * Recursively delete all contents of a directory.
   */
  async function deleteDirectoryContents(dirHandle) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        const subDir = await dirHandle.getDirectoryHandle(entry.name);
        await deleteDirectoryContents(subDir);
      }
      await dirHandle.removeEntry(entry.name, { recursive: true });
    }
  }

  /**
   * Clean up OPFS - remove all files and directories.
   */
  async function cleanupOPFS() {
    const root = await getOPFSRoot();
    await deleteDirectoryContents(root);
    return { success: true };
  }

  /**
   * Check if OPFS is empty.
   */
  async function isOPFSEmpty() {
    const root = await getOPFSRoot();
    for await (const _ of root.values()) {
      return false;
    }
    return true;
  }
`;

test.describe('Library OPFS Operations', () => {
  // Clean up OPFS before each test for isolation
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
      })();
    `);
  });

  test('OPFS is available', async ({ page }) => {
    test.setTimeout(5000);

    await page.goto('/', { timeout: 5000 });

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
    await page.goto('/', { timeout: 5000 });

    // Initialize the library structure
    const initResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await initializeOPFS();
      })();
    `);

    expect(initResult.success).toBe(true);

    // Verify directories exist
    const tonesExists = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await directoryExists(['library', 'tones']);
      })();
    `);
    expect(tonesExists).toBe(true);

    const patchesExists = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await directoryExists(['library', 'patches']);
      })();
    `);
    expect(patchesExists).toBe(true);

    const setsExists = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await directoryExists(['library', 'sets']);
      })();
    `);
    expect(setsExists).toBe(true);
  });

  test('can write and read files', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    const testContent = 'Hello, OPFS! This is a test file.';
    const testPath = ['test-dir'];
    const testFileName = 'test-file.txt';

    // Write the file
    const writeResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await writeFile(${JSON.stringify(testPath)}, ${JSON.stringify(testFileName)}, ${JSON.stringify(testContent)});
      })();
    `);

    expect(writeResult.success).toBe(true);

    // Read the file back
    const readResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await readFile(${JSON.stringify(testPath)}, ${JSON.stringify(testFileName)});
      })();
    `) as { success: boolean; content: string };

    expect(readResult.success).toBe(true);
    expect(readResult.content).toBe(testContent);
  });

  test('can populate fixtures', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    const fixtures = [
      {
        path: ['library', 'tones'],
        fileName: 'tone1.yaml',
        content: 'name: Test Tone 1\nformat: tone',
      },
      {
        path: ['library', 'tones'],
        fileName: 'tone2.yaml',
        content: 'name: Test Tone 2\nformat: tone',
      },
      {
        path: ['library', 'patches', 'my-patch'],
        fileName: 'patch.yaml',
        content: 'name: My Patch\nformat: patch',
      },
    ];

    // Populate fixtures
    const populateResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await populateFixtures(${JSON.stringify(fixtures)});
      })();
    `) as { success: boolean; created: Array<{ path: string[]; fileName: string }> };

    expect(populateResult.success).toBe(true);
    expect(populateResult.created).toHaveLength(3);

    // Verify files were created by reading them back
    for (const fixture of fixtures) {
      const readResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readFile(${JSON.stringify(fixture.path)}, ${JSON.stringify(fixture.fileName)});
        })();
      `) as { success: boolean; content: string };

      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe(fixture.content);
    }
  });

  test('can list directory contents', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    // Create some test files and directories
    const fixtures = [
      { path: ['test-dir'], fileName: 'file1.txt', content: 'content1' },
      { path: ['test-dir'], fileName: 'file2.txt', content: 'content2' },
      { path: ['test-dir', 'subdir'], fileName: 'nested.txt', content: 'nested' },
    ];

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await populateFixtures(${JSON.stringify(fixtures)});
      })();
    `);

    // List the directory
    const listResult = await page.evaluate(`
      ${OPFS_HELPERS}
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
    await page.goto('/', { timeout: 5000 });

    // First, populate some fixtures
    const fixtures = [
      { path: ['library', 'tones'], fileName: 'tone1.yaml', content: 'test' },
      { path: ['library', 'patches'], fileName: 'patch1.yaml', content: 'test' },
      { path: ['deep', 'nested', 'path'], fileName: 'file.txt', content: 'test' },
    ];

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await populateFixtures(${JSON.stringify(fixtures)});
      })();
    `);

    // Verify OPFS is not empty
    const beforeCleanup = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await isOPFSEmpty();
      })();
    `);
    expect(beforeCleanup).toBe(false);

    // Clean up OPFS
    const cleanupResult = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await cleanupOPFS();
      })();
    `);

    expect(cleanupResult.success).toBe(true);

    // Verify OPFS is empty
    const afterCleanup = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await isOPFSEmpty();
      })();
    `);
    expect(afterCleanup).toBe(true);
  });

  test('cleanup is isolated between tests', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    // This test verifies that each test starts with a clean OPFS.
    // The beforeEach hook should have cleaned up any data from previous tests.

    // Verify OPFS is empty at the start of this test
    const isEmpty = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await isOPFSEmpty();
      })();
    `);
    expect(isEmpty).toBe(true);

    // Create some data that would persist if cleanup didn't work
    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await writeFile(['isolation-test'], 'marker.txt', 'This should be cleaned up');
      })();
    `);

    // Verify data was created
    const afterWrite = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await isOPFSEmpty();
      })();
    `);
    expect(afterWrite).toBe(false);

    // The next test will verify the isolation by checking that OPFS is empty again
    // (via the beforeEach hook)
  });

  test('isolation verification - OPFS should be empty from previous test cleanup', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    // This test runs after 'cleanup is isolated between tests' and verifies
    // that the beforeEach cleanup worked correctly - the 'isolation-test'
    // directory should not exist.

    const isEmpty = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await isOPFSEmpty();
      })();
    `);
    expect(isEmpty).toBe(true);

    // Also verify the specific directory from the previous test doesn't exist
    const isolationDirExists = await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        return await directoryExists(['isolation-test']);
      })();
    `);
    expect(isolationDirExists).toBe(false);
  });
});
