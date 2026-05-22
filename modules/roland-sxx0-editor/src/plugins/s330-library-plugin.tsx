/**
 * S-330 Library Plugin
 *
 * Device library plugin for the Roland S-330 sampler.
 * Provides categories, item types, memory layout, and preview panel
 * configuration for the S-330's library UI.
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
import { s330Config } from '@/configs/s330';
import type { DeviceMemoryCustomState } from './shared/plugin-state-types';

// =========================================================================
// S-330 Memory Panel Adapter
// =========================================================================

/**
 * Adapter that bridges the plugin interface to DeviceMemoryPanel.
 * Extracts data from customState and renders the existing component.
 */
function S330MemoryPanelAdapter(props: DeviceMemoryRenderProps): JSX.Element {
  const state = props.customState as DeviceMemoryCustomState | undefined;

  // If no custom state, render a placeholder
  if (!state) {
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

  return <LibraryDeviceMemoryPanel state={state} />;
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
    renderMemoryPanel: (props) => <S330MemoryPanelAdapter {...props} />,
  },

  previewPanel: {
    renderPreview: (selection, context) => (
      <LibraryPreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
