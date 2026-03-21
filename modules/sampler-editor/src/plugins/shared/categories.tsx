/**
 * Shared category plugin factories for Roland S-series samplers.
 *
 * Creates category plugins for library sections: tones, patches,
 * drum kits, samples (common), and programs (common).
 */

import type { CategoryPlugin, CategoryCallbacks } from '@audiocontrol/editor-core';
import {
  toneItemType,
  patchItemType,
  drumKitItemType,
  sampleItemType,
  programItemType,
  choppedSampleItemType,
} from './item-types';

// =========================================================================
// New Folder Button Component
// =========================================================================

function NewFolderButton({
  onClick,
}: {
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="text-xs text-s330-muted hover:text-s330-highlight transition-colors"
      title="New folder"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
    </button>
  );
}

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

// =========================================================================
// Drum Kits Category
// =========================================================================

export function createDrumKitsCategory(): CategoryPlugin {
  return {
    categoryId: 'drumKits',
    title: 'Drum Kits',
    itemTypes: {
      'drum-kit': drumKitItemType,
    },
    emptyMessage: 'No drum kits in library',
    dropMessage: 'Drop to save drum kit',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

// =========================================================================
// Chopped Samples Category
// =========================================================================

export function createChoppedSamplesCategory(): CategoryPlugin {
  return {
    categoryId: 'choppedSamples',
    title: 'Chopped Samples',
    itemTypes: {
      'chopped-sample': choppedSampleItemType,
    },
    emptyMessage: 'No chopped samples',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

// =========================================================================
// Common Samples Category
// =========================================================================

export function createCommonSamplesCategory(): CategoryPlugin {
  return {
    categoryId: 'commonSamples',
    title: 'Samples',
    itemTypes: {
      sample: sampleItemType,
    },
    emptyMessage: 'No samples in common library',
    dropMessage: 'Drop to add sample',
    acceptsExternalDrop: true,
    acceptedDropMimeTypes: ['Files'],

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

// =========================================================================
// Common Programs Category
// =========================================================================

export function createCommonProgramsCategory(): CategoryPlugin {
  return {
    categoryId: 'commonPrograms',
    title: 'Programs',
    itemTypes: {
      program: programItemType,
    },
    emptyMessage: 'No programs in common library',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}
