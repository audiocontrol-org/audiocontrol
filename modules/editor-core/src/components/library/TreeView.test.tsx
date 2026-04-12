import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders add-folder button on directory nodes when edit.onCreateFolder is provided', () => {
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} edit={{ onDelete: () => {}, onCreateFolder: () => {} }} />,
    );
    expect(html).toContain('ac-tree-add-btn');
    expect(html).toContain('New folder in Samples');
  });

  it('does not render add-folder button when edit is omitted', () => {
    const html = renderToStaticMarkup(<TreeView nodes={sampleTree} />);
    expect(html).not.toContain('ac-tree-add-btn');
  });

  it('does not render add-folder button on non-directory nodes', () => {
    const html = renderToStaticMarkup(
      <TreeView nodes={sampleTree} edit={{ onDelete: () => {}, onCreateFolder: () => {} }} />,
    );
    // hihat.wav is a file, should not have add button
    expect(html).not.toContain('New folder in hihat.wav');
  });

  describe('inline rename', () => {
    it('does not render rename input when enableInlineRename is false', () => {
      const html = renderToStaticMarkup(
        <TreeView nodes={sampleTree} edit={{ onDelete: () => {}, onRename: async () => {} }} />,
      );
      expect(html).not.toContain('ac-tree-rename-input');
    });

    it('does not render rename input when onRename is not provided', () => {
      const html = renderToStaticMarkup(
        <TreeView nodes={sampleTree} edit={{ onDelete: () => {}, enableInlineRename: true }} />,
      );
      expect(html).not.toContain('ac-tree-rename-input');
    });

    it('enters edit mode on double-click when enabled', async () => {
      const onRename = vi.fn();
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('hihat.wav');
    });

    it('cancels edit mode on Escape', async () => {
      const onRename = vi.fn();
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(onRename).not.toHaveBeenCalled();
    });

    it('submits rename on Enter', async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'newname.wav{Enter}');

      await waitFor(() => {
        expect(onRename).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'hihat.wav' }),
          'newname.wav',
        );
      });
    });

    it('does not submit if name unchanged', async () => {
      const onRename = vi.fn();
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      await userEvent.keyboard('{Enter}');

      expect(onRename).not.toHaveBeenCalled();
    });

    it('does not submit if name is only whitespace', async () => {
      const onRename = vi.fn();
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '   {Enter}');

      expect(onRename).not.toHaveBeenCalled();
    });

    it('keeps edit mode open on rename error', async () => {
      const onRename = vi.fn().mockRejectedValue(new Error('Rename failed'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'newname.wav{Enter}');

      await waitFor(() => {
        expect(onRename).toHaveBeenCalled();
      });

      // Input should still be visible after error
      expect(screen.getByRole('textbox')).toBeInTheDocument();

      consoleError.mockRestore();
    });

    it('adds editing class when in edit mode', async () => {
      const onRename = vi.fn();
      render(
        <TreeView
          nodes={sampleTree}
          edit={{ onDelete: () => {}, onRename, enableInlineRename: true }}
        />,
      );

      const hihatNode = screen.getByText('hihat.wav');
      await userEvent.dblClick(hihatNode);

      const treeNode = screen.getByRole('textbox').closest('.ac-tree-node');
      expect(treeNode).toHaveClass('ac-tree-node--editing');
    });
  });
});
