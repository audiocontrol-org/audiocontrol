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
      batchable: false,
    },
    {
      id: 'move',
      label: 'Move to...',
      icon: null,
      batchable: true,
    },
    { separator: true },
    {
      id: 'open-loop-editor',
      label: 'Open in Loop Editor',
      icon: null,
      batchable: false,
    },
    {
      id: 'open-chopper',
      label: 'Open in Chopper',
      icon: null,
      batchable: false,
    },
    {
      id: 'open-sample-editor',
      label: 'Open in Sample Editor',
      icon: null,
      batchable: false,
    },
    { separator: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: null,
      danger: true,
      batchable: true,
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
      <span className="ac-tree-node-meta">
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
      batchable: false,
    },
    {
      id: 'move',
      label: 'Move to...',
      icon: null,
      batchable: true,
    },
    { separator: true },
    {
      id: 'delete',
      label: 'Delete',
      icon: null,
      danger: true,
      batchable: true,
    },
  ],
};

