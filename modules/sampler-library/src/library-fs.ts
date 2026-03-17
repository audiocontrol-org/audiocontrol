/**
 * Library filesystem types and FSAA scanning functions.
 *
 * Provides the shared types and recursive directory scanners used by
 * any consumer of the FSAA library layout:
 *
 *   {root}/library/{device}/tones/
 *   {root}/library/{device}/drum-kits/
 *   {root}/library/{device}/patches/
 *   {root}/library/{device}/sets/{name}/tones/
 *   {root}/library/common/samples/
 *
 * All scanners are built on a generic `scanLibraryDirectory` function
 * parameterized by an `ItemDetector`. Adding a new item type requires
 * only a new detector, not a new scanner.
 *
 * This module is browser-only (uses the File System Access API).
 */

/* eslint-disable @typescript-eslint/no-empty-interface */

import { parse as parseYaml } from 'yaml';

// =========================================================================
// File System Access API type declarations (browser-only)
// =========================================================================

declare global {
  interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterable<FileSystemHandle>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
  }
}

import { DrumKitBundleSchema, type DrumKitBundle, ChoppedSampleSchema } from './schemas/index.js';
import { loadDrumKitBundle as parseDrumKitBundle } from './drum-kits/index.js';

// =========================================================================
// Types
// =========================================================================

/** Library item category types that support subdirectories. */
export type LibraryCategory = 'tones' | 'patches' | 'drum-kits';

/** All category types. */
export const LIBRARY_CATEGORIES: LibraryCategory[] = ['tones', 'patches', 'drum-kits'];

/**
 * Tree node for rendering hierarchical library contents.
 * Used by both directories and items (tones, patches, drum-kits).
 */
export interface LibraryTreeNode {
  /** Unique identifier for this node (path joined by '/') */
  id: string;
  /** Display name */
  name: string;
  /** Node type */
  type: 'directory' | 'tone' | 'patch' | 'drum-kit' | 'chopped-sample';
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
  /** Additional metadata for drum kits */
  kitCount?: number;
  sampleCount?: number;
  description?: string;
  /** Additional metadata for chopped samples */
  sliceCount?: number;
  variant?: string;
}

// =========================================================================
// Directory Navigation
// =========================================================================

/**
 * Get or create a nested directory path within a directory handle.
 */
export async function getNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string[],
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Get a nested directory without creating it.
 * Returns null if any part of the path doesn't exist.
 */
export async function getNestedDirectoryIfExists(
  rootHandle: FileSystemDirectoryHandle,
  path: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current = rootHandle;
  try {
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment, { create: false });
    }
    return current;
  } catch {
    return null;
  }
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
  entry: FileSystemHandle,
  parentDir: FileSystemDirectoryHandle,
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
  dir: FileSystemDirectoryHandle,
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

/** Detect a drum kit: a directory containing `.wav` files. */
const detectDrumKit: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'directory') return null;

  const subDir = await parentDir.getDirectoryHandle(entry.name);
  const wavFiles: string[] = [];
  let kitYaml: DrumKitBundle | null = null;

  for await (const file of subDir.values()) {
    if (file.kind !== 'file') continue;
    if (file.name.toLowerCase().endsWith('.wav')) {
      wavFiles.push(file.name);
    } else if (file.name === 'kit.yaml') {
      try {
        const fileHandle = await subDir.getFileHandle('kit.yaml');
        const yamlFile = await fileHandle.getFile();
        const yamlContent = await yamlFile.text();
        kitYaml = DrumKitBundleSchema.parse(parseYaml(yamlContent));
      } catch {
        // Invalid kit.yaml
      }
    }
  }

  if (wavFiles.length === 0) return null;

  const resolved = parseDrumKitBundle(kitYaml, wavFiles, entry.name);
  return {
    id: [...path, entry.name].join('/'),
    name: resolved.name,
    type: 'drum-kit',
    path,
    directoryName: entry.name,
    description: resolved.description,
    kitCount: resolved.kits.length,
    sampleCount: resolved.totalSamples,
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

/** Detect a chopped sample: a directory containing `manifest.yaml` with a valid schema. */
const detectChoppedSample: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'directory') return null;

  const subDir = await parentDir.getDirectoryHandle(entry.name);

  try {
    const manifestHandle = await subDir.getFileHandle('manifest.yaml');
    const file = await manifestHandle.getFile();
    const text = await file.text();
    const parsed = parseYaml(text);
    const result = ChoppedSampleSchema.safeParse(parsed);
    if (!result.success) return null;

    return {
      id: [...path, entry.name].join('/'),
      name: result.data.name,
      type: 'chopped-sample',
      path,
      directoryName: entry.name,
      sliceCount: result.data.slices.length,
      variant: result.data.variant,
      description: result.data.description,
    };
  } catch {
    return null;
  }
};

