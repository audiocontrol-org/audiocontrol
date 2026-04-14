/**
 * Category plugin factories for S3000XL library sections.
 *
 * Three library sections:
 * - Common Samples: vendor-neutral WAV samples (library/common/samples/)
 * - Common Programs: vendor-neutral program bundles (library/common/programs/)
 * - S3K Programs: Akai-native serialized programs (library/s3k/programs/)
 */

import type { CategoryPlugin, TransferActionId } from '@audiocontrol/editor-core';
import {
  createCommonSamplesCategory,
  createCommonProgramsCategory,
  createCommonProgramItemType,
} from '@audiocontrol/editor-core';

// =========================================================================
// S3K transfer capabilities
// =========================================================================

/** Transfer actions the S3K editor supports. */
export const S3K_TRANSFER_ACTIONS: ReadonlySet<TransferActionId> = new Set<TransferActionId>([
  'send-sample-to-device',
  'send-program-to-device',
  'import-drum-kit',
  'edit-drum-kit',
  'import-instrument',
  'promote-to-common-area',
]);

// =========================================================================
// Common area categories
// =========================================================================

export function createSamplesCategory(): CategoryPlugin {
  return createCommonSamplesCategory('samples', S3K_TRANSFER_ACTIONS);
}

export function createCommonProgramsCategoryForS3k(): CategoryPlugin {
  return createCommonProgramsCategory('common-programs', S3K_TRANSFER_ACTIONS);
}

// =========================================================================
// S3K-specific programs category
// =========================================================================

export function createS3kProgramsCategory(): CategoryPlugin {
  return {
    categoryId: 's3k-programs',
    title: 'Akai Programs',
    itemTypes: {
      program: createCommonProgramItemType(S3K_TRANSFER_ACTIONS),
    },
    emptyMessage: 'No Akai programs in library.',
    acceptsExternalDrop: false,
  };
}
