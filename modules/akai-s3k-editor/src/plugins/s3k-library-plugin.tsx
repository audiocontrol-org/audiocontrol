/**
 * S3000XL Library Plugin
 *
 * Device library plugin for the Akai S3000XL sampler.
 * Provides categories, item types, device memory layout, and preview panel
 * configuration for the S3000XL's library UI.
 *
 * The S3000XL library currently uses two common-area categories:
 * - Samples: WAV files for audio data
 * - Programs: YAML files defining key/velocity zones
 *
 * Device memory (programs, samples on device) is configured here and
 * rendered by a DeviceMemoryPanel component created in Phase 1. If the
 * component is not yet available, the memory panel renders a placeholder.
 *
 * Translators are empty pending the common library format finalization.
 */

import type {
  DeviceLibraryPlugin,
  ItemSelection,
  PreviewContext,
} from '@audiocontrol/editor-core';
import { createSamplesCategory, createProgramsCategory } from '@/plugins/categories';
import { S3kPreviewPanelAdapter } from '@/components/library/S3kItemPreviewPanel';

// =========================================================================
// Device memory panel adapter
// =========================================================================

/**
 * Adapter that bridges the plugin interface to the S3K DeviceMemoryPanel.
 *
 * Phase 1 creates the actual DeviceMemoryPanel component. Until it lands,
 * this renders a summary placeholder. Once Phase 1 merges, this adapter
 * will import and render DeviceMemoryPanel, passing data from customState.
 */
function S3kMemoryPanelAdapter(): JSX.Element {
  return (
    <div className="p-4">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        Device Memory
      </div>
      <div className="text-sm text-gray-500 italic">
        Connect to an S3000XL to view device programs and samples.
      </div>
    </div>
  );
}

// =========================================================================
// S3000XL Library Plugin
// =========================================================================

export const s3kLibraryPlugin: DeviceLibraryPlugin = {
  deviceId: 's3000xl',
  deviceName: 'Akai S3000XL',

  categories: [
    createSamplesCategory(),
    createProgramsCategory(),
  ],

  translators: [],

  deviceMemory: {
    slotGroups: [
      {
        groupId: 'programs',
        label: 'Programs (on device)',
        slotCount: 128,
      },
      {
        groupId: 'samples',
        label: 'Samples (on device)',
        slotCount: 128,
      },
    ],
    renderMemoryPanel: () => <S3kMemoryPanelAdapter />,
  },

  previewPanel: {
    renderPreview: (selection: ItemSelection | null, context: PreviewContext) => (
      <S3kPreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
