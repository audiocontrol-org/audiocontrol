/**
 * Roland-specific library drag-drop helpers.
 *
 * The canonical drag payload type is LibraryDragPayload from editor-core.
 * Roland-specific fields (setName, toneFile, patchFile) are carried in the
 * payload's `meta` bag and extracted at consumption sites via the helpers
 * in this module.
 *
 * This module also re-exports the canonical MIME type and payload type so
 * that Roland code has a single import source for drag-drop concerns.
 */

import type { LibraryDragPayload } from '@audiocontrol/editor-core';

// Re-export the canonical type and MIME for convenience
export type { LibraryDragPayload } from '@audiocontrol/editor-core';
export { LIBRARY_ITEM_MIME } from '@audiocontrol/editor-core';

/**
 * Roland-specific metadata carried in LibraryDragPayload.meta.
 */
export interface RolandDragMeta {
  /** For tones/patches in sets: the set name */
  setName?: string;
  /** For tones: the file name within the set */
  toneFile?: string;
  /** For patches: the file name within the set */
  patchFile?: string;
  /**
   * On-disk directory name for individual patches and samples (packed
   * by `useRolandLibraryData` per #418). Distinct from `nodeName` which
   * is the YAML display name; the loader needs the directory name to
   * resolve the bundle on disk.
   */
  directoryName?: string;
  /**
   * On-disk file name (without extension) for individual tones (packed
   * by `useRolandLibraryData` per #418). Distinct from `nodeName` which
   * is the YAML display name.
   */
  fileName?: string;
}

/**
 * Extract Roland-specific fields from a LibraryDragPayload.
 *
 * Returns a typed view of the meta fields relevant to Roland drag-drop.
 * Fields that are absent or not strings are returned as undefined.
 */
export function extractRolandDragMeta(payload: LibraryDragPayload): RolandDragMeta {
  const meta = payload.meta;
  return {
    setName: typeof meta['setName'] === 'string' ? meta['setName'] : undefined,
    toneFile: typeof meta['toneFile'] === 'string' ? meta['toneFile'] : undefined,
    patchFile: typeof meta['patchFile'] === 'string' ? meta['patchFile'] : undefined,
    directoryName: typeof meta['directoryName'] === 'string' ? meta['directoryName'] : undefined,
    fileName: typeof meta['fileName'] === 'string' ? meta['fileName'] : undefined,
  };
}

/**
 * Build a LibraryDragPayload for a Roland library item.
 *
 * Centralizes payload construction so that all drag-start sites produce
 * consistent payloads with the correct meta fields.
 */
export function buildRolandDragPayload(params: {
  categoryId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  sourcePath: string[];
  setName?: string;
  toneFile?: string;
  patchFile?: string;
}): LibraryDragPayload {
  const meta: Record<string, unknown> = {};
  if (params.setName !== undefined) meta['setName'] = params.setName;
  if (params.toneFile !== undefined) meta['toneFile'] = params.toneFile;
  if (params.patchFile !== undefined) meta['patchFile'] = params.patchFile;

  return {
    categoryId: params.categoryId,
    nodeId: params.nodeId,
    nodeName: params.nodeName,
    nodeType: params.nodeType,
    sourcePath: params.sourcePath,
    meta,
  };
}
