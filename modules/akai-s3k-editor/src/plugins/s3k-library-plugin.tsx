/**
 * S3000XL Library Plugin
 *
 * Device library plugin for the Akai S3000XL sampler.
 * Provides categories, item types, device memory layout, and preview panel
 * configuration for the S3000XL's library UI.
 *
 * The S3000XL library uses two common-area categories:
 * - Samples: WAV files for audio data
 * - Programs: Serialized S3000XL program bundles (YAML)
 *
 * Device memory (programs and samples on device) is rendered by the
 * DeviceMemoryPanel component. The panel state is passed through
 * the `customState` prop from the LibraryPage.
 */

import type {
  DeviceLibraryPlugin,
  ItemSelection,
  PreviewContext,
} from '@audiocontrol/editor-core';
import { createSamplesCategory, createProgramsCategory } from '@/plugins/categories';
import { S3kPreviewPanelAdapter } from '@/components/library/S3kItemPreviewPanel';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';

// =========================================================================
// Device memory panel custom state
// =========================================================================

/** State passed from LibraryPage to the device memory panel via customState. */
export interface S3kMemoryPanelState {
  programNames: string[];
  sampleNames: string[];
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelectProgram: (index: number) => void;
  onSelectSample: (index: number) => void;
  onRefresh: () => void;
  isConnected: boolean;
  isLoading: boolean;
}

/**
 * Adapter that bridges the plugin interface to the S3K DeviceMemoryPanel.
 */
function S3kMemoryPanelAdapter({
  customState,
}: {
  customState: unknown;
}): JSX.Element {
  const state = customState as S3kMemoryPanelState | undefined;

  if (!state) {
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

  return (
    <DeviceMemoryPanel
      programNames={state.programNames}
      sampleNames={state.sampleNames}
      selectedIndex={state.selectedIndex}
      selectedType={state.selectedType}
      onSelectProgram={state.onSelectProgram}
      onSelectSample={state.onSelectSample}
      onRefresh={state.onRefresh}
      isConnected={state.isConnected}
      isLoading={state.isLoading}
    />
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
    renderMemoryPanel: ({ customState }) => (
      <S3kMemoryPanelAdapter customState={customState} />
    ),
  },

  previewPanel: {
    renderPreview: (selection: ItemSelection | null, context: PreviewContext) => (
      <S3kPreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
