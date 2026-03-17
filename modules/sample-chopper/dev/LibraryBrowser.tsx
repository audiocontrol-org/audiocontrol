/**
 * Library browser panel for the standalone sample chopper.
 *
 * Displays saved chopped samples with open/delete actions.
 * Visible when the library directory is connected.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChoppedSampleInfo } from '@audiocontrol/sampler-library/browser';
import { listChoppedSamples, deleteChoppedSample } from './library.js';

export interface LibraryBrowserProps {
  /** Whether the library directory is connected */
  connected: boolean;
  /** Incremented after save to trigger refresh */
  refreshKey: number;
  /** Called when user wants to open a sample in the chopper */
  onOpen: (name: string) => void;
}

export function LibraryBrowser({ connected, refreshKey, onOpen }: LibraryBrowserProps): JSX.Element | null {
  const [items, setItems] = useState<ChoppedSampleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    listChoppedSamples()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to list samples'))
      .finally(() => setLoading(false));
  }, [connected]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleDelete = useCallback(async (name: string) => {
    try {
      await deleteChoppedSample(name);
      setConfirmDelete(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }, [refresh]);

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

      {loading && <p className="library-browser-status">Loading...</p>}
      {error && <p className="library-browser-error">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="library-browser-status">
          No chopped samples saved yet. Chop a sample and click Save.
        </p>
      )}

      {!loading && items.length > 0 && (
        <ul className="library-browser-list">
          {items.map((item) => (
            <li key={item.name} className="library-browser-item">
              <div className="library-browser-item-info">
                <span className="library-browser-item-name">{item.name}</span>
                <span className="library-browser-item-meta">
                  {item.variant} &middot; {item.sliceCount} slice{item.sliceCount !== 1 ? 's' : ''}
                  {item.description ? ` &middot; ${item.description}` : ''}
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
    </div>
  );
}
