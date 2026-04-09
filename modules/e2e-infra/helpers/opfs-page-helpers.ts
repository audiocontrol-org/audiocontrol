/**
 * Reusable OPFS page.evaluate helpers for e2e tests.
 *
 * Each function wraps a single page.evaluate() call with function-based
 * (not string-based) evaluation. These are safe to use in Playwright e2e
 * tests and avoid the SyntaxError issues caused by template-string evaluation.
 */

import type { Page } from '@playwright/test';

/** Delete all entries from OPFS root. */
export async function opfsCleanup(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    async function deleteAll(dir: FileSystemDirectoryHandle): Promise<void> {
      for await (const entry of dir.values()) {
        if (entry.kind === 'directory') {
          const sub = await dir.getDirectoryHandle(entry.name);
          await deleteAll(sub);
        }
        await dir.removeEntry(entry.name, { recursive: true });
      }
    }
    await deleteAll(root);
  });
}

/** Check if OPFS root has zero entries. */
export async function opfsIsEmpty(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    for await (const _ of root.values()) {
      return false;
    }
    return true;
  });
}

/** Create a directory at the given path, creating intermediaries. */
export async function opfsCreateDir(
  page: Page,
  path: string[],
): Promise<{ success: boolean }> {
  return page.evaluate(async (p) => {
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    for (const seg of p) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }
    return { success: true };
  }, path);
}

/** Check whether a directory exists at the given path. */
export async function opfsDirExists(
  page: Page,
  path: string[],
): Promise<boolean> {
  return page.evaluate(async (p) => {
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    try {
      for (const seg of p) {
        dir = await dir.getDirectoryHandle(seg);
      }
      return true;
    } catch {
      return false;
    }
  }, path);
}

/** Write a text file at the given directory path. */
export async function opfsWriteFile(
  page: Page,
  dirPath: string[],
  fileName: string,
  content: string,
): Promise<void> {
  await page.evaluate(
    async ({ path, fileName, content }) => {
      const root = await navigator.storage.getDirectory();
      let dir: FileSystemDirectoryHandle = root;
      for (const seg of path) {
        dir = await dir.getDirectoryHandle(seg, { create: true });
      }
      const fh = await dir.getFileHandle(fileName, { create: true });
      const w = await fh.createWritable();
      await w.write(content);
      await w.close();
    },
    { path: dirPath, fileName, content },
  );
}

/** Read a text file at the given directory path. */
export async function opfsReadFile(
  page: Page,
  dirPath: string[],
  fileName: string,
): Promise<{ success: boolean; content: string }> {
  return page.evaluate(
    async ({ path, fileName }) => {
      const root = await navigator.storage.getDirectory();
      let dir: FileSystemDirectoryHandle = root;
      for (const seg of path) {
        dir = await dir.getDirectoryHandle(seg);
      }
      const fh = await dir.getFileHandle(fileName);
      const file = await fh.getFile();
      const content = await file.text();
      return { success: true, content };
    },
    { path: dirPath, fileName },
  );
}

/** List entries in a directory. */
export async function opfsListDir(
  page: Page,
  path: string[],
): Promise<{ success: boolean; entries: Array<{ name: string; kind: string }> }> {
  return page.evaluate(async (p) => {
    const root = await navigator.storage.getDirectory();
    let dir: FileSystemDirectoryHandle = root;
    for (const seg of p) {
      dir = await dir.getDirectoryHandle(seg);
    }
    const entries: Array<{ name: string; kind: string }> = [];
    for await (const entry of dir.values()) {
      entries.push({ name: entry.name, kind: entry.kind });
    }
    return { success: true, entries };
  }, path);
}

/** Delete a directory at the given path. */
export async function opfsDeleteDir(
  page: Page,
  path: string[],
): Promise<{ success: boolean }> {
  return page.evaluate(async (p) => {
    const root = await navigator.storage.getDirectory();
    let parent: FileSystemDirectoryHandle = root;
    const parentPath = p.slice(0, -1);
    for (const seg of parentPath) {
      parent = await parent.getDirectoryHandle(seg);
    }
    const dirName = p[p.length - 1];
    await parent.removeEntry(dirName, { recursive: true });
    return { success: true };
  }, path);
}

