/**
 * Browser-compatible Library Service
 *
 * Handles library operations in the browser using the File System Access API
 * when available, with fallback to download/upload for older browsers.
 *
 * Note: Full filesystem persistence requires the File System Access API
 * (Chrome/Edge) or a backend server. This implementation focuses on
 * the immediate export/import workflows.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { S330Tone } from '@audiocontrol/sampler-devices/s330';
import type { S330WaveDataResponse } from '@audiocontrol/sampler-devices/s330';
import {
  ToneYamlSchema,
  s330ToneConverter,
  type ToneYaml,
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';

/**
 * Check if the File System Access API is available
 */
export function hasFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
}

// In-memory cache for the library directory handle
let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Get the cached library directory handle, if available and still has permission.
 */
export async function getCachedLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!cachedDirectoryHandle) {
    return null;
  }

  // Verify we still have permission
  try {
    const permission = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return cachedDirectoryHandle;
    }

    // Try to request permission
    const requested = await cachedDirectoryHandle.requestPermission({ mode: 'readwrite' });
    if (requested === 'granted') {
      return cachedDirectoryHandle;
    }
  } catch {
    // Permission check failed, clear cache
    cachedDirectoryHandle = null;
  }

  return null;
}

/**
 * Set the cached library directory handle.
 */
export function setCachedLibraryDirectory(handle: FileSystemDirectoryHandle | null): void {
  cachedDirectoryHandle = handle;
}

/**
 * Export result containing the generated files
 */
export interface ExportResult {
  yamlContent: string;
  wavBlob: Blob;
  toneName: string;
}

/**
 * Convert S330 tone and wave data to library format
 */
export function prepareExport(
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string
): ExportResult {
  const toneName = customName || tone.name || 'untitled';
  const wavFilename = `${toneName}.wav`;

  // Convert S330 tone to YAML format
  const toneYaml = s330ToneConverter.toYaml(tone, wavFilename);

  // Generate YAML content
  const yamlContent = stringifyYaml(toneYaml, {
    indent: 2,
    lineWidth: 120,
  });

  // Create WAV blob
  const samples = unpack12BitTo16Bit(waveData.data);
  const wavBlob = createWavBlobFromSamples(samples, waveData.sampleRate);

  return {
    yamlContent,
    wavBlob,
    toneName,
  };
}

/**
 * Download a file to the user's computer
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get a directory handle for the library.
 * Must be called directly from a user gesture (click handler).
 * Returns null if user cancels or API not available.
 */
export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFileSystemAccess()) {
    return null;
  }

  try {
    return await window.showDirectoryPicker({
      id: 'sampler-library',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null; // User cancelled
    }
    throw err;
  }
}

/**
 * Get or create a nested directory path within a directory handle.
 */
async function getNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Export tone to a specific directory using File System Access API.
 * Automatically creates library/s330/tones/ subdirectory structure.
 */
export async function exportToneToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { yamlContent, wavBlob, toneName } = prepareExport(tone, waveData, customName);

  onProgress?.(50);

  // Create library/s330/tones/ subdirectory structure
  const tonesDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'tones']);

  // Write YAML file
  const yamlHandle = await tonesDir.getFileHandle(`${toneName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.(75);

  // Write WAV file
  const wavHandle = await tonesDir.getFileHandle(`${toneName}.wav`, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBlob);
  await wavWritable.close();

  onProgress?.(100);
}

/**
 * Export tone to library by downloading files (fallback)
 */
export async function exportToneAsDownload(
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { yamlContent, wavBlob, toneName } = prepareExport(tone, waveData, customName);

  onProgress?.(50);

  // Download both files
  downloadFile(new Blob([yamlContent], { type: 'text/yaml' }), `${toneName}.yaml`);
  onProgress?.(75);
  downloadFile(wavBlob, `${toneName}.wav`);
  onProgress?.(100);
}

/**
 * Import tone from YAML file
 * Returns the parsed ToneYaml
 */
export async function importToneFromFile(): Promise<ToneYaml> {
  if (hasFileSystemAccess()) {
    // Use File System Access API
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'YAML files',
          accept: { 'text/yaml': ['.yaml', '.yml'] },
        },
      ],
    });
    const file = await fileHandle.getFile();
    const content = await file.text();
    const data = parseYaml(content);
    return ToneYamlSchema.parse(data);
  } else {
    // Fallback: use file input
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const content = await file.text();
          const data = parseYaml(content);
          const tone = ToneYamlSchema.parse(data);
          resolve(tone);
        } catch (err) {
          reject(err);
        }
      };

      input.oncancel = () => {
        reject(new Error('Import cancelled'));
      };

      input.click();
    });
  }
}

/**
 * Import WAV file and return as Uint8Array
 */
export async function importWavFile(): Promise<{ data: Uint8Array; filename: string }> {
  if (hasFileSystemAccess()) {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'WAV files',
          accept: { 'audio/wav': ['.wav'] },
        },
      ],
    });
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer),
      filename: file.name,
    };
  } else {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.wav';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          resolve({
            data: new Uint8Array(arrayBuffer),
            filename: file.name,
          });
        } catch (err) {
          reject(err);
        }
      };

      input.oncancel = () => {
        reject(new Error('Import cancelled'));
      };

      input.click();
    });
  }
}

/**
 * Convert ToneYaml back to S330Tone for device upload
 */
export function convertYamlToS330Tone(yaml: ToneYaml): S330Tone {
  return s330ToneConverter.fromYaml(yaml);
}

// TypeScript declarations for File System Access API
declare global {
  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface DirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }
}
