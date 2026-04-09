/**
 * Shared OPFS fixture writers for e2e tests.
 *
 * These functions write test fixtures to OPFS at contract paths defined in
 * SAMPLER-LIBRARY.md. Import from any editor's e2e tests.
 *
 * Common-area fixtures (samples, drum kits) go to library/common/samples/.
 * Device-specific fixtures go to library/{device}/{category}/.
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Common-area fixtures
// ---------------------------------------------------------------------------

/**
 * Write a minimal sample fixture to OPFS common area.
 * Writes to: library/common/samples/{path...}/{name}/sample.yaml + sample.wav
 */
export async function writeSampleFixture(
  page: Page,
  name: string,
  path: string[] = [],
): Promise<void> {
  await page.evaluate(async ({ name, path }: { name: string; path: string[] }) => {
    const root = await navigator.storage.getDirectory();
    // Contract path: library/common/samples/
    let dir = root;
    for (const segment of ['library', 'common', 'samples', ...path]) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const sampleDir = await dir.getDirectoryHandle(name, { create: true });

    // Write sample.yaml
    const yaml = `format: sample\nversion: 1\nname: ${name}\nfile: sample.wav\nsampleRate: 44100\n`;
    const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yaml);
    await yamlWritable.close();

    // Write minimal WAV (44 bytes header + 2 bytes data)
    const wavHeader = new ArrayBuffer(46);
    const view = new DataView(wavHeader);
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 38, true);          // file size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);          // chunk size
    view.setUint16(20, 1, true);           // PCM
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, 44100, true);       // sample rate
    view.setUint32(28, 88200, true);       // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits per sample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, 2, true);           // data size
    view.setInt16(44, 0, true);            // one silent sample

    const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(new Uint8Array(wavHeader));
    await wavWritable.close();
  }, { name, path });
}

/**
 * Options for creating a drum kit test fixture.
 * The fixture is a common-area chopped sample: sample.yaml with slice
 * definitions + sample.wav with enough audio for the slices.
 */
export interface DrumKitFixtureOptions {
  /** Display name for the drum kit */
  name: string;
  /** MIDI base note (default: 36 = C2) */
  baseNote?: number;
  /** Slice labels (one per slice). Determines slice count. */
  sliceLabels: string[];
  /** Sample rate (default: 44100) */
  sampleRate?: number;
  /** Samples per slice (default: 100) */
  samplesPerSlice?: number;
}

/**
 * Write a drum kit fixture to the common-area samples directory.
 *
 * Creates: library/common/samples/{name}/sample.yaml + sample.wav
 *
 * The YAML contains slice definitions that importDrumKitToDevice (S3K) and
 * equivalent Roland import code can read via loadChoppedSample().
 *
 * Both editors should read drum kits from the common area, per SAMPLER-LIBRARY.md.
 */
export async function writeDrumKitFixture(
  page: Page,
  options: DrumKitFixtureOptions,
): Promise<void> {
  await page.evaluate(async (opts: DrumKitFixtureOptions) => {
    const sampleRate = opts.sampleRate ?? 44100;
    const samplesPerSlice = opts.samplesPerSlice ?? 100;
    const totalSamples = opts.sliceLabels.length * samplesPerSlice;
    const baseNote = opts.baseNote ?? 36;

    // Build sample.yaml with slice definitions
    const sliceYaml = opts.sliceLabels.map((label, i) => {
      const start = i * samplesPerSlice;
      const end = (i + 1) * samplesPerSlice;
      return `  - label: "${label}"\n    startSample: ${start}\n    endSample: ${end}`;
    }).join('\n');

    const yaml = [
      'format: sample',
      'version: 1',
      `name: "${opts.name}"`,
      'file: sample.wav',
      `sampleRate: ${sampleRate}`,
      'drumKit:',
      `  baseNote: ${baseNote}`,
      'slices:',
      sliceYaml,
    ].join('\n') + '\n';

    // Build WAV with enough PCM data for all slices (16-bit mono)
    const dataSize = totalSamples * 2;
    const fileSize = 44 + dataSize;
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false);  // "RIFF"
    view.setUint32(4, fileSize - 8, true);
    view.setUint32(8, 0x57415645, false);  // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);            // PCM
    view.setUint16(22, 1, true);            // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    // Fill with distinct pattern per slice
    for (let i = 0; i < totalSamples; i++) {
      const sliceIndex = Math.floor(i / samplesPerSlice);
      const amplitude = 8000 + sliceIndex * 2000;
      const value = Math.round(amplitude * Math.sin(2 * Math.PI * 440 * i / sampleRate));
      view.setInt16(44 + i * 2, value, true);
    }

    // Write to OPFS: library/common/samples/{name}/
    const root = await navigator.storage.getDirectory();
    let dir = root;
    for (const segment of ['library', 'common', 'samples']) {
      dir = await dir.getDirectoryHandle(segment, { create: true });
    }
    const sampleDir = await dir.getDirectoryHandle(opts.name, { create: true });

    const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yaml);
    await yamlWritable.close();

    const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(new Uint8Array(buffer));
    await wavWritable.close();
  }, options);
}

// ---------------------------------------------------------------------------
// Device-specific fixtures — Roland
// ---------------------------------------------------------------------------

/**
 * Write a tone fixture (YAML + WAV) to OPFS.
 * Writes to: library/s330/tones/{name}.yaml + {name}.wav
 */
export async function writeToneFixture(
  page: Page,
  name: string,
  yaml: string,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml, wavBase64 }: { name: string; yaml: string; wavBase64: string }) => {
      // Contract path: library/s330/tones/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s330 = await lib.getDirectoryHandle('s330', { create: true });
      const tones = await s330.getDirectoryHandle('tones', { create: true });

      const yamlHandle = await tones.getFileHandle(`${name}.yaml`, { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await tones.getFileHandle(`${name}.wav`, { create: true });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { name, yaml, wavBase64 },
  );
}

/**
 * Write a patch fixture (YAML) to OPFS.
 * Writes to: library/s330/patches/{name}/{name}.yaml
 */
export async function writePatchFixture(
  page: Page,
  name: string,
  yaml: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml }: { name: string; yaml: string }) => {
      // Contract path: library/s330/patches/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s330 = await lib.getDirectoryHandle('s330', { create: true });
      const patches = await s330.getDirectoryHandle('patches', { create: true });
      const patchDir = await patches.getDirectoryHandle(name, { create: true });

      const yamlHandle = await patchDir.getFileHandle(`${name}.yaml`, { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();
    },
    { name, yaml },
  );
}

// ---------------------------------------------------------------------------
// Device-specific fixtures — S3K
// ---------------------------------------------------------------------------

/**
 * Write an S3K program fixture (YAML) to OPFS.
 * Writes to: library/s3k/programs/{name}/program.s3k.yaml
 */
export async function writeS3kProgramFixture(
  page: Page,
  name: string,
  yaml: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, yaml }: { name: string; yaml: string }) => {
      // Contract path: library/s3k/programs/
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const s3k = await lib.getDirectoryHandle('s3k', { create: true });
      const programs = await s3k.getDirectoryHandle('programs', { create: true });
      const programDir = await programs.getDirectoryHandle(name, { create: true });

      const yamlHandle = await programDir.getFileHandle('program.s3k.yaml', { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();
    },
    { name, yaml },
  );
}
