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
 *   {root}/library/chopped-samples/
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

import { DrumKitBundleSchema, type DrumKitBundle } from './schemas/index.js';
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
  type: 'directory' | 'tone' | 'patch' | 'drum-kit';
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
// Tone scanning
// =========================================================================

/**
 * Recursively scan a directory for tones and build a tree structure.
 * A tone is identified by a .yaml file (optionally paired with a .wav).
 */
export async function scanTonesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  const nodes: LibraryTreeNode[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name);
      const children = await scanTonesDirectory(subDir, [...path, entry.name]);
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: entry.name,
        type: 'directory',
        path,
        children,
      });
    } else if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.yaml')) {
      const fileName = entry.name.replace(/\.yaml$/i, '');
      nodes.push({
        id: [...path, fileName].join('/'),
        name: fileName,
        type: 'tone',
        path,
        fileName,
      });
    }
  }

  return sortNodes(nodes);
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
// Drum kit scanning
// =========================================================================

/**
 * Recursively scan a directory for drum kits and build a tree structure.
 * A drum kit is a directory containing .wav files (and optionally kit.yaml).
 */
export async function scanDrumKitsDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  const nodes: LibraryTreeNode[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind !== 'directory') continue;

    const subDir = await dir.getDirectoryHandle(entry.name);
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

    if (wavFiles.length > 0) {
      const resolved = parseDrumKitBundle(kitYaml, wavFiles, entry.name);
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: resolved.name,
        type: 'drum-kit',
        path,
        directoryName: entry.name,
        description: resolved.description,
        kitCount: resolved.kits.length,
        sampleCount: resolved.totalSamples,
      });
    } else {
      const children = await scanDrumKitsDirectory(subDir, [...path, entry.name]);
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: entry.name,
        type: 'directory',
        path,
        children,
      });
    }
  }

  return sortNodes(nodes);
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
// Patch scanning
// =========================================================================

/**
 * Recursively scan a directory for patches and build a tree structure.
 * A patch is a directory containing patch.yaml (and optionally a tones/ subdirectory).
 */
export async function scanPatchesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[],
): Promise<LibraryTreeNode[]> {
  const nodes: LibraryTreeNode[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind !== 'directory') continue;

    const subDir = await dir.getDirectoryHandle(entry.name);

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

    if (isPatchBundle) {
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: patchName,
        type: 'patch',
        path,
        directoryName: entry.name,
        toneCount,
      });
    } else {
      const children = await scanPatchesDirectory(subDir, [...path, entry.name]);
      nodes.push({
        id: [...path, entry.name].join('/'),
        name: entry.name,
        type: 'directory',
        path,
        children,
      });
    }
  }

  return sortNodes(nodes);
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
