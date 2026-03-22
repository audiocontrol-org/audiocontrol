import { describe, it, expect } from 'vitest';
import { InMemoryDirectoryHandle } from './in-memory-storage';
import { seedMockLibrary } from './seed-mock-library';
import { loadSample } from '../common-area/samples';
import { listCommonSamplesTree } from '../library-fs';

describe('seedMockLibrary', () => {
  it('creates the expected directory structure', async () => {
    const root = new InMemoryDirectoryHandle('root');
    seedMockLibrary(root);

    // Navigate to library/common/samples/
    const library = await root.getDirectoryHandle('library');
    const common = await library.getDirectoryHandle('common');
    const samples = await common.getDirectoryHandle('samples');

    // Should have all test signals
    const entries: string[] = [];
    for await (const entry of samples.values()) {
      entries.push(entry.name);
    }

    expect(entries).toContain('sustain');
    expect(entries).toContain('discontinuity');
    expect(entries).toContain('decay-into-sustain');
    expect(entries.length).toBe(12);
  });

  it('creates valid sample.yaml files', async () => {
    const root = new InMemoryDirectoryHandle('root');
    seedMockLibrary(root);

    const dir = await (await (await (await root.getDirectoryHandle('library'))
      .getDirectoryHandle('common'))
      .getDirectoryHandle('samples'))
      .getDirectoryHandle('sustain');

    const yamlHandle = await dir.getFileHandle('sample.yaml');
    const yamlFile = await yamlHandle.getFile();
    const yamlText = await yamlFile.text();

    expect(yamlText).toContain('format: sample');
    expect(yamlText).toContain('name: sustain');
    expect(yamlText).toContain('file: sample.wav');
    expect(yamlText).toContain('sampleRate: 30000');
    expect(yamlText).toContain('loopMode: forward');
  });

  it('creates valid WAV files', async () => {
    const root = new InMemoryDirectoryHandle('root');
    seedMockLibrary(root);

    const dir = await (await (await (await root.getDirectoryHandle('library'))
      .getDirectoryHandle('common'))
      .getDirectoryHandle('samples'))
      .getDirectoryHandle('sustain');

    const wavHandle = await dir.getFileHandle('sample.wav');
    const wavFile = await wavHandle.getFile();
    const buf = new Uint8Array(await wavFile.arrayBuffer());

    // WAV header check
    expect(buf[0]).toBe(0x52); // 'R'
    expect(buf[1]).toBe(0x49); // 'I'
    expect(buf[2]).toBe(0x46); // 'F'
    expect(buf[3]).toBe(0x46); // 'F'

    // Should be non-trivial size (2 seconds of 30kHz mono 16-bit)
    expect(buf.byteLength).toBeGreaterThanOrEqual(44 + 60000 * 2);
  });

  it('works with listCommonSamplesTree', async () => {
    const root = new InMemoryDirectoryHandle('root');
    seedMockLibrary(root);

    const tree = await listCommonSamplesTree(root);
    const names = tree.map(n => n.name);

    expect(names).toContain('sustain');
    expect(names).toContain('discontinuity');
    expect(tree.length).toBe(12);

    // All should be type 'sample'
    for (const node of tree) {
      expect(node.type).toBe('sample');
    }
  });

  it('works with loadSample', async () => {
    const root = new InMemoryDirectoryHandle('root');
    seedMockLibrary(root);

    const result = await loadSample(root, 'sustain');

    expect(result.yaml.name).toBe('sustain');
    expect(result.yaml.sampleRate).toBe(30000);
    expect(result.yaml.loopMode).toBe('forward');
    expect(result.wavData.byteLength).toBeGreaterThan(44);
  });
});
