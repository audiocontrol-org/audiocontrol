/**
 * Device configuration types for the sampler editor.
 *
 * These types define the interface that all device-specific configurations
 * must implement to work with the shared editor components.
 *
 * @packageDocumentation
 */

import type { SamplerClientInterface } from '@/core/midi/SamplerClient';
export type { SamplerClientInterface } from '@/core/midi/SamplerClient';
import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';

/**
 * Supported device types in the sampler editor.
 */
export type SamplerDeviceType = 's330' | 's550';

/**
 * Factory function type for creating device clients.
 */
export type ClientFactory = (
  adapter: SSeriesMidiAdapter,
  options?: { deviceId?: number }
) => SamplerClientInterface;

// =============================================================================
// Memory Layout Types
// =============================================================================

/**
 * A group of tone slots displayed together in the UI.
 * For S-330: one group containing all 32 tones.
 * For S-550: two groups (Block 1: tones 0-31, Block 2: tones 32-63).
 */
export interface ToneSlotGroup {
  /** Display label for the group header */
  label: string;
  /** First absolute tone index in this group */
  firstIndex: number;
  /** Number of tone slots in this group */
  count: number;
  /** Wave bank names available for tones in this group (e.g., ['A', 'B']) */
  waveBankLabels: string[];
  /** Absolute wave bank indices available for tones in this group */
  waveBankIndices: number[];
}

/**
 * An import target option for the "Load Set" dialog.
 * For S-330: no options needed (one target).
 * For S-550: two options (Block 1 or Block 2).
 */
export interface ImportTarget {
  /** Display label (e.g., "Block 1 — Tones 1-32, Banks A/B") */
  label: string;
  /** Offset to add to set tone indices when importing to this target */
  toneIndexOffset: number;
  /** Offset to add to set wave bank indices when importing to this target */
  waveBankOffset: number;
}

/**
 * Describes how the device's memory is organized for the UI.
 * Provided by device-specific factories — the UI never branches on device type.
 */
export interface MemoryLayout {
  /** How to group tone slots in the device memory panel */
  toneGroups: ToneSlotGroup[];

  /** Label for the patches section header (e.g., "Patches (16 slots)") */
  patchSectionLabel: string;

  /**
   * Import target options for the "Load Set" dialog.
   * If length === 1, no selector is shown (the single target is used).
   * If length > 1, a selector is rendered with these options.
   */
  importTargets: ImportTarget[];

  /**
   * Get the valid wave bank options for a given tone index.
   * Returns labels and indices for the bank selector in import dialogs.
   */
  getWaveBanksForTone(toneIndex: number): { labels: string[]; indices: number[] };

  /**
   * Format a tone slot index for display (e.g., 0 → "T11", 32 → "T51").
   */
  formatToneSlot(index: number): string;

  /**
   * Format a patch slot index for display (e.g., 0 → "P11").
   */
  formatPatchSlot(index: number): string;

  /**
   * Format a patch bank label for load buttons (e.g., bank 0 → "P11-P18" for S-330,
   * or "I11-I18" for S-550 block I).
   */
  formatPatchBankLabel(bankIndex: number, patchesPerBank: number): string;

  /**
   * Format a tone bank label for load buttons (e.g., bank 0 → "T11-T18").
   */
  formatToneBankLabel(bankIndex: number, tonesPerBank: number): string;

  /**
   * Whether patch labels use Roman numerals (I, II) and should be rendered in serif font.
   * S-550 uses Roman numerals for blocks, S-330 uses P prefix.
   */
  patchLabelsUseSerif: boolean;
}

// =============================================================================
// Device Config
// =============================================================================

/**
 * Configuration for a sampler device.
 *
 * This interface defines all the device-specific constants and factories
 * needed to configure the editor for a particular sampler.
 */
export interface DeviceConfig {
  /** Device type identifier */
  deviceType: SamplerDeviceType;

  /** Human-readable device name */
  deviceName: string;

  /** Manufacturer name */
  manufacturer: string;

  // Memory layout
  /** Total number of patches available */
  totalPatches: number;

  /** Total number of tones available */
  totalTones: number;

  /** Number of patches per bank */
  patchesPerBank: number;

  /** Number of tones per bank */
  tonesPerBank: number;

  /** Number of wave banks (A, B for S-330; A, B, C, D for S-550) */
  waveBankCount: number;

  // Value ranges
  /** Maximum valid tone index (0-based) */
  maxToneIndex: number;

  /** Maximum valid patch index (0-based) */
  maxPatchIndex: number;

  /** Maximum wave bank index (0-based) */
  maxWaveBankIndex: number;

  // URL configuration
  /** Base path for the editor (e.g., /roland/s330/editor) */
  basePath: string;

  // Client factory
  /** Factory function to create the device client */
  createClient: ClientFactory;

  /** Device-specific memory layout for UI rendering */
  memoryLayout: MemoryLayout;
}

/**
 * Get the number of patch banks for a device config.
 */
export function getPatchBankCount(config: DeviceConfig): number {
  return Math.ceil(config.totalPatches / config.patchesPerBank);
}

/**
 * Get the number of tone banks for a device config.
 */
export function getToneBankCount(config: DeviceConfig): number {
  return Math.ceil(config.totalTones / config.tonesPerBank);
}

/**
 * Get the bank index for a patch index.
 */
export function getPatchBankIndex(config: DeviceConfig, patchIndex: number): number {
  return Math.floor(patchIndex / config.patchesPerBank);
}

/**
 * Get the bank index for a tone index.
 */
export function getToneBankIndex(config: DeviceConfig, toneIndex: number): number {
  return Math.floor(toneIndex / config.tonesPerBank);
}
