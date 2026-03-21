import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoveDialog } from './MoveDialog';
import type { MoveDialogDirectory } from './MoveDialog';

const testDirs: MoveDialogDirectory[] = [
  { id: 'dir-1', name: 'Drums', path: [], depth: 0 },
  { id: 'dir-2', name: 'Bass', path: [], depth: 0 },
];

describe('MoveDialog', () => {
  it('renders nothing when not open', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={false}
        itemName="test"
        directories={[]}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  it('renders item name in title', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={true}
        itemName="My Tone"
        directories={testDirs}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Move &quot;My Tone&quot;');
  });

  it('renders directory list with root option', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={true}
        itemName="x"
        directories={testDirs}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('(top level)');
    expect(html).toContain('Drums');
    expect(html).toContain('Bass');
  });

  it('renders cancel and move buttons', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={true}
        itemName="x"
        directories={[]}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('Cancel');
    expect(html).toContain('>Move<');
  });

  it('renders dialog role', () => {
    const html = renderToStaticMarkup(
      <MoveDialog
        open={true}
        itemName="x"
        directories={[]}
        onMove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain('role="dialog"');
  });
});