/**
 * Rename a directory by copying contents to a new name and removing the old.
 * Returns { success: true } on success.
 */
export async function opfsRenameDir(
  page: Page,
  path: string[],
  newName: string,
): Promise<{ success: boolean }> {
  return page.evaluate(
    async ({ path, newName }) => {
      const root = await navigator.storage.getDirectory();
      let parent: FileSystemDirectoryHandle = root;
      const parentPath = path.slice(0, -1);
      for (const seg of parentPath) {
        parent = await parent.getDirectoryHandle(seg);
      }
      const oldName = path[path.length - 1];
      const oldDir = await parent.getDirectoryHandle(oldName);
      const newDir = await parent.getDirectoryHandle(newName, { create: true });

      async function copyContents(
        src: FileSystemDirectoryHandle,
        dest: FileSystemDirectoryHandle,
      ): Promise<void> {
        for await (const entry of src.values()) {
          if (entry.kind === 'file') {
            const srcFile = await src.getFileHandle(entry.name);
            const file = await srcFile.getFile();
            const content = await file.arrayBuffer();
            const destFile = await dest.getFileHandle(entry.name, {
              create: true,
            });
            const w = await destFile.createWritable();
            await w.write(content);
            await w.close();
          } else {
            const srcSub = await src.getDirectoryHandle(entry.name);
            const destSub = await dest.getDirectoryHandle(entry.name, {
              create: true,
            });
            await copyContents(srcSub, destSub);
          }
        }
      }

      await copyContents(oldDir, newDir);
      await parent.removeEntry(oldName, { recursive: true });
      return { success: true };
    },
    { path, newName },
  );
}

/**
 * Move a directory from srcPath to destPath by copying contents then removing
 * the source. Does NOT check for moving into itself -- caller must do that.
 */
export async function opfsMoveDir(
  page: Page,
  srcPath: string[],
  destPath: string[],
): Promise<{ success: boolean }> {
  return page.evaluate(
    async ({ srcPath, destPath }) => {
      const root = await navigator.storage.getDirectory();

      let srcParent: FileSystemDirectoryHandle = root;
      for (const seg of srcPath.slice(0, -1)) {
        srcParent = await srcParent.getDirectoryHandle(seg);
      }
      const srcName = srcPath[srcPath.length - 1];
      const srcDir = await srcParent.getDirectoryHandle(srcName);

      let destParent: FileSystemDirectoryHandle = root;
      for (const seg of destPath.slice(0, -1)) {
        destParent = await destParent.getDirectoryHandle(seg, { create: true });
      }
      const destName = destPath[destPath.length - 1];
      const destDir = await destParent.getDirectoryHandle(destName, {
        create: true,
      });

      async function copyContents(
        src: FileSystemDirectoryHandle,
        dest: FileSystemDirectoryHandle,
      ): Promise<void> {
        for await (const entry of src.values()) {
          if (entry.kind === 'file') {
            const srcFile = await src.getFileHandle(entry.name);
            const file = await srcFile.getFile();
            const content = await file.arrayBuffer();
            const destFile = await dest.getFileHandle(entry.name, {
              create: true,
            });
            const w = await destFile.createWritable();
            await w.write(content);
            await w.close();
          } else {
            const srcSub = await src.getDirectoryHandle(entry.name);
            const destSub = await dest.getDirectoryHandle(entry.name, {
              create: true,
            });
            await copyContents(srcSub, destSub);
          }
        }
      }

      await copyContents(srcDir, destDir);
      await srcParent.removeEntry(srcName, { recursive: true });
      return { success: true };
    },
    { srcPath, destPath },
  );
}

/** Check if moving srcPath into destPath would be moving into itself. */
export function isMovingIntoItself(
  srcPath: string[],
  destPath: string[],
): boolean {
  const srcStr = srcPath.join('/');
  const destStr = destPath.join('/');
  return destStr.startsWith(srcStr + '/') || destStr === srcStr;
}
