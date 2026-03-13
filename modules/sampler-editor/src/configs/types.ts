/**
 * Device configuration types for the sampler editor.
 *
 * These types define the interface that all device-specific configurations
 * must implement to work with the shared editor components.
 *
 * @packageDocumentation
 */

import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';

/**
 * Supported device types in the sampler editor.
 */
export type SamplerDeviceType = 's330' | 's550';

/**
 * Device-specific client interface.
 * This is a minimal interface that all device clients must implement.
 */
export interface SamplerClientInterface {
  // Connection
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Patch operations
  loadPatch(index: number): Promise<unknown>;
  loadAllPatches(onProgress?: (current: number, total: number) => void): Promise<unknown[]>;
  savePatch(index: number, patch: unknown): Promise<void>;

  // Tone operations
  loadTone(index: number): Promise<unknown>;
  loadAllTones(onProgress?: (current: number, total: number) => void): Promise<unknown[]>;
  saveTone(index: number, tone: unknown): Promise<void>;

  // System operations
  loadSystemParams(): Promise<unknown>;
  saveSystemParams(params: unknown): Promise<void>;
}

/**
 * Factory function type for creating device clients.
 */
export type ClientFactory = (
  adapter: SSeriesMidiAdapter,
  options?: { deviceId?: number }
) => SamplerClientInterface;

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
