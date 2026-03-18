/**
 * Path resolution utilities for sets.
 *
 * Sets are stored in a directory structure that mirrors the device's
 * tone/patch organization but scoped to a named set directory.
 *
 * Directory structure:
 * ```
 * ~/Documents/AudioTools/library/s330/sets/
 * ├── My_Set_Name/
 * │   ├── set.yaml           # Set manifest
 * │   ├── tones/
 * │   │   ├── T01.yaml       # Tone parameters
 * │   │   ├── T01.wav        # Tone wave data
 * │   │   └── ...
 * │   └── patches/
 * │       ├── P01.yaml       # Patch parameters
 * │       └── ...
 * └── Another_Set/
 *     └── ...
 * ```
 *
 * @packageDocumentation
 */

import { join } from 'path';
import type { DeviceType } from '@/types/index.js';
import { getDeviceLibraryPath, sanitizeFilename } from './library-paths.js';

/**
 * Get the sets directory for a device.
 *
 * @param device - Device type
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/
 */
export function getSetsDirectory(device: DeviceType): string {
  return join(getDeviceLibraryPath(device), 'sets');
}

/**
 * Get the directory for a specific set.
 *
 * @param device - Device type
 * @param setName - Set name (will be sanitized for filesystem)
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/
 */
export function getSetDirectory(device: DeviceType, setName: string): string {
  const safeName = sanitizeFilename(setName);
  return join(getSetsDirectory(device), safeName);
}

/**
 * Get the path to a set's manifest file.
 *
 * @param device - Device type
 * @param setName - Set name
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/set.yaml
 */
export function getSetManifestPath(device: DeviceType, setName: string): string {
  return join(getSetDirectory(device, setName), 'set.yaml');
}

/**
 * Get the tones directory within a set.
 *
 * @param device - Device type
 * @param setName - Set name
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/tones/
 */
export function getSetTonesDirectory(device: DeviceType, setName: string): string {
  return join(getSetDirectory(device, setName), 'tones');
}

/**
 * Get the patches directory within a set.
 *
 * @param device - Device type
 * @param setName - Set name
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/patches/
 */
export function getSetPatchesDirectory(device: DeviceType, setName: string): string {
  return join(getSetDirectory(device, setName), 'patches');
}

/**
 * Get the path to a tone YAML file within a set.
 *
 * @param device - Device type
 * @param setName - Set name
 * @param toneFile - Tone filename (without extension, e.g., "T01")
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/tones/{toneFile}.yaml
 */
export function getSetTonePath(
  device: DeviceType,
  setName: string,
  toneFile: string
): string {
  return join(getSetTonesDirectory(device, setName), `${toneFile}.yaml`);
}

/**
 * Get the path to a tone WAV file within a set.
 *
 * @param device - Device type
 * @param setName - Set name
 * @param toneFile - Tone filename (without extension, e.g., "T01")
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/tones/{toneFile}.wav
 */
export function getSetToneWavePath(
  device: DeviceType,
  setName: string,
  toneFile: string
): string {
  return join(getSetTonesDirectory(device, setName), `${toneFile}.wav`);
}

/**
 * Get the path to a patch YAML file within a set.
 *
 * @param device - Device type
 * @param setName - Set name
 * @param patchFile - Patch filename (without extension, e.g., "P01")
 * @returns Path to ~/Documents/AudioTools/library/{device}/sets/{setName}/patches/{patchFile}.yaml
 */
export function getSetPatchPath(
  device: DeviceType,
  setName: string,
  patchFile: string
): string {
  return join(getSetPatchesDirectory(device, setName), `${patchFile}.yaml`);
}

/**
 * Generate the standard tone filename for a slot index.
 *
 * @param slot - Slot index (0-63 for S-550, 0-31 for S-330)
 * @returns Filename like "T01", "T02", ..., "T64"
 */
export function getToneFilename(slot: number): string {
  if (slot < 0 || slot > 63) {
    throw new Error(`Invalid tone slot index: ${slot}. Must be 0-63.`);
  }
  return `T${String(slot + 1).padStart(2, '0')}`;
}

/**
 * Generate the standard patch filename for a slot index.
 *
 * @param slot - Slot index (0-63 for S-330, 0-31 for S-550)
 * @returns Filename like "P01", "P02", ..., "P64"
 */
export function getPatchFilename(slot: number): string {
  if (slot < 0 || slot > 63) {
    throw new Error(`Invalid patch slot index: ${slot}. Must be 0-63.`);
  }
  return `P${String(slot + 1).padStart(2, '0')}`;
}

/**
 * Parse a tone filename to extract the slot index.
 *
 * @param filename - Filename like "T01" or "T01.yaml"
 * @returns Slot index (0-31) or null if invalid
 */
export function parseToneFilename(filename: string): number | null {
  const match = filename.match(/^T(\d{2})(?:\.yaml)?$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (num < 1 || num > 32) return null;

  return num - 1;
}

/**
 * Parse a patch filename to extract the slot index.
 *
 * @param filename - Filename like "P01" or "P01.yaml"
 * @returns Slot index (0-15) or null if invalid
 */
export function parsePatchFilename(filename: string): number | null {
  const match = filename.match(/^P(\d{2})(?:\.yaml)?$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (num < 1 || num > 16) return null;

  return num - 1;
}
