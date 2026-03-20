import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SaveDialog } from './SaveDialog';
import type { DirectoryItem } from './SaveDialog';

const testDirs: DirectoryItem[] = [
  { name: 'Drums', path: [], depth: 0 },
  { name: 'Kicks', path: ['Drums'], depth: 1 },
  { name: 'Bass', path: [], depth: 0 },
];

describe('SaveDialog', () => {
  it('renders nothing when not open', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={false}
        defaultName="test"
        directories={[]}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders title and name input when open', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="My Sample"
        directories={testDirs}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Save');
    expect(html).toContain('My Sample');
    expect(html).toContain('ac-input');
  });

  it('renders directory list', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={testDirs}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Drums');
    expect(html).toContain('Kicks');
    expect(html).toContain('Bass');
    expect(html).toContain('(top level)');
  });

  it('renders new folder input when onCreateFolder provided', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={[]}
        onSave={() => {}}
        onCancel={() => {}}
        onCreateFolder={async () => {}}
      />,
    );
    expect(html).toContain('New Folder');
    expect(html).toContain('New folder name...');
  });

  it('does not render new folder input when onCreateFolder not provided', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={[]}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).not.toContain('New Folder');
  });

  it('renders cancel and save buttons', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={[]}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Cancel');
    expect(html).toContain('>Save<');
  });

  it('renders custom title', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        title="Export Sample"
        defaultName="x"
        directories={[]}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Export Sample');
  });

  it('shows loading state', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={[]}
        loading
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Scanning...');
  });

  it('shows error state', () => {
    const html = renderToStaticMarkup(
      <SaveDialog
        open={true}
        defaultName="x"
        directories={[]}
        error="Access denied"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Access denied');
  });
});
