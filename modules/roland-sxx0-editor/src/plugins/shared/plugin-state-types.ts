/**
 * Type definitions for plugin custom state.
 *
 * These interfaces define the shape of customState passed to plugin
 * render functions via DeviceMemoryRenderProps and PreviewContext.
 * They bridge the plugin interface to the existing component interfaces.
 */

import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { LibraryDragPayload } from '@/lib/library-drag-types';
import type { RolandPageSelection } from '@/pages/LibraryPage';
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
  onDropLibraryTone?: (data: LibraryDragPayload, targetSlot: number) => void;
  /** Callback when a library patch is dropped on a device slot */
  onDropLibraryPatch?: (data: LibraryDragPayload, targetSlot: number) => void;
  /**
   * Callback when a library sample bundle is dropped on the device memory
   * panel. Samples occupy multiple tone slots and a wave-bank segment range,
   * so the drop target is the panel itself rather than a single slot — the
   * dialog the callback opens (`ImportSamplesDialog`) is where the user
   * picks the starting tone slot, wave bank, and segment.
   */
  onDropLibrarySample?: (data: LibraryDragPayload) => void;
  /**
   * Bank index currently being loaded (tones), null if none. The panel
   * surfaces the spinning reload icon on this bank's header.
   */
  loadingToneBank?: number | null;
  /** Bank index currently being loaded (patches), null if none. */
  loadingPatchBank?: number | null;
  /** Called when the user clicks an unloaded tone-bank's row to load. */
  onLoadToneBank?: (bankIndex: number) => void;
  /** Called when the user clicks an unloaded patch-bank's row to load. */
  onLoadPatchBank?: (bankIndex: number) => void;
  /**
   * Called when the user clicks a tone-bank's reload icon. Re-fetches
   * the bank from the device, invalidating the cache for the range.
   */
  onReloadToneBank?: (bankIndex: number) => void;
  /** Same as onReloadToneBank but for the patch banks. */
  onReloadPatchBank?: (bankIndex: number) => void;
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
  pageSelection: RolandPageSelection | null;
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

  // Device-memory action callbacks. Sibling actions to the library
  // preview's IMPORT-TO-DEVICE / OPEN-IN-EDITOR row — they let the
  // operator export a device-resident tone/patch to the library OR
  // jump straight to the parameter editor for that slot, both
  // triggered from the right-column preview pane.
  onExportDeviceTone?: (toneIndex: number) => void;
  onExportDevicePatch?: (patchIndex: number) => void;
  onEditDeviceTone?: (toneIndex: number) => void;
  onEditDevicePatch?: (patchIndex: number) => void;
}
