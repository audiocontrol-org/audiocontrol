/**
 * Shared category plugin factories for Roland S-series samplers.
 *
 * Creates device-specific category plugins for tones, patches, and
 * drum kits. Common-area categories (samples, programs) are imported
 * from @audiocontrol/editor-core and re-exported.
 */

import type { CategoryPlugin, CategoryCallbacks } from '@audiocontrol/editor-core';
import {
  NewFolderButton,
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from '@audiocontrol/editor-core';
import {
  toneItemType,
  patchItemType,
} from './item-types';

// Re-export common-area category factories from editor-core
export { createCommonSamplesCategory, createCommonProgramsCategory };

// =========================================================================
// Tones Category
// =========================================================================

export function createTonesCategory(): CategoryPlugin {
  return {
    categoryId: 'tones',
    title: 'Tones',
    itemTypes: {
      tone: toneItemType,
    },
    emptyMessage: 'No tones in library',
    dropMessage: 'Drop to save tone',
    acceptsExternalDrop: true,
    acceptedDropMimeTypes: [
      'application/x-s330-device-drag',
      'application/x-s330-library-drag',
    ],

    canAcceptDrop: (dragData: unknown) => {
      const data = dragData as { type?: string };
      return data?.type === 'tone';
    },

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

// =========================================================================
// Patches Category
// =========================================================================

export function createPatchesCategory(): CategoryPlugin {
  return {
    categoryId: 'patches',
    title: 'Patches',
    itemTypes: {
      patch: patchItemType,
    },
    emptyMessage: 'No patches in library',
    dropMessage: 'Drop to save patch',
    acceptsExternalDrop: true,
    acceptedDropMimeTypes: [
      'application/x-s330-device-drag',
      'application/x-s330-library-drag',
    ],

    canAcceptDrop: (dragData: unknown) => {
      const data = dragData as { type?: string };
      return data?.type === 'patch';
    },

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

