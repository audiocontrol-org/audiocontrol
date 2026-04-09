/**
 * Shared category factory functions for common-area library sections.
 *
 * Creates CategoryPlugin instances for samples and programs that live
 * in the common library area. The `categoryId` parameter allows each
 * editor to use its own identifier (e.g., S3K uses 'samples', Roland
 * uses 'commonSamples').
 */

import type { CategoryPlugin, CategoryCallbacks } from '@/components/library/plugins/types';
import { commonSampleItemType, commonProgramItemType } from '@/plugins/common-area/item-types';

// =========================================================================
// Header action component
// =========================================================================

/**
 * New folder button for category headers.
 * Uses a folder-with-plus SVG icon.
 */
export function NewFolderButton({
  onClick,
}: {
  onClick: () => void;
}): JSX.Element {
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
// Common Samples category
// =========================================================================

/**
 * Create a category plugin for common-area samples.
 *
 * @param categoryId - Category identifier; defaults to 'samples'
 */
export function createCommonSamplesCategory(
  categoryId = 'samples',
): CategoryPlugin {
  return {
    categoryId,
    title: 'Samples',
    itemTypes: {
      sample: commonSampleItemType,
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
// Common Programs category
// =========================================================================

/**
 * Create a category plugin for common-area programs.
 *
 * @param categoryId - Category identifier; defaults to 'programs'
 */
export function createCommonProgramsCategory(
  categoryId = 'programs',
): CategoryPlugin {
  return {
    categoryId,
    title: 'Programs',
    itemTypes: {
      program: commonProgramItemType,
    },
    emptyMessage: 'No programs in library.',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}
