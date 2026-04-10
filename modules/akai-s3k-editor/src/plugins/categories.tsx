/**
 * Category plugin factories for S3000XL library sections.
 *
 * Three library sections:
 * - Common Samples: vendor-neutral WAV samples (library/common/samples/)
 * - Common Programs: vendor-neutral program bundles (library/common/programs/)
 * - S3K Programs: Akai-native serialized programs (library/s3k/programs/)
 */

import type { CategoryPlugin } from '@audiocontrol/editor-core';
import {
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from '@audiocontrol/editor-core';
import { commonProgramItemType } from '@audiocontrol/editor-core';

// =========================================================================
// Common area categories
// =========================================================================

export function createSamplesCategory(): CategoryPlugin {
  return createCommonSamplesCategory('samples');
}

export function createCommonProgramsCategoryForS3k(): CategoryPlugin {
  return createCommonProgramsCategory('common-programs');
}

// =========================================================================
// S3K-specific programs category
// =========================================================================

export function createS3kProgramsCategory(): CategoryPlugin {
  return {
    categoryId: 's3k-programs',
    title: 'Akai Programs',
    itemTypes: {
      program: commonProgramItemType,
    },
    emptyMessage: 'No Akai programs in library.',
    acceptsExternalDrop: false,
  };
}
