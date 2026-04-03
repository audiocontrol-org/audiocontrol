/**
 * Item type plugins for S3000XL library categories.
 *
 * Defines rendering and behavior for samples (WAV files) and programs
 * (YAML files) in the library browser. Uses editor-core's generic icons
 * since the S3000XL doesn't need custom icon components.
 */

import { AudioFileIcon, FileIcon } from '@audiocontrol/editor-core';
import type { ItemTypePlugin } from '@audiocontrol/editor-core';

// =========================================================================
// Metadata types
// =========================================================================

export interface SampleMeta {
  fileName?: string;
  path?: string[];
  description?: string;
}

export interface ProgramMeta {
  directoryName?: string;
  path?: string[];
  /** Filesystem directory name (sanitized, used for storage lookup) */
  dirName?: string;
  /** Number of keygroups in the program */
  keygroupCount?: number;
  /** Sample names referenced by the program's zones */
  sampleReferences?: string[];
}

// =========================================================================
// Sample item type
// =========================================================================

export const sampleItemType: ItemTypePlugin<SampleMeta> = {
  typeId: 'sample',
  displayName: 'Sample',

  renderIcon: () => <AudioFileIcon />,

  renderTrailing: () => null,

  isDraggable: () => true,

  supportsRename: true,

  getContextMenuActions: () => [
    { id: 'rename', label: 'Rename', icon: null },
    { id: 'move', label: 'Move to...', icon: null },
    { separator: true },
    { id: 'delete', label: 'Delete', icon: null, danger: true },
  ],
};

// =========================================================================
// Program item type
// =========================================================================

export const programItemType: ItemTypePlugin<ProgramMeta> = {
  typeId: 'program',
  displayName: 'Program',

  renderIcon: () => <FileIcon />,

  renderTrailing: () => null,

  isDraggable: () => true,

  supportsRename: true,

  getContextMenuActions: () => [
    { id: 'rename', label: 'Rename', icon: null },
    { id: 'move', label: 'Move to...', icon: null },
    { separator: true },
    { id: 'delete', label: 'Delete', icon: null, danger: true },
  ],
};
