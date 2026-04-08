/**
 * Shared item type plugins for Roland S-series samplers.
 *
 * Defines rendering and behavior for tones, patches, drum kits,
 * samples, and programs. These are used by both S-330 and S-550 plugins.
 */

import type { ItemTypePlugin } from '@audiocontrol/editor-core';
import { WaveIcon, PatchIcon, DrumKitIcon } from '@/components/library/LibraryTreeIcons';

// =========================================================================
// Metadata Types
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

export interface DrumKitMeta {
  directoryName?: string;
  kitCount?: number;
  sampleCount?: number;
  path?: string[];
}

export interface SampleMeta {
  fileName?: string;
  path?: string[];
}

export interface ProgramMeta {
  directoryName?: string;
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

// =========================================================================
// Drum Kit Item Type Plugin
// =========================================================================

export const drumKitItemType: ItemTypePlugin<DrumKitMeta> = {
  typeId: 'drum-kit',
  displayName: 'Drum Kit',

  renderIcon: () => <DrumKitIcon />,

  renderTrailing: (meta) => {
    if (!meta || (meta.kitCount === undefined && meta.sampleCount === undefined)) {
      return null;
    }
    const parts: string[] = [];
    if (meta.kitCount !== undefined) {
      parts.push(`${meta.kitCount} kit${meta.kitCount !== 1 ? 's' : ''}`);
    }
    if (meta.sampleCount !== undefined) {
      parts.push(`${meta.sampleCount} samples`);
    }
    return (
      <span className="text-xs text-s330-muted">
        {parts.join(' / ')}
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

// =========================================================================
// Sample Item Type Plugin (common library samples)
// =========================================================================

export const sampleItemType: ItemTypePlugin<SampleMeta> = {
  typeId: 'sample',
  displayName: 'Sample',

  renderIcon: () => <WaveIcon />,

  renderTrailing: () => null,

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
// Program Item Type Plugin (common library programs)
// =========================================================================

export const programItemType: ItemTypePlugin<ProgramMeta> = {
  typeId: 'program',
  displayName: 'Program',

  renderIcon: () => <PatchIcon />,

  renderTrailing: () => null,

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

