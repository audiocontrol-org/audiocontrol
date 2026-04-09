/**
 * Item type plugins for S3000XL library categories.
 *
 * Re-exports common-area item types from editor-core and defines
 * S3K-specific metadata extensions for backward compatibility.
 */

import type { CommonSampleMeta, CommonProgramMeta } from '@audiocontrol/editor-core';

export {
  commonSampleItemType as sampleItemType,
  commonProgramItemType as programItemType,
} from '@audiocontrol/editor-core';

// =========================================================================
// Metadata types — backward-compatible aliases
// =========================================================================

/** S3K sample metadata is identical to common-area sample metadata. */
export type SampleMeta = CommonSampleMeta;

/**
 * S3K program metadata extends common-area program metadata with
 * device-specific fields used by S3kItemPreviewPanel.
 */
export interface ProgramMeta extends CommonProgramMeta {
  directoryName?: string;
  /** Filesystem directory name (sanitized, used for storage lookup) */
  dirName?: string;
  /** Number of keygroups in the program */
  keygroupCount?: number;
  /** Sample names referenced by the program's zones */
  sampleReferences?: string[];
}
