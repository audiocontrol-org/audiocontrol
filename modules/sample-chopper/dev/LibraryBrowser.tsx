/**
 * Library browser panel for the standalone sample chopper.
 *
 * Tabbed interface showing chopped samples, tones, and drum kits
 * from the connected FSAA library directory. Uses shared LibraryPanel
 * and TreeView components from editor-core for structural rendering.
 */

import { useCallback, useEffect, useState } from 'react';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';
import { isValidMoveTarget } from '@audiocontrol/sampler-library/browser';
import {
  LibraryPanel,
  TreeView,
  type TreeNode,
  type LibraryTab,
} from '@audiocontrol/editor-core';
import '@audiocontrol/editor-core/library.css';
import {
  listChoppedSamples,
  deleteChoppedSample,
  createSamplesFolder,
  moveLibraryItem,
  listLibraryTones,
  listLibraryDrumKits,
  type LibraryToneInfo,
  type LibraryDrumKitInfo,
} from './library.js';

// -- Public drag-drop contract (used by parent components) ----------------

export const CHOPPER_DRAG_MIME = 'application/x-chopper-library-move';

export interface ChopperDragData {
  type: 'chopped-sample' | 'directory';
  name: string;
  path: string[];
  directoryName?: string;
}

// -- Props ----------------------------------------------------------------

type Tab = 'samples' | 'tones' | 'drum-kits';

export interface LibraryBrowserProps {
  connected: boolean;
  refreshKey: number;
  onOpen: (name: string, path: string[]) => void;
  onOpenTone: (tone: LibraryToneInfo) => void;
  onOpenDrumKit: (kit: LibraryDrumKitInfo) => void;
  onPathChange?: (path: string[]) => void;
}

// -- Constants ------------------------------------------------------------

const TABS: LibraryTab[] = [
  { id: 'samples', label: 'Samples' },
  { id: 'tones', label: 'Tones' },
  { id: 'drum-kits', label: 'Drum Kits' },
];

// -- Helpers --------------------------------------------------------------

function DeviceBadge({ device }: { device: string }): JSX.Element {
  const label = device === 's330' ? 'S-330' : device === 's550' ? 'S-550' : device.toUpperCase();
  return <span className="library-device-badge">{label}</span>;
}

function sourceLabel(source: LibraryToneInfo['source']): string | null {
  if (source.kind === 'set') return source.setName;
  return null;
}

function toneKey(tone: LibraryToneInfo): string {
  const src = tone.source.kind === 'set' ? `set:${tone.source.setName}` : 'standalone';
  return `${tone.device}/${src}/${tone.path.join('/')}/${tone.name}`;
}

function kitKey(kit: LibraryDrumKitInfo): string {
  return `${kit.device}/${kit.path.join('/')}`;
}

/** Map LibraryTreeNode[] to TreeNode[] with metadata preserved in `meta`. */
function toTreeNodes(nodes: LibraryTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children ? toTreeNodes(node.children) : undefined,
    meta: {
      variant: node.variant,
      sliceCount: node.sliceCount,
      description: node.description,
      directoryName: node.directoryName,
      path: node.path,
    },
  }));
}

// -- Main component -------------------------------------------------------

