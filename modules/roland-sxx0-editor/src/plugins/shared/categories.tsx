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
    // Shadow MIMEs published by DeviceMemoryPanel's tone dragstart
    // (`application/x-s330-device-item/tone`) and by tree-internal
    // library item drags of node type tone. Listed here so the
    // PluginLibraryBrowser section dragover handler can discriminate
    // tone-vs-patch drags during dragover without having to parse the
    // dataTransfer JSON (which most browsers block during dragover).
    acceptedDropMimeTypes: [
      'application/x-s330-device-item/tone',
      'application/x-library-item/tone',
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
    // Per-type shadow MIMEs (see tones category). Tones-only drags
    // carry `*/tone` and patch-only drags carry `*/patch`; the
    // section dragover handler picks the right section to highlight.
    acceptedDropMimeTypes: [
      'application/x-s330-device-item/patch',
      'application/x-library-item/patch',
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

