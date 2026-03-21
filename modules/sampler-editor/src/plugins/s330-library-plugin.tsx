/**
 * S-330 Library Plugin
 *
 * Device library plugin for the Roland S-330 sampler.
 * Provides categories, item types, memory layout, and preview panel
 * configuration for the S-330's library UI.
 */

import type {
  DeviceLibraryPlugin,
  ItemSelection,
  PreviewContext,
  DeviceMemoryRenderProps,
} from '@audiocontrol/editor-core';
import {
  createTonesCategory,
  createPatchesCategory,
  createDrumKitsCategory,
  createChoppedSamplesCategory,
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from './shared/categories';
import { s330Config } from '@/configs/s330';

// =========================================================================
// S-330 Memory Panel (placeholder - actual implementation uses existing DeviceMemoryPanel)
// =========================================================================

function S330MemoryPanel(_props: DeviceMemoryRenderProps): JSX.Element {
  // This is a placeholder - the actual implementation would render
  // the tone/patch slots using the existing DeviceMemoryPanel logic
  return (
    <div className="p-4">
      <div className="text-xs font-medium text-s330-muted uppercase tracking-wide mb-2">
        Device Memory
      </div>
      <div className="text-sm text-s330-muted/70 italic">
        {s330Config.totalTones} tones, {s330Config.totalPatches} patches
      </div>
    </div>
  );
}

// =========================================================================
// S-330 Preview Panel (placeholder - actual implementation uses existing ItemPreviewPanel)
// =========================================================================

function S330PreviewPanel({
  selection,
  context,
}: {
  selection: ItemSelection | null;
  context: PreviewContext;
}): JSX.Element {
  if (context.isLoading) {
    return (
      <div className="p-4 text-sm text-s330-muted italic">
        Loading...
      </div>
    );
  }

  if (context.error) {
    return (
      <div className="p-4 text-sm text-red-400">
        {context.error}
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="p-4 text-sm text-s330-muted/70 italic text-center">
        Select an item to view details
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="font-medium text-s330-text mb-2">
        {selection.node.name}
      </h3>
      <div className="text-xs text-s330-muted">
        Type: {selection.node.type}
      </div>
      <div className="text-xs text-s330-muted">
        Category: {selection.categoryId}
      </div>
    </div>
  );
}

// =========================================================================
// S-330 Library Plugin
// =========================================================================

export const s330LibraryPlugin: DeviceLibraryPlugin = {
  deviceId: 's330',
  deviceName: 'Roland S-330',

  categories: [
    createTonesCategory(),
    createPatchesCategory(),
    createDrumKitsCategory(),
    createChoppedSamplesCategory(),
    createCommonSamplesCategory(),
    createCommonProgramsCategory(),
  ],

  // Translators would be implemented when the common library format is finalized
  translators: [],

  deviceMemory: {
    slotGroups: [
      {
        groupId: 'tones',
        label: `Tones (${s330Config.memoryLayout.formatToneSlot(0)}-${s330Config.memoryLayout.formatToneSlot(s330Config.totalTones - 1)})`,
        slotCount: s330Config.totalTones,
      },
      {
        groupId: 'patches',
        label: `Patches (${s330Config.memoryLayout.formatPatchSlot(0)}-${s330Config.memoryLayout.formatPatchSlot(s330Config.totalPatches - 1)})`,
        slotCount: s330Config.totalPatches,
      },
    ],
    renderMemoryPanel: (props) => <S330MemoryPanel {...props} />,
  },

  previewPanel: {
    renderPreview: (selection, context) => (
      <S330PreviewPanel selection={selection} context={context} />
    ),
  },
};
