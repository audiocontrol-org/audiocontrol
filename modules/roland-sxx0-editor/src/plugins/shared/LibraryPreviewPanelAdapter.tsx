/**
 * LibraryPreviewPanelAdapter
 *
 * Shared adapter that bridges the plugin preview-panel slot to
 * ItemPreviewPanel / CommonSamplePreviewPanel / the empty-state Preview
 * header chrome, based on pageSelection routing through customState.
 *
 * Extracted 2026-05-22 from S330PreviewPanelAdapter (lines 87-175) and
 * S550PreviewPanelAdapter (lines 109-197) per clones.yaml group
 * 47120235fd38 disposition. Pre-extraction the two function bodies
 * were byte-identical — same loading / error / empty-state branches,
 * same pageSelection-type routing, same prop pass-through to the
 * concrete preview panels. Contract pinned by D-LIB-37 wiring
 * assertion (the canonical .ac-panel-header-title "Preview" chrome
 * appears on both s330 and s550 library routes with no selection).
 *
 * The s330-muted-prefixed color tokens are kept verbatim — they are
 * the per-device-prefixed but shared-by-convention token names that
 * apply to both s330 and s550 surfaces. Renaming them is a token-
 * cleanup orthogonal to this refactor.
 */

import type { ItemSelection, PreviewContext } from '@audiocontrol/editor-core';

import { ItemPreviewPanel } from '@/components/library/ItemPreviewPanel';
import { CommonSamplePreviewPanel } from '@/components/library/CommonSamplePreviewPanel';
import type { PreviewPanelCustomState } from './plugin-state-types';

export function LibraryPreviewPanelAdapter({
  selection: _selection,
  context,
}: {
  selection: ItemSelection | null;
  context: PreviewContext;
}): JSX.Element {
  const state = context.customState as PreviewPanelCustomState | undefined;

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

  // The plugin-tree `selection` prop is only set by library-tree
  // clicks (via `PluginLibraryBrowser.onSelectionChange`); clicks in
  // `DeviceMemoryPanel` go through the page's `handleSelectDevice`
  // which sets `state.pageSelection.source === 'device'` but leaves
  // the tree-level `selection` null. Routing off `pageSelection`
  // (page-level source of truth) rather than the tree-level `selection`
  // prop covers both device-memory and library-tree clicks uniformly.
  const pageSelection = state?.pageSelection;
  if (!state || !pageSelection) {
    return (
      <div className="h-full flex flex-col">
        <div className="ac-panel-header">
          <h3 className="ac-panel-header-title">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select an item to view details</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageSelection?.type === 'sample' || pageSelection?.type === 'program') {
    const commonNodeType = pageSelection.type;
    return (
      <CommonSamplePreviewPanel
        selection={pageSelection ? { type: pageSelection.type as 'sample' | 'program', name: pageSelection.name!, path: pageSelection.path } : null}
        libraryHandle={state.libraryHandle}
        onPromoteToDevice={() => {}}
        onOpenInLoopEditor={state.onOpenInLoopEditor ? (name, path) => state.onOpenInLoopEditor!(name, commonNodeType, path) : undefined}
        onOpenInChopper={state.onOpenInChopper ? (name, path) => state.onOpenInChopper!(name, commonNodeType, path) : undefined}
        onOpenInSampleEditor={state.onOpenInSampleEditor ? (name, path) => state.onOpenInSampleEditor!(name, commonNodeType, path) : undefined}
      />
    );
  }

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
      onOpenInLoopEditor={state.onOpenInLoopEditor}
      onOpenInSampleEditor={state.onOpenInSampleEditor}
      onExportDeviceTone={state.onExportDeviceTone}
      onExportDevicePatch={state.onExportDevicePatch}
      onEditDeviceTone={state.onEditDeviceTone}
      onEditDevicePatch={state.onEditDevicePatch}
    />
  );
}
