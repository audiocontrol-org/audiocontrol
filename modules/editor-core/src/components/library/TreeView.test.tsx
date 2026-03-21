import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TreeView } from './TreeView';
import type { TreeNode } from './TreeView';

const sampleTree: TreeNode[] = [
  {
    id: 'dir-1',
    name: 'Samples',
    type: 'directory',
    children: [
      { id: 'file-1', name: 'kick.wav', type: 'audio' },
      { id: 'file-2', name: 'snare.wav', type: 'audio' },
    ],
  },
  { id: 'file-3', name: 'hihat.wav', type: 'audio' },
];

describe('TreeView', () => {
  it('renders top-level nodes', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).toContain('Samples');
    expect(html).toContain('hihat.wav');
  });

  it('renders tree role on root', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).toContain('role="tree"');
  });

  it('renders treeitem role on nodes', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).toContain('role="treeitem"');
  });

  it('shows children when directory is expanded', () => {
    const expanded = new Set(['dir-1']);
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} expandedIds={expanded} />,
    );
    expect(html).toContain('kick.wav');
    expect(html).toContain('snare.wav');
  });

  it('hides children when directory is collapsed', () => {
    const expanded = new Set<string>();
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} expandedIds={expanded} />,
    );
    expect(html).toContain('Samples');
    expect(html).not.toContain('kick.wav');
  });

  it('shows empty directory message when expanded directory has no children', () => {
    const nodes: TreeNode[] = [
      { id: 'empty-dir', name: 'Empty', type: 'directory', children: [] },
    ];
    const expanded = new Set(['empty-dir']);
    const html = renderToStaticMarkup(
      <TreeView nodes={nodes} expandedIds={expanded} />,
    );
    expect(html).toContain('Empty folder');
  });

  it('uses custom empty directory message', () => {
    const nodes: TreeNode[] = [
      { id: 'empty-dir', name: 'Empty', type: 'directory', children: [] },
    ];
    const expanded = new Set(['empty-dir']);
    const html = renderToStaticMarkup(
      <TreeView
        nodes={nodes}
        expandedIds={expanded}
        emptyDirectoryMessage="Nothing here"
      />,
    );
    expect(html).toContain('Nothing here');
  });

  it('renders "No items" when nodes array is empty', () => {
    const html = renderToStaticMarkup(<TreeView nodes={[]} />);
    expect(html).toContain('No items');
  });

  it('marks selected node with selected class', () => {
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} selectedId="file-3" />,
    );
    expect(html).toContain('ac-tree-node--selected');
  });

  it('sets aria-expanded on directory nodes', () => {
    const expanded = new Set(['dir-1']);
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} expandedIds={expanded} />,
    );
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders chevron for directory nodes', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).toContain('ac-tree-chevron');
  });

  it('renders nested children at depth > 1', () => {
    const deepTree: TreeNode[] = [
      {
        id: 'root',
        name: 'Root',
        type: 'directory',
        children: [
          {
            id: 'sub',
            name: 'Sub',
            type: 'directory',
            children: [
              { id: 'deep', name: 'Deep File', type: 'file' },
            ],
          },
        ],
      },
    ];
    const expanded = new Set(['root', 'sub']);
    const html = renderToStaticMarkup(
      <TreeView nodes={deepTree} expandedIds={expanded} />,
    );
    expect(html).toContain('Deep File');
  });

  it('renders add-folder button on directory nodes when onCreateFolder is provided', () => {
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} onCreateFolder={() => {}} />,
    );
    expect(html).toContain('ac-tree-add-btn');
    expect(html).toContain('New folder in Samples');
  });

  it('does not render add-folder button when onCreateFolder is omitted', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).not.toContain('ac-tree-add-btn');
  });

  it('does not render add-folder button on non-directory nodes', () => {
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} onCreateFolder={() => {}} />,
    );
    // hihat.wav is a file, should not have add button
    expect(html).not.toContain('New folder in hihat.wav');
  });
});
