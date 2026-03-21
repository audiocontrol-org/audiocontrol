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
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { SampleBundlePreviewPanel } from '@/components/library/SampleBundlePreviewPanel';
import { CommonSamplePreviewPanel } from '@/components/library/CommonSamplePreviewPanel';
import type { DeviceMemoryCustomState, PreviewPanelCustomState } from './shared/plugin-state-types';
import type { DrumKitInfo, LibraryTreeNode } from '@/lib/library-service';

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

  // Render the actual DeviceMemoryPanel
  return (
    <DeviceMemoryPanel
      tones={state.tones}
      patches={state.patches}
      loadedToneBanks={state.loadedToneBanks}
      loadedPatchBanks={state.loadedPatchBanks}
      selectedIndex={state.selectedIndex}
      selectedType={state.selectedType}
      onSelectTone={state.onSelectTone}
      onSelectPatch={state.onSelectPatch}
      onDropLibraryTone={state.onDropLibraryTone}
      onDropLibraryPatch={state.onDropLibraryPatch}
    />
  );
}

// =========================================================================
// S-330 Preview Panel Adapter
// =========================================================================

/**
 * Adapter that bridges the plugin interface to preview panels.
 * Routes to ItemPreviewPanel, SampleBundlePreviewPanel, or
 * CommonSamplePreviewPanel based on selection type.
 */
function S330PreviewPanelAdapter({
  selection,
  context,
}: {
  selection: ItemSelection | null;
  context: PreviewContext;
}): JSX.Element {
  const state = context.customState as PreviewPanelCustomState | undefined;

  // Loading state
  if (context.isLoading) {
    return (
      <div className="p-4 text-sm text-s330-muted italic">
        Loading...
      </div>
    );
  }

  // Error state
  if (context.error) {
    return (
      <div className="p-4 text-sm text-red-400">
        {context.error}
      </div>
    );
  }

  // No selection or no custom state - show empty state
  if (!selection || !state) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select an item to view details</p>
          </div>
        </div>
      </div>
    );
  }

  const pageSelection = state.pageSelection;

  // Route to appropriate preview panel based on selection type
  if (pageSelection?.type === 'drumKit' || pageSelection?.type === 'choppedSample') {
    // Find drum kit info for preview
    const kitInfo: DrumKitInfo | null = pageSelection.type === 'drumKit'
      ? { directoryName: pageSelection.name!, name: pageSelection.name!, kitCount: 0, sampleCount: 0 }
      : null;

    // Find chopped sample node for preview
    const choppedSampleNode: LibraryTreeNode | null = null; // Would need to be passed through state

    return (
      <SampleBundlePreviewPanel
        kitInfo={pageSelection.type === 'drumKit' ? kitInfo : undefined}
        choppedSampleNode={pageSelection.type === 'choppedSample' ? choppedSampleNode : undefined}
        libraryHandle={state.libraryHandle}
        preloadedBundle={pageSelection.type === 'drumKit' ? state.selectedDrumKitBundle : undefined}
        preloadedManifest={pageSelection.type === 'choppedSample' ? state.selectedChoppedSampleManifest : undefined}
        onImport={state.onImportDrumKit}
        onEditKit={pageSelection.type === 'drumKit' ? state.onEditDrumKit : undefined}
      />
    );
  }

  if (pageSelection?.type === 'sample' || pageSelection?.type === 'program') {
    return (
      <CommonSamplePreviewPanel
        selection={pageSelection ? { type: pageSelection.type as 'sample' | 'program', name: pageSelection.name!, path: pageSelection.path } : null}
        libraryHandle={state.libraryHandle}
        onPromoteToDevice={() => {}}
      />
    );
  }

  // Default to ItemPreviewPanel for tones, patches, sets, etc.
  return (
    <ItemPreviewPanel
      selection={pageSelection}
      deviceTones={state.deviceTones}
      devicePatches={state.devicePatches}
      libraryHandle={state.libraryHandle}
      onImportTone={state.onImportTone}
      onImportPatch={state.onImportPatch}
      onImportIndividualTone={state.onImportIndividualTone}
      onImportIndividualPatch={state.onImportIndividualPatch}
      onLoadSet={state.onLoadSet}
    />
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
    renderMemoryPanel: (props) => <S330MemoryPanelAdapter {...props} />,
  },

  previewPanel: {
    renderPreview: (selection, context) => (
      <S330PreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
