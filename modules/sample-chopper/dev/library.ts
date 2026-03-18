/**
 * Browser-based library adapter for the standalone sample chopper.
 *
 * Chopped samples live at: {root}/library/common/samples/{path}/
 * Tones and drum kits are scanned from the shared FSAA library layout
 * via functions from @audiocontrol/sampler-library.
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import {
  ChoppedSampleSchema,
  type ChoppedSample,
  parseWav,
  type LibraryTreeNode,
  type LibrarySetInfo,
  DrumKitBundleSchema,
  loadDrumKitBundle as parseDrumKitBundle,
  type DrumKitBundle,
  getNestedDirectory,
  getNestedDirectoryIfExists,
  moveDirectory,
  listTonesTree,
  listDrumKitsTree,
  listChoppedSamplesTree,
  listSets,
  listSetTonesTree,
  scanTonesDirectory,
  ToneYamlSchema,
} from '@audiocontrol/sampler-library/browser';
import type {
  ChopperSavePayload,
  SliceDefinitionOutput,
} from '@/ui/index.js';

export interface ChopperLoadPayload {
  name: string;
  slices: SliceDefinitionOutput[];
  sourceAudio: { samples: Int16Array; sampleRate: number };
  triggers?: Array<{ triggerId: string; sliceIndex: number }>;
  playbackConfig?: {
    polyphony: 'mono' | 'poly';
    playbackMode: 'one-shot' | 'gate';
    muteGroups: number[];
  };
}

// Re-export shared types for consumers
export type { LibraryTreeNode, LibrarySetInfo };

// =========================================================================
// FSAA type declarations (chopper-specific: directory picker, writable)
// =========================================================================

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemDirectoryHandle {
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }
}

// =========================================================================
// Directory Handle Management
// =========================================================================

let cachedHandle: FileSystemDirectoryHandle | null = null;

export function hasFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}

export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFileSystemAccess()) return null;

  try {
    const handle = await window.showDirectoryPicker({
      id: 'chopped-sample-library',
      mode: 'readwrite',
      startIn: 'documents',
    });
    cachedHandle = handle;
    return handle;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

export async function getLibraryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedHandle) {
    try {
      const perm = await cachedHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return cachedHandle;
      const req = await cachedHandle.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') return cachedHandle;
    } catch {
      cachedHandle = null;
    }
  }
  return null;
}

async function ensureLibraryHandle(): Promise<FileSystemDirectoryHandle> {
  const existing = await getLibraryHandle();
  if (existing) return existing;

  const picked = await pickLibraryDirectory();
  if (!picked) throw new Error('Library directory selection cancelled');
  return picked;
}

// =========================================================================
// WAV Encoding (write-only, not in sampler-library)
// =========================================================================

function createWavBlob(samples: Int16Array, sampleRate: number): Blob {
  const bitsPerSample = 16;
  const channels = 1;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(new Uint8Array(samples.buffer, samples.byteOffset, dataSize), 44);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

function writeStr(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// =========================================================================
// Filename Sanitization
// =========================================================================

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

// =========================================================================
// Chopped Samples: Save / List / Delete / Load
// =========================================================================

const SAMPLES_ROOT = ['library', 'common', 'samples'];

async function getChoppedSamplesDir(
  root: FileSystemDirectoryHandle,
  path: string[] = [],
): Promise<FileSystemDirectoryHandle> {
  return getNestedDirectory(root, [...SAMPLES_ROOT, ...path]);
}

export async function saveChoppedSample(
  payload: ChopperSavePayload,
  path: string[] = [],
): Promise<void> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root, path);

  const safeName = sanitizeFilename(payload.name);
  const sampleDir = await samplesDir.getDirectoryHandle(safeName, { create: true });

  const manifest: ChoppedSample = {
    format: 'chopped-sample',
    version: 1,
    variant: 'generic',
    name: payload.name,
    source: 'source.wav',
    sampleRate: payload.sourceAudio.sampleRate,
    slices: payload.slices.map((s) => ({
      label: s.label,
      startSample: s.startSample,
      endSample: s.endSample,
    })),
    triggers: payload.triggers,
    playback: payload.playbackConfig,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  const result = ChoppedSampleSchema.safeParse(manifest);
  if (!result.success) {
    throw new Error(`Invalid manifest: ${result.error.message}`);
  }

  const yamlContent = stringifyYaml(result.data, { indent: 2, lineWidth: 120 });
  const yamlHandle = await sampleDir.getFileHandle('manifest.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  const wavBlob = createWavBlob(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);
  const wavHandle = await sampleDir.getFileHandle('source.wav', { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBlob);
  await wavWritable.close();
}

export async function listChoppedSamples(): Promise<LibraryTreeNode[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];
  return listChoppedSamplesTree(handle);
}

export async function deleteChoppedSample(name: string, path: string[] = []): Promise<void> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root, path);
  const safeName = sanitizeFilename(name);
  await samplesDir.removeEntry(safeName, { recursive: true });
}

export async function loadChoppedSample(
  name: string,
  path: string[] = [],
): Promise<ChopperLoadPayload> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root, path);
  const safeName = sanitizeFilename(name);
  const sampleDir = await samplesDir.getDirectoryHandle(safeName, { create: false });

  const manifestHandle = await sampleDir.getFileHandle('manifest.yaml');
  const manifestFile = await manifestHandle.getFile();
  const manifestText = await manifestFile.text();
  const parsed = parseYaml(manifestText);
  const result = ChoppedSampleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid manifest for "${name}": ${result.error.message}`);
  }

  const manifest = result.data;
  const wavHandle = await sampleDir.getFileHandle('source.wav');
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const wavData = parseWav(wavBuffer);

  const slices: SliceDefinitionOutput[] = manifest.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return {
    name: manifest.name,
    slices,
    sourceAudio: { samples: wavData.samples, sampleRate: wavData.sampleRate },
    triggers: manifest.triggers,
    playbackConfig: manifest.playback,
  };
}

export async function createSamplesFolder(
  path: string[],
  name: string,
): Promise<void> {
  const root = await ensureLibraryHandle();
  const parentDir = await getChoppedSamplesDir(root, path);
  await parentDir.getDirectoryHandle(name, { create: true });
}

/**
 * Move a library item (sample or folder) from one location to another.
 */
