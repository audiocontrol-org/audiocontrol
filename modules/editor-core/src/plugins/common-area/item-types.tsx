/**
 * Shared item type plugins for common-area samples and programs.
 *
 * These define rendering and behavior for items that live in the
 * common library area shared across all editors. Device-specific
 * item types (tones, patches, keygroups) remain in their respective
 * editor plugins.
 */

import type { ItemTypePlugin } from '@/components/library/plugins/types';
import { SampleIcon, ProgramIcon } from '@/plugins/common-area/icons';

// =========================================================================
// Metadata types
// =========================================================================

/** Metadata for common-area sample items */
export interface CommonSampleMeta {
  path?: string[];
  description?: string;
  sliceCount?: number;
  hasDrumKit?: boolean;
}

/** Metadata for common-area program items */
export interface CommonProgramMeta {
  path?: string[];
  description?: string;
}

// =========================================================================
// Sample item type
// =========================================================================

export const commonSampleItemType: ItemTypePlugin<CommonSampleMeta> = {
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
    { id: 'open-loop-editor', label: 'Open in Loop Editor', icon: null },
    { id: 'open-sample-editor', label: 'Open in Sample Editor', icon: null },
    { id: 'open-chopper', label: 'Open in Chopper', icon: null },
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

export const commonProgramItemType: ItemTypePlugin<CommonProgramMeta> = {
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
