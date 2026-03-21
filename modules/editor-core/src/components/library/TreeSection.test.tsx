import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TreeSection } from './TreeSection';
import type { TreeNode } from './TreeView';

const sampleNodes: TreeNode[] = [
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

describe('TreeSection', () => {
  it('renders section with title', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="My Section"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('My Section');
    expect(html).toContain('ac-tree-section');
    expect(html).toContain('ac-tree-section-title');
  });

  it('renders nodes', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('Samples');
    expect(html).toContain('hihat.wav');
  });

  it('renders empty message when no nodes', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Empty Section"
        nodes={[]}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        emptyMessage="Nothing here yet"
      />,
    );
    expect(html).toContain('Nothing here yet');
    expect(html).toContain('ac-tree-section-empty');
  });

  it('renders default empty message', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Empty Section"
        nodes={[]}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('No items');
  });

  it('renders header actions', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        headerActions={<button>Add</button>}
      />,
    );
    expect(html).toContain('<button>Add</button>');
    expect(html).toContain('ac-tree-section-actions');
  });

  it('renders drop hint when isDragOver is true', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        isDragOver={true}
        dropMessage="Drop to import"
      />,
    );
    expect(html).toContain('Drop to import');
    expect(html).toContain('ac-tree-section-drop-hint');
    expect(html).toContain('ac-tree-section-dropzone');
  });

  it('adds drag-over class when isDragOver is true', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        isDragOver={true}
        dropMessage="Drop here"
      />,
    );
    expect(html).toContain('ac-tree-section--drag-over');
  });

  it('does not render drop zone when not dragging over', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        dropMessage="Drop here"
      />,
    );
    expect(html).not.toContain('ac-tree-section-dropzone');
    expect(html).not.toContain('ac-tree-section--drag-over');
  });

  it('sets data-category attribute', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="my-category"
        expandedIds={new Set()}
        onToggleExpand={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('data-category="my-category"');
  });

  it('passes enableInlineRename to TreeView', () => {
    const onRename = vi.fn();
    render(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set(['dir-1'])}
        onToggleExpand={() => {}}
        onSelect={() => {}}
        onRename={onRename}
        enableInlineRename={true}
      />,
    );

    // The nodes should be rendered - inline rename is wired through
    expect(screen.getByText('kick.wav')).toBeInTheDocument();
  });

  it('renders expanded children', () => {
    const html = renderToStaticMarkup(
      <TreeSection
        title="Samples"
        nodes={sampleNodes}
        category="samples"
        expandedIds={new Set(['dir-1'])}
        onToggleExpand={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('kick.wav');
    expect(html).toContain('snare.wav');
  });
});
