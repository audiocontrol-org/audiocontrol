/**
 * Item type plugins for S3000XL library categories.
 *
 * Defines rendering and behavior for samples, chopped samples, drum kits,
 * and programs in the library browser. Uses dedicated SVG icon components
 * from LibraryIcons to distinguish item types visually.
 */

import type { ItemTypePlugin } from '@audiocontrol/editor-core';
import {
  SampleIcon,
  ChoppedSampleIcon,
  DrumKitIcon,
  ProgramIcon,
} from '@/components/library/LibraryIcons';

// =========================================================================
// Metadata types
// =========================================================================

export interface SampleMeta {
  fileName?: string;
  directoryName?: string;
  path?: string[];
  description?: string;
}

export interface ChoppedSampleMeta {
  directoryName?: string;
  path?: string[];
  description?: string;
  sliceCount?: number;
  variant?: string;
}

export interface DrumKitSampleMeta {
  directoryName?: string;
  path?: string[];
  description?: string;
  sliceCount?: number;
  variant?: string;
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

  renderTrailing: () => null,

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
// Chopped sample item type
// =========================================================================

export const choppedSampleItemType: ItemTypePlugin<ChoppedSampleMeta> = {
  typeId: 'chopped-sample',
  displayName: 'Chopped Sample',

  renderIcon: () => <ChoppedSampleIcon />,

  renderTrailing: (meta) => {
    if (meta.sliceCount === undefined) return null;
    return (
      <span className="text-xs text-gray-400">
        {meta.sliceCount} slice{meta.sliceCount !== 1 ? 's' : ''}
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
// Drum kit item type (sample with slices + drumKit metadata)
// =========================================================================

export const drumKitItemType: ItemTypePlugin<DrumKitSampleMeta> = {
  typeId: 'drum-kit',
  displayName: 'Drum Kit',

  renderIcon: () => <DrumKitIcon />,

  renderTrailing: (meta) => {
    if (meta.sliceCount === undefined) return null;
    return (
      <span className="text-xs text-gray-400">
        {meta.sliceCount} pad{meta.sliceCount !== 1 ? 's' : ''}
      </span>
    );
  },

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
