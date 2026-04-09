/**
 * Type definitions for plugin custom state.
 *
 * These interfaces define the shape of customState passed to plugin
 * render functions via DeviceMemoryRenderProps and PreviewContext.
 * They bridge the plugin interface to the existing component interfaces.
 */

import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { LibraryDragData } from '@/components/library/DeviceMemoryPanel';
import type { ItemSelection } from '@/pages/LibraryPage';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Device Memory Panel Custom State
// =========================================================================

/**
 * Custom state for the device memory panel.
 * Passed via customState prop in DeviceMemoryRenderProps.
 */
export interface DeviceMemoryCustomState {
  /** Current tones loaded on device */
  tones: (SamplerTone | undefined)[];
  /** Current patches loaded on device */
  patches: (SamplerPatch | undefined)[];
  /** Banks of tones that have been loaded */
  loadedToneBanks: number[];
  /** Banks of patches that have been loaded */
  loadedPatchBanks: number[];
  /** Currently selected slot index */
  selectedIndex?: number;
  /** Type of currently selected slot */
  selectedType?: 'tone' | 'patch';
  /** Callback when a tone slot is selected */
  onSelectTone: (index: number) => void;
  /** Callback when a patch slot is selected */
  onSelectPatch: (index: number) => void;
  /** Callback when a library tone is dropped on a device slot */
  onDropLibraryTone?: (data: LibraryDragData, targetSlot: number) => void;
  /** Callback when a library patch is dropped on a device slot */
  onDropLibraryPatch?: (data: LibraryDragData, targetSlot: number) => void;
}

// =========================================================================
// Preview Panel Custom State
// =========================================================================

/**
 * Custom state for the preview panel.
 * Passed via customState prop in PreviewContext.
 */
export interface PreviewPanelCustomState {
  /** LibraryPage-style selection (includes source and additional fields) */
  pageSelection: ItemSelection | null;
  /** Device tones for preview */
  deviceTones: (SamplerTone | undefined)[];
  /** Device patches for preview */
  devicePatches: (SamplerPatch | undefined)[];
  /** File system handle for the library */
  libraryHandle: StorageDirectoryHandle | null;
  // Import callbacks
  onImportTone?: (setName: string, toneFile: string) => void;
  onImportPatch?: (setName: string, patchFile: string) => void;
  onImportIndividualTone?: (toneFile: string) => void;
  onImportIndividualPatch?: (patchDirectoryName: string, path?: string[]) => void;
  onLoadSet?: () => void;

  // Tool action callbacks
  onOpenInLoopEditor?: (name: string, path?: string[]) => void;
  onOpenInChopper?: (name: string, path?: string[]) => void;
  onOpenInSampleEditor?: (name: string, path?: string[]) => void;
}