// =========================================================================
// Tone scanning (wrapper over generic scanner)
// =========================================================================

/**
 * Recursively scan a directory for tones and build a tree structure.
 * A tone is identified by a .yaml file (optionally paired with a .wav).
 */
export async function scanTonesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectTone);
}

/**
 * List all standalone tones for a device as a hierarchical tree.
 */
export async function listTonesTree(
  root: FileSystemDirectoryHandle,
  device: string,
): Promise<LibraryTreeNode[]> {
  const tonesDir = await getNestedDirectoryIfExists(root, ['library', device, 'tones']);
  if (!tonesDir) return [];
  return scanTonesDirectory(tonesDir, []);
}

// =========================================================================
// Drum kit scanning (wrapper over generic scanner)
// =========================================================================

/**
 * Recursively scan a directory for drum kits and build a tree structure.
 * A drum kit is a directory containing .wav files (and optionally kit.yaml).
 */
export async function scanDrumKitsDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectDrumKit);
}

/**
 * List all drum kits for a device as a hierarchical tree.
 */
export async function listDrumKitsTree(
  root: FileSystemDirectoryHandle,
  device: string,
): Promise<LibraryTreeNode[]> {
  const kitsDir = await getNestedDirectoryIfExists(root, ['library', device, 'drum-kits']);
  if (!kitsDir) return [];
  return scanDrumKitsDirectory(kitsDir, []);
}

// =========================================================================
// Patch scanning (wrapper over generic scanner)
// =========================================================================

/**
 * Recursively scan a directory for patches and build a tree structure.
 * A patch is a directory containing patch.yaml (and optionally a tones/ subdirectory).
 */
export async function scanPatchesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectPatch);
}

/**
 * List all patches for a device as a hierarchical tree.
 */
export async function listPatchesTree(
  root: FileSystemDirectoryHandle,
  device: string,
): Promise<LibraryTreeNode[]> {
  const patchesDir = await getNestedDirectoryIfExists(root, ['library', device, 'patches']);
  if (!patchesDir) return [];
  return scanPatchesDirectory(patchesDir, []);
}

// =========================================================================
// Chopped sample scanning
// =========================================================================

/**
 * Recursively scan a directory for chopped samples and build a tree structure.
 * A chopped sample is a directory containing a valid `manifest.yaml`.
 */
export async function scanChoppedSamplesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  return scanLibraryDirectory(dir, path, detectChoppedSample);
}

/**
 * List all chopped samples from `library/common/samples/` as a hierarchical tree.
 */
export async function listChoppedSamplesTree(
  root: FileSystemDirectoryHandle,
): Promise<LibraryTreeNode[]> {
  const samplesDir = await getNestedDirectoryIfExists(root, ['library', 'common', 'samples']);
  if (!samplesDir) return [];
  return scanChoppedSamplesDirectory(samplesDir, []);
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
  root: FileSystemDirectoryHandle,
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
  root: FileSystemDirectoryHandle,
  device: string,
  setName: string,
): Promise<LibraryTreeNode[]> {
  const tonesDir = await getNestedDirectoryIfExists(
    root, ['library', device, 'sets', setName, 'tones'],
  );
  if (!tonesDir) return [];
  return scanTonesDirectory(tonesDir, []);
}
