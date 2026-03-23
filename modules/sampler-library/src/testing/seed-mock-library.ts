/**
 * Seeds an in-memory StorageDirectoryHandle with test signal samples.
 *
 * Creates the common-area sample directory structure that
 * listCommonSamplesTree() and loadSample() expect:
 *
 *   library/common/samples/{name}/
 *     sample.yaml
 *     {name}.wav
 */

import { InMemoryDirectoryHandle, InMemoryFileHandle } from './in-memory-storage.js';
import {
  generatePureSustain,
  generateLeadingSilence,
  generateTrailingSilence,
  generateConstantDecay,
  generateDecayIntoSustain,
  generateSustainWithTrailingDecay,
  generateDiscontinuity,
} from '../loop-detector/testing/test-signals.js';

const DEFAULT_SAMPLE_RATE = 30000;

/** Minimal WAV file creator — 16-bit mono PCM. */
function createWavBytes(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2;
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false);  // "RIFF"
  view.setUint32(4, fileSize - 8, true);
  view.setUint32(8, 0x57415645, false);  // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i]!, true);
  }

  return new Uint8Array(buffer);
}

interface SignalDef {
  name: string;
  generate: (sr: number) => Int16Array;
  loopStart: number;
  loopEnd: number;
}

const SIGNALS: SignalDef[] = [
  { name: 'sustain', generate: generatePureSustain, loopStart: 9000, loopEnd: 45000 },
  { name: 'leading-silence', generate: generateLeadingSilence, loopStart: 12000, loopEnd: 45000 },
  { name: 'trailing-silence', generate: generateTrailingSilence, loopStart: 9000, loopEnd: 40000 },
  { name: 'constant-decay', generate: generateConstantDecay, loopStart: 3000, loopEnd: 45000 },
  { name: 'decay-into-sustain', generate: generateDecayIntoSustain, loopStart: 9000, loopEnd: 45000 },
  { name: 'sustain-trailing-decay', generate: generateSustainWithTrailingDecay, loopStart: 9000, loopEnd: 40000 },
  { name: 'discontinuity', generate: generateDiscontinuity, loopStart: 9000, loopEnd: 45000 },
];

/**
 * Seed the in-memory storage root with test signal samples.
 *
 * After calling this, `listCommonSamplesTree(root)` returns all signals
 * and `loadSample(root, name)` loads the generated WAV + YAML.
 */
export function seedMockLibrary(root: InMemoryDirectoryHandle): void {
  // Build: root/library/common/samples/{name}/
  const library = new InMemoryDirectoryHandle('library');
  const common = new InMemoryDirectoryHandle('common');
  const samples = new InMemoryDirectoryHandle('samples');

  for (const signal of SIGNALS) {
    const dir = new InMemoryDirectoryHandle(signal.name);
    const audioSamples = signal.generate(DEFAULT_SAMPLE_RATE);
    const wavBytes = createWavBytes(audioSamples, DEFAULT_SAMPLE_RATE);

    const yaml = [
      'format: sample',
      'version: 1',
      `name: ${signal.name}`,
      `file: sample.wav`,
      `sampleRate: ${DEFAULT_SAMPLE_RATE}`,
      'loopMode: forward',
      `loopStart: ${signal.loopStart}`,
      `loopEnd: ${signal.loopEnd}`,
    ].join('\n');

    dir.addFile(new InMemoryFileHandle('sample.yaml', new TextEncoder().encode(yaml)));
    dir.addFile(new InMemoryFileHandle('sample.wav', wavBytes));
    samples.addDirectory(dir);
  }

  common.addDirectory(samples);
  library.addDirectory(common);

  // Create empty device-specific directories so library scanners
  // (listSets, listIndividualTones, etc.) don't throw NotFoundError.
  // These list functions call getDirectoryHandle which throws if missing.
  const s330 = new InMemoryDirectoryHandle('s330');
  s330.addDirectory(new InMemoryDirectoryHandle('sets'));
  s330.addDirectory(new InMemoryDirectoryHandle('tones'));
  s330.addDirectory(new InMemoryDirectoryHandle('patches'));
  s330.addDirectory(new InMemoryDirectoryHandle('drum-kits'));
  library.addDirectory(s330);

  const s550 = new InMemoryDirectoryHandle('s550');
  s550.addDirectory(new InMemoryDirectoryHandle('sets'));
  s550.addDirectory(new InMemoryDirectoryHandle('tones'));
  s550.addDirectory(new InMemoryDirectoryHandle('patches'));
  s550.addDirectory(new InMemoryDirectoryHandle('drum-kits'));
  library.addDirectory(s550);

  root.addDirectory(library);
}
