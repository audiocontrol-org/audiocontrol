/**
 * Item type plugins for S3000XL library categories.
 *
 * Defines rendering and behavior for samples and programs in the library
 * browser. Samples carry optional slice/drum-kit metadata that drives
 * badge rendering and context-menu actions.
 */

import type { ItemTypePlugin } from '@audiocontrol/editor-core';
import {
  SampleIcon,
  ProgramIcon,
} from '@/components/library/LibraryIcons';

// =========================================================================
// Metadata types
// =========================================================================

export interface SampleMeta {
  path?: string[];
  description?: string;
  sliceCount?: number;
  hasDrumKit?: boolean;
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

  renderIcon: () => <SampleIcon />,

  renderTrailing: (meta) => {
    if (!meta.sliceCount || meta.sliceCount <= 0) return null;
    const unit = meta.hasDrumKit ? 'pad' : 'slice';
    return (
      <span className="text-xs text-gray-400">
        {meta.sliceCount} {unit}{meta.sliceCount !== 1 ? 's' : ''}
      </span>
    );
  },

  isDraggable: () => true,

  supportsRename: true,

  getContextMenuActions: () => [
    { id: 'open-loop-editor', label: 'Loop Editor', icon: null },
    { id: 'open-sample-editor', label: 'Edit Sample', icon: null },
    { id: 'open-chopper', label: 'Chop', icon: null },
    { separator: true },
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

  renderIcon: () => <ProgramIcon />,

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
