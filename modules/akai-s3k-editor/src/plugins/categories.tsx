/**
 * Category plugin factories for S3000XL library sections.
 *
 * Creates category plugins for the two common-area sections the S3000XL
 * library currently supports: samples (WAV) and programs (YAML).
 *
 * The Samples category recognizes three item types:
 * - sample: regular WAV sample
 * - chopped-sample: sample with slice definitions
 * - drum-kit: sample with slice definitions + drum kit metadata
 *
 * The Programs category recognizes one item type:
 * - program: S3000XL program YAML bundle
 */

import type { CategoryPlugin, CategoryCallbacks } from '@audiocontrol/editor-core';
import {
  sampleItemType,
  choppedSampleItemType,
  drumKitItemType,
  programItemType,
} from '@/plugins/item-types';

// =========================================================================
// Header action component
// =========================================================================

function NewFolderButton({ onClick }: { onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
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
// Samples category (common-area: samples, chopped samples, drum kits)
// =========================================================================

export function createSamplesCategory(): CategoryPlugin {
  return {
    categoryId: 'samples',
    title: 'Samples',
    itemTypes: {
      sample: sampleItemType,
      'chopped-sample': choppedSampleItemType,
      'drum-kit': drumKitItemType,
    },
    emptyMessage: 'No samples in library. Import WAV files to get started.',
    dropMessage: 'Drop to add sample',
    acceptsExternalDrop: true,
    acceptedDropMimeTypes: ['Files'],

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}

// =========================================================================
// Programs category (common-area YAML files)
// =========================================================================

export function createProgramsCategory(): CategoryPlugin {
  return {
    categoryId: 'programs',
    title: 'Programs',
    itemTypes: {
      program: programItemType,
    },
    emptyMessage: 'No programs in library.',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}
