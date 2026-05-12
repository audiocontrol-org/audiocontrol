/**
 * S-550 Library Plugin
 *
 * Device library plugin for the Roland S-550 sampler.
 * Extends the S-330 plugin pattern with S-550-specific memory layout
 * (64 tones in 2 blocks, 32 patches, 4 wave banks).
 */

import type {
  DeviceLibraryPlugin,
  ItemSelection,
  PreviewContext,
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
import { s550Config } from '@/configs/s550';
import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { CommonSamplePreviewPanel } from '@/components/library/CommonSamplePreviewPanel';
import type { DeviceMemoryCustomState, PreviewPanelCustomState } from './shared/plugin-state-types';

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

  // Render the actual DeviceMemoryPanel
  // DeviceMemoryPanel uses DeviceConfigContext to get the S-550 layout
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
      onDropLibrarySample={state.onDropLibrarySample}
    />
  );
}

// =========================================================================
// S-550 Preview Panel Adapter
// =========================================================================

/**
 * Adapter that bridges the plugin interface to preview panels.
 * Routes to ItemPreviewPanel, SampleBundlePreviewPanel, or
 * CommonSamplePreviewPanel based on selection type.
 */
function S550PreviewPanelAdapter({
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
  if (pageSelection?.type === 'sample' || pageSelection?.type === 'program') {
    return (
      <CommonSamplePreviewPanel
        selection={pageSelection ? { type: pageSelection.type as 'sample' | 'program', name: pageSelection.name!, path: pageSelection.path } : null}
        libraryHandle={state.libraryHandle}
        onPromoteToDevice={() => {}}
        onOpenInLoopEditor={state.onOpenInLoopEditor}
        onOpenInChopper={state.onOpenInChopper}
        onOpenInSampleEditor={state.onOpenInSampleEditor}
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
      onOpenInLoopEditor={state.onOpenInLoopEditor ? (name, _nodeType, path) => state.onOpenInLoopEditor!(name, path) : undefined}
      onOpenInSampleEditor={state.onOpenInSampleEditor ? (name, _nodeType, path) => state.onOpenInSampleEditor!(name, path) : undefined}
    />
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
      <S550PreviewPanelAdapter selection={selection} context={context} />
    ),
  },
};
