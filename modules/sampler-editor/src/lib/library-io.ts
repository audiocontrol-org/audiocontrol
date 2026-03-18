/**
 * Shared file I/O helpers for reading/writing tone and patch data
 * to the filesystem. Used by library-tones, library-patches, and library-sets.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { S330Tone, S330Patch, S330WaveDataResponse } from '@/core/midi/S330Client';
import {
  prepareWavForS330,
  calculateSegmentsNeeded,
} from '@/core/midi/S330Client';
import {
  ToneYamlSchema,
  s330ToneConverter,
  s330PatchConverter,
  type ToneYaml,
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';

// Re-export yaml helpers for other library modules
export { parseYaml, stringifyYaml };

// =========================================================================
// Tone File I/O
// =========================================================================

/**
 * Result from reading tone files from disk.
 */
export interface ReadToneResult {
  /** Parsed tone YAML */
  yaml: ToneYaml;
  /** Prepared wave data ready for S330 import (raw PCM, NOT WAV file) */
  wavData: Uint8Array;
  /** Number of segments needed for this tone's wave data */
  segmentsNeeded: number;
}

/**
 * Read a tone's YAML and WAV files from a directory.
 * This is the canonical function for reading tone data - used by all
 * tone loading operations (sets, individual tones, patch bundles).
 *
 * IMPORTANT: This function returns prepared PCM data, not raw WAV file bytes.
 * The WAV file is parsed and converted using prepareWavForS330().
 */
export async function readToneFilesFromDirectory(
  directory: FileSystemDirectoryHandle,
  baseFilename: string
): Promise<ReadToneResult> {
  const yamlHandle = await directory.getFileHandle(`${baseFilename}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlContent = await yamlFile.text();
  const yaml = ToneYamlSchema.parse(parseYaml(yamlContent));

  const wavHandle = await directory.getFileHandle(`${baseFilename}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavFileBuffer = await wavFile.arrayBuffer();
  const targetSampleRate = yaml.wave.sampleRate as 15000 | 30000;
  const prepared = prepareWavForS330(wavFileBuffer, targetSampleRate);

  const segmentsNeeded = calculateSegmentsNeeded(prepared.data.length / 2);

  return { yaml, wavData: prepared.data, segmentsNeeded };
}

/**
 * Result from writing tone files, includes info needed for manifest.
 */
export interface WriteToneResult {
  /** Calculated segment length based on actual sample count */
  segmentLength: number;
}

/**
 * Write a tone's YAML and WAV files to a directory.
 * This is the canonical function for writing tone data - used by both
 * individual tone export and set export operations.
 */
export async function writeToneFilesToDirectory(
  directory: FileSystemDirectoryHandle,
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  baseFilename: string
): Promise<WriteToneResult> {
  const samples = unpack12BitTo16Bit(waveData.data);

  const toneYaml = s330ToneConverter.toYaml(tone, `${baseFilename}.wav`);
  const yamlContent = stringifyYaml(toneYaml, {
    indent: 2,
    lineWidth: 120,
  });

  const yamlHandle = await directory.getFileHandle(`${baseFilename}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  const wavBlob = createWavBlobFromSamples(samples, waveData.sampleRate);
  const wavHandle = await directory.getFileHandle(`${baseFilename}.wav`, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBlob);
  await wavWritable.close();

  return {
    segmentLength: calculateSegmentsNeeded(samples.length),
  };
}

/**
 * Write a sub-tone's YAML file only (no WAV).
 * The YAML's wave.file references the source (original) tone's WAV file.
 */
export async function writeSubToneYamlToDirectory(
  directory: FileSystemDirectoryHandle,
  tone: S330Tone,
  baseFilename: string,
  sourceWavFilename: string,
): Promise<void> {
  const toneYaml = s330ToneConverter.toYaml(tone, sourceWavFilename);
  const yamlContent = stringifyYaml(toneYaml, {
    indent: 2,
    lineWidth: 120,
  });

  const yamlHandle = await directory.getFileHandle(`${baseFilename}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();
}

// =========================================================================
// Patch File I/O
// =========================================================================

/**
 * Write a patch's YAML file to a directory.
 * This is the canonical function for writing patch data - used by both
 * individual patch export and set export operations.
 */
export async function writePatchFileToDirectory(
  directory: FileSystemDirectoryHandle,
  patch: S330Patch,
  baseFilename: string
): Promise<void> {
  const patchYaml = s330PatchConverter.toYaml(patch);
  const yamlContent = stringifyYaml(patchYaml, {
    indent: 2,
    lineWidth: 120,
  });

  const yamlHandle = await directory.getFileHandle(`${baseFilename}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();
}

// =========================================================================
// Filename Helpers
// =========================================================================

/**
 * Generate a tone filename from slot index and optional name.
 * Format: "T01" or "T01 PianoName" if name is provided
 */
export function getToneFilename(slotIndex: number, toneName?: string): string {
  const slotPrefix = `T${String(slotIndex + 1).padStart(2, '0')}`;
  const sanitizedName = (toneName || '').trim().replace(/[<>:"/\\|?*]/g, '_');
  return sanitizedName ? `${slotPrefix} ${sanitizedName}` : slotPrefix;
}

/**
 * Generate a patch filename from slot index and optional name.
 * Format: "P01" or "P01 StringPad" if name is provided
 */
export function getPatchFilename(slotIndex: number, patchName?: string): string {
  const slotPrefix = `P${String(slotIndex + 1).padStart(2, '0')}`;
  const sanitizedName = (patchName || '').trim().replace(/[<>:"/\\|?*]/g, '_');
  return sanitizedName ? `${slotPrefix} ${sanitizedName}` : slotPrefix;
}

/**
 * Download a file to the user's computer (browser fallback).
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
