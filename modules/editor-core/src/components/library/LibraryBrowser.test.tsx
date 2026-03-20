import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LibraryBrowser } from './LibraryBrowser';
import type { TreeNode } from './TreeView';

const sampleNodes: TreeNode[] = [
  {
    id: 'folder-1',
    name: 'Pads',
    type: 'directory',
    children: [
      { id: 'sample-1', name: 'Warm Pad', type: 'sample', meta: { path: ['Pads'] } },
    ],
  },
  { id: 'sample-2', name: 'Kick', type: 'sample', meta: { path: [] } },
];

const noop = () => {};
const asyncNoop = async () => {};

function renderBrowser(overrides: Partial<React.ComponentProps<typeof LibraryBrowser>> = {}) {
  return renderToStaticMarkup(
    <LibraryBrowser
      nodes={sampleNodes}
      onCreateFolder={asyncNoop}
      onDelete={noop}
      onMove={asyncNoop}
      onRefresh={noop}
      {...overrides}
    />,
  );
}

describe('LibraryBrowser', () => {
  it('renders tree nodes inside LibraryPanel', () => {
    const html = renderBrowser();
    expect(html).toContain('Pads');
    expect(html).toContain('Kick');
    expect(html).toContain('ac-library-panel');
    expect(html).toContain('ac-tree-view');
  });

  it('renders title', () => {
    const html = renderBrowser({ title: 'My Library' });
    expect(html).toContain('My Library');
  });

  it('single-column layout when renderDetail is omitted', () => {
    const html = renderBrowser();
    expect(html).toContain('ac-library-browser');
    expect(html).not.toContain('ac-library-browser--split');
    expect(html).not.toContain('ac-library-browser-detail');
  });

  it('renders empty message when nodes is empty', () => {
    const html = renderBrowser({ nodes: [], emptyMessage: 'Nothing here' });
    expect(html).toContain('Nothing here');
  });

  it('disables buttons when loading', () => {
    const html = renderBrowser({ nodes: [], loading: true });
    // Refresh button shows "..." when loading
    expect(html).toContain('disabled=""');
  });

  it('renders error state', () => {
    const html = renderBrowser({ error: 'Connection lost' });
    expect(html).toContain('Connection lost');
    expect(html).toContain('ac-text-error');
  });

  it('renders connection slot', () => {
    const html = renderBrowser({ connectionSlot: <span>Connected to Drive</span> });
    expect(html).toContain('Connected to Drive');
  });

  it('renders refresh button', () => {
    const html = renderBrowser();
    expect(html).toContain('↻');
  });

  it('renders delete buttons via onDelete', () => {
    const html = renderBrowser();
    expect(html).toContain('ac-tree-delete-btn');
  });

  it('makes non-directory nodes draggable', () => {
    const html = renderBrowser();
    expect(html).toContain('draggable');
  });

  it('shows detail panel immediately when renderDetail is provided', () => {
    const html = renderBrowser({
      renderDetail: (node) => <div className="detail">{node ? node.name : 'No selection'}</div>,
    });
    expect(html).toContain('ac-library-browser--split');
    expect(html).toContain('ac-library-browser-detail');
    expect(html).toContain('No selection');
  });

  it('passes renderIcon to TreeView', () => {
    const html = renderBrowser({
      renderIcon: (node) => <span data-icon={node.name} />,
    });
    expect(html).toContain('data-icon="Kick"');
  });

  it('passes renderTrailing to TreeView', () => {
    const html = renderBrowser({
      renderTrailing: (node) =>
        node.type !== 'directory' ? <span className="trailing">{node.name}</span> : null,
    });
    expect(html).toContain('class="trailing"');
    expect(html).toContain('Kick');
  });
});
