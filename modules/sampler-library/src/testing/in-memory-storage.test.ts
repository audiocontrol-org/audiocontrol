import { describe, it, expect } from 'vitest';
import { InMemoryDirectoryHandle, InMemoryFileHandle } from './in-memory-storage';

describe('InMemoryDirectoryHandle', () => {
  it('creates and retrieves subdirectories', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const sub = await root.getDirectoryHandle('sub', { create: true });
    expect(sub.name).toBe('sub');

    const same = await root.getDirectoryHandle('sub');
    expect(same).toBe(sub);
  });

  it('throws NotFoundError for missing directory without create', async () => {
    const root = new InMemoryDirectoryHandle('root');
    await expect(root.getDirectoryHandle('missing')).rejects.toThrow('not found');
  });

  it('creates and retrieves files', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const fh = await root.getFileHandle('test.txt', { create: true });
    expect(fh.name).toBe('test.txt');

    const same = await root.getFileHandle('test.txt');
    expect(same).toBe(fh);
  });

  it('throws NotFoundError for missing file without create', async () => {
    const root = new InMemoryDirectoryHandle('root');
    await expect(root.getFileHandle('missing.txt')).rejects.toThrow('not found');
  });

  it('iterates entries via values()', async () => {
    const root = new InMemoryDirectoryHandle('root');
    await root.getDirectoryHandle('dir1', { create: true });
    await root.getFileHandle('file1.txt', { create: true });

    const entries: Array<{ kind: string; name: string }> = [];
    for await (const entry of root.values()) {
      entries.push(entry);
    }

    expect(entries).toHaveLength(2);
    expect(entries.find(e => e.name === 'dir1')?.kind).toBe('directory');
    expect(entries.find(e => e.name === 'file1.txt')?.kind).toBe('file');
  });

  it('removes entries', async () => {
    const root = new InMemoryDirectoryHandle('root');
    await root.getFileHandle('doomed.txt', { create: true });
    await root.removeEntry('doomed.txt');

    await expect(root.getFileHandle('doomed.txt')).rejects.toThrow();
  });

  it('throws on removeEntry for missing entry', async () => {
    const root = new InMemoryDirectoryHandle('root');
    await expect(root.removeEntry('ghost')).rejects.toThrow();
  });

  it('supports addDirectory and addFile helpers', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const sub = new InMemoryDirectoryHandle('sub');
    const file = new InMemoryFileHandle('data.bin', new Uint8Array([1, 2, 3]));

    root.addDirectory(sub);
    root.addFile(file);

    const gotDir = await root.getDirectoryHandle('sub');
    expect(gotDir).toBe(sub);

    const gotFile = await root.getFileHandle('data.bin');
    expect(gotFile).toBe(file);
  });

  it('supports nested directory traversal', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const a = await root.getDirectoryHandle('a', { create: true });
    const b = await a.getDirectoryHandle('b', { create: true });
    await b.getFileHandle('deep.txt', { create: true });

    // Traverse from root
    const found = await (await (await root.getDirectoryHandle('a')).getDirectoryHandle('b')).getFileHandle('deep.txt');
    expect(found.name).toBe('deep.txt');
  });
});

describe('InMemoryFileHandle', () => {
  it('reads text content', async () => {
    const fh = new InMemoryFileHandle('test.txt', new TextEncoder().encode('hello'));
    const file = await fh.getFile();
    expect(await file.text()).toBe('hello');
  });

  it('reads binary content', async () => {
    const data = new Uint8Array([0x00, 0xff, 0x42]);
    const fh = new InMemoryFileHandle('test.bin', data);
    const file = await fh.getFile();
    const buf = new Uint8Array(await file.arrayBuffer());
    expect(buf).toEqual(data);
  });

  it('reports file size', async () => {
    const fh = new InMemoryFileHandle('test.bin', new Uint8Array(100));
    const file = await fh.getFile();
    expect(file.size).toBe(100);
  });

  it('writes via createWritable', async () => {
    const fh = new InMemoryFileHandle('test.txt');
    const writable = await fh.createWritable();
    await writable.write('hello ');
    await writable.write('world');
    await writable.close();

    const file = await fh.getFile();
    expect(await file.text()).toBe('hello world');
  });

  it('writes binary via createWritable', async () => {
    const fh = new InMemoryFileHandle('test.bin');
    const writable = await fh.createWritable();
    await writable.write(new Uint8Array([1, 2]).buffer);
    await writable.write(new Uint8Array([3, 4]).buffer);
    await writable.close();

    const file = await fh.getFile();
    const buf = new Uint8Array(await file.arrayBuffer());
    expect(buf).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('streams file content', async () => {
    const data = new Uint8Array([10, 20, 30]);
    const fh = new InMemoryFileHandle('test.bin', data);
    const file = await fh.getFile();
    const reader = file.stream().getReader();
    const { value } = await reader.read();
    expect(value).toEqual(data);
  });
});
