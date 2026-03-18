/**
 * Contract tests for FileIO implementations.
 *
 * Any FileIO implementation (mock, browser, Electron) should pass these
 * tests to guarantee consistent behavior across environments.
 */

import { describe, it, expect } from 'vitest';
import { createMockFileIO } from '../mock-file-io';
import type { FileIO } from '../types';

/**
 * Shared contract test suite. Call with a factory that creates a fresh
 * FileIO instance for each test.
 */
export function fileIOContractTests(
  name: string,
  factory: () => { impl: FileIO; setup?: () => Promise<void> },
) {
  describe(`FileIO contract: ${name}`, () => {
    it('pickFile returns null when no file is available', async () => {
      const { impl } = factory();
      const result = await impl.pickFile();
      expect(result).toBeNull();
    });

    it('pickDirectory returns null when no directory is available', async () => {
      const { impl } = factory();
      const result = await impl.pickDirectory();
      expect(result).toBeNull();
    });

    it('readFile throws for non-existent file', async () => {
      const { impl } = factory();
      await expect(impl.readFile({ name: 'missing.txt', kind: 'file' })).rejects.toThrow();
    });

    it('listDirectory throws for non-existent directory', async () => {
      const { impl } = factory();
      await expect(impl.listDirectory({ name: 'missing', kind: 'directory' })).rejects.toThrow();
    });
  });
}

// Run contract tests against the mock implementation
fileIOContractTests('MockFileIO', () => {
  const { impl } = createMockFileIO();
  return { impl };
});

describe('MockFileIO-specific behavior', () => {
  it('pickFile returns handle after setPickedFile', async () => {
    const { impl, controls } = createMockFileIO();
    const testData = new ArrayBuffer(8);
    controls.setPickedFile({ name: 'test.wav', data: testData });

    const handle = await impl.pickFile();
    expect(handle).not.toBeNull();
    expect(handle!.name).toBe('test.wav');
    expect(handle!.kind).toBe('file');
  });

  it('pickDirectory returns handle after setPickedDirectory', async () => {
    const { impl, controls } = createMockFileIO();
    controls.setPickedDirectory({ name: 'samples', children: [] });

    const handle = await impl.pickDirectory();
    expect(handle).not.toBeNull();
    expect(handle!.name).toBe('samples');
    expect(handle!.kind).toBe('directory');
  });

  it('readFile returns data for a file added via addFile', async () => {
    const { impl, controls } = createMockFileIO();
    const data = new Uint8Array([1, 2, 3, 4]).buffer;
    controls.addFile('data.bin', data);

    const result = await impl.readFile({ name: 'data.bin', kind: 'file' });
    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('readFile returns a copy, not the original buffer', async () => {
    const { impl, controls } = createMockFileIO();
    const data = new Uint8Array([1, 2, 3]).buffer;
    controls.addFile('data.bin', data);

    const result = await impl.readFile({ name: 'data.bin', kind: 'file' });
    expect(result).not.toBe(data);
  });

  it('writeFile stores data retrievable via getWrittenFiles', async () => {
    const { impl, controls } = createMockFileIO();
    const data = new Uint8Array([10, 20, 30]);
    await impl.writeFile({ name: 'out.bin', kind: 'file' }, data);

    const written = controls.getWrittenFiles();
    expect(written.has('out.bin')).toBe(true);
    expect(new Uint8Array(written.get('out.bin')!)).toEqual(new Uint8Array([10, 20, 30]));
  });

  it('listDirectory returns entries for a directory added via addDirectory', async () => {
    const { impl, controls } = createMockFileIO();
    controls.addDirectory('sounds', [
      { name: 'kick.wav', data: new ArrayBuffer(0) },
      { name: 'snares', children: [] },
    ]);

    const entries = await impl.listDirectory({ name: 'sounds', kind: 'directory' });
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('kick.wav');
    expect(entries[0].kind).toBe('file');
    expect(entries[1].name).toBe('snares');
    expect(entries[1].kind).toBe('directory');
  });
});
