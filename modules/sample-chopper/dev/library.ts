/**
 * Browser-based chopped sample library using the File System Access API.
 *
 * Reads and writes chopped samples to:
 *   {libraryRoot}/chopped-samples/{name}/manifest.yaml + source.wav
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import {
  ChoppedSampleSchema,
  type ChoppedSample,
  type ChoppedSampleInfo,
} from '@audiocontrol/sampler-library/browser';
import type {
  ChopperSavePayload,
  ChopperLoadPayload,
  SliceDefinitionOutput,
} from '@/ui/index.js';

// =========================================================================
// File System Access API types (subset needed here)
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
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterable<FileSystemHandle>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
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

export async function ensureLibraryHandle(): Promise<FileSystemDirectoryHandle> {
  const existing = await getLibraryHandle();
  if (existing) return existing;

  const picked = await pickLibraryDirectory();
  if (!picked) throw new Error('Library directory selection cancelled');
  return picked;
}

async function getChoppedSamplesDir(
  root: FileSystemDirectoryHandle
): Promise<FileSystemDirectoryHandle> {
  return root.getDirectoryHandle('chopped-samples', { create: true });
}

// =========================================================================
// WAV Encoding/Decoding
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

  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeStr(view, 8, 'WAVE');
  // fmt chunk
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data chunk
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

export function parseWavSamples(buffer: ArrayBuffer): { samples: Int16Array; sampleRate: number } {
  const view = new DataView(buffer);

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') throw new Error('Not a WAV file');

  let offset = 12;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let numChannels = 1;

  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    }

    if (chunkId === 'data') {
      const dataOffset = offset + 8;
      if (bitsPerSample === 16) {
        const sampleCount = chunkSize / (2 * numChannels);
        const samples = new Int16Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
          samples[i] = view.getInt16(dataOffset + i * 2 * numChannels, true);
        }
        return { samples, sampleRate };
      }
      throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  throw new Error('No data chunk found');
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
// Save
// =========================================================================

export async function saveChoppedSample(payload: ChopperSavePayload): Promise<void> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root);

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

  // Write manifest.yaml
  const yamlContent = stringifyYaml(result.data, { indent: 2, lineWidth: 120 });
  const yamlHandle = await sampleDir.getFileHandle('manifest.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  // Write source.wav
  const wavBlob = createWavBlob(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);
  const wavHandle = await sampleDir.getFileHandle('source.wav', { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBlob);
  await wavWritable.close();
}

// =========================================================================
// List
// =========================================================================

export async function listChoppedSamples(): Promise<ChoppedSampleInfo[]> {
  const handle = await getLibraryHandle();
  if (!handle) return [];

  let samplesDir: FileSystemDirectoryHandle;
  try {
    samplesDir = await handle.getDirectoryHandle('chopped-samples', { create: false });
  } catch {
    return [];
  }

  const items: ChoppedSampleInfo[] = [];
  for await (const entry of samplesDir.values()) {
    if (entry.kind !== 'directory') continue;

    try {
      const dir = await samplesDir.getDirectoryHandle(entry.name);
      const manifestHandle = await dir.getFileHandle('manifest.yaml');
      const file = await manifestHandle.getFile();
      const text = await file.text();
      const parsed = parseYaml(text);
      const result = ChoppedSampleSchema.safeParse(parsed);
      if (!result.success) continue;

      items.push({
        name: result.data.name,
        variant: result.data.variant,
        sliceCount: result.data.slices.length,
        description: result.data.description,
        createdAt: result.data.createdAt,
        modifiedAt: result.data.modifiedAt,
      });
    } catch {
      // Skip unreadable entries
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// =========================================================================
// Delete
// =========================================================================

export async function deleteChoppedSample(name: string): Promise<void> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root);
  const safeName = sanitizeFilename(name);
  await samplesDir.removeEntry(safeName, { recursive: true });
}

// =========================================================================
// Load
// =========================================================================

export async function loadChoppedSample(name: string): Promise<ChopperLoadPayload> {
  const root = await ensureLibraryHandle();
  const samplesDir = await getChoppedSamplesDir(root);
  const safeName = sanitizeFilename(name);
  const sampleDir = await samplesDir.getDirectoryHandle(safeName, { create: false });

  // Read manifest
  const manifestHandle = await sampleDir.getFileHandle('manifest.yaml');
  const manifestFile = await manifestHandle.getFile();
  const manifestText = await manifestFile.text();
  const parsed = parseYaml(manifestText);
  const result = ChoppedSampleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid manifest for "${name}": ${result.error.message}`);
  }

  const manifest = result.data;

  // Read source.wav
  const wavHandle = await sampleDir.getFileHandle('source.wav');
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const { samples, sampleRate } = parseWavSamples(wavBuffer);

  const slices: SliceDefinitionOutput[] = manifest.slices.map((s) => ({
    label: s.label,
    startSample: s.startSample,
    endSample: s.endSample,
  }));

  return {
    name: manifest.name,
    slices,
    sourceAudio: { samples, sampleRate },
    triggers: manifest.triggers,
    playbackConfig: manifest.playback,
  };
}
