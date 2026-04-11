/**
 * Shared item type plugins for Roland S-series samplers.
 *
 * Defines rendering and behavior for device-specific item types:
 * tones, patches, and drum kits. Common-area item types (samples,
 * programs) are imported from @audiocontrol/editor-core.
 */

import type { ItemTypePlugin } from '@audiocontrol/editor-core';
import type { CommonSampleMeta, CommonProgramMeta } from '@audiocontrol/editor-core';
import { WaveIcon, PatchIcon } from '@/components/library/LibraryTreeIcons';

export type { CommonSampleMeta, CommonProgramMeta };

// =========================================================================
// Metadata Types (device-specific)
// =========================================================================

export interface ToneMeta {
  fileName?: string;
  path?: string[];
}

export interface PatchMeta {
  directoryName?: string;
  toneCount?: number;
  path?: string[];
}

// =========================================================================
// Tone Item Type Plugin
// =========================================================================

export const toneItemType: ItemTypePlugin<ToneMeta> = {
  typeId: 'tone',
  displayName: 'Tone',

  renderIcon: () => <WaveIcon />,

  renderTrailing: () => null,

  isDraggable: () => true,

  supportsRename: true,

  getContextMenuActions: (_meta, _node) => [
    {
      id: 'rename',
      label: 'Rename',
      icon: null,
    },
    {
      id: 'move',
      label: 'Move to...',
      icon: null,
    },
    { separator: true },
    {
      id: 'open-loop-editor',
      label: 'Open in Loop Editor',
      icon: null,
    },
    {
      id: 'open-chopper',
      label: 'Open in Chopper',
      icon: null,
    },
    {
      id: 'open-sample-editor',
      label: 'Open in Sample Editor',
      icon: null,
    },
    { separator: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: null,
      danger: true,
    },
  ],
};

// =========================================================================
// Patch Item Type Plugin
// =========================================================================

export const patchItemType: ItemTypePlugin<PatchMeta> = {
  typeId: 'patch',
  displayName: 'Patch',

  renderIcon: () => <PatchIcon />,

  renderTrailing: (meta) => {
    if (!meta || meta.toneCount === undefined) return null;
    return (
      <span className="text-xs text-s330-muted">
        {meta.toneCount} tone{meta.toneCount !== 1 ? 's' : ''}
      </span>
    );
  },

  isDraggable: () => true,

  supportsRename: true,

  getContextMenuActions: () => [
    {
      id: 'rename',
      label: 'Rename',
      icon: null,
    },
    {
      id: 'move',
      label: 'Move to...',
      icon: null,
    },
    { separator: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: null,
      danger: true,
    },
  ],
};

