/**
 * S-550 Library Plugin
 *
 * Device library plugin for the Roland S-550 sampler.
 * Extends the S-330 plugin pattern with S-550-specific memory layout
 * (64 tones in 2 blocks, 32 patches, 4 wave banks).
 */

import type {
  DeviceLibraryPlugin,
  DeviceMemoryRenderProps,
} from '@audiocontrol/editor-core';
import {
  createCommonSamplesCategory,
  createCommonProgramsCategory,
} from '@audiocontrol/editor-core';
import {
  createTonesCategory,
  createPatchesCategory,
} from './shared/categories';
import { LibraryDeviceMemoryPanel } from './shared/LibraryDeviceMemoryPanel';
import { LibraryPreviewPanelAdapter } from './shared/LibraryPreviewPanelAdapter';
import { s550Config } from '@/configs/s550';
import type { DeviceMemoryCustomState } from './shared/plugin-state-types';

// =========================================================================
// S-550 Memory Panel Adapter
// =========================================================================

/**
 * Adapter that bridges the plugin interface to DeviceMemoryPanel.
 * The DeviceMemoryPanel uses DeviceConfigContext internally to handle
 * the S-550's two-block tone layout.
 */
function S550MemoryPanelAdapter(props: DeviceMemoryRenderProps): JSX.Element {
  const state = props.customState as DeviceMemoryCustomState | undefined;
  const { toneGroups } = s550Config.memoryLayout;

  // If no custom state, render a placeholder showing S-550 memory layout
  if (!state) {
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

  // DeviceMemoryPanel uses DeviceConfigContext to get the S-550 layout
  return <LibraryDeviceMemoryPanel state={state} />;
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
    renderMemoryPanel: (props) => <S550MemoryPanelAdapter {...props} />,
  },

  previewPanel: {
    renderPreview: (selection, context) => (
      <LibraryPreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
