/**
 * Library filesystem types and recursive directory scanners.
 *
 * Provides the shared types and recursive directory scanners used by
 * any consumer of the library layout:
 *
 *   {root}/library/{device}/tones/
 *   {root}/library/{device}/patches/
 *   {root}/library/{device}/sets/{name}/tones/
 *   {root}/library/common/samples/
 *
 * All scanners are built on a generic `scanLibraryDirectory` function
 * parameterized by an `ItemDetector`. Adding a new item type requires
 * only a new detector, not a new scanner.
 *
 * All functions accept abstract {@link StorageDirectoryHandle} parameters,
 * making them portable across runtimes. Browser FSAA handles satisfy
 * the interface via structural typing.
 */

import { parse as parseYaml } from 'yaml';

import type { StorageDirectoryHandle, StorageEntry } from './storage-handles.js';
import { SampleYamlSchema, ProgramYamlSchema } from './schemas/index.js';

// =========================================================================
// Types
// =========================================================================

/** Library item category types that support subdirectories. */
export type LibraryCategory = 'tones' | 'patches';

/** All category types. */
export const LIBRARY_CATEGORIES: LibraryCategory[] = ['tones', 'patches'];

/**
 * Tree node for rendering hierarchical library contents.
 * Used by both directories and items (tones, patches, drum-kits).
 */
export interface LibraryTreeNode {
  /** Unique identifier for this node (path joined by '/') */
  id: string;
  /** Display name */
  name: string;
  /** Node type. Common-area samples are always 'sample' — slice/drum-kit state
   *  is in metadata (sliceCount, hasDrumKit). */
  type: 'directory' | 'tone' | 'patch' | 'sample' | 'program';
  /** Path segments from category root (empty for root items) */
  path: string[];
  /** Child nodes (only for directories) */
  children?: LibraryTreeNode[];
  /** Whether directory is expanded in UI (client state, not persisted) */
  isExpanded?: boolean;
  /** File name for items (without extension) */
  fileName?: string;
  /** Directory name for patches/drum-kits */
  directoryName?: string;
  /** Additional metadata for patches */
  toneCount?: number;
  /** Additional metadata for programs */
  kitCount?: number;
  description?: string;
  /** Number of slices (if sample has slice definitions) */
  sliceCount?: number;
  /** Whether sample has drum kit config (base note, pad mapping) */
  hasDrumKit?: boolean;
}

// =========================================================================
// Directory Navigation
// =========================================================================

/**
 * Get or create a nested directory path within a directory handle.
 */
export async function getNestedDirectory(
  rootHandle: StorageDirectoryHandle,
  path: string[],
): Promise<StorageDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Get a nested directory for read-only access.
 * Does not use { create: true }, allowing directory handles to be cached.
 * Throws if any part of the path doesn't exist.
 */
export async function getNestedDirectoryReadOnly(
  rootHandle: StorageDirectoryHandle,
  path: string[],
): Promise<StorageDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment);
  }
  return current;
}

/**
 * Get a nested directory without creating it.
 * Returns null if any part of the path doesn't exist.
 */
export async function getNestedDirectoryIfExists(
  rootHandle: StorageDirectoryHandle,
  path: string[],
): Promise<StorageDirectoryHandle | null> {
  let current = rootHandle;
  try {
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment);
    }
    return current;
  } catch {
    return null;
  }
}

// =========================================================================
// Filesystem move operations
// =========================================================================

/**
 * Copy all contents from source directory to target directory (recursive).
 */
export async function copyDirectoryContents(
  src: StorageDirectoryHandle,
  dest: StorageDirectoryHandle,
): Promise<void> {
  for await (const entry of src.values()) {
    if (entry.kind === 'file') {
      const srcFile = await src.getFileHandle(entry.name);
      const file = await srcFile.getFile();
      const destFile = await dest.getFileHandle(entry.name, { create: true });
      const writable = await destFile.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    } else {
      const srcSub = await src.getDirectoryHandle(entry.name);
      const destSub = await dest.getDirectoryHandle(entry.name, { create: true });
      await copyDirectoryContents(srcSub, destSub);
    }
  }
}

/**
 * Move a directory from one parent to another.
 * FSAA has no native move, so this copies contents then removes the source.
 */
export async function moveDirectory(
  parentDir: StorageDirectoryHandle,
  name: string,
  targetParentDir: StorageDirectoryHandle,
): Promise<void> {
  const srcDir = await parentDir.getDirectoryHandle(name, { create: false });
  const destDir = await targetParentDir.getDirectoryHandle(name, { create: true });
  await copyDirectoryContents(srcDir, destDir);
  await parentDir.removeEntry(name, { recursive: true });
}


/**
 * Check whether moving a source item into a target directory is valid.
 * Returns false if:
 * - Target is the source itself
 * - Target is a descendant of the source (circular move)
 * - Source is already in the target (no-op move)
 *
 * Pure path logic — no filesystem access needed.
 */
