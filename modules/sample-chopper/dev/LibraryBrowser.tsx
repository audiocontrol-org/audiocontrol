/**
 * Library browser panel for the standalone sample chopper.
 *
 * Tabbed interface showing chopped samples, tones, and drum kits
 * from the connected FSAA library directory.
 */

import { useCallback, useEffect, useState } from 'react';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';
import {
  listChoppedSamples,
  deleteChoppedSample,
  createSamplesFolder,
  listLibraryTones,
  listLibraryDrumKits,
  type LibraryToneInfo,
  type LibraryDrumKitInfo,
} from './library.js';

type Tab = 'samples' | 'tones' | 'drum-kits';

export interface LibraryBrowserProps {
  connected: boolean;
  refreshKey: number;
  onOpen: (name: string, path: string[]) => void;
  onOpenTone: (tone: LibraryToneInfo) => void;
  onOpenDrumKit: (kit: LibraryDrumKitInfo) => void;
  onPathChange?: (path: string[]) => void;
}

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

// =========================================================================
// Tree node component for samples tab
// =========================================================================

interface SampleTreeNodeProps {
  node: LibraryTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (name: string, path: string[]) => void;
  onDelete: (name: string, path: string[]) => void;
  confirmDelete: string | null;
  onConfirmDelete: (id: string | null) => void;
}

function SampleTreeNode({
  node,
  depth,
  expandedPaths,
  onToggle,
  onOpen,
  onDelete,
  confirmDelete,
  onConfirmDelete,
}: SampleTreeNodeProps): JSX.Element {
  const isExpanded = expandedPaths.has(node.id);

  if (node.type === 'directory') {
    return (
      <>
        <li
          className="library-browser-item library-tree-folder"
          style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
          onClick={() => onToggle(node.id)}
        >
          <div className="library-browser-item-info">
            <span className="library-browser-item-name">
              <span className={`library-tree-chevron ${isExpanded ? 'expanded' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {node.name}
            </span>
          </div>
        </li>
        {isExpanded && node.children?.map((child) => (
          <SampleTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onToggle={onToggle}
            onOpen={onOpen}
            onDelete={onDelete}
            confirmDelete={confirmDelete}
            onConfirmDelete={onConfirmDelete}
          />
        ))}
      </>
    );
  }

  const nodeId = node.id;
  const dirName = node.directoryName ?? node.name;

  return (
    <li
      className="library-browser-item"
      style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
    >
      <div className="library-browser-item-info">
        <span className="library-browser-item-name">{node.name}</span>
        <span className="library-browser-item-meta">
          {node.variant} &middot; {node.sliceCount} slice{node.sliceCount !== 1 ? 's' : ''}
          {node.description ? ` \u00b7 ${node.description}` : ''}
        </span>
      </div>
      <div className="library-browser-item-actions">
        <button
          className="library-browser-action open"
          onClick={() => onOpen(dirName, node.path)}
          title="Open in chopper"
        >
          Open
        </button>
        {confirmDelete === nodeId ? (
          <>
            <button
              className="library-browser-action danger"
              onClick={() => onDelete(dirName, node.path)}
            >
              Confirm
            </button>
            <button
              className="library-browser-action"
              onClick={() => onConfirmDelete(null)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="library-browser-action"
            onClick={() => onConfirmDelete(nodeId)}
            title="Delete"
          >
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

// =========================================================================
// Main component
// =========================================================================

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

  const updatePath = useCallback((path: string[]) => {
    setCurrentPath(path);
    onPathChange?.(path);
  }, [onPathChange]);

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

  const handleDelete = useCallback(async (name: string, path: string[]) => {
    try {
      await deleteChoppedSample(name, path);
      setConfirmDelete(null);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [refreshSamples]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setError(null);
    setConfirmDelete(null);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt('New folder name:');
    if (!name) return;
    try {
      await createSamplesFolder(currentPath, name);
      refreshSamples();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  }, [currentPath, refreshSamples]);

  // Update currentPath when a directory is toggled (last expanded directory = current target)
  useEffect(() => {
    // Derive currentPath from the deepest expanded directory
    // This is a simple heuristic; the user's last toggle determines the save target
  }, [expandedPaths]);

  if (!connected) return null;

  const hasAnySamples = samplesTree.length > 0;

  return (
    <div className="library-browser">
      <div className="library-browser-header">
        <h2>Library</h2>
        <div className="library-browser-header-actions">
          {activeTab === 'samples' && (
            <button
              className="library-browser-new-folder"
              onClick={handleNewFolder}
              title="New folder"
            >
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="11" x2="12" y2="17" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="9" y1="14" x2="15" y2="14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button className="library-browser-refresh" onClick={refresh} disabled={loading} title="Refresh">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="library-tab-bar">
        <button
          className={`library-tab ${activeTab === 'samples' ? 'active' : ''}`}
          onClick={() => handleTabChange('samples')}
        >
          Samples
        </button>
        <button
          className={`library-tab ${activeTab === 'tones' ? 'active' : ''}`}
          onClick={() => handleTabChange('tones')}
        >
          Tones
        </button>
        <button
          className={`library-tab ${activeTab === 'drum-kits' ? 'active' : ''}`}
          onClick={() => handleTabChange('drum-kits')}
        >
          Drum Kits
        </button>
      </div>

      {loading && <p className="library-browser-status">Loading...</p>}
      {error && <p className="library-browser-error">{error}</p>}

      {/* Samples tab — tree rendering */}
      {activeTab === 'samples' && !loading && !error && (
        <>
          {!hasAnySamples && (
            <p className="library-browser-status">
              No chopped samples saved yet. Chop a sample and click Save.
            </p>
          )}
          {hasAnySamples && (
            <ul className="library-browser-list">
              {samplesTree.map((node) => (
                <SampleTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedPaths={expandedPaths}
                  onToggle={handleToggle}
                  onOpen={onOpen}
                  onDelete={handleDelete}
                  confirmDelete={confirmDelete}
                  onConfirmDelete={setConfirmDelete}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* Tones tab */}
      {activeTab === 'tones' && !loading && !error && (
        <>
          {tones.length === 0 && (
            <p className="library-browser-status">No tones found in the connected library.</p>
          )}
          {tones.length > 0 && (
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
        </>
      )}

      {/* Drum Kits tab */}
      {activeTab === 'drum-kits' && !loading && !error && (
        <>
          {drumKits.length === 0 && (
            <p className="library-browser-status">No drum kits found in the connected library.</p>
          )}
          {drumKits.length > 0 && (
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
        </>
      )}
    </div>
  );
}
