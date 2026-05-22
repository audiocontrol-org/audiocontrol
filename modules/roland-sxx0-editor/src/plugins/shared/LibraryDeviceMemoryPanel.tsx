/**
 * LibraryDeviceMemoryPanel
 *
 * Shared adapter that renders DeviceMemoryPanel given a populated
 * DeviceMemoryCustomState. Both s330LibraryPlugin and s550LibraryPlugin
 * delegate to this once they've checked their device-specific no-state
 * placeholder branch.
 *
 * Extracted 2026-05-22 from S330MemoryPanelAdapter (lines 54-75) and
 * S550MemoryPanelAdapter (lines 75-97) per clones.yaml group
 * 290604cd13fe disposition. Pre-extraction the two return statements
 * were byte-identical (props pass-through to DeviceMemoryPanel) — the
 * only divergence between the per-device adapters lives in their
 * !state placeholders, which stay in the per-device file. Contract
 * pinned by D-LIB-23 wiring assertion (DeviceMemoryPanel
 * data-capability="C-LIB-02" reachable on both s330 and s550 library
 * routes).
 */

import { DeviceMemoryPanel } from '@/components/library/DeviceMemoryPanel';
import type { DeviceMemoryCustomState } from './plugin-state-types';

export function LibraryDeviceMemoryPanel({
  state,
}: {
  state: DeviceMemoryCustomState;
}): JSX.Element {
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
      loadingToneBank={state.loadingToneBank}
      loadingPatchBank={state.loadingPatchBank}
      onLoadToneBank={state.onLoadToneBank}
      onLoadPatchBank={state.onLoadPatchBank}
      onReloadToneBank={state.onReloadToneBank}
      onReloadPatchBank={state.onReloadPatchBank}
    />
  );
}
