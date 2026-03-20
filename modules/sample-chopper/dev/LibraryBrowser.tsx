/**
 * Library browser panel for the standalone sample chopper.
 *
 * Tabbed interface showing chopped samples, tones, and drum kits
 * from the connected FSAA library directory. The samples tab uses
 * the composed LibraryBrowser from editor-core (with built-in
 * drag-drop, delete, and folder creation). Tones and drum kits
 * tabs use LibraryPanel directly for flat-list rendering.
 */

import { useCallback, useEffect, useState } from 'react';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';
import {
  LibraryBrowser as LibraryBrowserComposed,
  LibraryPanel,
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
}: LibraryBrowserProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<Tab>('samples');
  const [samplesTree, setSamplesTree] = useState<LibraryTreeNode[]>([]);
  const [tones, setTones] = useState<LibraryToneInfo[]>([]);
  const [drumKits, setDrumKits] = useState<LibraryDrumKitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleDeleteNode = useCallback(async (node: TreeNode) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    const name = meta?.directoryName ?? node.name;
    const path = meta?.path ?? [];
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteChoppedSample(name, path);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [refreshSamples]);

  const handleMoveNode = useCallback(async (node: TreeNode, targetPath: string[]) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    const name = meta?.directoryName ?? node.name;
    const fromPath = meta?.path ?? [];
    try {
      await moveLibraryItem(name, fromPath, targetPath);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move item');
    }
  }, [refreshSamples]);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId as Tab);
    setError(null);
  }, []);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createSamplesFolder(currentPath, name);
    refreshSamples();
  }, [currentPath, refreshSamples]);

  const handleSelectSample = useCallback((node: TreeNode) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    onOpen(meta?.directoryName ?? node.name, meta?.path ?? []);
  }, [onOpen]);

  const renderTrailing = useCallback((node: TreeNode) => {
    if (node.type === 'directory') return null;
    const meta = node.meta as {
      variant?: string;
      sliceCount?: number;
      description?: string;
    } | undefined;

    return (
      <span className="library-browser-item-meta">
        {meta?.variant} &middot; {meta?.sliceCount} slice{meta?.sliceCount !== 1 ? 's' : ''}
        {meta?.description ? ` \u00b7 ${meta.description}` : ''}
      </span>
    );
  }, []);

  if (!connected) return null;

  // --- Samples tab via LibraryBrowserComposed ---
  if (activeTab === 'samples') {
    return (
      <div>
        <LibraryPanel
          tabs={TABS}
          activeTabId={activeTab}
          onTabChange={handleTabChange}
        />
        <LibraryBrowserComposed
          nodes={toTreeNodes(samplesTree)}
          title="Samples"
          loading={loading}
          error={error ?? undefined}
          emptyMessage="No chopped samples saved yet. Chop a sample and click Save."
          onCreateFolder={handleCreateFolder}
          onDelete={handleDeleteNode}
          onMove={handleMoveNode}
          onRefresh={refreshSamples}
          onSelect={handleSelectSample}
          renderTrailing={renderTrailing}
        />
      </div>
    );
  }

  // --- Tones / Drum Kits tabs via LibraryPanel ---

  const emptyMessage =
    activeTab === 'tones'
      ? 'No tones found in the connected library.'
      : 'No drum kits found in the connected library.';

  const isEmpty =
    activeTab === 'tones'
      ? tones.length === 0
      : drumKits.length === 0;

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
    >
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
