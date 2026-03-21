/**
 * S-550 Library Plugin
 *
 * Device library plugin for the Roland S-550 sampler.
 * Extends the S-330 plugin with S-550-specific memory layout
 * (64 tones in 2 blocks, 32 patches, 4 wave banks).
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
import { s550Config } from '@/configs/s550';

// =========================================================================
// S-550 Memory Panel
// =========================================================================

function S550MemoryPanel(_props: DeviceMemoryRenderProps): JSX.Element {
  // This is a placeholder - the actual implementation would render
  // the tone/patch slots using the existing DeviceMemoryPanel logic,
  // showing the two tone blocks with their respective wave banks
  const { toneGroups } = s550Config.memoryLayout;

  return (
    <div className="p-4 space-y-4">
      <div className="text-xs font-medium text-s330-muted uppercase tracking-wide">
        Device Memory
      </div>

      {/* Tone blocks */}
      {toneGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="text-xs text-s330-muted">
            {group.label}
          </div>
          <div className="text-xs text-s330-muted/70">
            {group.count} tones, Banks {group.waveBankLabels.join('/')}
          </div>
        </div>
      ))}

      {/* Patches */}
      <div className="space-y-1 pt-2 border-t border-s330-accent/30">
        <div className="text-xs text-s330-muted">
          {s550Config.memoryLayout.patchSectionLabel}
        </div>
        <div className="text-xs text-s330-muted/70">
          {s550Config.totalPatches} patches
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// S-550 Preview Panel
// =========================================================================

function S550PreviewPanel({
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
// S-550 Library Plugin
// =========================================================================

export const s550LibraryPlugin: DeviceLibraryPlugin = {
  deviceId: 's550',
  deviceName: 'Roland S-550',

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
      // Block 1: Tones T11-T48 with wave banks A/B
      {
        groupId: 'tones-block1',
        label: s550Config.memoryLayout.toneGroups[0].label,
        slotCount: s550Config.memoryLayout.toneGroups[0].count,
      },
      // Block 2: Tones T51-T88 with wave banks C/D
      {
        groupId: 'tones-block2',
        label: s550Config.memoryLayout.toneGroups[1].label,
        slotCount: s550Config.memoryLayout.toneGroups[1].count,
      },
      // Patches P11-P48
      {
        groupId: 'patches',
        label: `Patches (${s550Config.memoryLayout.formatPatchSlot(0)}-${s550Config.memoryLayout.formatPatchSlot(s550Config.totalPatches - 1)})`,
        slotCount: s550Config.totalPatches,
      },
    ],
    renderMemoryPanel: (props) => <S550MemoryPanel {...props} />,
  },

  previewPanel: {
    renderPreview: (selection, context) => (
      <S550PreviewPanel selection={selection} context={context} />
    ),
  },
};