export async function moveLibraryItem(
  name: string,
  fromPath: string[],
  toPath: string[],
): Promise<void> {
  const root = await ensureLibraryHandle();
  const srcParent = await getChoppedSamplesDir(root, fromPath);
  const destParent = await getChoppedSamplesDir(root, toPath);
  await moveDirectory(srcParent, name, destParent);
}

// =========================================================================
// Tone Listing / Loading
// =========================================================================

const DEVICE_DIRS = ['s330', 's550'] as const;

export interface LibraryToneInfo {
  name: string;
  device: string;
  source: { kind: 'standalone' } | { kind: 'set'; setName: string };
  path: string[];
  sampleRate?: number;
}

export async function listLibraryTones(): Promise<LibraryToneInfo[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];

  const allTones: LibraryToneInfo[] = [];

  for (const device of DEVICE_DIRS) {
    // Standalone tones
    const tree = await listTonesTree(handle, device);
    flattenTones(tree, device, { kind: 'standalone' }, [], allTones);

    // Tones inside sets
    const sets = await listSets(handle, device);
    for (const set of sets) {
      const setTree = await listSetTonesTree(handle, device, set.directoryName);
      flattenTones(setTree, device, { kind: 'set', setName: set.directoryName }, [], allTones);
    }
  }

  return allTones.sort((a, b) => a.name.localeCompare(b.name));
}

function flattenTones(
  nodes: LibraryTreeNode[],
  device: string,
  source: LibraryToneInfo['source'],
  path: string[],
  out: LibraryToneInfo[],
): void {
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      flattenTones(node.children, device, source, [...path, node.name], out);
    } else if (node.type === 'tone' && node.fileName) {
      out.push({ name: node.fileName, device, source, path });
    }
  }
}

export async function loadLibraryTone(
  tone: LibraryToneInfo,
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const root = await ensureLibraryHandle();
  const segments = tone.source.kind === 'set'
    ? ['library', tone.device, 'sets', tone.source.setName, 'tones', ...tone.path]
    : ['library', tone.device, 'tones', ...tone.path];

  const dir = await getNestedDirectoryIfExists(root, segments);
  if (!dir) throw new Error(`Tones directory not found for ${tone.device}`);

  const wavHandle = await dir.getFileHandle(`${tone.name}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const wavData = parseWav(wavBuffer);
  return { samples: wavData.samples, sampleRate: wavData.sampleRate };
}

// =========================================================================
// Drum Kit Listing / Loading
// =========================================================================

export interface LibraryDrumKitInfo {
  name: string;
  device: string;
  path: string[];
  directoryName: string;
  version: 1 | 2;
  sliceCount: number;
  sampleCount: number;
  description?: string;
}

export async function listLibraryDrumKits(): Promise<LibraryDrumKitInfo[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];

  const allKits: LibraryDrumKitInfo[] = [];

  for (const device of DEVICE_DIRS) {
    const tree = await listDrumKitsTree(handle, device);
    flattenDrumKits(tree, device, [], allKits);
  }

  return allKits.sort((a, b) => a.name.localeCompare(b.name));
}

function flattenDrumKits(
  nodes: LibraryTreeNode[],
  device: string,
  path: string[],
  out: LibraryDrumKitInfo[],
): void {
  for (const node of nodes) {
    if (node.type === 'directory' && node.children) {
      flattenDrumKits(node.children, device, [...path, node.name], out);
    } else if (node.type === 'drum-kit' && node.directoryName) {
      const hasSource = node.sampleCount !== undefined && node.sampleCount > 0;
      out.push({
        name: node.name,
        device,
        path: [...path, node.directoryName],
        directoryName: node.directoryName,
        version: hasSource ? 2 : 1,
        sliceCount: 0,
        sampleCount: node.sampleCount ?? 0,
        description: node.description,
      });
    }
  }
}

export async function loadLibraryDrumKit(
  kit: LibraryDrumKitInfo,
): Promise<{ samples: Int16Array; sampleRate: number; slices: SliceDefinitionOutput[] }> {
  const root = await ensureLibraryHandle();
  const dir = await getNestedDirectoryIfExists(
    root, ['library', kit.device, 'drum-kits', ...kit.path],
  );
  if (!dir) throw new Error(`Drum kit directory not found for ${kit.device}`);

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

  const resolved = parseDrumKitBundle(kitYaml, wavFiles, kit.name);

  if (!resolved.source || !resolved.slices || resolved.slices.length === 0) {
    throw new Error(`"${kit.name}" is a v1 drum kit without a source WAV`);
  }

  const wavHandle = await dir.getFileHandle(resolved.source);
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const wavData = parseWav(wavBuffer);

  const slices: SliceDefinitionOutput[] = resolved.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return { samples: wavData.samples, sampleRate: wavData.sampleRate, slices };
}
