/**
 * Library adapter for the standalone sample chopper.
 *
 * Connection management and common-area operations delegate to shared
 * abstractions in @audiocontrol/sampler-library. This file retains only
 * the chopper-specific device-browsing operations (listing/loading
 * tones and drum kits across multiple devices).
 */

import { parse as parseYaml } from 'yaml';
import {
  type ChoppedSample,
  type LibraryTreeNode,
  type LibrarySetInfo,
  type StorageDirectoryHandle,
  parseWav,
  createWav,
  DrumKitBundleSchema,
  loadDrumKitBundle as parseDrumKitBundle,
  type DrumKitBundle,
  getNestedDirectoryIfExists,
  listTonesTree,
  listDrumKitsTree,
  listChoppedSamplesTree,
  listCommonSamplesTree,
  listSets,
  listSetTonesTree,
  BrowserLibraryConnection,
  saveChoppedSample as sharedSaveChoppedSample,
  loadChoppedSample as sharedLoadChoppedSample,
  deleteItem,
  createFolder,
  moveItem,
} from '@audiocontrol/sampler-library/browser';
import type {
  ChopperSavePayload,
  SliceDefinitionOutput,
} from '@/ui/index.js';

// =========================================================================
// Connection singleton
// =========================================================================

const connection = new BrowserLibraryConnection({
  pickerId: 'chopped-sample-library',
});

export function hasFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in globalThis;
}

export async function pickLibraryDirectory(): Promise<boolean> {
  return connection.connect();
}

export async function getLibraryHandle(): Promise<StorageDirectoryHandle | null> {
  if (!connection.isConnected()) return null;
  const valid = await connection.verifyPermission();
  return valid ? connection.getRoot() : null;
}

function ensureRoot(): StorageDirectoryHandle {
  return connection.getRoot();
}

// =========================================================================
// Chopped sample types
// =========================================================================

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
// Chopped Samples: Save / List / Delete / Load
// =========================================================================

export async function saveChoppedSample(
  payload: ChopperSavePayload,
  path: string[] = [],
): Promise<void> {
  const root = ensureRoot();
  const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);

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

  await sharedSaveChoppedSample(root, { name: payload.name, manifest, wavData }, path);
}

export async function listChoppedSamples(): Promise<LibraryTreeNode[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];
  return listChoppedSamplesTree(handle);
}

export async function listCommonSamples(): Promise<LibraryTreeNode[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];
  return listCommonSamplesTree(handle);
}

export async function deleteChoppedSample(name: string, path: string[] = []): Promise<void> {
  await deleteItem(ensureRoot(), name, path);
}

export async function loadChoppedSample(
  name: string,
  path: string[] = [],
): Promise<ChopperLoadPayload> {
  const result = await sharedLoadChoppedSample(ensureRoot(), name, path);
  const wavData = parseWav(result.wavData);

  const slices: SliceDefinitionOutput[] = result.manifest.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return {
    name: result.manifest.name,
    slices,
    sourceAudio: { samples: wavData.samples, sampleRate: wavData.sampleRate },
    triggers: result.manifest.triggers,
    playbackConfig: result.manifest.playback,
  };
}

export async function createSamplesFolder(
  path: string[],
  name: string,
): Promise<void> {
  await createFolder(ensureRoot(), path, name);
}

export async function moveLibraryItem(
  name: string,
  fromPath: string[],
  toPath: string[],
): Promise<void> {
  await moveItem(ensureRoot(), name, fromPath, toPath);
}

// =========================================================================
// Tone Listing / Loading (device-specific browsing)
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
    const tree = await listTonesTree(handle, device);
    flattenTones(tree, device, { kind: 'standalone' }, [], allTones);

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
  const root = ensureRoot();
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
// Drum Kit Listing / Loading (device-specific browsing)
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
  const root = ensureRoot();
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