export function LibraryBrowser({
  connected,
  refreshKey,
  onOpen,
  onOpenTone,
  onOpenDrumKit,
  onPathChange,
}: LibraryBrowserProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<Tab>('samples');
  const [samplesTree, setSamplesTree] = useState<LibraryTreeNode[]>([]);
  const [tones, setTones] = useState<LibraryToneInfo[]>([]);
  const [drumKits, setDrumKits] = useState<LibraryDrumKitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<string[]>([]);

  // --- Data fetching ---

  const refreshSamples = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    listChoppedSamples()
      .then(setSamplesTree)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list samples'))
      .finally(() => setLoading(false));
  }, [connected]);

  const refreshTones = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    listLibraryTones()
      .then(setTones)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list tones'))
      .finally(() => setLoading(false));
  }, [connected]);

  const refreshDrumKits = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    listLibraryDrumKits()
      .then(setDrumKits)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list drum kits'))
      .finally(() => setLoading(false));
  }, [connected]);

  const refresh = useCallback(() => {
    if (activeTab === 'samples') refreshSamples();
    else if (activeTab === 'tones') refreshTones();
    else refreshDrumKits();
  }, [activeTab, refreshSamples, refreshTones, refreshDrumKits]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  // --- Actions ---

  const handleDelete = useCallback(async (name: string, path: string[]) => {
    try {
      await deleteChoppedSample(name, path);
      setConfirmDelete(null);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [refreshSamples]);

  const handleMove = useCallback(async (name: string, fromPath: string[], toPath: string[]) => {
    try {
      await moveLibraryItem(name, fromPath, toPath);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move item');
    }
  }, [refreshSamples]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId as Tab);
    setError(null);
    setConfirmDelete(null);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createSamplesFolder(currentPath, name);
    refreshSamples();
  }, [currentPath, refreshSamples]);

  // --- TreeView callbacks ---

  const handleDragStart = useCallback((node: TreeNode, e: React.DragEvent) => {
    const meta = node.meta as { directoryName?: string; path: string[] } | undefined;
    const dragData: ChopperDragData = {
      type: node.type === 'directory' ? 'directory' : 'chopped-sample',
      name: meta?.directoryName ?? node.name,
      path: meta?.path ?? [],
      directoryName: meta?.directoryName,
    };
    e.dataTransfer.setData(CHOPPER_DRAG_MIME, JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((_targetNode: TreeNode, e: React.DragEvent): boolean => {
    return e.dataTransfer.types.includes(CHOPPER_DRAG_MIME);
  }, []);

  const handleDrop = useCallback((targetNode: TreeNode, e: React.DragEvent) => {
    const jsonData = e.dataTransfer.getData(CHOPPER_DRAG_MIME);
    if (!jsonData) return;
    try {
      const dragData = JSON.parse(jsonData) as ChopperDragData;
      const targetMeta = targetNode.meta as { path: string[] } | undefined;
      const targetPath = [...(targetMeta?.path ?? []), targetNode.name];
      if (!isValidMoveTarget(dragData.path, dragData.name, targetPath)) return;
      handleMove(dragData.name, dragData.path, targetPath);
    } catch (err) {
      console.error('[LibraryBrowser] Failed to parse drop data:', err);
    }
  }, [handleMove]);

  const renderTrailing = useCallback((node: TreeNode) => {
    if (node.type === 'directory') return null;

    const meta = node.meta as {
      variant?: string;
      sliceCount?: number;
      description?: string;
      directoryName?: string;
      path?: string[];
    } | undefined;

    const dirName = meta?.directoryName ?? node.name;
    const nodePath = meta?.path ?? [];
    const nodeId = node.id;

    return (
      <>
        <span className="library-browser-item-meta">
          {meta?.variant} &middot; {meta?.sliceCount} slice{meta?.sliceCount !== 1 ? 's' : ''}
          {meta?.description ? ` \u00b7 ${meta.description}` : ''}
        </span>
        <span className="library-browser-item-actions">
          <button
            className="library-browser-action open"
            onClick={(e) => { e.stopPropagation(); onOpen(dirName, nodePath); }}
            title="Open in chopper"
          >
            Open
          </button>
          {confirmDelete === nodeId ? (
            <>
              <button
                className="library-browser-action danger"
                onClick={(e) => { e.stopPropagation(); handleDelete(dirName, nodePath); }}
              >
                Confirm
              </button>
              <button
                className="library-browser-action"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="library-browser-action"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(nodeId); }}
              title="Delete"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </span>
      </>
    );
  }, [confirmDelete, onOpen, handleDelete]);

  // --- Root drag-drop (move items to root level) ---

  const [isRootDragOver, setIsRootDragOver] = useState(false);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(CHOPPER_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRootDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(CHOPPER_DRAG_MIME)) return;
    e.preventDefault();
    setIsRootDragOver(true);
  }, []);

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsRootDragOver(false);
    }
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(false);
    const jsonData = e.dataTransfer.getData(CHOPPER_DRAG_MIME);
    if (!jsonData) return;
    try {
      const dragData = JSON.parse(jsonData) as ChopperDragData;
      if (dragData.path.length === 0) return;
      handleMove(dragData.name, dragData.path, []);
    } catch (err) {
      console.error('[LibraryBrowser] Failed to parse root drop data:', err);
    }
  }, [handleMove]);

  if (!connected) return null;

  // --- Derived render state ---

  const emptyMessage =
    activeTab === 'samples'
      ? 'No chopped samples saved yet. Chop a sample and click Save.'
      : activeTab === 'tones'
        ? 'No tones found in the connected library.'
        : 'No drum kits found in the connected library.';

  const isEmpty =
    activeTab === 'samples'
      ? samplesTree.length === 0
      : activeTab === 'tones'
        ? tones.length === 0
        : drumKits.length === 0;

  const treeNodes = toTreeNodes(samplesTree);

  return (
    <LibraryPanel
      title="Library"
      tabs={TABS}
      activeTabId={activeTab}
      onTabChange={handleTabChange}
      loading={loading}
      error={error ?? undefined}
      emptyMessage={emptyMessage}
      isEmpty={!loading && !error && isEmpty}
      onRefresh={refresh}
      onCreateFolder={activeTab === 'samples' ? handleCreateFolder : undefined}
    >
      {/* Samples tab -- TreeView with root drag-drop wrapper */}
      {activeTab === 'samples' && !isEmpty && (
        <div
          className={isRootDragOver ? 'drag-over-root' : ''}
          onDragOver={handleRootDragOver}
          onDragEnter={handleRootDragEnter}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          <TreeView
            nodes={treeNodes}
            expandedIds={expandedPaths}
            onToggleExpand={handleToggle}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            renderTrailing={renderTrailing}
          />
        </div>
      )}

      {/* Tones tab -- flat list */}
      {activeTab === 'tones' && !isEmpty && (
        <ul className="library-browser-list">
          {tones.map((tone) => {
            const setName = sourceLabel(tone.source);
            const location = [setName, ...tone.path].filter(Boolean).join('/');
            return (
              <li key={toneKey(tone)} className="library-browser-item">
                <div className="library-browser-item-info">
                  <span className="library-browser-item-name">
                    <DeviceBadge device={tone.device} />
                    {tone.name}
                  </span>
                  <span className="library-browser-item-meta">
                    {tone.sampleRate ? `${tone.sampleRate} Hz` : 'tone'}
                    {location ? ` \u00b7 ${location}` : ''}
                  </span>
                </div>
                <div className="library-browser-item-actions">
                  <button
                    className="library-browser-action open"
                    onClick={() => onOpenTone(tone)}
                    title="Open in chopper"
                  >
                    Open
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Drum Kits tab -- flat list */}
      {activeTab === 'drum-kits' && !isEmpty && (
        <ul className="library-browser-list">
          {drumKits.map((kit) => (
            <li key={kitKey(kit)} className="library-browser-item">
              <div className="library-browser-item-info">
                <span className="library-browser-item-name">
                  <DeviceBadge device={kit.device} />
                  {kit.name}
                </span>
                <span className="library-browser-item-meta">
                  v{kit.version}
                  {kit.version === 2 ? ` \u00b7 ${kit.sliceCount} slice${kit.sliceCount !== 1 ? 's' : ''}` : ` \u00b7 ${kit.sampleCount} sample${kit.sampleCount !== 1 ? 's' : ''}`}
                  {kit.description ? ` \u00b7 ${kit.description}` : ''}
                </span>
              </div>
              <div className="library-browser-item-actions">
                {kit.version === 2 ? (
                  <button
                    className="library-browser-action open"
                    onClick={() => onOpenDrumKit(kit)}
                    title="Open in chopper"
                  >
                    Open
                  </button>
                ) : (
                  <span className="library-browser-item-note">individual files</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </LibraryPanel>
  );
}
