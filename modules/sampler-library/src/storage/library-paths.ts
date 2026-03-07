/**
 * Library path resolution utilities.
 *
 * Provides consistent path generation for the sampler library structure.
 *
 * @packageDocumentation
 */

import { homedir } from 'os';
import { join } from 'path';
import type { DeviceType } from '@/types/index.js';

/**
 * Get the root directory for the audiotools library.
 *
 * @returns Path to ~/.audiotools/library/
 */
export function getLibraryRoot(): string {
  return join(homedir(), '.audiotools', 'library');
}

/**
 * Get the library directory for a specific device.
 *
 * @param device - Device type
 * @returns Path to ~/.audiotools/library/{device}/
 */
export function getDeviceLibraryPath(device: DeviceType): string {
  return join(getLibraryRoot(), device);
}

/**
 * Get the tones directory for a device.
 *
 * @param device - Device type
 * @returns Path to ~/.audiotools/library/{device}/tones/
 */
export function getTonesDirectory(device: DeviceType): string {
  return join(getDeviceLibraryPath(device), 'tones');
}

/**
 * Get the patches directory for a device.
 *
 * @param device - Device type
 * @returns Path to ~/.audiotools/library/{device}/patches/
 */
export function getPatchesDirectory(device: DeviceType): string {
  return join(getDeviceLibraryPath(device), 'patches');
}

/**
 * Get the templates directory for a device.
 *
 * @param device - Device type
 * @returns Path to ~/.audiotools/library/{device}/templates/
 */
export function getTemplatesDirectory(device: DeviceType): string {
  return join(getDeviceLibraryPath(device), 'templates');
}

/**
 * Get the path to a tone YAML file.
 *
 * @param device - Device type
 * @param toneName - Tone name (without extension)
 * @returns Path to ~/.audiotools/library/{device}/tones/{toneName}.yaml
 */
export function getTonePath(device: DeviceType, toneName: string): string {
  return join(getTonesDirectory(device), `${toneName}.yaml`);
}

/**
 * Get the path to a tone's WAV file.
 *
 * @param device - Device type
 * @param toneName - Tone name (without extension)
 * @returns Path to ~/.audiotools/library/{device}/tones/{toneName}.wav
 */
export function getToneWavePath(device: DeviceType, toneName: string): string {
  return join(getTonesDirectory(device), `${toneName}.wav`);
}

/**
 * Get the path to a patch YAML file.
 *
 * @param device - Device type
 * @param patchName - Patch name (without extension)
 * @returns Path to ~/.audiotools/library/{device}/patches/{patchName}.yaml
 */
export function getPatchPath(device: DeviceType, patchName: string): string {
  return join(getPatchesDirectory(device), `${patchName}.yaml`);
}

/**
 * Get the path to a template YAML file.
 *
 * @param device - Device type
 * @param templateName - Template name (without extension)
 * @returns Path to ~/.audiotools/library/{device}/templates/{templateName}.yaml
 */
export function getTemplatePath(device: DeviceType, templateName: string): string {
  return join(getTemplatesDirectory(device), `${templateName}.yaml`);
}

/**
 * Sanitize a name for use as a filename.
 *
 * Removes or replaces characters that are not safe for filenames.
 *
 * @param name - Original name
 * @returns Sanitized filename-safe name
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Replace unsafe chars
    .replace(/\s+/g, '_') // Replace whitespace with underscore
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_|_$/g, '') // Trim leading/trailing underscores
    .slice(0, 64); // Limit length
}

/**
 * Extract the base name from a file path (without extension).
 *
 * @param filePath - Full file path
 * @returns Base name without extension
 */
export function getBaseName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  const filename = parts[parts.length - 1] ?? '';
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}
