/**
 * Scanning and loading tones and drum kits from the FSAA library.
 *
 * Reads from {libraryRoot}/library/{s330,s550}/tones/ and drum-kits/
 * directories to present existing sampler content for import into
 * the standalone chopper.
 */

import { parse as parseYaml } from 'yaml';
import {
  DrumKitBundleSchema,
  loadDrumKitBundle as parseDrumKitBundle,
  ToneYamlSchema,
  type DrumKitBundle,
} from '@audiocontrol/sampler-library/browser';
import type { SliceDefinitionOutput } from '@/ui/index.js';
import { getLibraryHandle, ensureLibraryHandle, parseWavSamples } from './library.js';

// =========================================================================
// Types
// =========================================================================

export interface LibraryToneInfo {
  name: string;
  device: string;
  path: string[];
  sampleRate?: number;
}

export interface LibraryDrumKitInfo {
  name: string;
  device: string;
  path: string[];
  version: 1 | 2;
  sliceCount: number;
  sampleCount: number;
  description?: string;
}

export interface LibraryTonePayload {
  samples: Int16Array;
  sampleRate: number;
}

export interface LibraryDrumKitPayload {
  samples: Int16Array;
  sampleRate: number;
  slices: SliceDefinitionOutput[];
}

// =========================================================================
// FSAA Helpers
// =========================================================================

const DEVICE_DIRS = ['s330', 's550'] as const;

async function getSubdirectory(
  root: FileSystemDirectoryHandle,
  ...segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const seg of segments) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create: false });
    } catch {
      return null;
    }
  }
  return dir;
}

// =========================================================================
// Tone Scanning / Loading
// =========================================================================

async function scanTonesDir(
  dir: FileSystemDirectoryHandle,
  device: string,
  path: string[]
): Promise<LibraryToneInfo[]> {
  const results: LibraryToneInfo[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name);
      const subResults = await scanTonesDir(subDir, device, [...path, entry.name]);
      results.push(...subResults);
      continue;
    }

    if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
      const baseName = entry.name.replace(/\.yaml$/, '');
      try {
        await dir.getFileHandle(`${baseName}.wav`);
      } catch {
        continue;
      }

      let sampleRate: number | undefined;
      try {
        const fileHandle = await dir.getFileHandle(entry.name);
        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsed = parseYaml(text);
        const result = ToneYamlSchema.safeParse(parsed);
        if (result.success) {
          sampleRate = result.data.wave.sampleRate;
        }
      } catch {
        // Skip metadata on parse failure
      }

      results.push({ name: baseName, device, path, sampleRate });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listLibraryTones(): Promise<LibraryToneInfo[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];

  const allTones: LibraryToneInfo[] = [];

  for (const device of DEVICE_DIRS) {
    const tonesDir = await getSubdirectory(handle, 'library', device, 'tones');
    if (!tonesDir) continue;
    const tones = await scanTonesDir(tonesDir, device, []);
    allTones.push(...tones);
  }

  return allTones.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadLibraryTone(
  device: string,
  name: string,
  path: string[]
): Promise<LibraryTonePayload> {
  const root = await ensureLibraryHandle();
  const tonesDir = await getSubdirectory(root, 'library', device, 'tones');
  if (!tonesDir) throw new Error(`Tones directory not found for ${device}`);

  let dir = tonesDir;
  for (const seg of path) {
    dir = await dir.getDirectoryHandle(seg, { create: false });
  }

  const wavHandle = await dir.getFileHandle(`${name}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  return parseWavSamples(wavBuffer);
}

// =========================================================================
// Drum Kit Scanning / Loading
// =========================================================================

async function scanDrumKitsDir(
  dir: FileSystemDirectoryHandle,
  device: string,
  path: string[]
): Promise<LibraryDrumKitInfo[]> {
  const results: LibraryDrumKitInfo[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind !== 'directory') continue;

    const kitDir = await dir.getDirectoryHandle(entry.name);
    const wavFiles: string[] = [];
    let kitYaml: DrumKitBundle | null = null;

    for await (const child of kitDir.values()) {
      if (child.kind !== 'file') continue;
      if (child.name.endsWith('.wav')) {
        wavFiles.push(child.name);
      }
      if (child.name === 'kit.yaml') {
        try {
          const fh = await kitDir.getFileHandle('kit.yaml');
          const file = await fh.getFile();
          const text = await file.text();
          const parsed = parseYaml(text);
          const result = DrumKitBundleSchema.safeParse(parsed);
          if (result.success) kitYaml = result.data;
        } catch {
          // Skip invalid YAML
        }
      }
    }

    if (wavFiles.length === 0) {
      const subResults = await scanDrumKitsDir(kitDir, device, [...path, entry.name]);
      results.push(...subResults);
      continue;
    }

    const resolved = parseDrumKitBundle(kitYaml, wavFiles, entry.name);
    const isV2 = resolved.source !== undefined && resolved.slices !== undefined;

    results.push({
      name: resolved.name,
      device,
      path: [...path, entry.name],
      version: isV2 ? 2 : 1,
      sliceCount: resolved.slices?.length ?? 0,
      sampleCount: resolved.totalSamples,
      description: resolved.description,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listLibraryDrumKits(): Promise<LibraryDrumKitInfo[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];

  const allKits: LibraryDrumKitInfo[] = [];

  for (const device of DEVICE_DIRS) {
    const kitsDir = await getSubdirectory(handle, 'library', device, 'drum-kits');
    if (!kitsDir) continue;
    const kits = await scanDrumKitsDir(kitsDir, device, []);
    allKits.push(...kits);
  }

  return allKits.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadLibraryDrumKit(
  device: string,
  name: string,
  path: string[]
): Promise<LibraryDrumKitPayload> {
  const root = await ensureLibraryHandle();
  const kitsDir = await getSubdirectory(root, 'library', device, 'drum-kits');
  if (!kitsDir) throw new Error(`Drum kits directory not found for ${device}`);

  let dir = kitsDir;
  for (const seg of path) {
    dir = await dir.getDirectoryHandle(seg, { create: false });
  }

  let kitYaml: DrumKitBundle | null = null;
  try {
    const yamlHandle = await dir.getFileHandle('kit.yaml');
    const yamlFile = await yamlHandle.getFile();
    const text = await yamlFile.text();
    const parsed = parseYaml(text);
    const result = DrumKitBundleSchema.safeParse(parsed);
    if (result.success) kitYaml = result.data;
  } catch {
    // No kit.yaml
  }

  const wavFiles: string[] = [];
  for await (const child of dir.values()) {
    if (child.kind === 'file' && child.name.endsWith('.wav')) {
      wavFiles.push(child.name);
    }
  }

  const resolved = parseDrumKitBundle(kitYaml, wavFiles, name);

  if (!resolved.source || !resolved.slices || resolved.slices.length === 0) {
    throw new Error(`"${name}" is a v1 drum kit without a source WAV — cannot import`);
  }

  const wavHandle = await dir.getFileHandle(resolved.source);
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const { samples, sampleRate } = parseWavSamples(wavBuffer);

  const slices: SliceDefinitionOutput[] = resolved.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return { samples, sampleRate, slices };
}
