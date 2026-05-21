/**
 * Shared category factory functions for common-area library sections.
 *
 * Creates CategoryPlugin instances for samples and programs that live
 * in the common library area. Both editors use the default category IDs
 * ('samples' and 'programs').
 */

import type { CategoryPlugin, CategoryCallbacks } from '@/components/library/plugins/types';
import type { TransferActionId } from '@/hooks/useLibraryOperations';
import { createCommonSampleItemType, createCommonProgramItemType } from '@/plugins/common-area/item-types';

// =========================================================================
// Header action component
// =========================================================================

/**
 * Import button for category headers.
 * Opens a file picker to import WAV files.
 */
function ImportButton({
  onClick,
}: {
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
      title="Import WAV files"
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
    </button>
  );
}

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
  supportedActions: ReadonlySet<TransferActionId> = new Set(),
): CategoryPlugin {
  return {
    categoryId,
    title: 'Samples',
    scope: 'common',
    itemTypes: {
      sample: createCommonSampleItemType(supportedActions),
    },
    emptyMessage: 'No samples in library. Import WAV files to get started.',
    dropMessage: 'Drop to add sample',
    acceptsExternalDrop: true,
    acceptedDropMimeTypes: ['Files'],

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <>
        <ImportButton onClick={callbacks.importFiles} />
        <NewFolderButton onClick={callbacks.createFolder} />
      </>
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
  supportedActions: ReadonlySet<TransferActionId> = new Set(),
): CategoryPlugin {
  return {
    categoryId,
    title: 'Programs',
    scope: 'common',
    itemTypes: {
      program: createCommonProgramItemType(supportedActions),
    },
    emptyMessage: 'No programs in library.',
    acceptsExternalDrop: false,

    renderHeaderActions: (callbacks: CategoryCallbacks) => (
      <NewFolderButton onClick={callbacks.createFolder} />
    ),
  };
}