export function isValidMoveTarget(
  sourcePath: string[],
  sourceName: string,
  targetPath: string[],
): boolean {
  const sourceFullPath = [...sourcePath, sourceName].join('/');
  const targetFullPath = targetPath.join('/');

  // Prevent dropping into itself or a descendant
  if (targetFullPath === sourceFullPath || targetFullPath.startsWith(sourceFullPath + '/')) {
    return false;
  }

  // Prevent no-op move (already in the target directory)
  if (sourcePath.join('/') === targetFullPath) {
    return false;
  }

  return true;
}

// =========================================================================
// Sorting helper
// =========================================================================

function sortNodes(nodes: LibraryTreeNode[]): LibraryTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

// =========================================================================
// Generic scanner
// =========================================================================

/**
 * Detector function signature for the generic scanner.
 * Returns a `LibraryTreeNode` if the entry is a recognized item,
 * or `null` to let the scanner treat it as an organizational directory.
 */
export type ItemDetector = (
  entry: StorageEntry,
  parentDir: StorageDirectoryHandle,
  path: string[],
) => Promise<LibraryTreeNode | null>;

/**
 * Generic recursive directory scanner parameterized by a detector.
 *
 * For each entry in `dir`:
 * - Calls `detectItem`. If it returns a node, that node is used.
 * - If `null` and the entry is a directory, recurses as an organizational folder.
 * - If `null` and the entry is a file, the entry is skipped.
 */
export async function scanLibraryDirectory(
  dir: StorageDirectoryHandle,
  path: string[],
  detectItem: ItemDetector,
): Promise<LibraryTreeNode[]> {
  const nodes: LibraryTreeNode[] = [];

  for await (const entry of dir.values()) {
    const detected = await detectItem(entry, dir, path);
    if (detected) {
      nodes.push(detected);
    } else if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name);
      const children = await scanLibraryDirectory(subDir, [...path, entry.name], detectItem);
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: entry.name,
        type: 'directory',
        path,
        children,
      });
    }
    // Files that aren't detected are silently skipped
  }

  return sortNodes(nodes);
}

// =========================================================================
// Item detectors
// =========================================================================

/** Detect a tone: a `.yaml` file in the current directory. */
const detectTone: ItemDetector = async (entry, _parentDir, path) => {
  if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.yaml')) return null;
  const fileName = entry.name.replace(/\.yaml$/i, '');
  return {
    id: [...path, fileName].join('/'),
    name: fileName,
    type: 'tone',
    path,
    fileName,
  };
};

/** Detect a patch: a directory containing `patch.yaml`. */
const detectPatch: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'directory') return null;

  const subDir = await parentDir.getDirectoryHandle(entry.name);

  let isPatchBundle = false;
  let patchName = entry.name;
  let toneCount = 0;

  try {
    const yamlHandle = await subDir.getFileHandle('patch.yaml');
    const yamlFile = await yamlHandle.getFile();
    const content = await yamlFile.text();
    const yaml = parseYaml(content) as { name?: string };
    patchName = yaml.name || entry.name;
    isPatchBundle = true;

    try {
      const tonesDir = await subDir.getDirectoryHandle('tones');
      for await (const toneEntry of tonesDir.values()) {
        if (toneEntry.kind === 'file' && toneEntry.name.endsWith('.yaml')) {
          toneCount++;
        }
      }
    } catch {
      // No tones directory
    }
  } catch {
    // Not a patch bundle
  }

  if (!isPatchBundle) return null;

  return {
    id: [...path, entry.name].join('/'),
    name: patchName,
    type: 'patch',
    path,
    directoryName: entry.name,
    toneCount,
  };
};

// =========================================================================
// Tone scanning (wrapper over generic scanner)
// =========================================================================

/**
 * Recursively scan a directory for tones and build a tree structure.
 * A tone is identified by a .yaml file (optionally paired with a .wav).
 */
export async function scanTonesDirectory(
  dir: StorageDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectTone);
}

/**
 * List all standalone tones for a device as a hierarchical tree.
 */
export async function listTonesTree(
  root: StorageDirectoryHandle,
  device: string,
): Promise<LibraryTreeNode[]> {
  const tonesDir = await getNestedDirectoryIfExists(root, ['library', device, 'tones']);
  if (!tonesDir) return [];
  return scanTonesDirectory(tonesDir, []);
}

// =========================================================================
// Patch scanning (wrapper over generic scanner)
// =========================================================================

/**
 * Recursively scan a directory for patches and build a tree structure.
 * A patch is a directory containing patch.yaml (and optionally a tones/ subdirectory).
 */
export async function scanPatchesDirectory(
  dir: StorageDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectPatch);
}

/**
 * List all patches for a device as a hierarchical tree.
 */
export async function listPatchesTree(
  root: StorageDirectoryHandle,
  device: string,
): Promise<LibraryTreeNode[]> {
  const patchesDir = await getNestedDirectoryIfExists(root, ['library', device, 'patches']);
  if (!patchesDir) return [];
  return scanPatchesDirectory(patchesDir, []);
}

// =========================================================================
// Common-area sample detection
// =========================================================================

