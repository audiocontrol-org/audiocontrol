/**
 * Category plugin factories for S3000XL library sections.
 *
 * Delegates to common-area category factories from editor-core for
 * the two common-area sections: samples (WAV) and programs (YAML).
 */

import type { CategoryPlugin } from '@audiocontrol/editor-core';
import {
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from '@audiocontrol/editor-core';

// =========================================================================
// Samples category (common-area samples with optional slice/drum-kit metadata)
// =========================================================================

export function createSamplesCategory(): CategoryPlugin {
  return createCommonSamplesCategory('samples');
}

// =========================================================================
// Programs category (common-area YAML files)
// =========================================================================

export function createProgramsCategory(): CategoryPlugin {
  return createCommonProgramsCategory('programs');
}
