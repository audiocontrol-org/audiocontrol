/**
 * Library browser panel for the standalone sample chopper.
 *
 * Tabbed interface showing chopped samples, tones, and drum kits
 * from the connected FSAA library directory.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChoppedSampleInfo } from '@audiocontrol/sampler-library/browser';
import { listChoppedSamples, deleteChoppedSample } from './library.js';
import {
  listLibraryTones,
  listLibraryDrumKits,
  type LibraryToneInfo,
  type LibraryDrumKitInfo,
} from './library-imports.js';

type Tab = 'samples' | 'tones' | 'drum-kits';

export interface LibraryBrowserProps {
  connected: boolean;
  refreshKey: number;
  onOpen: (name: string) => void;
  onOpenTone: (device: string, name: string, path: string[]) => void;
  onOpenDrumKit: (device: string, name: string, path: string[]) => void;
}

function DeviceBadge({ device }: { device: string }): JSX.Element {
  const label = device === 's330' ? 'S-330' : device === 's550' ? 'S-550' : device.toUpperCase();
  return <span className="library-device-badge">{label}</span>;
}

export function LibraryBrowser({
  connected,
  refreshKey,
  onOpen,
  onOpenTone,
  onOpenDrumKit,
}: LibraryBrowserProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<Tab>('samples');
  const [items, setItems] = useState<ChoppedSampleInfo[]>([]);
  const [tones, setTones] = useState<LibraryToneInfo[]>([]);
  const [drumKits, setDrumKits] = useState<LibraryDrumKitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refreshSamples = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    listChoppedSamples()
      .then(setItems)
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

  const handleDelete = useCallback(async (name: string) => {
    try {
      await deleteChoppedSample(name);
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

  if (!connected) return null;

  return (
    <div className="library-browser">
      <div className="library-browser-header">
        <h2>Library</h2>
        <button className="library-browser-refresh" onClick={refresh} disabled={loading} title="Refresh">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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

      {/* Samples tab */}
      {activeTab === 'samples' && !loading && !error && (
        <>
          {items.length === 0 && (
            <p className="library-browser-status">
              No chopped samples saved yet. Chop a sample and click Save.
            </p>
          )}
          {items.length > 0 && (
            <ul className="library-browser-list">
              {items.map((item) => (
                <li key={item.name} className="library-browser-item">
                  <div className="library-browser-item-info">
                    <span className="library-browser-item-name">{item.name}</span>
                    <span className="library-browser-item-meta">
                      {item.variant} &middot; {item.sliceCount} slice{item.sliceCount !== 1 ? 's' : ''}
                      {item.description ? ` \u00b7 ${item.description}` : ''}
                    </span>
                  </div>
                  <div className="library-browser-item-actions">
                    <button
                      className="library-browser-action open"
                      onClick={() => onOpen(item.name)}
                      title="Open in chopper"
                    >
                      Open
                    </button>
                    {confirmDelete === item.name ? (
                      <>
                        <button
                          className="library-browser-action danger"
                          onClick={() => handleDelete(item.name)}
                        >
                          Confirm
                        </button>
                        <button
                          className="library-browser-action"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="library-browser-action"
                        onClick={() => setConfirmDelete(item.name)}
                        title="Delete"
                      >
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Tones tab */}
      {activeTab === 'tones' && !loading && !error && (
        <>
          {tones.length === 0 && (
            <p className="library-browser-status">
              No tones found. Connect a library with tones in library/s330/tones/ or library/s550/tones/.
            </p>
          )}
          {tones.length > 0 && (
            <ul className="library-browser-list">
              {tones.map((tone) => (
                <li key={`${tone.device}/${tone.path.join('/')}/${tone.name}`} className="library-browser-item">
                  <div className="library-browser-item-info">
                    <span className="library-browser-item-name">
                      <DeviceBadge device={tone.device} />
                      {tone.name}
                    </span>
                    <span className="library-browser-item-meta">
                      {tone.sampleRate ? `${tone.sampleRate} Hz` : 'tone'}
                      {tone.path.length > 0 ? ` \u00b7 ${tone.path.join('/')}` : ''}
                    </span>
                  </div>
                  <div className="library-browser-item-actions">
                    <button
                      className="library-browser-action open"
                      onClick={() => onOpenTone(tone.device, tone.name, tone.path)}
                      title="Open in chopper"
                    >
                      Open
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Drum Kits tab */}
      {activeTab === 'drum-kits' && !loading && !error && (
        <>
          {drumKits.length === 0 && (
            <p className="library-browser-status">
              No drum kits found. Connect a library with kits in library/s330/drum-kits/ or library/s550/drum-kits/.
            </p>
          )}
          {drumKits.length > 0 && (
            <ul className="library-browser-list">
              {drumKits.map((kit) => (
                <li key={`${kit.device}/${kit.path.join('/')}`} className="library-browser-item">
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
                        onClick={() => onOpenDrumKit(kit.device, kit.name, kit.path)}
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
