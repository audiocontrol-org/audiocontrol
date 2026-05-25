import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PluginLibraryBrowser } from './PluginLibraryBrowser';
import type { DeviceLibraryPlugin, CategoryPlugin, ItemTypePlugin } from './plugins';
import type { TreeNode } from './TreeView';

// Create a minimal test plugin
const createTestItemType = (typeId: string): ItemTypePlugin => ({
  typeId,
  displayName: typeId,
  renderIcon: () => <span data-testid={`icon-${typeId}`}>Icon</span>,
  isDraggable: () => true,
  supportsRename: true,
});

const createTestCategory = (
  categoryId: string,
  title: string,
): CategoryPlugin => ({
  categoryId,
  title,
  itemTypes: {
    sample: createTestItemType('sample'),
  },
  emptyMessage: `No ${title.toLowerCase()}`,
});

const createTestPlugin = (
  options: { withDeviceMemory?: boolean } = {},
): DeviceLibraryPlugin => ({
  deviceId: 'test-device',
  deviceName: 'Test Device',
  categories: [
    createTestCategory('samples', 'Samples'),
    createTestCategory('programs', 'Programs'),
  ],
  translators: [],
  deviceMemory: options.withDeviceMemory
    ? {
        slotGroups: [{ groupId: 'slots', label: 'Slots', slotCount: 16 }],
        renderMemoryPanel: () => (
          <div data-testid="device-memory">Device Memory</div>
        ),
      }
    : undefined,
  previewPanel: {
    renderPreview: (selection) => (
      <div data-testid="preview-panel">
        {selection ? `Preview: ${selection.node.name}` : 'No selection'}
      </div>
    ),
  },
});

const sampleNodes: TreeNode[] = [
  {
    id: 'dir-1',
    name: 'Kicks',
    type: 'directory',
    children: [
      { id: 'sample-1', name: 'kick.wav', type: 'sample' },
    ],
  },
  { id: 'sample-2', name: 'snare.wav', type: 'sample' },
];

describe('PluginLibraryBrowser', () => {
  const defaultProps = {
    plugin: createTestPlugin(),
    libraryHandle: {} as FileSystemDirectoryHandle,
    categoryData: { samples: sampleNodes, programs: [] },
    expandedPaths: { samples: new Set<string>(), programs: new Set<string>() },
    selection: null,
    onSelectionChange: vi.fn(),
    onToggleExpand: vi.fn(),
    onRefresh: vi.fn(),
    onCreateFolder: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onRename: vi.fn(),
  };

  it('renders two-column layout without device memory', () => {
    const html = renderToStaticMarkup(
      <PluginLibraryBrowser {...defaultProps} />,
    );
    expect(html).toContain('ac-plugin-library-browser--two-column');
    expect(html).not.toContain('ac-plugin-library-browser-device');
  });

  it('renders three-column layout with device memory', () => {
    const plugin = createTestPlugin({ withDeviceMemory: true });
    render(
      <PluginLibraryBrowser {...defaultProps} plugin={plugin} />,
    );
    expect(screen.getByTestId('device-memory')).toBeInTheDocument();
  });

  it('renders category sections', () => {
    const html = renderToStaticMarkup(
      <PluginLibraryBrowser {...defaultProps} />,
    );
    expect(html).toContain('Samples');
    expect(html).toContain('Programs');
  });

  it('renders nodes in categories', () => {
    render(<PluginLibraryBrowser {...defaultProps} />);
    expect(screen.getByText('Kicks')).toBeInTheDocument();
    expect(screen.getByText('snare.wav')).toBeInTheDocument();
  });

  it('renders empty message for empty categories', () => {
    render(<PluginLibraryBrowser {...defaultProps} />);
    expect(screen.getByText('No programs')).toBeInTheDocument();
  });

  it('renders preview panel', () => {
    render(<PluginLibraryBrowser {...defaultProps} />);
    expect(screen.getByTestId('preview-panel')).toHaveTextContent('No selection');
  });

  it('renders preview with selection', () => {
    const selection = {
      categoryId: 'samples',
      node: sampleNodes[1],
      meta: {},
    };
    render(
      <PluginLibraryBrowser {...defaultProps} selection={selection} />,
    );
    expect(screen.getByTestId('preview-panel')).toHaveTextContent('Preview: snare.wav');
  });

  it('renders connection slot', () => {
    render(
      <PluginLibraryBrowser
        {...defaultProps}
        connectionSlot={<div data-testid="connection">Connected</div>}
      />,
    );
    expect(screen.getByTestId('connection')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(
      <PluginLibraryBrowser {...defaultProps} loading={true} />,
    );
    // The loading UI is a skeleton band (no user-visible "Loading..."
    // text). The presence of the dedicated `.ac-plugin-library-browser-skeleton`
    // wrapper is the load-bearing assertion — every skeleton-section block
    // inside it is one row of the three-up category placeholder.
    expect(
      container.querySelector('.ac-plugin-library-browser-skeleton'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('.ac-plugin-library-browser-skeleton-section').length,
    ).toBeGreaterThan(0);
  });

  it('renders error state', () => {
    render(
      <PluginLibraryBrowser {...defaultProps} error="Failed to load" />,
    );
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('renders empty state when no library handle', () => {
    render(
      <PluginLibraryBrowser {...defaultProps} libraryHandle={null} />,
    );
    // Empty-state copy is "Connect to a library folder to get started"
    // (no trailing period — matches design-system terse-microcopy convention).
    expect(
      screen.getByText('Connect to a library folder to get started'),
    ).toBeInTheDocument();
  });

  it('renders operation progress', () => {
    render(
      <PluginLibraryBrowser
        {...defaultProps}
        operationProgress={{
          currentStep: 1,
          totalSteps: 2,
          stepLabel: 'Uploading kick.wav',
          bytesSent: 0,
          bytesTotal: 1000,
          bytesSentAllSteps: 0,
          bytesTotalAllSteps: 2000,
        }}
      />,
    );
    expect(screen.getByText('Uploading kick.wav')).toBeInTheDocument();
  });
});
