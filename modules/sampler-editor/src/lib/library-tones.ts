/**
 * Individual tone operations — export, import, listing, loading, and deletion
 * of tones in the library.
 */

import type { S330Tone, S330WaveDataResponse } from '@/core/midi/S330Client';
import {
  prepareWavForS330,
  parseWav,
  calculateSegmentsNeeded,
  type PreparedS330Sample,
} from '@/core/midi/S330Client';
import {
  ToneYamlSchema,
  s330ToneConverter,
  type ToneYaml,
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';
import type { LibraryTreeNode } from '@/lib/library-fs';
import { hasFileSystemAccess, getNestedDirectory } from '@/lib/library-fs';
import {
  parseYaml,
  stringifyYaml,
  readToneFilesFromDirectory,
  writeToneFilesToDirectory,
  downloadFile,
} from '@/lib/library-io';

// Re-export for consumers that import from library-service
export type { PreparedS330Sample };
export { prepareWavForS330 };

// =========================================================================
// WAV File Info
// =========================================================================

/**
 * Parse WAV file and return metadata for display purposes.
 */
export interface WavFileInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  sampleCount: number;
  duration: number;
}

/**
 * Get WAV file info for display purposes.
 */
export function getWavFileInfo(wavBytes: ArrayBuffer): WavFileInfo {
  const wavData = parseWav(wavBytes);
  return {
    sampleRate: wavData.sampleRate,
    channels: wavData.channels,
    bitsPerSample: wavData.bitsPerSample,
    sampleCount: wavData.samples.length,
    duration: wavData.samples.length / wavData.sampleRate,
  };
}

/**
 * Calculate segments needed for a WAV file at a target sample rate.
 */
export function calculateWavSegmentsNeeded(
  wavBytes: ArrayBuffer,
  targetSampleRate: 15000 | 30000
): number {
  const wavData = parseWav(wavBytes);
  const outputSampleCount = Math.floor(
    wavData.samples.length * (targetSampleRate / wavData.sampleRate)
  );
  return calculateSegmentsNeeded(outputSampleCount);
}

// =========================================================================
// Export Result
// =========================================================================

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

  const toneYaml = s330ToneConverter.toYaml(tone, wavFilename);
  const yamlContent = stringifyYaml(toneYaml, {
    indent: 2,
    lineWidth: 120,
  });

  const samples = unpack12BitTo16Bit(waveData.data);
  const wavBlob = createWavBlobFromSamples(samples, waveData.sampleRate);

  return {
    yamlContent,
    wavBlob,
    toneName,
  };
}

// =========================================================================
// Tone Info
// =========================================================================

/**
 * Information about an individual tone in the library.
 */
export interface LibraryToneInfo {
  /** Tone file name (without extension) */
  name: string;
  /** Full filename */
  fileName: string;
  /** Path segments from tones root (empty for root items) */
  path?: string[];
}

// =========================================================================
// Individual Tone Export
// =========================================================================

/**
 * Export tone to a specific directory using File System Access API.
 */
export async function exportToneToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string,
  onProgress?: (progress: number) => void,
  path: string[] = []
): Promise<void> {
  const toneName = customName || tone.name || 'untitled';
  const sanitizedName = toneName.replace(/[<>:"/\\|?*]/g, '_').trim();

  onProgress?.(25);

  const tonesDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'tones', ...path]);

  onProgress?.(50);

  await writeToneFilesToDirectory(tonesDir, tone, waveData, sanitizedName);

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

  downloadFile(new Blob([yamlContent], { type: 'text/yaml' }), `${toneName}.yaml`);
  onProgress?.(75);
  downloadFile(wavBlob, `${toneName}.wav`);
  onProgress?.(100);
}

/**
 * Import tone from YAML file
 */
export async function importToneFromFile(): Promise<ToneYaml> {
  if (hasFileSystemAccess()) {
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

// =========================================================================
// Listing and Loading
// =========================================================================

/**
 * List all individual tones in the library (outside of sets).
 *
 * @deprecated Use listIndividualTonesTree for hierarchical view
 */
export async function listIndividualTones(
  directoryHandle: FileSystemDirectoryHandle
): Promise<LibraryToneInfo[]> {
  const tones: LibraryToneInfo[] = [];

  try {
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const tonesDir = await s330Dir.getDirectoryHandle('tones', { create: false });

    for await (const entry of tonesDir.values()) {
      if (entry.kind !== 'file') continue;
      if (!entry.name.toLowerCase().endsWith('.yaml')) continue;

      const name = entry.name.replace(/\.yaml$/i, '');
      tones.push({
        name,
        fileName: name,
      });
    }
  } catch {
    return [];
  }

  return tones.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively scan a directory for tones and build a tree structure.
 */
async function scanTonesDirectory(
  dir: FileSystemDirectoryHandle,
  path: string[]
): Promise<LibraryTreeNode[]> {
  const nodes: LibraryTreeNode[] = [];

  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      const subDir = await dir.getDirectoryHandle(entry.name);
      const children = await scanTonesDirectory(subDir, [...path, entry.name]);

      nodes.push({
        id: [...path, entry.name].join('/'),
        name: entry.name,
        type: 'directory',
        path,
        children,
      });
    } else if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.yaml')) {
      const fileName = entry.name.replace(/\.yaml$/i, '');
      nodes.push({
        id: [...path, fileName].join('/'),
        name: fileName,
        type: 'tone',
        path,
        fileName,
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * List all individual tones in the library as a hierarchical tree.
 */
export async function listIndividualTonesTree(
  directoryHandle: FileSystemDirectoryHandle
): Promise<LibraryTreeNode[]> {
  try {
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const tonesDir = await s330Dir.getDirectoryHandle('tones', { create: false });

    return await scanTonesDirectory(tonesDir, []);
  } catch {
    return [];
  }
}

/**
 * Load an individual tone from the library (outside of sets).
 */
export async function loadIndividualTone(
  directoryHandle: FileSystemDirectoryHandle,
  toneFile: string,
  path: string[] = []
): Promise<{ yaml: ToneYaml; wavData: Uint8Array }> {
  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'tones', ...path
  ]);

  const { yaml, wavData } = await readToneFilesFromDirectory(tonesDir, toneFile);
  return { yaml, wavData };
}

/**
 * Load raw WAV samples from an individual library tone for sample chopping.
 */
export async function loadIndividualToneWavSamples(
  directoryHandle: FileSystemDirectoryHandle,
  toneFile: string,
  path: string[] = []
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'tones', ...path
  ]);

  const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavFileBuffer = await wavFile.arrayBuffer();

  const wavData = parseWav(wavFileBuffer);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
  };
}

/**
 * Delete an individual tone from the library.
 */
export async function deleteIndividualTone(
  directoryHandle: FileSystemDirectoryHandle,
  toneFile: string,
  path: string[] = []
): Promise<void> {
  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'tones', ...path
  ]);

  await tonesDir.removeEntry(`${toneFile}.yaml`);

  try {
    await tonesDir.removeEntry(`${toneFile}.wav`);
  } catch {
    // WAV file may not exist, that's ok
  }
}

/**
 * Load raw WAV samples from a library tone in a set for sample chopping.
 */
export async function loadToneWavSamples(
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  toneFile: string
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'sets', sanitizedName, 'tones'
  ]);

  const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavFileBuffer = await wavFile.arrayBuffer();

  const wavData = parseWav(wavFileBuffer);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
  };
}
