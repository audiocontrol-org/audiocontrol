/**
 * Inlined OPFS helper functions for page.evaluate() calls.
 *
 * These are string constants because page.evaluate() cannot import modules.
 * Each test factory prepends the relevant helpers before its evaluate calls.
 */

/**
 * Core OPFS helpers: root access, read/write, list, cleanup.
 * Used by both OPFS and directory test factories.
 */
export const OPFS_CORE_HELPERS = `
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

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

  async function populateFixtures(fixtures) {
    const results = [];
    for (const fixture of fixtures) {
      await writeFile(fixture.path, fixture.fileName, fixture.content);
      results.push({ path: fixture.path, fileName: fixture.fileName });
    }
    return { success: true, created: results };
  }

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

  async function deleteDirectoryContents(dirHandle) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        const subDir = await dirHandle.getDirectoryHandle(entry.name);
        await deleteDirectoryContents(subDir);
      }
      await dirHandle.removeEntry(entry.name, { recursive: true });
    }
  }

  async function cleanupOPFS() {
    const root = await getOPFSRoot();
    await deleteDirectoryContents(root);
    return { success: true };
  }

  async function isOPFSEmpty() {
    const root = await getOPFSRoot();
    for await (const _ of root.values()) {
      return false;
    }
    return true;
  }
`;

/**
 * Directory CRUD helpers: create, rename, move, delete.
 * Appended to OPFS_CORE_HELPERS for directory operation tests.
 */
export const OPFS_DIRECTORY_HELPERS = `
  async function createDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    return { success: true };
  }

  async function copyContents(srcDir, destDir) {
    for await (const entry of srcDir.values()) {
      if (entry.kind === 'file') {
        const srcFile = await srcDir.getFileHandle(entry.name);
        const file = await srcFile.getFile();
        const content = await file.arrayBuffer();
        const destFile = await destDir.getFileHandle(entry.name, { create: true });
        const writable = await destFile.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        const srcSubDir = await srcDir.getDirectoryHandle(entry.name);
        const destSubDir = await destDir.getDirectoryHandle(entry.name, { create: true });
        await copyContents(srcSubDir, destSubDir);
      }
    }
  }

  async function renameDirectory(pathSegments, newName) {
    const root = await getOPFSRoot();
    let parent = root;
    const parentPath = pathSegments.slice(0, -1);
    for (const segment of parentPath) {
      parent = await parent.getDirectoryHandle(segment);
    }

    const oldName = pathSegments[pathSegments.length - 1];
    const oldDir = await parent.getDirectoryHandle(oldName);
    const newDir = await parent.getDirectoryHandle(newName, { create: true });

    await copyContents(oldDir, newDir);
    await parent.removeEntry(oldName, { recursive: true });

    return { success: true };
  }

  async function moveDirectory(srcPathSegments, destPathSegments) {
    const root = await getOPFSRoot();

    let srcParent = root;
    const srcParentPath = srcPathSegments.slice(0, -1);
    for (const segment of srcParentPath) {
      srcParent = await srcParent.getDirectoryHandle(segment);
    }

    const srcName = srcPathSegments[srcPathSegments.length - 1];
    const srcDir = await srcParent.getDirectoryHandle(srcName);

    let destParent = root;
    const destParentPath = destPathSegments.slice(0, -1);
    for (const segment of destParentPath) {
      destParent = await destParent.getDirectoryHandle(segment, { create: true });
    }

    const destName = destPathSegments[destPathSegments.length - 1];
    const destDir = await destParent.getDirectoryHandle(destName, { create: true });

    await copyContents(srcDir, destDir);
    await srcParent.removeEntry(srcName, { recursive: true });

    return { success: true };
  }

  async function deleteDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let parent = root;
    const parentPath = pathSegments.slice(0, -1);
    for (const segment of parentPath) {
      parent = await parent.getDirectoryHandle(segment);
    }

    const dirName = pathSegments[pathSegments.length - 1];
    await parent.removeEntry(dirName, { recursive: true });

    return { success: true };
  }

  function isMovingIntoItself(srcPath, destPath) {
    const srcStr = srcPath.join('/');
    const destStr = destPath.join('/');
    return destStr.startsWith(srcStr + '/') || destStr === srcStr;
  }
`;