/**
 * Detect a common-area sample: a directory containing `sample.yaml`
 * with `format: 'sample'`.
 *
 * Discriminates node type based on YAML content:
 * - `slices` + `drumKit` present  -> type: 'drum-kit', variant: 'drum-kit'
 * - `slices` present (no drumKit) -> type: 'chopped-sample', variant: 'generic'
 * - neither                       -> type: 'sample'
 *
 * Samples are stored as directory bundles:
 *   {name}/sample.yaml + sample.wav
 */
const detectSample: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'directory') return null;

  try {
    const sampleDir = await parentDir.getDirectoryHandle(entry.name);
    const yamlHandle = await sampleDir.getFileHandle('sample.yaml');
    const file = await yamlHandle.getFile();
    const text = await file.text();
    const parsed = parseYaml(text);
    const result = SampleYamlSchema.safeParse(parsed);
    if (!result.success) return null;

    const data = result.data;

    // All samples are type 'sample'. Slice and drum kit metadata are
    // communicated via the node's metadata fields, not the type.
    // See SAMPLER-LIBRARY.md "Sample Slicing" for the theory.
    return {
      id: [...path, entry.name].join('/'),
      name: data.name,
      type: 'sample' as LibraryTreeNode['type'],
      path,
      directoryName: entry.name,
      description: data.description,
      sliceCount: data.slices?.length,
      hasDrumKit: data.drumKit !== undefined,
    };
  } catch {
    return null;
  }
};

/**
 * Detect a common-area program: a directory containing `program.yaml`
 * with `format: 'program'`.
 */
const detectProgram: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'directory') return null;

  const subDir = await parentDir.getDirectoryHandle(entry.name);

  try {
    const manifestHandle = await subDir.getFileHandle('program.yaml');
    const file = await manifestHandle.getFile();
    const text = await file.text();
    const parsed = parseYaml(text);
    const result = ProgramYamlSchema.safeParse(parsed);
    if (!result.success) return null;

    return {
      id: [...path, entry.name].join('/'),
      name: result.data.name,
      type: 'program',
      path,
      directoryName: entry.name,
      description: result.data.description,
      kitCount: result.data.zones.length,
    };
  } catch {
    return null;
  }
};

/**
 * Combined detector for `library/common/samples/` that recognizes
 * samples, programs, and legacy chopped samples.
 */
const detectCommonItem: ItemDetector = async (entry, parentDir, path) => {
  // Try sample first (directories with sample.yaml)
  const sample = await detectSample(entry, parentDir, path);
  if (sample) return sample;

  // Try program (directories with program.yaml)
  const program = await detectProgram(entry, parentDir, path);
  if (program) return program;

  return null;
};

// =========================================================================
// Common-area scanning
// =========================================================================

/**
 * Recursively scan a directory for common-area content (samples,
 * programs, and legacy chopped samples) and build a tree structure.
 */
export async function scanCommonSamplesDirectory(
  dir: StorageDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectCommonItem);
}

/**
 * List all common-area content from `library/common/samples/` as a
 * hierarchical tree. Returns samples, programs, and legacy chopped
 * samples in a unified tree.
 */
export async function listCommonSamplesTree(
  root: StorageDirectoryHandle,
): Promise<LibraryTreeNode[]> {
  const samplesDir = await getNestedDirectoryIfExists(root, ['library', 'common', 'samples']);
  if (!samplesDir) return [];
  return scanCommonSamplesDirectory(samplesDir, []);
}

// =========================================================================
// Set scanning
// =========================================================================

/** Summary info for a saved set. */
export interface LibrarySetInfo {
  name: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
  toneCount: number;
  patchCount: number;
  directoryName: string;
}

/**
 * List all sets for a device.
 */
export async function listSets(
  root: StorageDirectoryHandle,
  device: string,
): Promise<LibrarySetInfo[]> {
  const setsDir = await getNestedDirectoryIfExists(root, ['library', device, 'sets']);
  if (!setsDir) return [];

  const sets: LibrarySetInfo[] = [];

  for await (const entry of setsDir.values()) {
    if (entry.kind !== 'directory') continue;

    try {
      const setDir = await setsDir.getDirectoryHandle(entry.name);
      const manifestHandle = await setDir.getFileHandle('set.yaml');
      const manifestFile = await manifestHandle.getFile();
      const manifestContent = await manifestFile.text();
      const manifest = parseYaml(manifestContent) as {
        name?: string;
        description?: string;
        createdAt?: string;
        modifiedAt?: string;
        tones?: unknown[];
        patches?: unknown[];
      };

      sets.push({
        name: manifest.name ?? entry.name,
        description: manifest.description,
        createdAt: manifest.createdAt,
        modifiedAt: manifest.modifiedAt,
        toneCount: manifest.tones?.length ?? 0,
        patchCount: manifest.patches?.length ?? 0,
        directoryName: entry.name,
      });
    } catch {
      // Skip invalid sets
    }
  }

  return sets.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List tones inside a specific set.
 */
export async function listSetTonesTree(
  root: StorageDirectoryHandle,
  device: string,
  setName: string,
): Promise<LibraryTreeNode[]> {
  const tonesDir = await getNestedDirectoryIfExists(
    root, ['library', device, 'sets', setName, 'tones'],
  );
  if (!tonesDir) return [];
  return scanTonesDirectory(tonesDir, []);
}
